import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: (id) => mocks[id] ?? require(id) });
  return exports;
}
const geometry = await load("../src/lib/features/janus-drag.ts");
const columns = [{ id: "a", taskIds: ["one", "two"] }, { id: "b", taskIds: ["three"] }, { id: "empty", taskIds: [] }];
const rects = new Map([
  ["viewport", { x: 0, y: 0, width: 1000, height: 600 }],
  ...columns.map((column, index) => [`section:${column.id}`, { x: index * 300, y: 40, width: 288, height: 540 }]),
  ["task:one", { x: 10, y: 100, width: 268, height: 100 }],
  ["task:two", { x: 10, y: 208, width: 268, height: 160 }],
  ["task:three", { x: 310, y: 100, width: 268, height: 100 }],
]);

test("card drops insert before/after variable-height cards and into empty lists", () => {
  for (const [x, y, sectionId, beforeTaskId] of [[320, 110, "b", "three"], [320, 190, "b", null], [610, 200, "empty", null], [40, 220, "a", "two"], [40, 350, "a", null]]) {
    assert.deepEqual({ ...geometry.janusDropTarget(rects, "task:one", columns, { x, y }) }, { kind: "task", sectionId, beforeTaskId });
  }
  assert.deepEqual(Array.from(geometry.taskDropOrder("one", ["one", "two"], null)), ["two", "one"]);
  assert.deepEqual(Array.from(geometry.taskDropOrder("one", ["three"], "three")), ["one", "three"]);
  assert.deepEqual(Array.from(geometry.taskDropOrder("one", [], null)), ["one"]);
  assert.equal(geometry.taskDropOrder("one", ["two"], "missing"), null);
});

test("drop hit tests reject stale sources, offscreen lists and outside releases", () => {
  for (const point of [{ x: -1, y: 100 }, { x: 1100, y: 100 }, { x: 10, y: 610 }, { x: 950, y: 100 }, { x: NaN, y: 100 }]) {
    assert.equal(geometry.janusDropTarget(rects, "task:one", columns, point), null);
  }
  assert.equal(geometry.janusDropTarget(rects, "task:missing", columns, { x: 320, y: 100 }), null);
  const scrolled = new Map(rects);
  scrolled.set("task:three", { x: 310, y: -70, width: 268, height: 100 });
  assert.equal(geometry.janusDropTarget(scrolled, "task:one", columns, { x: 320, y: 100 }).beforeTaskId, null);
});

test("list dragging inserts without swapping or moving hidden lists", () => {
  const sections = [{ id: "a" }, { id: "hidden", hidden: true }, { id: "b" }, { id: "empty" }];
  assert.deepEqual(Array.from(geometry.sectionDropOrder(sections, "a", "empty")), ["b", "hidden", "empty", "a"]);
  assert.equal(geometry.sectionDropOrder(sections, "a", "a"), null);
  assert.equal(geometry.sectionDropOrder(sections, "hidden", "a"), null);
  assert.deepEqual({ ...geometry.janusDropTarget(rects, "section:a", columns, { x: 320, y: 110 }) }, { kind: "section", sectionId: "b" });
  assert.equal(geometry.janusDropTarget(rects, "section:a", columns, { x: 30, y: 100 }), null);
});

function hooks() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const memo = (fn, deps) => {
    const index = cursor++;
    if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) slots[index] = { deps, value: fn() };
    return slots[index].value;
  };
  return {
    react: {
      useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
      useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
      useCallback: (fn, deps) => memo(() => fn, deps),
      useEffect(fn, deps) { const index = cursor++; const old = slots[index]; if (!old || deps.some((dep, i) => dep !== old.deps[i])) effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); },
    },
    render(fn) { cursor = 0; effects = []; const result = fn(); effects.forEach((effect) => effect()); return result; },
  };
}

test("drag previews never save, release uses fresh positions, and cancellation never saves", async () => {
  const state = hooks();
  const { useJanusDrag } = await load("../src/hooks/use-janus-drag.ts", { react: state.react, "@/lib/features/janus-drag": geometry });
  const saves = [];
  let enabled = true;
  let layout = "desktop";
  let positions = new Map(rects);
  const render = () => state.render(() => useJanusDrag(enabled, columns, layout, (id, target) => saves.push([id, { ...target }])));
  let drag = render();
  for (const key of rects.keys()) drag.register(key, (receive) => receive(positions.get(key)));
  drag.start("task:one", { x: 50, y: 110 });
  drag.move(320, 110);
  drag = render();
  assert.equal(drag.drag.target.beforeTaskId, "three");
  assert.equal(saves.length, 0);
  positions.set("task:three", { x: 310, y: -70, width: 268, height: 100 });
  drag.drop(320, 110);
  assert.deepEqual(saves, [["task:one", { kind: "task", sectionId: "b", beforeTaskId: null }]]);
  for (const cancel of [() => drag.cancel(), () => { enabled = false; render(); }, () => { layout = "phone"; render(); }]) {
    enabled = true;
    drag = render();
    drag.start("task:one", { x: 50, y: 110 });
    cancel();
    drag.drop(610, 200);
  }
  assert.equal(saves.length, 1);
  assert.equal(render().drag, null);
});

