import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/ui/mobile-top-bar.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
let focused = false;
const colors = { primary: "#86b840", borderStrong: "#555555", foreground: "#eeeeee", input: "#222222" };
const mocks = {
  react: { useRef: (current) => ({ current }), useState: () => [focused, (value) => { focused = value; }] },
  "react-native": { Platform: { OS: "web" }, Pressable: "Pressable", TextInput: "TextInput", View: "View", Text: "Text", StyleSheet: { create: (value) => value } },
  "@expo/vector-icons": { Ionicons: "Icon" },
  "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0 }) },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors } }) },
};
const exports = {};
vm.runInNewContext(compiled, { exports, require: (id) => id === "react/jsx-runtime" ? require(id) : mocks[id] });

test("revealed search can autofocus while permanently displayed search does not steal focus", () => {
  for (const autoFocus of [undefined, false, true]) {
    const tree = exports.MobileSearchField({ value: "", onChangeText() {}, placeholder: "Search", accessibilityLabel: "Search", autoFocus });
    assert.equal(nodes(tree).find((node) => node.type === "TextInput").props.autoFocus, autoFocus ?? false);
  }
});

test("clearing shared search returns focus to the input for the next query", () => {
  const queries = [];
  let focuses = 0;
  const tree = exports.MobileSearchField({ value: "meeting", onChangeText: (value) => queries.push(value), placeholder: "Search", accessibilityLabel: "Search", autoFocus: true });
  nodes(tree).find((node) => node.type === "TextInput").props.ref.current = { focus: () => focuses++ };
  nodes(tree).find((node) => node.props?.accessibilityLabel === "Clear search").props.onPress();
  assert.deepEqual(queries, [""]);
  assert.equal(focuses, 1);
});

test("search focus highlights the entire themed control without changing its size", () => {
  focused = false;
  const flatten = (style) => Object.assign({}, ...[style].flat().filter(Boolean));
  const render = () => exports.MobileSearchField({ value: "", onChangeText() {}, placeholder: "Search", accessibilityLabel: "Search" });
  let tree = render();
  const original = flatten(tree.props.style);
  assert.equal(original.borderColor, colors.borderStrong);
  const input = nodes(tree).find((node) => node.type === "TextInput");
  assert.equal(flatten(input.props.style).outlineWidth, 0);
  assert.equal(input.props.selectionColor, colors.primary);
  input.props.onFocus();
  tree = render();
  const active = flatten(tree.props.style);
  assert.equal(active.borderColor, colors.primary);
  for (const key of ["height", "borderWidth", "borderRadius", "paddingLeft"]) assert.equal(active[key], original[key]);
  assert.equal(active.height, 44);
  assert.equal(flatten(input.props.style).height + active.borderWidth * 2, active.height);
  nodes(tree).find((node) => node.type === "TextInput").props.onBlur();
  assert.equal(flatten(render().props.style).borderColor, colors.borderStrong);
});

test("search fields revealed by an explicit action opt in to autofocus", async () => {
  for (const [path, component, placeholder] of [
    ["../src/components/board/board-manager-content.tsx", "MobileSearchField", "Search boards"],
    ["../src/components/reference/mobile/reference-my-tasks-screen.tsx", "MobileSearchField", "Search tasks or tags"],
    ["../src/components/settings/theme-picker.tsx", "Input", "Search themes"],
  ]) {
    const text = await readFile(new URL(path, import.meta.url), "utf8");
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let field;
    const visit = (node) => {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === component && node.attributes.properties.some((prop) => ts.isJsxAttribute(prop) && prop.name.getText(file) === "placeholder" && prop.initializer?.text === placeholder)) field = node;
      ts.forEachChild(node, visit);
    };
    visit(file);
    assert.ok(field, `${path}: search field exists`);
    assert.ok(field.attributes.properties.some((prop) => ts.isJsxAttribute(prop) && prop.name.getText(file) === "autoFocus" && !prop.initializer), `${path}: revealed field requests focus`);
  }
});
