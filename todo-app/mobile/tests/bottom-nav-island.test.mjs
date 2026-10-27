import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
let insets = { bottom: 0, left: 0, right: 0 };
const colors = { card: "#222222", border: "#444444", shadow: "#000000" };
let scheme = "light";
const referenceTheme = { useReferenceTheme: () => ({ colors: { primary: "purple", muted: "gray" }, type: {} }) };
const mocks = {
  "react-native": { View: "View", Pressable: "Pressable", Text: "Text", StyleSheet: { create: (styles) => styles } },
  "react-native-safe-area-context": { useSafeAreaInsets: () => insets },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors, scheme } }) },
  "expo-blur": { BlurView: "BlurView" },
  "@expo/vector-icons": { Ionicons: "Icon" },
  "@/components/ui/bottom-nav-island": { BottomNavIsland: "BottomNavIsland" },
  "../reference-theme": referenceTheme, "../reference/reference-theme": referenceTheme,
};
async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (id) => mocks[id] ?? require(id) });
  return exports;
}
const { BottomNavIsland } = await load("../src/components/ui/bottom-nav-island.tsx");
const flatten = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}

test("island is centered, width-limited, and has a rounded theme-aware surface", () => {
  const tree = BottomNavIsland({ children: "Tabs" });
  const position = flatten(tree.props.style);
  const surface = flatten(tree.props.children.props.style);
  assert.equal(position.position, "absolute");
  assert.equal(position.alignItems, "center");
  assert.equal(position.paddingLeft, 16);
  assert.equal(position.paddingRight, 16);
  assert.equal(position.paddingBottom, 12);
  assert.equal(surface.width, "100%");
  assert.equal(surface.maxWidth, 256);
  assert.equal(surface.borderRadius, 26);
  const glass = tree.props.children.props.children;
  assert.equal(glass.type, "BlurView");
  assert.equal(glass.props.tint, "light");
  assert.equal(flatten(glass.props.style).overflow, "hidden");
  assert.ok(flatten(glass.props.style).backgroundColor.startsWith("rgba("));
  assert.equal(tree.props.pointerEvents, "box-none");
});

test("glass uses a proper Android target, a safe fallback, and a compact width for four tabs", () => {
  scheme = "dark";
  const target = { current: null };
  const tree = BottomNavIsland({ children: "Tabs", tabCount: 4, blurTarget: target });
  const surface = tree.props.children;
  const glass = surface.props.children;
  assert.equal(flatten(surface.props.style).maxWidth, 336);
  assert.equal(glass.props.tint, "dark");
  assert.equal(glass.props.blurTarget, target);
  assert.equal(glass.props.blurMethod, "dimezisBlurViewSdk31Plus");
  assert.equal(BottomNavIsland({ children: "Tabs" }).props.children.props.children.props.blurMethod, "none");
  scheme = "light";
});

test("island stays clear of bottom and landscape safe areas", () => {
  insets = { bottom: 34, left: 44, right: 44 };
  const position = flatten(BottomNavIsland({ children: "Tabs" }).props.style);
  assert.equal(position.paddingBottom, 34);
  assert.equal(position.paddingLeft, 44);
  assert.equal(position.paddingRight, 44);
  insets = { bottom: 0, left: 0, right: 0 };
});

test("main and board navigation share the island without changing their tab actions", async () => {
  const { ReferenceMobileBottomNav } = await load("../src/components/reference/mobile/reference-mobile-bottom-nav.tsx");
  const { MobileBoardBottomNav } = await load("../src/components/board/mobile-board-bottom-nav.tsx");
  const target = { current: null };
  for (const [render, active, expected] of [
    [(onPress) => ReferenceMobileBottomNav({ active: "top-tasks", onNavigate: onPress, blurTarget: target }), "Top Tasks", ["boards", "top-tasks", "settings"]],
    [(onPress) => MobileBoardBottomNav({ mode: "calendar", onMode: onPress, blurTarget: target }), "Calendar view", ["board", "list", "calendar", "insights"]],
  ]) {
    const calls = [];
    const tree = render((tab) => calls.push(tab));
    assert.equal(tree.type, "BottomNavIsland");
    assert.equal(tree.props.blurTarget, target);
    assert.equal(tree.props.tabCount ?? 3, expected.length);
    const tabs = nodes(tree).filter((node) => node.props?.accessibilityRole === "tab");
    assert.equal(tabs.find((tab) => tab.props.accessibilityLabel === active).props.accessibilityState.selected, true);
    tabs.forEach((tab) => tab.props.onPress());
    assert.deepEqual(calls, expected);
  }
});
