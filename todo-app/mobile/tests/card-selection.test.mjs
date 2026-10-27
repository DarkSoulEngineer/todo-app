import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/board/mobile-column-task-card.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
const colors = new Proxy({}, { get: () => "#888888" });
let expanded = false;
const mocks = {
  react: { useState: () => [expanded, () => {}] },
  "react-native": { Pressable: "Pressable", Text: "Text", View: "View", StyleSheet: { create: (value) => value } },
  "@expo/vector-icons": { Ionicons: "Ionicons" },
  "expo-linear-gradient": { LinearGradient: "LinearGradient" },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { scheme: "light" } }) },
  "@/lib/domain/status": { describeDue: () => null },
  "@/lib/features/card-themes": { detectCardTheme: () => null },
  "@/lib/domain/boards": {},
  "./mobile-board-colors": { useMobileBoardColors: () => colors },
};
const exports = {};
vm.runInNewContext(outputText, { exports, require: (id) => mocks[id] ?? require(id) });
const render = (overrides = {}) => exports.MobileColumnTaskCard({
  task: { id: "task", title: "Test card", priority: "low", subtasks: [], completed: false, canceled: false },
  now: new Date(), selected: false, selectionMode: false,
  onPress() {}, onMenu() {}, onSelect() {}, onToggleSubtask() {}, ...overrides,
});
function findCheckboxes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(findCheckboxes);
  return [...(node.props?.accessibilityRole === "checkbox" ? [node] : []), ...findCheckboxes(node.props?.children)];
}

test("normal cards never show a completion checkbox, regardless of status", () => {
  for (const status of [{}, { completed: true }, { canceled: true }]) {
    const task = { id: "task", title: "Test card", priority: "low", subtasks: [], ...status };
    assert.equal(findCheckboxes(render({ task })).length, 0);
  }
});

test("selection checkboxes reflect selection and invoke only the selection callback", () => {
  for (const selected of [false, true]) {
    let calls = 0;
    const [checkbox] = findCheckboxes(render({ selectionMode: true, selected, onSelect: () => calls++ }));
    assert.equal(checkbox.props["aria-checked"], selected);
    assert.equal(checkbox.props.accessibilityLabel, `${selected ? "Deselect" : "Select"} Test card`);
    checkbox.props.onPress();
    assert.equal(calls, 1);
  }
});

test("subtask completion remains available outside selection mode", () => {
  expanded = true;
  let toggled;
  const task = { id: "task", title: "Test card", priority: "low", subtasks: [{ id: "sub", title: "Subtask", done: false }] };
  const [checkbox] = findCheckboxes(render({ task, onToggleSubtask: (id) => { toggled = id; } }));
  assert.equal(checkbox.props.accessibilityLabel, "Subtask");
  checkbox.props.onPress();
  assert.equal(toggled, "sub");
  assert.equal(findCheckboxes(render({ task, selectionMode: true })).find((item) => item.props.accessibilityLabel === "Subtask").props.disabled, true);
  expanded = false;
});
