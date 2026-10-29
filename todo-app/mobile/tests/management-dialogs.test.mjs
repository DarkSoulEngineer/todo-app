import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const confirmation = await readFile(new URL("../src/components/ui/confirmation-dialog.tsx", import.meta.url), "utf8");
const boardUI = await readFile(new URL("../src/components/janus-board-ui.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("board.tsx", boardUI, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const renameForm = parsed.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "TextEntrySheetForm").getText(parsed);

function render(kind, width, props) {
  const native = { ScrollView: "ScrollView", Text: "Text", View: "View", StyleSheet: { create: (v) => v, hairlineWidth: 0.5 }, useWindowDimensions: () => ({ width }) };
  const useTheme = () => ({ theme: { colors: {} } });
  const mocks = {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "react-native": native,
    "@/components/ui/button": { Button: "Button" },
    "@/components/ui/editor-window": { EditorWindow: "EditorWindow" },
    "@/components/ui/sheet": { Sheet: "Sheet" },
    "@/providers/theme-provider": { useTheme },
  };
  const source = kind === "confirm" ? confirmation : `export ${renameForm}`;
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (id) => mocks[id], ...native, useTheme, useState: (v) => [typeof v === "function" ? v() : v, () => {}], EditorWindow: "EditorWindow", Input: "Input", Button: "Button", Sheet: "Sheet", styles: {} });
  return kind === "confirm" ? exports.ConfirmationDialog(props) : exports.TextEntrySheetForm(props);
}

test("delete confirmations use responsive windows and never delete on dismissal", () => {
  for (const width of [390, 767, 768, 1200]) {
    let deleted = 0, closed = 0;
    const tree = render("confirm", width, { visible: true, title: "Delete list?", description: "Cards will move to another list.", confirmLabel: "Delete list", cancelLabel: "Keep list", onClose: () => closed++, onConfirm: () => deleted++ });
    assert.equal(tree.type, width >= 768 ? "EditorWindow" : "Sheet");
    tree.props.onClose();
    nodes(tree).find((n) => n.props?.label === "Keep list").props.onPress();
    assert.equal(closed, 2);
    assert.equal(deleted, 0);
    const action = nodes(tree).find((n) => n.props?.label === "Delete list");
    assert.equal(action.props.variant, "danger");
    action.props.onPress();
    assert.equal(deleted, 1);
  }
});

test("mobile confirmation titles truncate very long names without losing the actions or full accessible title", () => {
  const title = `Delete “${"LongBoardName".repeat(500)}”?`;
  for (const width of [320, 390, 767]) {
    let deleted = 0;
    let canceled = 0;
    const tree = render("confirm", width, { visible: true, title, description: "This cannot be undone.", confirmLabel: "Delete board", cancelLabel: "Keep it", onClose: () => canceled++, onConfirm: () => deleted++ });
    const heading = nodes(tree).find((node) => node.props?.accessibilityRole === "header");
    assert.equal(heading.props.numberOfLines, 2);
    assert.equal(heading.props.ellipsizeMode, "tail");
    assert.equal(heading.props.accessibilityLabel, title);
    assert.equal(heading.props.children, title);
    nodes(tree).find((node) => node.props?.label === "Keep it").props.onPress();
    assert.equal(canceled, 1);
    assert.equal(deleted, 0);
    nodes(tree).find((node) => node.props?.label === "Delete board").props.onPress();
    assert.equal(deleted, 1);
  }
});

test("rename board and list windows preserve initial values, validation and submission", () => {
  for (const title of ["Rename list", "Rename board"]) {
    for (const initialValue of ["   ", "  New name  "]) {
      const saved = [];
      let closed = 0;
      const tree = render("rename", 1200, { visible: true, title, initialValue, placeholder: "Name", onClose: () => closed++, onSubmit: (value) => saved.push(value) });
      assert.equal(tree.type, "EditorWindow");
      const input = nodes(tree).find((n) => n.type === "Input");
      assert.equal(input.props.value, initialValue);
      const save = nodes(tree).find((n) => n.props?.label === "Save");
      assert.equal(save.props.disabled, !initialValue.trim());
      nodes(tree).find((n) => n.props?.label === "Cancel").props.onPress();
      assert.equal(closed, 1);
      assert.deepEqual(saved, []);
      input.props.onSubmitEditing();
      save.props.onPress();
      assert.deepEqual(saved, initialValue.trim() ? ["New name", "New name"] : []);
    }
  }
});

test("new board uses the shared responsive form and only submits nonblank names", () => {
  for (const width of [390, 1200]) {
    for (const initialValue of ["", "  Test board  "]) {
      const created = [];
      const tree = render("rename", width, { visible: true, title: "New board", description: "Add lists and categories after creating the board.", placeholder: "Board name", actionLabel: "Create board", initialValue, onClose() {}, onSubmit: (name) => created.push(name) });
      assert.equal(tree.type, width >= 768 ? "EditorWindow" : "Sheet");
      const action = nodes(tree).find((node) => node.props?.label === "Create board");
      assert.equal(action.props.disabled, !initialValue.trim());
      action.props.onPress();
      nodes(tree).find((node) => node.type === "Input").props.onSubmitEditing();
      assert.deepEqual(created, initialValue.trim() ? ["Test board", "Test board"] : []);
    }
  }
});
