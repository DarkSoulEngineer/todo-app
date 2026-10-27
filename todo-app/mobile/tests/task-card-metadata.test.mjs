import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const status = {};
vm.runInNewContext(compile(await readFile(new URL("../src/lib/domain/status.ts", import.meta.url), "utf8")), { exports: status, require });
const source = await readFile(new URL("../src/components/janus-board-ui.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("card.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "TaskCard");
const colors = new Proxy({}, { get: () => "#888888" });
const exports = {};
vm.runInNewContext(compile(declaration.getText(ast)), {
  exports, require, ...status, useTheme: () => ({ theme: { colors } }), detectCardTheme: () => null,
  styles: new Proxy({}, { get: () => ({}) }), StyleSheet: { absoluteFill: {} },
  Card: "Card", View: "View", Text: "Text", Pressable: "Pressable", Ionicons: "Ionicons", Chip: "Chip",
  PRIORITY_META: { high: { label: "High" } },
});
const now = new Date(2026, 9, 27, 12);
const base = { id: "card", title: "Test card", description: "Some notes", priority: "high", category: null, tags: [], completed: false, canceled: false, subtasks: [{ id: "sub", title: "Checklist item", done: false }] };
const render = (dueAt, extra = {}, callbacks = {}) => exports.TaskCard({ task: { ...base, dueAt, ...extra }, boards: [], now, ...callbacks });
function find(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
}
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return node && typeof node === "object" ? text(node.props?.children) : "";
}

test("overdue metadata is one alert badge with duration, not duplicated text or clock", () => {
  for (const [minutes, duration] of [[6 * 24 * 60, "6d"], [3 * 60, "3h"], [45, "45m"]]) {
    const tree = render(new Date(now.getTime() - minutes * 60_000).toISOString());
    const badges = find(tree, (node) => node.props?.accessibilityLabel?.startsWith("Overdue by"));
    assert.equal(badges.length, 1);
    assert.equal(text(badges[0]), duration);
    assert.equal(find(badges[0], (node) => node.type === "Ionicons" && node.props.name === "alert-circle-outline").length, 1);
    assert.equal(find(tree, (node) => node.type === "Ionicons" && node.props.name === "time-outline").length, 0);
    assert.equal(text(tree).toLowerCase().includes("overdue"), false);
  }
});

test("cards have no completion checkbox and keep their edit and actions controls", () => {
  const calls = [];
  const tree = render(null, {}, { onPress: () => calls.push("edit"), onLongPress: () => calls.push("actions") });
  assert.equal(find(tree, (node) => node.props?.accessibilityRole === "checkbox").length, 0);
  const buttons = find(tree, (node) => node.type === "Pressable");
  buttons.find((button) => button.props.accessibilityLabel === "Edit task Test card").props.onPress();
  buttons.find((button) => button.props.accessibilityLabel === "Actions for Test card").props.onPress({ stopPropagation() {} });
  assert.deepEqual(calls, ["edit", "actions"]);
  assert.ok(text(tree).includes("CHECKLIST"));
  assert.ok(text(tree).includes("Checklist item"));
});

test("upcoming deadlines and completed/canceled status labels are preserved", () => {
  const future = new Date(2026, 9, 27, 15).toISOString();
  const upcoming = render(future);
  assert.ok(text(upcoming).includes("Upcoming"));
  assert.equal(find(upcoming, (node) => node.type === "Ionicons" && node.props.name === "time-outline").length, 1);
  assert.ok(text(render(null, { completed: true })).includes("Completed"));
  assert.ok(text(render(null, { canceled: true })).includes("Canceled"));
});
