import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/board/create-list-dialog.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
function render(width, title = "", visible = true) {
  const created = [];
  let closed = 0;
  const mocks = {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "react-native": { ScrollView: "ScrollView", Text: "Text", View: "View", StyleSheet: { create: (v) => v, hairlineWidth: 0.5 }, useWindowDimensions: () => ({ width }) },
    "@/components/ui/button": { Button: "Button" },
    "@/components/ui/input": { Input: "Input" },
    "@/components/ui/editor-window": { EditorWindow: "EditorWindow" },
    "@/components/ui/sheet": { Sheet: "Sheet" },
    "./special-list-identity": { SpecialListIdentity: "SpecialListIdentity" },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (id) => mocks[id] });
  const tree = exports.CreateListDialog({ visible, title, onChangeTitle() {}, onClose: () => closed++, onCreate: (value) => created.push(value) });
  return { tree, created, get closed() { return closed; }, input: nodes(tree).find((node) => node.type === "Input"), button: nodes(tree).find((node) => node.props?.label === "Add list") };
}

test("list creation uses the card editor frame on wide screens and a sheet on phones", () => {
  assert.equal(render(767).tree.type, "Sheet");
  const wide = render(768);
  assert.equal(wide.tree.type, "EditorWindow");
  assert.equal(wide.tree.props.width, 560);
  assert.equal(wide.tree.props.height, 300);
  assert.equal(wide.tree.props.closeLabel, "Close list editor");
  assert.equal(render(1200, "", false).tree.props.visible, false);
  nodes(wide.tree).find((node) => node.props?.label === "Cancel").props.onPress();
  wide.tree.props.onClose();
  assert.equal(wide.closed, 2);
  assert.deepEqual(wide.created, []);
});

test("button and keyboard submission reject blank names and trim valid names", () => {
  for (const width of [390, 1200]) {
    for (const title of ["", "   "]) {
      const h = render(width, title);
      assert.equal(h.button.props.disabled, true);
      h.button.props.onPress();
      h.input.props.onSubmitEditing();
      assert.deepEqual(h.created, []);
    }
    const h = render(width, "  In progress  ");
    assert.equal(h.button.props.disabled, false);
    h.button.props.onPress();
    h.input.props.onSubmitEditing();
    assert.deepEqual(h.created, ["In progress", "In progress"]);
  }
});

test("phone sheets use compact spacing and corners without shrinking touch targets", () => {
  for (const width of [320, 390, 767]) {
    const h = render(width);
    assert.equal(h.tree.props.style.paddingHorizontal, 12);
    assert.equal(h.tree.props.style.borderTopLeftRadius, 16);
    assert.equal(h.input.props.style.borderRadius, 8);
    assert.equal(h.input.props.style.fontSize, 14);
    assert.equal(h.input.props.style.outlineWidth, undefined, "shared input owns the themed focus treatment");
    assert.ok(h.input.props.style.height >= 44);
    assert.ok(h.button.props.style.height >= 44);
    assert.equal(h.button.props.style.borderRadius, 8);
  }
  assert.equal(render(1200).input.props.style.borderRadius, 6, "desktop layout is unchanged");
});
