import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const cache = new Map();
const react = {
  useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
  useRef: (current) => ({ current }), useCallback: (fn) => fn, useMemo: (fn) => fn(), useEffect() {},
};
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const exports = {};
  cache.set(path, exports);
  const source = readFileSync(new URL(`../src/${path}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  new Function("require", "exports", outputText)((name) => {
    if (name === "react") return react;
    if (name === "@/lib/domain/projects" || name === "@/lib/data/versions") return {};
    return name.startsWith("@/") ? load(name.slice(2)) : require(name);
  }, exports);
  return exports;
}
const { useTasks } = load("hooks/use-tasks");
const { getTaskSectionId } = load("lib/domain/sections");
const { taskDropOrder, sectionDropOrder } = load("lib/features/janus-drag");
const source = readFileSync(new URL("../app/board/[id].tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("board.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "WorkspaceScreen");
const actions = screen.body.statements.filter((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => ["dropTask", "dropSection"].includes(declaration.name.getText(ast))));
const compiled = ts.transpileModule(actions.map((node) => node.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const stamp = "2026-10-28T12:00:00Z";
const task = (id, sectionId) => ({ id, title: id, description: "Preserve my notes", dueAt: null, priority: "high", category: null, completed: false, canceled: false, completedAt: null, sectionId, createdAt: stamp, updatedAt: stamp, subtasks: [{ id: `sub-${id}`, title: "Checklist", done: true }], tags: ["tag"], attachments: [], activity: [] });
const sections = [{ id: "a", title: "A" }, { id: "hidden", title: "Hidden", hidden: true }, { id: "b", title: "B" }, { id: "empty", title: "Empty" }, { id: "done", title: "Done", status: "completed" }];
function harness({ filtered = false, sort = "manual" } = {}) {
  const api = useTasks();
  api.restore({ tasks: [task("one", "a"), task("invisible", "b"), task("two", "a"), task("three", "b")], sections, boards: [] });
  const before = api.snapshot();
  const messages = [];
  const sorts = [];
  const actions = new Function("api", "tasks", "visibleTasks", "sections", "now", "sort", "setSort", "toast", "getTaskSectionId", "taskDropOrder", "sectionDropOrder", `${compiled}\nreturn { dropTask, dropSection };`)(
    api, before.tasks, before.tasks.filter((task) => !filtered || task.id !== "invisible"), before.sections, new Date(stamp), sort,
    (next) => sorts.push(next), { success: (message, options) => messages.push({ message, options }) }, getTaskSectionId, taskDropOrder, sectionDropOrder,
  );
  return { api, before, messages, sorts, ...actions };
}

test("real Board drop action moves and orders filtered cards without losing other tasks", () => {
  const h = harness({ filtered: true, sort: "priority" });
  h.dropTask("one", "b", "three");
  const after = h.api.snapshot();
  assert.deepEqual(after.tasks.map((task) => task.id), ["one", "invisible", "two", "three"]);
  assert.equal(after.tasks.find((task) => task.id === "one").sectionId, "b");
  const original = h.before.tasks[0];
  const moved = after.tasks.find((task) => task.id === "one");
  for (const field of ["title", "description", "priority", "subtasks", "tags", "attachments", "completed", "canceled", "dueAt"]) assert.deepEqual(moved[field], original[field]);
  assert.deepEqual(h.sorts, ["manual"]);
  assert.equal(h.messages.length, 1);
  h.messages[0].options.action.onPress();
  assert.deepEqual(h.api.snapshot(), h.before);
  assert.deepEqual(h.sorts, ["manual", "priority"]);
});

test("same-list reordering, empty-list moves and status lists use existing persisted actions", () => {
  for (const [target, beforeId, expectedOrder] of [["a", null, ["two", "invisible", "one", "three"]], ["empty", null, ["one", "invisible", "two", "three"]], ["done", null, ["one", "invisible", "two", "three"]]]) {
    const h = harness();
    h.dropTask("one", target, beforeId);
    const workspace = h.api.snapshot();
    assert.deepEqual(workspace.tasks.map((task) => task.id), expectedOrder);
    const moved = workspace.tasks.find((task) => task.id === "one");
    assert.equal(getTaskSectionId(moved, workspace.sections, new Date()), target);
    if (target === "done") { assert.equal(moved.completed, true); assert.equal(moved.canceled, false); }
    // Restoring the serialized workspace follows the same hydration path as reopening it.
    const reloaded = useTasks();
    reloaded.restore(JSON.parse(JSON.stringify(workspace)));
    assert.deepEqual(reloaded.snapshot(), workspace);
  }
});

test("invalid, hidden, stale and unchanged drops never write or toast", () => {
  for (const args of [["missing", "b", null], ["one", "hidden", null], ["one", "missing", null], ["one", "b", "missing"], ["one", "a", "two"]]) {
    const h = harness();
    h.dropTask(...args);
    assert.deepEqual(h.api.snapshot(), h.before);
    assert.equal(h.messages.length, 0);
  }
});

test("real section action preserves hidden slots, persists and supports Undo", () => {
  const h = harness();
  h.dropSection("a", "empty");
  assert.deepEqual(h.api.snapshot().sections.map((section) => section.id), ["b", "hidden", "empty", "a", "done"]);
  assert.deepEqual(h.api.snapshot().tasks, h.before.tasks);
  h.messages[0].options.action.onPress();
  assert.deepEqual(h.api.snapshot(), h.before);
});
