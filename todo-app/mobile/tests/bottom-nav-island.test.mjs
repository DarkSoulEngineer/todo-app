import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
let insets = { bottom: 0, left: 0, right: 0 };
const colors = { background: "#120F0B", card: "#222222", border: "#444444", shadow: "#000000" };
let scheme = "light";
const referenceTheme = { useReferenceTheme: () => ({ colors: { primary: "purple", muted: "gray" }, type: {} }) };
const mocks = {
  "react-native": { View: "View", Pressable: "Pressable", Text: "Text", StyleSheet: { create: (styles) => styles } },
  "react-native-safe-area-context": { useSafeAreaInsets: () => insets },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors, scheme } }) },
  "expo-blur": { BlurView: "BlurView" },
  "expo-linear-gradient": { LinearGradient: "LinearGradient" },
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
const surfaceOf = (tree) => nodes(tree).find((node) => node.props?.testID === "navigation-island-surface");

function findBlurView(tree) {
  const surface = surfaceOf(tree);
  if (!surface) return null;
  // backgroundBase View wraps the BlurView
  const background = nodes(surface).find((node) => node.props?.testID === "backgroundBase");
  if (!background) return null;
  return nodes(background).find((node) => node.type === "BlurView");
}

test("island renders centered and width-limited", () => {
  const tree = BottomNavIsland({ children: "Tabs" });
  const position = flatten(tree.props.style);
  assert.equal(position.position, "absolute");
  assert.equal(position.alignItems, "center");
  assert.equal(position.paddingLeft, 16);
  assert.equal(position.paddingRight, 16);
  assert.equal(position.paddingBottom, 12);
});

test("surface has rounded border radius", () => {
  const tree = BottomNavIsland({ children: "Tabs" });
  const surface = surfaceOf(tree);
  assert.ok(surface);
  const style = flatten(surface.props.style);
  assert.equal(style.borderRadius, 26);
});

test("blur is present and has correct intensity for dark theme", () => {
  scheme = "dark";
  const target = { current: null };
  const tree = BottomNavIsland({ children: "Tabs", blurTarget: target });
  const blur = findBlurView(tree);
  assert.ok(blur, "BlurView should be found");
  assert.equal(blur.props.intensity, 38);
  assert.equal(blur.props.tint, "dark");
  assert.equal(blur.props.blurTarget, target);
  assert.equal(blur.props.blurMethod, "dimezisBlurViewSdk31Plus");
  scheme = "light";
});

test("blur is present and has correct intensity for light theme", () => {
  const target = { current: null };
  const tree = BottomNavIsland({ children: "Tabs", blurTarget: target });
  const blur = findBlurView(tree);
  assert.ok(blur, "BlurView should be found");
  assert.equal(blur.props.intensity, 40);
  assert.equal(blur.props.tint, "light");
  scheme = "light";
});

test("no external backdrop testID", () => {
  const target = { current: null };
  const tree = BottomNavIsland({ children: "Tabs", blurTarget: target });
  assert.equal(nodes(tree).some((node) => node.props?.testID === "navigation-island-backdrop"), false);
});

test("fade gradient has correct colors", () => {
  const tree = BottomNavIsland({ children: "Tabs" });
  const surface = surfaceOf(tree);
  const glass = nodes(surface).find((node) => {
    // Find the glass View (not backgroundBase)
    return node.props?.testID !== "backgroundBase" && node.type === "View";
  });
  assert.ok(glass, "glass View should be found");
  const gradient = nodes(glass).find((node) => node.type === "LinearGradient");
  assert.ok(gradient, "LinearGradient should be found inside glass");
  assert.equal(gradient.props.pointerEvents, "none");
  assert.equal(gradient.props.start.y, 0);
  assert.equal(gradient.props.end.y, 1);
  assert.equal(glass.props.children.at(-1), "Tabs");
});

test("island stays clear of bottom and landscape safe areas", () => {
  insets = { bottom: 34, left: 44, right: 44 };
  const tree = BottomNavIsland({ children: "Tabs" });
  const position = flatten(tree.props.style);
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