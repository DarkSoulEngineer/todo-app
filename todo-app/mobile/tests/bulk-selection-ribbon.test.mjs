import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/board/bulk-selection-toolbar.tsx", import.meta.url), "utf8");
const exports = {};
const mocks = {
  "react/jsx-runtime": require("react/jsx-runtime"),
  "react-native": { Pressable: "Pressable", View: "View", Text: "Text", StyleSheet: { create: (styles) => styles, hairlineWidth: 0.5 } },
  "@expo/vector-icons": { Ionicons: "Icon" },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
  "@/components/ui/ribbon-scroll-view": { RibbonScrollView: "RibbonScrollView" },
};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: (id) => mocks[id] });
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node.type === "function" ? nodes(node.type(node.props)) : [node, ...nodes(node.props?.children)];
const button = (tree, label) => nodes(tree).find((node) => node.props?.accessibilityLabel === label);

test("board ribbon keeps shared tool sizes and disables inapplicable actions without hiding them", () => {
  let calls = 0;
  const run = () => calls++;
  for (const count of [0, 2]) {
    const tree = exports.BulkSelectionToolbar({ entity: "board", selectedCount: count, onSelectAll: run, onClear: run, onDelete: run, boardActions: { onClose: run, onReopen: run, onDuplicate: run, canClose: true, canReopen: false, canDuplicate: true } });
    assert.equal(tree.type, "RibbonScrollView");
    assert.equal(tree.props.accessibilityLabel, "Bulk board actions");
    for (const label of ["Unselect all boards", "Close selected boards", "Duplicate selected boards", `Delete ${count} selected boards`]) {
      const control = button(tree, label);
      assert.equal(control.props.disabled, count === 0);
      assert.equal(control.props.style[0].minHeight, 48);
    }
    assert.equal(button(tree, "Reopen selected boards").props.disabled, true);
    assert.equal(button(tree, "Select all visible boards").props.disabled, false);
    assert.equal(nodes(tree).filter((node) => node.props?.accessibilityRole === "button").length, 6);
  }
  assert.equal(calls, 0);
});

test("task ribbon retains its task-specific labels and actions", () => {
  const run = () => {};
  const tree = exports.BulkSelectionToolbar({ selectedCount: 2, onSelectAll: run, onClear: run, onComplete: run, onCancel: run, onRestore: run, onMove: run, onPriority: run, onDelete: run });
  for (const label of ["Select all visible tasks", "Unselect all tasks", "Complete 2 selected tasks", "Cancel 2 selected tasks", "Restore 2 selected tasks", "Move selected tasks", "Set priority for selected tasks", "Delete 2 selected tasks"]) assert.ok(button(tree, label));
  assert.equal(button(tree, "Close selected boards"), undefined);
});
