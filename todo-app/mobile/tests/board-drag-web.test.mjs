import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/board/board-drag-cell.web.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });

function harness() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const listeners = new Map();
  const frames = new Map();
  const captures = new Set();
  const calls = [];
  let nextFrame = 0;
  let now = 1000;
  const root = {
    style: {}, dataset: {},
    getBoundingClientRect: () => ({ x: 100, y: 200, width: 340, height: 250 }),
    setPointerCapture: (id) => captures.add(id), hasPointerCapture: (id) => captures.has(id), releasePointerCapture: (id) => captures.delete(id),
    addEventListener() {}, removeEventListener() {},
  };
  const content = { style: {} };
  const effect = (fn, deps) => {
    const index = cursor++;
    const old = slots[index];
    if (!old || deps.some((dep, i) => dep !== old.deps[i])) effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
  };
  const mocks = {
    react: {
      useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
      useLayoutEffect: effect, useEffect: effect,
      useCallback(fn, deps) { const index = cursor++; if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) slots[index] = { deps, fn }; return slots[index].fn; },
    },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
    "react/jsx-runtime": require("react/jsx-runtime"),
  };
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, require: (id) => mocks[id], performance: { now: () => now },
    window: {
      addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
      removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    },
    requestAnimationFrame(fn) { frames.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame(id) { frames.delete(id); },
  });
  const props = {
    id: "a", name: "Board A", enabled: true, active: false, width: 340, target: false,
    onRegister: () => () => {}, onStart: (id, point) => calls.push(["start", id, point.x, point.y]),
    onMove: (x, y) => calls.push(["move", x, y]), onDrop: (x, y) => calls.push(["drop", x, y]), onCancel: () => calls.push(["cancel"]),
  };
  return {
    root, content, calls, frames, captures,
    render(overrides = {}) {
      cursor = 0; effects = [];
      const tree = exports.BoardDragCell({ ...props, ...overrides });
      tree.props.ref.current = root;
      tree.props.children[2].props.ref.current = content;
      effects.forEach((fn) => fn());
      return tree;
    },
    dispatch(name, event = {}) { for (const fn of [...listeners.get(name) ?? []]) fn(event); },
    paint() { const work = [...frames.values()]; frames.clear(); work.forEach((fn) => fn()); },
    listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
    advance(milliseconds) { now += milliseconds; },
  };
}
function pointer(x, y, extra = {}) {
  return { pointerId: 1, button: 0, isPrimary: true, clientX: x, clientY: y, preventDefault() {}, stopPropagation() {}, ...extra };
}

test("web drag keeps its pickup offset and coalesces pointer bursts into one frame", () => {
  const h = harness();
  const tree = h.render();
  assert.match(tree.props.children[0].props.children, /cursor:grab/);
  assert.match(tree.props.children[0].props.children, /cursor:grabbing/);
  tree.props.onPointerDownCapture(pointer(110, 215));
  h.dispatch("pointermove", pointer(112, 217));
  assert.equal(h.calls.length, 0, "small pointer jitter must stay a normal click");
  for (let step = 1; step <= 100; step++) h.dispatch("pointermove", pointer(110 + step, 215 + step));
  assert.equal(h.frames.size, 1);
  assert.equal(h.calls.filter(([action]) => action === "move").length, 0);
  assert.equal(h.root.dataset.dragging, "true");
  assert.ok(h.captures.has(1));
  h.paint();
  assert.equal(h.content.style.transform, "translate3d(100px, 100px, 0)");
  assert.deepEqual(h.calls, [["start", "a", 110, 215], ["move", 210, 315]]);
  // The original 10px/15px grab offset is unchanged after translation.
  assert.equal(100 + 100 + 10, 210);
  assert.equal(200 + 100 + 15, 315);
  h.dispatch("pointerup", pointer(215, 320));
  assert.deepEqual(h.calls.at(-1), ["drop", 215, 320]);
  assert.equal(h.content.style.transform, "");
  assert.equal(h.listenerCount(), 0);
  assert.equal(h.captures.size, 0);
  assert.equal(h.root.dataset.dragging, "false");
});

test("web drag supports repeated gestures, final-pointer drops and canceled frames", () => {
  const h = harness();
  let tree = h.render();
  for (let attempt = 0; attempt < 5; attempt++) {
    tree.props.onPointerDownCapture(pointer(120, 220));
    h.dispatch("pointermove", pointer(320, 420));
    h.dispatch("pointerup", pointer(330, 430));
    assert.equal(h.frames.size, 0, "a drop must cancel its pending paint");
    tree = h.render();
  }
  assert.equal(h.calls.filter(([action]) => action === "drop").length, 5);
  assert.deepEqual(h.calls.at(-1), ["drop", 330, 430]);
  tree.props.onPointerDownCapture(pointer(120, 220));
  h.dispatch("pointermove", pointer(320, 420));
  h.dispatch("keydown", { key: "Escape" });
  assert.deepEqual(h.calls.at(-1), ["cancel"]);
  h.paint();
  assert.equal(h.content.style.transform, "");
  assert.equal(h.listenerCount(), 0);
});

test("normal control clicks remain available; only drag-generated clicks are blocked", () => {
  const h = harness();
  const tree = h.render();
  let blocked = 0;
  const click = { detail: 1, preventDefault: () => blocked++, stopPropagation() {} };
  tree.props.onPointerDownCapture(pointer(120, 220));
  h.dispatch("pointerup", pointer(120, 220));
  tree.props.onClickCapture(click);
  assert.equal(blocked, 0);
  tree.props.onPointerDownCapture(pointer(120, 220));
  h.dispatch("pointermove", pointer(320, 420));
  h.dispatch("pointerup", pointer(320, 420));
  tree.props.onClickCapture(click);
  assert.equal(blocked, 1);
  h.advance(400);
  tree.props.onClickCapture(click);
  assert.equal(blocked, 1);
  const disabled = h.render({ enabled: false });
  disabled.props.onPointerDownCapture(pointer(120, 220));
  assert.equal(h.listenerCount(), 0);
});
