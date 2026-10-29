import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/ui/editor-window.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];

test("editor window fits safe areas, maximizes/restores and routes dismissal without saving", () => {
  let width = 1200, height = 900, cursor = 0, closed = 0;
  const state = [];
  const colors = { card: "#212121", backgroundAlt: "#181818", borderStrong: "#444444", border: "#333333", foreground: "#FFFFFF", mutedForeground: "#BBBBBB", secondary: "#454545", overlay: "#00000080" };
  const mocks = {
    react: { useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; } },
    "react-native": { Modal: "Modal", KeyboardAvoidingView: "KeyboardAvoidingView", Pressable: "Pressable", View: "View", Text: "Text", Platform: { OS: "web" }, StyleSheet: { create: (value) => value, absoluteFill: {}, hairlineWidth: 0.5 }, useWindowDimensions: () => ({ width, height }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }) },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors } }) },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "react/jsx-runtime": require("react/jsx-runtime"),
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (id) => mocks[id] });
  const render = () => { cursor = 0; return exports.EditorWindow({ visible: true, title: "Edit task", subtitle: "Changes save automatically", onClose: () => closed++, children: "form" }); };
  const surface = (tree) => nodes(tree).find((node) => node.props?.testID === "task-editor-window");
  const button = (tree, label) => nodes(tree).find((node) => node.props?.accessibilityLabel === label);
  let tree = render();
  assert.equal(surface(tree).props.style[0].borderRadius, 8);
  assert.equal(surface(tree).props.style[1].width, 960);
  assert.equal(surface(tree).props.style[1].height, 760);
  assert.equal(surface(tree).props.style[1].backgroundColor, colors.card);
  button(tree, "Maximize editor window").props.onPress();
  tree = render();
  assert.equal(surface(tree).props.style[1].width, 1168);
  assert.equal(surface(tree).props.style[1].height, 824);
  button(tree, "Restore editor window").props.onPress();
  width = 768; height = 600;
  tree = render();
  assert.equal(surface(tree).props.style[1].width, 736);
  assert.equal(surface(tree).props.style[1].height, 524);
  button(tree, "Close task editor").props.onPress();
  button(tree, "Close task editor backdrop").props.onPress();
  tree.props.onRequestClose();
  assert.equal(closed, 3);
});