test("release during asynchronous measurements completes once; stale callbacks cannot save", async () => {
  const state = hooks();
  const { useJanusDrag } = await load("../src/hooks/use-janus-drag.ts", { react: state.react, "@/lib/features/janus-drag": geometry });
  const saves = [];
  const pending = [];
  const render = () => state.render(() => useJanusDrag(true, columns, "desktop", (...args) => saves.push(args)));
  let drag = render();
  for (const [key, rect] of rects) drag.register(key, (receive) => pending.push(() => receive(rect)));
  drag.start("task:one", { x: 50, y: 110 });
  drag.drop(610, 200);
  assert.equal(saves.length, 0);
  while (pending.length) pending.splice(0).forEach((receive) => receive());
  assert.equal(saves.length, 1);
  assert.equal(saves[0][1].sectionId, "empty");
  drag = render();
  drag.start("task:one", { x: 50, y: 110 });
  drag.cancel();
  pending.splice(0).forEach((receive) => receive());
  assert.equal(saves.length, 1);
});

test("browser auto-scroll triggers at the actual list edge and ignores unrelated space", async () => {
  const { scrollJanusAtPointer } = await load("../src/lib/features/web-drag-preview.ts");
  const list = { scrollTop: 0, getBoundingClientRect: () => ({ left: 310, right: 598, top: 100, bottom: 500 }) };
  const carousel = { scrollLeft: 0, getBoundingClientRect: () => ({ left: 0, right: 1000, top: 50, bottom: 550 }), querySelectorAll: () => [list] };
  const source = { closest: () => carousel };
  scrollJanusAtPointer(source, 400, 496);
  assert.ok(list.scrollTop > 0, "scroll before the footer, not only on the footer");
  list.scrollTop = 0;
  scrollJanusAtPointer(source, 400, 520);
  assert.ok(list.scrollTop > 0, "the add-card footer is also an edge target");
  scrollJanusAtPointer(source, 996, 200);
  assert.ok(carousel.scrollLeft > 0);
  list.scrollTop = 0;
  carousel.scrollLeft = 0;
  scrollJanusAtPointer(source, 400, 700);
  assert.equal(list.scrollTop, 0);
  assert.equal(carousel.scrollLeft, 0);
});

test("native edge scrolling advances both axes and stops after cancellation", async () => {
  const state = hooks();
  const frames = new Map();
  let nextFrame = 0;
  const source = await readFile(new URL("../src/hooks/use-native-janus-auto-scroll.ts", import.meta.url), "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: (id) => id === "react" ? state.react : { Platform: { OS: "android" } },
    requestAnimationFrame: (fn) => { frames.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame: (id) => frames.delete(id),
  });
  const horizontal = [];
  const vertical = [];
  const moves = [];
  const carousel = { current: { getNativeScrollRef: () => ({ measureInWindow: (receive) => receive(0, 50, 390, 500) }), scrollTo: (value) => horizontal.push(value) } };
  const list = { getNativeScrollRef: () => ({ measureInWindow: (receive) => receive(300, 100, 288, 400) }), scrollTo: (value) => vertical.push(value) };
  const render = (dragging) => state.render(() => exports.useNativeJanusAutoScroll(dragging, carousel, (x, y) => moves.push([x, y])));
  const scroll = render(true);
  scroll.trackCarousel(200);
  scroll.registerList("b", list);
  scroll.trackList("b", 100);
  scroll.trackPointer(386, 496);
  const paint = () => { const work = [...frames.values()]; frames.clear(); work.forEach((fn) => fn()); };
  paint();
  assert.ok(horizontal[0].x > 200);
  assert.ok(vertical[0].y > 100);
  assert.deepEqual(moves, [[386, 496]]);
  render(false);
  assert.equal(frames.size, 0);
  paint();
  assert.equal(horizontal.length, 1);
});
