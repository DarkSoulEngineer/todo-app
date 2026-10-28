import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (id) => {
    if (id === "react/jsx-runtime") return require(id);
    assert.ok(id in mocks, `Unexpected import ${id}`);
    return mocks[id];
  } });
  return exports;
}
const geometry = await load("../src/lib/features/board-drag.ts");
const ordering = await load("../src/lib/features/board-layout.ts");
const rects = new Map([
  ["a", { x: 0, y: 0, width: 340, height: 250 }],
  ["b", { x: 356, y: 0, width: 340, height: 270 }],
  ["c", { x: 0, y: 286, width: 340, height: 250 }],
  ["d", { x: 356, y: 286, width: 340, height: 250 }],
]);

test("drop geometry works across columns, rows and variable-height cards", () => {
  assert.equal(geometry.pointerBoardDropTarget(rects, "a", 526, 125), "b");
  assert.equal(geometry.pointerBoardDropTarget(rects, "a", 170, 411), "c");
  assert.equal(geometry.pointerBoardDropTarget(rects, "a", 526, 411), "d");
  assert.equal(geometry.pointerBoardDropTarget(rects, "a", 350, 125), "b", "gutters snap to the closest slot");
  assert.equal(geometry.pointerBoardDropTarget(rects, "a", 350, 296), "d", "mouse near the slot edge still snaps");
  for (const [x, y] of [[170, 125], [-230, 125], [170, 1025], [NaN, 0]]) {
    assert.equal(geometry.pointerBoardDropTarget(rects, "a", x, y), null);
  }
  assert.equal(geometry.pointerBoardDropTarget(rects, "missing", 0, 0), null);
});

test("drop inserts rather than swaps; closed and stale boards cannot be dragged", () => {
  const original = { cols: 3, order: ["a", "closed", "b", "c", "d"] };
  const open = ["a", "b", "c", "d"];
  const next = ordering.dropBoardInLayout(original, "a", "d", open);
  assert.deepEqual(Array.from(next.order), ["closed", "b", "c", "d", "a"]);
  assert.deepEqual(Array.from(ordering.dropBoardInLayout(next, "a", "b", open).order), ["closed", "a", "b", "c", "d"]);
  for (const [id, target] of [["closed", "a"], ["a", "closed"], ["a", "missing"], ["a", "a"]]) {
    assert.equal(ordering.dropBoardInLayout(original, id, target, open), original);
  }
  assert.deepEqual(original.order, ["a", "closed", "b", "c", "d"]);
});

function hooks() {
  const slots = [];
  let index = 0;
  let effects = [];
  let writes = 0;
  const effect = (fn, deps) => {
    const slot = index++;
    const previous = slots[slot];
    if (!previous || deps.some((value, i) => value !== previous.deps[i])) effects.push(() => { previous?.cleanup?.(); slots[slot] = { deps, cleanup: fn() }; });
  };
  const memo = (fn, deps) => {
    const slot = index++;
    if (!slots[slot] || deps.some((value, i) => value !== slots[slot].deps[i])) slots[slot] = { deps, value: fn() };
    return slots[slot].value;
  };
  return {
    react: {
      useRef(initial) { const slot = index++; return slots[slot] ??= { current: initial }; },
      useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], (value) => { writes++; slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }]; },
      useCallback: (fn, deps) => memo(() => fn, deps), useMemo: memo,
      useEffect: effect, useLayoutEffect: effect,
    },
    render(fn) { index = 0; effects = []; const result = fn(); effects.forEach((effect) => effect()); return result; },
    get writes() { return writes; },
  };
}

