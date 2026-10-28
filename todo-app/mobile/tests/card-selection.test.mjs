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
    checkbox.props.onPress({ stopPropagation() {} });
    assert.equal(calls, 1);
  }
});

test("subtask completion remains available outside selection mode", () => {
  expanded = true;
  let toggled;
  const task = { id: "task", title: "Test card", priority: "low", subtasks: [{ id: "sub", title: "Subtask", done: false }] };
  const [checkbox] = findCheckboxes(render({ task, onToggleSubtask: (id) => { toggled = id; } }));
  assert.equal(checkbox.props.accessibilityLabel, "Subtask");
  checkbox.props.onPress({ stopPropagation() {} });
  assert.equal(toggled, "sub");
  assert.equal(findCheckboxes(render({ task, selectionMode: true })).find((item) => item.props.accessibilityLabel === "Subtask").props.disabled, true);
  expanded = false;
});

function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}

test("the entire board card opens or selects, including padding and passive content", () => {
  for (const selectionMode of [false, true]) for (const compact of [false, true]) {
    let pressed = 0;
    let menu = 0;
    const tree = render({ selectionMode, compact, selected: selectionMode, onPress: () => pressed++, onMenu: () => menu++ });
    assert.equal(tree.type, "Pressable");
    assert.equal(tree.props.testID, "janus-card-task");
    assert.equal(tree.props.accessibilityState.selected, selectionMode);
    tree.props.onPress();
    tree.props.onLongPress();
    assert.equal(pressed, 1);
    assert.equal(menu, 1);
    assert.equal(nodes(tree).filter((node) => node !== tree && node.props?.accessibilityLabel === "Test card").length, 0, "title no longer has a separate partial hit target");
  }
});

test("nested card controls stop the card click and run only their own action", () => {
  expanded = true;
  const calls = [];
  const tree = render({
    task: { id: "task", title: "Test card", description: "Notes", priority: "low", subtasks: [{ id: "sub", title: "Subtask", done: false }] },
    onPress: () => calls.push("open"), onMenu: () => calls.push("menu"),
    onMoveLeft: () => calls.push("move"), onToggleSubtask: () => calls.push("subtask"),
  });
  for (const label of ["Actions for Test card", "Move Test card to previous column", "Checklist for Test card", "Subtask"]) {
    let stopped = false;
    nodes(tree).find((node) => node.props?.accessibilityLabel === label).props.onPress({ stopPropagation() { stopped = true; } });
    assert.equal(stopped, true, label);
  }
  assert.deepEqual(calls, ["menu", "move", "subtask"]);
  expanded = false;
});
