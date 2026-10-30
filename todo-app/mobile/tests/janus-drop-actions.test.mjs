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
const { getTaskSectionId, isCustomSection } = load("lib/domain/sections");
const { taskDropOrder, sectionDropOrder } = load("lib/features/janus-drag");
const { createNavigationCommands } = load("lib/features/navigation-commands");
const { getRibbonContext } = load("lib/features/ribbon-context");
const source = readFileSync(new URL("../app/board/[id].tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("board.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "WorkspaceScreen");
const actions = screen.body.statements.filter((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => ["dropTask", "dropSection"].includes(declaration.name.getText(ast))));
const compiled = ts.transpileModule(actions.map((node) => node.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const commandNames = ["moveTaskToSection", "reorderTask", "moveSection", "visibleSections", "cardTargets", "neighborList", "commands"];
const commandSource = screen.body.statements.filter((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => commandNames.includes(declaration.name.getText(ast))));
const commandCode = ts.transpileModule(commandSource.map((node) => node.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
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
  const visibleTasks = before.tasks.filter((task) => !filtered || task.id !== "invisible");
  const renderedBoardTasks = visibleTasks.filter((task) => !before.sections.find((section) => section.id === getTaskSectionId(task, before.sections, new Date(stamp)))?.hidden);
  const selected = [];
  const context = { api, tasks: before.tasks, visibleTasks, renderedBoardTasks, sections: before.sections, now: new Date(stamp), sort, setSort: (next) => sorts.push(next), toast: { success: (message, options) => messages.push({ message, options }) }, getTaskSectionId, isCustomSection, createNavigationCommands, getRibbonContext, mode: "board", width: 1200, projects: [], id: "board", currentProjectId: "board", boards: [], hasTasks: true, compactCards: false, focusedColumn: false, showMoveArrows: false, zoom: 1, dragEnabled: true,
    setNewBoardOpen() {}, addNewTask() {}, setAddSectionOpen() {}, setRenameBoardOpen() {}, setRenameCardTarget: (task) => selected.push(task), openEditor() {}, setRenameSectionTarget() {}, switchProject() {}, leaveWorkspace() {}, changeMode() {},
  };
  const commands = new Function(...Object.keys(context), `${commandCode}\nreturn commands;`)(...Object.values(context));
  return { api, before, messages, sorts, commands, selected, ...actions };
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

test("same-list reordering and every holder name preserve status", () => {
  for (const [target, beforeId, expectedOrder] of [["a", null, ["two", "invisible", "one", "three"]], ["empty", null, ["one", "invisible", "two", "three"]], ["done", null, ["one", "invisible", "two", "three"]]]) {
    const h = harness();
    h.dropTask("one", target, beforeId);
    const workspace = h.api.snapshot();
    assert.deepEqual(workspace.tasks.map((task) => task.id), expectedOrder);
    const moved = workspace.tasks.find((task) => task.id === "one");
    assert.equal(getTaskSectionId(moved, workspace.sections, new Date()), target);
    assert.equal(moved.completed, false);
    assert.equal(moved.canceled, false);
    // Restoring the serialized workspace follows the same hydration path as reopening it.
    const reloaded = useTasks();
    reloaded.restore(JSON.parse(JSON.stringify(workspace)));
    assert.deepEqual(reloaded.snapshot(), workspace);
  }
});

test("dropping without a real list cannot clear placement or write state", () => {
  const h = harness();
  h.dropTask("one", null, null);
  assert.deepEqual(h.api.snapshot(), h.before);
  assert.equal(h.messages.length, 0);
});

test("dropping into Done preserves the card's state and Undo restores placement", () => {
  const h = harness();
  h.dropTask("one", "done", null);
  const moved = h.api.snapshot().tasks.find((task) => task.id === "one");
  assert.equal(moved.completed, false);
  assert.equal(moved.completedAt, null);
  assert.equal(moved.sectionId, "done");
  h.messages[0].options.action.onPress();
  assert.deepEqual(h.api.snapshot(), h.before);
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

test("palette moves cards past hidden lists, omits edges, and offers undo", () => {
  const h = harness({ filtered: true });
  const left = h.commands.find((command) => command.id === "card-left");
  assert.equal(left.children.some((target) => target.id === "one"), false);
  const right = h.commands.find((command) => command.id === "card-right");
  right.children.find((target) => target.id === "one").run();
  assert.equal(h.api.snapshot().tasks.find((task) => task.id === "one").sectionId, "b");
  assert.equal(right.children.some((target) => target.id === "invisible"), false);
  h.messages[0].options.action.onPress();
  assert.deepEqual(h.api.snapshot(), h.before);
});

test("palette reorder uses manual ordering and target selection never mutates cards", () => {
  const h = harness({ sort: "priority" });
  h.commands.find((command) => command.id === "rename-card").children[0].run();
  assert.equal(h.selected[0].id, "one");
  assert.deepEqual(h.api.snapshot(), h.before);
  const up = h.commands.find((command) => command.id === "card-up");
  assert.equal(up.children.some((target) => target.id === "one"), false);
  up.children.find((target) => target.id === "two").run();
  assert.deepEqual(h.api.snapshot().tasks.map((task) => task.id), ["two", "invisible", "one", "three"]);
  assert.deepEqual(h.sorts, ["manual"]);
  h.messages[0].options.action.onPress();
  assert.deepEqual(h.api.snapshot(), h.before);
});

test("palette list reorder uses existing persisted action and supports undo", () => {
  const h = harness();
  h.commands.find((command) => command.id === "list-right").children.find((target) => target.id === "a").run();
  assert.deepEqual(h.api.snapshot().sections.map((section) => section.id), ["hidden", "a", "b", "empty", "done"]);
  h.messages[0].options.action.onPress();
  assert.deepEqual(h.api.snapshot(), h.before);
});