test("pointer drag saves only a valid drop and cancels on termination or resize", async () => {
  const state = hooks();
  const { useBoardGridDrag } = await load("../src/hooks/use-board-grid-drag.ts", { react: state.react, "@/lib/features/board-drag": geometry });
  const saves = [];
  const save = (id, target) => saves.push([id, target]);
  let width = 340;
  const render = () => state.render(() => useBoardGridDrag(true, ["a", "b", "c", "d"], width, save));
  let drag = render();
  for (const [id, rect] of rects) drag.register(id, (receive) => receive(rect));
  drag.start("a", { x: 170, y: 125 });
  drag = render();
  assert.equal(drag.drag.id, "a");
  drag.move(526, 411);
  drag = render();
  assert.equal(drag.drag.target, "d");
  const writes = state.writes;
  for (let step = 0; step < 100; step++) drag.move(526 + step % 10, 411);
  assert.equal(state.writes, writes, "pointer motion within a slot must not rerender the grid");
  assert.equal(saves.length, 0, "moving must not write storage");
  drag.drop(526, 411);
  drag = render();
  assert.equal(drag.drag, null);
  assert.deepEqual(saves, [["a", "d"]]);
  drag.start("a", { x: 170, y: 125 }); drag.move(170, 411); drag.cancel(); drag.drop(170, 411);
  assert.equal(saves.length, 1);
  drag.start("a", { x: 170, y: 125 }); width = 400; render(); drag = render();
  assert.equal(drag.drag, null);
  drag.drop(356, 0);
  assert.equal(saves.length, 1);
  drag.start("a", { x: 170, y: 125 }); drag.drop(-1000, 0);
  assert.equal(saves.length, 1, "dropping outside the grid must not reorder");
});

test("successive drags remeasure moved and scrolled cards without relying on onLayout", async () => {
  const state = hooks();
  const { useBoardGridDrag } = await load("../src/hooks/use-board-grid-drag.ts", { react: state.react, "@/lib/features/board-drag": geometry });
  let ids = ["a", "b", "c", "d"];
  let positions = new Map(rects);
  let measurements = 0;
  const saves = [];
  const save = (id, target) => {
    saves.push([id, target]);
    const next = ids.filter((key) => key !== id);
    next.splice(ids.indexOf(target), 0, id);
    ids = next;
  };
  const render = () => state.render(() => useBoardGridDrag(true, ids, 340, save));
  let drag = render();
  for (const id of ids) drag.register(id, (receive) => { measurements++; receive(positions.get(id)); });
  const slots = [...rects.values()];
  for (let attempt = 0; attempt < 8; attempt++) {
    // Update browser positions without emitting any React Native onLayout events.
    positions = new Map(ids.map((id, index) => [id, { ...slots[index], y: slots[index].y + attempt * 37 }]));
    drag = render();
    const id = ids[0];
    const target = ids.at(-1);
    const start = positions.get(id);
    const end = positions.get(target);
    drag.start(id, { x: start.x + 8, y: start.y + 8 });
    drag.move(end.x + 10, end.y + 10);
    assert.equal(render().drag.target, target);
    drag.drop(end.x + 10, end.y + 10);
    assert.equal(saves.length, attempt + 1);
    assert.deepEqual(saves.at(-1), [id, target]);
    render();
  }
  assert.equal(measurements, 8 * 4, "each drag needs fresh positions for every card");
});

test("async measurements honor release and ignore canceled sessions", async () => {
  const state = hooks();
  const { useBoardGridDrag } = await load("../src/hooks/use-board-grid-drag.ts", { react: state.react, "@/lib/features/board-drag": geometry });
  const pending = [];
  const saves = [];
  const save = (...args) => saves.push(args);
  const render = () => state.render(() => useBoardGridDrag(true, ["a", "b"], 340, save));
  let drag = render();
  for (const id of ["a", "b"]) drag.register(id, (receive) => pending.push(() => receive(rects.get(id))));
  drag.start("a", { x: 10, y: 10 });
  drag.drop(400, 20);
  assert.equal(saves.length, 0);
  pending.splice(0).forEach((receive) => receive());
  assert.deepEqual(saves, [["a", "b"]]);
  drag = render();
  drag.start("a", { x: 10, y: 10 });
  drag.cancel();
  pending.splice(0).forEach((receive) => receive());
  drag.drop(400, 20);
  assert.equal(saves.length, 1);
});

