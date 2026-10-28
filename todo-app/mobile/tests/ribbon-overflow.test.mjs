import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/ui/ribbon-scroll-view.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function setup() {
  const slots = [];
  let cursor = 0;
  let interactions = 0;
  const moves = [];
  const mocks = {
    react: {
      useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
      useCallback: (fn) => fn,
      useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
    },
    "react-native": { View: "View", Pressable: "Pressable", ScrollView: "ScrollView", StyleSheet: { create: (value) => value } },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (id) => id === "react/jsx-runtime" ? require(id) : mocks[id] });
  let tree;
  const render = () => {
    cursor = 0;
    tree = exports.RibbonScrollView({ accessibilityLabel: "Ribbon tools", onInteraction: () => interactions++, children: "Tools" });
    nodes(tree).find((node) => node.type === "ScrollView").props.ref.current = { scrollTo: (position) => moves.push(position) };
    return tree;
  };
  render();
  return {
    render, moves, get interactions() { return interactions; },
    measure(outer, content, viewport = outer) {
      tree.props.onLayout({ nativeEvent: { layout: { width: outer } } });
      const scroll = nodes(tree).find((node) => node.type === "ScrollView");
      scroll.props.onContentSizeChange(content);
      scroll.props.onLayout({ nativeEvent: { layout: { width: viewport } } });
      return render();
    },
    scroll(offset, viewport) { nodes(tree).find((node) => node.type === "ScrollView").props.onScroll({ nativeEvent: { contentOffset: { x: offset }, layoutMeasurement: { width: viewport } } }); return render(); },
  };
}
const buttons = (tree) => nodes(tree).filter((node) => node.type === "Pressable");

test("fitting tool strips do not advertise nonexistent overflow", () => {
  const app = setup();
  assert.equal(buttons(app.measure(600, 400)).length, 0);
  assert.equal(buttons(app.measure(400, 400)).length, 0);
});

test("overflow arrows reveal hidden tools, clamp at either end and survive resize", () => {
  const app = setup();
  let tree = app.measure(320, 900, 232);
  let [left, right] = buttons(tree);
  assert.equal(left.props.disabled, true);
  assert.equal(right.props.disabled, false);
  assert.equal(right.props.accessibilityLabel, "Scroll Ribbon tools right");
  right.props.onPress();
  assert.ok(app.moves[0].x > 0 && app.moves[0].x < 668);
  assert.equal(app.interactions, 1);
  tree = app.scroll(668, 232);
  [left, right] = buttons(tree);
  assert.equal(left.props.disabled, false);
  assert.equal(right.props.disabled, true);
  left.props.onPress();
  assert.ok(app.moves[1].x < 668 && app.moves[1].x >= 0);
  assert.equal(buttons(app.measure(1200, 900)).length, 0, "arrows disappear after widening the viewport");
  assert.equal(buttons(app.measure(320, 200)).length, 0, "changing to a shorter tool strip removes stale arrows");
});
