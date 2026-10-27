import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const context = {};
vm.runInNewContext(await compile("../src/lib/features/ribbon-context.ts"), { exports: context });
const source = await compile("../src/components/board/mobile-board-ribbon.tsx");
const sameDeps = (a, b) => a && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

function setup() {
  const slots = [];
  const timers = new Map();
  let cursor = 0;
  let nextTimer = 0;
  let effects = [];
  const props = { mode: "board", query: "", zoom: 1, selecting: false, selection: "Selection tools", children: "Action tools", filters: "Filter tools" };
  props.onSelect = () => { props.selecting = true; };
  props.onDeselect = () => { props.selecting = false; };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: effect() };
      });
    },
  };
  const colors = new Proxy({}, { get: () => "#888888" });
  const mocks = {
    react, "@expo/vector-icons": { Ionicons: "Icon", MaterialCommunityIcons: "Icon" },
    "react-native": { Pressable: "Pressable", ScrollView: "ScrollView", View: "View", Text: "Text", TextInput: "TextInput", StyleSheet: { create: (styles) => styles }, useWindowDimensions: () => ({ width: 400, fontScale: 1 }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0 }) },
    "./mobile-board-colors": { useMobileBoardColors: () => colors }, "@/lib/features/ribbon-context": context,
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: (id) => mocks[id] ?? require(id),
    setTimeout: (callback) => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    props, timers,
    render() { cursor = 0; effects = []; const tree = exports.MobileBoardRibbon(props); effects.forEach((effect) => effect()); return tree; },
    elapse() { const pending = [...timers.values()]; timers.clear(); pending.forEach((callback) => callback()); },
  };
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const button = (tree, label) => nodes(tree).find((node) => node.props?.accessibilityLabel === label);
const hasSelection = (tree) => JSON.stringify(tree).includes("Selection tools");

test("Select cancels pending auto-hide and stays open during inactivity and interaction", () => {
  const app = setup();
  let tree = app.render();
  assert.equal(app.timers.size, 1);
  button(tree, "Select tasks").props.onPress();
  tree = app.render();
  assert.equal(app.timers.size, 0);
  assert.equal(hasSelection(tree), true);
  tree.props.onPointerDown();
  assert.equal(app.timers.size, 0);
  app.elapse();
  tree = app.render();
  assert.equal(hasSelection(tree), true);
  assert.equal(button(tree, "Pin ribbon open").props.accessibilityState.checked, false);
});

test("leaving Select resumes normal auto-hide", () => {
  const app = setup();
  let tree = app.render();
  button(tree, "Select tasks").props.onPress();
  tree = app.render();
  button(tree, "Actions tools").props.onPress();
  tree = app.render();
  assert.equal(app.timers.size, 1);
  assert.equal(JSON.stringify(tree).includes("Action tools"), true);
  app.elapse();
  tree = app.render();
  assert.equal(JSON.stringify(tree).includes("Action tools"), false);
});

test("selection forces an already collapsed ribbon open", () => {
  const app = setup();
  app.render(); app.elapse(); app.render();
  app.props.selecting = true;
  const tree = app.render();
  assert.equal(hasSelection(tree), true);
  assert.equal(app.timers.size, 0);
});

test("manual pinning still keeps the ribbon open after selection ends", () => {
  const app = setup();
  let tree = app.render();
  button(tree, "Select tasks").props.onPress();
  tree = app.render();
  button(tree, "Pin ribbon open").props.onPress();
  tree = app.render();
  button(tree, "Actions tools").props.onPress();
  tree = app.render();
  assert.equal(app.timers.size, 0);
  assert.equal(button(tree, "Unpin ribbon").props.accessibilityState.checked, true);
  app.elapse();
  assert.equal(JSON.stringify(app.render()).includes("Action tools"), true);
});