test("whole-card dragging waits for movement so clicks still reach card controls", async () => {
  const state = hooks();
  let events;
  const calls = [];
  const grabs = [];
  const { BoardDragCell } = await load("../src/components/board/board-drag-cell.tsx", {
    react: state.react,
    "react-native": { View: "View", Animated: { View: "AnimatedView", ValueXY: class {
      value = { x: 0, y: 0 };
      setValue(value) { this.value = value; }
      getTranslateTransform() { return [{ translateX: this.value.x }, { translateY: this.value.y }]; }
    } }, Platform: { OS: "web" }, StyleSheet: { create: (value) => value, absoluteFill: {} }, PanResponder: { create: (value) => { events = value; return { panHandlers: {} }; } } },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: { mutedForeground: "#888888" } } }) },
  });
  const props = { id: "a", name: "Board A", width: 340, enabled: true, onRegister: () => () => {}, onStart: (id, grab) => { calls.push(["start", id]); grabs.push(grab); }, onMove: (dx, dy) => calls.push(["move", dx, dy]), onDrop: (dx, dy) => calls.push(["drop", dx, dy]), onCancel: () => calls.push(["cancel"]) };
  const tree = state.render(() => BoardDragCell({ ...props, children: "Card content" }));
  tree.props.ref.current = { measureInWindow: (callback) => callback(10, 20, 340, 250) };
  assert.equal(tree.props.testID, "board-drag-cell-a");
  assert.equal(events.onStartShouldSetPanResponder(), false);
  assert.equal(events.onMoveShouldSetPanResponder(null, { dx: 2, dy: 2 }), false);
  assert.equal(events.onMoveShouldSetPanResponder(null, { dx: 8, dy: 0 }), true);
  assert.equal(events.onMoveShouldSetPanResponderCapture(null, { dx: 0, dy: 8 }), true);
  events.onPanResponderGrant(null, { x0: 20, y0: 30 });
  assert.equal(grabs[0].x, 20);
  assert.equal(grabs[0].y, 30);
  events.onPanResponderMove(null, { dx: 356, dy: 286 });
  events.onPanResponderRelease(null, { dx: 356, dy: 286 });
  events.onPanResponderTerminate();
  assert.deepEqual(calls, [["start", "a"], ["move", 376, 316], ["drop", 376, 316], ["cancel"]]);
  state.render(() => BoardDragCell({ ...props, enabled: false }));
  assert.equal(events.onStartShouldSetPanResponder(), false);
  assert.equal(events.onMoveShouldSetPanResponderCapture(null, { dx: 100, dy: 100 }), false);
  state.render(() => BoardDragCell({ ...props, active: true }));
  events.onPanResponderGrant(null, { x0: 20, y0: 30 });
  events.onPanResponderMove(null, { dx: 356, dy: 286 });
  const moving = state.render(() => BoardDragCell({ ...props, active: true }));
  assert.equal(moving.props.children[0].props.testID, "board-drag-placeholder-a");
  const transform = Object.assign({}, ...moving.props.children[1].props.style.filter(Boolean)).transform;
  assert.equal(10 + 10 + transform[0].translateX, 376, "original grab point must follow cursor X");
  assert.equal(20 + 10 + transform[1].translateY, 316, "original grab point must follow cursor Y");
  events.onPanResponderTerminate();
  state.render(() => BoardDragCell({ ...props, active: false }));
  events.onStartShouldSetPanResponderCapture({ nativeEvent: { pageX: 100, pageY: 200 } });
  events.onPanResponderGrant(null, { x0: 106, y0: 206 });
  events.onPanResponderMove(null, { dx: 50, dy: 40, moveX: 156, moveY: 246 });
  const repeated = state.render(() => BoardDragCell({ ...props, active: true }));
  const repeatedTransform = Object.assign({}, ...repeated.props.children[1].props.style.filter(Boolean)).transform;
  assert.equal(repeatedTransform[0].translateX, 56);
  assert.equal(repeatedTransform[1].translateY, 46);
});

