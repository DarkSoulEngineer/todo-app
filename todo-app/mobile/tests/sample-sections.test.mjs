import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const cache = new Map();
const react = {
  useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
  useRef: (current) => ({ current }),
  useCallback: (callback) => callback,
  useMemo: (factory) => factory(),
  useEffect: () => {},
};

// Execute the actual domain code and hook actions, without mounting native UI
// or running persistence effects. snapshot() exposes the hook's eager live refs.
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const exports = {};
  cache.set(path, exports);
  const source = readFileSync(new URL(`../src/${path}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  new Function("require", "exports", outputText)((name) => {
    if (name === "react") return react;
    if (name === "@/lib/domain/projects" || name === "@/lib/data/versions") return {};
    return name.startsWith("@/") ? load(name.slice(2)) : require(name);
  }, exports);
  return exports;
}

const { createSampleTasks, distributeSampleTasks } = load("lib/data/sample");
const { getTaskSectionId, getDisplaySections, reconcileSectionIds, UNASSIGNED_SECTION_ID } = load("lib/domain/sections");
const { useTasks } = load("hooks/use-tasks");
const lists = [{ id: "a", title: "A" }, { id: "b", title: "B" }];
const workspace = (sections, tasks = []) => ({ sections, tasks, boards: [] });

test("samples use randomized visible custom lists and preserve task data", () => {
  const tasks = createSampleTasks();
  const original = structuredClone(tasks);
  const random = Math.random;
  let draw = 0;
  Math.random = () => [0, 0.999][draw++ % 2];
  try {
    const result = distributeSampleTasks(tasks, [
      ...lists,
      { id: "hidden", title: "Hidden", hidden: true },
      { id: "status", title: "Completed", status: "completed" },
    ]);
    assert.equal(result.length, tasks.length);
    result.forEach((task, index) => {
      assert.equal(task.sectionId, index % 2 ? "b" : "a");
      assert.deepEqual({ ...task, sectionId: tasks[index].sectionId }, tasks[index]);
    });
    assert.deepEqual(tasks, original);
  } finally {
    Math.random = random;
  }
});

test("sample loading on an existing board never leaves cards unassigned", () => {
  const api = useTasks();
  api.restore(workspace(lists));
  api.loadSample();
  const result = api.snapshot();
  assert.deepEqual(result.sections, lists);
  assert.ok(result.tasks.length > 0);
  assert.ok(result.tasks.every((task) => lists.some((section) => section.id === task.sectionId)));
});

test("explicit sample loading adds demo lists only when no visible lists exist", () => {
  for (const sections of [[], [{ id: "hidden", title: "Hidden", hidden: true }]]) {
    const api = useTasks();
    api.restore(workspace(sections));
    api.loadSample();
    const result = api.snapshot();
    assert.equal(result.sections.length, sections.length + 3);
    assert.deepEqual(result.sections.slice(0, sections.length), sections);
    assert.ok(result.tasks.every((task) => result.sections.some((section) => !section.hidden && !section.status && section.id === task.sectionId)));
    api.loadSample();
    assert.equal(api.snapshot().sections.length, result.sections.length);
  }
});

test("unassigned cards stay unassigned, and hidden cards stay hidden", () => {
  const task = createSampleTasks()[0];
  const now = new Date();
  assert.equal(getTaskSectionId({ ...task, sectionId: null }, lists, now), undefined);
  assert.equal(getTaskSectionId({ ...task, sectionId: "missing" }, lists, now), undefined);
  assert.equal(getTaskSectionId({ ...task, sectionId: "hidden" }, [...lists, { id: "hidden", title: "Hidden", hidden: true }], now), "hidden");
  const sections = [];
  const tasks = [{ sectionId: null }];
  reconcileSectionIds(tasks, sections);
  assert.equal(sections.length, 0);
});

test("new cards and cards from a deleted list remain unassigned without automatic lists", () => {
  const api = useTasks();
  const task = api.addTask({ title: "New card", description: "", priority: "medium", dueAt: null, category: null, subtasks: [] });
  const before = api.snapshot();
  assert.equal(before.sections.length, 0);
  assert.equal(task.sectionId, null);
  const list = api.addSection("My list");
  api.setTaskSectionId(task.id, list.id);
  api.deleteSection(list.id);
  const after = api.snapshot();
  assert.equal(after.tasks.length, 1);
  assert.equal(after.tasks[0].sectionId, null);
  assert.equal(after.sections.length, 0);

  api.restore(workspace(lists, [{ ...task, sectionId: "a" }]));
  api.deleteSection("a");
  assert.equal(api.snapshot().tasks[0].sectionId, null);
});

test("fresh workspaces and missing tag data contain no preset tags or lists", () => {
  const { defaultBoards, normalizeBoards } = load("lib/domain/boards");
  const { emptyWorkspace, buildWorkspace } = load("lib/data/workspace");
  assert.deepEqual(defaultBoards(), []);
  assert.deepEqual(normalizeBoards(undefined), []);
  assert.deepEqual(emptyWorkspace(), { tasks: [], boards: [], sections: [] });
  const parsed = buildWorkspace({ tasks: [createSampleTasks()[0]] });
  assert.deepEqual(parsed.boards, []);
  assert.deepEqual(parsed.sections, []);
  assert.equal(parsed.tasks[0].sectionId, null);
});

test("legacy status lists become editable lists and keep cards in their original columns", () => {
  const api = useTasks();
  const base = createSampleTasks()[0];
  api.restore(workspace([{ id: "done", title: "Completed", status: "completed" }], [{ ...base, completed: true, sectionId: null }]));
  assert.deepEqual(api.snapshot().sections, [{ id: "done", title: "Completed" }]);
  assert.equal(api.snapshot().tasks[0].sectionId, "done");
  api.renameSection("done", "Archive");
  assert.equal(api.snapshot().sections[0].title, "Archive");
  api.deleteSection("done");
  assert.equal(api.snapshot().tasks[0].sectionId, null);
  assert.deepEqual(api.snapshot().sections, []);
});

test("status changes never create lists, unhide lists, or change user-chosen assignments", () => {
  for (const sectionId of [null, "a", "canceled"]) {
    const api = useTasks();
    const task = { ...createSampleTasks()[0], id: "test", completed: false, canceled: false, sectionId };
    const sections = [...lists, { id: "canceled", title: "Canceled", hidden: true }];
    api.restore(workspace(sections, [task]));
    for (const action of [() => api.toggleCancel("test"), () => api.toggleCancel("test"), () => api.toggleComplete("test"), ...["canceled", "completed", "open"].map((status) => () => api.setTaskStatus("test", status))]) {
      action();
      assert.equal(api.snapshot().tasks[0].sectionId, sectionId);
      assert.deepEqual(api.snapshot().sections, sections);
    }
  }
});

test("list assignment is explicit and independent of task status and deadlines", () => {
  const api = useTasks();
  const task = { ...createSampleTasks()[0], id: "test", sectionId: null };
  api.restore(workspace(lists, [task]));
  api.assignTaskToSection("test", "b");
  const placed = api.snapshot().tasks[0];
  for (const key of ["completed", "canceled", "completedAt", "dueAt", "category"]) assert.equal(placed[key], task[key]);
  assert.equal(placed.sectionId, "b");
  api.setTaskSectionId("test", "unknown");
  assert.equal(api.snapshot().tasks[0].sectionId, "b");
  api.setTaskSectionId("test", null);
  assert.equal(api.snapshot().tasks[0].sectionId, null);
});

test("No list is display-only and only appears when unassigned tasks exist", () => {
  const task = { ...createSampleTasks()[0], sectionId: null };
  const sections = structuredClone(lists);
  assert.deepEqual(getDisplaySections([{ ...task, sectionId: "a" }], sections, new Date()), lists);
  const displayed = getDisplaySections([task], sections, new Date());
  assert.equal(displayed[0].id, UNASSIGNED_SECTION_ID);
  assert.equal(displayed[0].title, "No list");
  assert.deepEqual(sections, lists);
});

test("user-defined tags can be created, assigned, renamed and deleted without presets", () => {
  const api = useTasks();
  assert.deepEqual(api.snapshot().boards, []);
  const tag = api.createBoard({ label: "My own tag", color: "teal" });
  const task = api.addTask({ title: "Task", description: "", priority: "medium", dueAt: null, category: tag.id, subtasks: [] });
  api.renameBoard(tag.id, "Renamed tag");
  assert.equal(api.snapshot().tasks[0].category, tag.id);
  assert.equal(api.snapshot().boards[0].label, "Renamed tag");
  api.deleteBoard(tag.id);
  assert.deepEqual(api.snapshot().boards, []);
  assert.equal(api.snapshot().tasks.find((item) => item.id === task.id).category, null);
});

test("quick add recognizes only tags supplied by the user, not historical preset names", () => {
  const { parseQuickAdd } = load("lib/features/quick-add");
  assert.equal(parseQuickAdd("Task #work", new Date()).category, null);
  assert.equal(parseQuickAdd("Task #studio", new Date(), [{ id: "mine", label: "Studio" }]).category, "mine");
});

test("special list synonyms apply only when placing a card and preserve unrelated task fields", () => {
  const { SPECIAL_LIST_RULES } = load("lib/features/special-lists");
  for (const rule of SPECIAL_LIST_RULES) for (const title of rule.names) {
    const api = useTasks();
    const task = { ...createSampleTasks()[0], id: "test", completed: false, canceled: false, completedAt: null, sectionId: null };
    api.restore(workspace([{ id: "special", title }], [task]));
    assert.equal(api.snapshot().tasks[0].completed, false, "load does not run entry rules");
    api.assignTaskToSection("test", "special");
    const result = api.snapshot().tasks[0];
    assert.equal(result.sectionId, "special");
    assert.equal(result.completed, rule.id === "completed", title);
    assert.equal(result.canceled, rule.id === "canceled", title);
    assert.equal(Boolean(result.completedAt), rule.id === "completed", title);
    for (const key of ["dueAt", "category", "priority", "title", "description", "subtasks", "attachments", "tags"]) assert.deepEqual(result[key], task[key]);
  }
});

test("Done → To do → Cancelled transitions work through the shared assignment action and undo", () => {
  const api = useTasks();
  const task = { ...createSampleTasks()[0], id: "test", completed: false, canceled: false, completedAt: null, sectionId: null };
  api.restore(workspace([{ id: "done", title: "Finished" }, { id: "todo", title: "To do" }, { id: "cancel", title: "Cancelled" }, { id: "plain", title: "My work" }], [task]));
  const original = api.snapshot();
  api.setTaskSectionId("test", "done");
  const completedAt = api.snapshot().tasks[0].completedAt;
  api.setTaskSectionId("test", "done");
  assert.equal(api.snapshot().tasks[0].completedAt, completedAt, "do not reset completion date");
  api.setTaskSectionId("test", "plain");
  assert.equal(api.snapshot().tasks[0].completed, true, "ordinary lists do not reopen tasks");
  api.setTaskSectionId("test", "todo");
  assert.equal(api.snapshot().tasks[0].completed, false);
  api.setTaskSectionId("test", "cancel");
  assert.equal(api.snapshot().tasks[0].canceled, true);
  api.setTaskSectionId("test", null);
  assert.equal(api.snapshot().tasks[0].canceled, true, "unassigning is not a status change");
  api.restore(original);
  assert.deepEqual(api.snapshot(), original);
  api.renameSection("plain", "Done");
  assert.equal(api.snapshot().tasks[0].completed, false, "rename must not run rules on existing cards");
});