test("Home saves a successful drop through the existing persisted manager layout", async () => {
  const saved = [];
  const updates = [];
  const layout = { cols: 3, order: ["a", "closed", "b", "c"] };
  let editing = true;
  let ready = true;
  let index = 0;
  const dummy = new Proxy({}, { get: (_, key) => key });
  const projects = layout.order.map((id) => ({ id, name: id, closedAt: id === "closed" ? "2026-10-28" : null, workspace: { tasks: [], sections: [], boards: [] } }));
  const { default: Home } = await load("../app/index.tsx", {
    react: { useRef: (current) => ({ current }), useEffect() {}, useMemo: (fn) => fn(), useState(initial) {
      const slot = index++;
      const overrides = { 7: editing, 9: layout, 10: ready };
      return [slot in overrides ? overrides[slot] : typeof initial === "function" ? initial() : initial, (value) => updates.push([slot, value])];
    } },
    "react-native": { View: "View", Text: "Text", StyleSheet: { create: (value) => value } },
    "expo-router": {}, "expo-blur": dummy,
    "@/components/board/board-manager-content": { BoardManagerContent: "BoardManagerContent" },
    "@/components/janus-board-ui": dummy,
    "@/components/ui/button": dummy, "@/components/ui/input": dummy, "@/components/ui/sheet": dummy, "@/components/ui/atmosphere": dummy,
    "@/components/reference/mobile/reference-mobile-bottom-nav": dummy, "@/components/setup/welcome-screen": dummy,
    "@/providers/tasks-provider": { useTasksContext: () => ({ projects, tasks: [], sections: [], boards: [], isLoading: false, currentProjectId: "a" }) },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
    "@/providers/toast-provider": { useToast: () => ({}) },
    "@/lib/data/transfer": {}, "@/lib/features/board-layout": ordering,
    "@/lib/data/manager-state": { getWorkspaceMetrics: () => ({}), saveManagerLayout: (value) => saved.push(value) },
  });
  function content() {
    index = 0;
    const tree = Home();
    return tree.props.children[0].props.children.find((node) => node?.type === "BoardManagerContent");
  }
  content().props.onReorder("a", "c");
  assert.equal(saved.length, 1);
  assert.deepEqual(Array.from(saved[0].order), ["closed", "b", "c", "a"]);
  assert.ok(updates.some(([slot, value]) => slot === 9 && value === saved[0]));
  content().props.onReorder("a", "closed");
  content().props.onReorder("a", "a");
  editing = false; content().props.onReorder("a", "c");
  editing = true; ready = false; content().props.onReorder("a", "c");
  assert.equal(saved.length, 1, "invalid, non-arrange and unhydrated drops must not write storage");
});

test("native section drags use a visual-only overlay and never claim card-body gestures", async () => {
  const state = hooks();
  let events;
  const previews = [];
  let hidden = 0;
  const { JanusDragCell: BoardDragCell } = await load("../src/components/board/janus-drag-cell.tsx", {
    react: state.react,
    "react-native": { View: "View", Animated: { View: "AnimatedView", ValueXY: class {
      setValue() {} getTranslateTransform() { return []; }
    } }, StyleSheet: { create: (value) => value, absoluteFill: {} }, PanResponder: { create: (value) => { events = value; return { panHandlers: {} }; } } },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
  });
  const props = { id: "section:a", name: "A", width: 288, enabled: true, handleHeight: 60, previewLayer: { show: (...args) => previews.push(args), hide: () => hidden++ }, renderPreview: () => "Visual-only section", children: "Live registered children", onRegister: () => () => {}, onStart() {}, onMove() {}, onDrop() {}, onCancel() {} };
  let tree = state.render(() => BoardDragCell(props));
  tree.props.ref.current = { measureInWindow: (receive) => receive(10, 100, 288, 600) };
  events.onStartShouldSetPanResponderCapture({ nativeEvent: { pageX: 30, pageY: 220 } });
  assert.equal(events.onMoveShouldSetPanResponderCapture(null, { dx: 10, dy: 0 }), false);
  events.onStartShouldSetPanResponderCapture({ nativeEvent: { pageX: 30, pageY: 120 } });
  assert.equal(events.onMoveShouldSetPanResponderCapture(null, { dx: 10, dy: 0 }), true);
  events.onPanResponderGrant(null, { x0: 30, y0: 120 });
  tree = state.render(() => BoardDragCell({ ...props, active: true }));
  assert.equal(previews.length, 1);
  assert.equal(previews[0][0], "Visual-only section");
  assert.equal(previews[0][1].width, 288);
  const style = Object.assign({}, ...tree.props.children[1].props.style.filter(Boolean));
  assert.equal(style.transform, undefined, "only the overlay moves, so native scroll views cannot clip it");
  assert.equal(style.opacity, 0.2);
  events.onPanResponderTerminate();
  assert.ok(hidden > 0);
});
