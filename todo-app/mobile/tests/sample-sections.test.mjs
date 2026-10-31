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

const { createSampleTasks, createSampleSections, distributeSampleTasks } = load("lib/data/sample");
const { getTaskSectionId, getDisplaySections, reconcileSectionIds } = load("lib/domain/sections");
const { useTasks } = load("hooks/use-tasks");
const lists = [{ id: "a", title: "A" }, { id: "b", title: "B" }];
const workspace = (sections, tasks = []) => ({ sections, tasks, boards: [] });

test("every sample generation includes the full completion/checklist visual test matrix", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  for (let run = 0; run < 5; run++) {
    const cases = createSampleTasks(now).filter((task) => task.tags.includes("Checklist demo"));
    assert.equal(cases.length, 9);
    const expected = [
      ["Done · full checklist", true, false, 3, 3],
      ["Done · partial checklist", true, false, 2, 3],
      ["Done · unchecked checklist", true, false, 0, 3],
      ["Done · no checklist", true, false, 0, 0],
      ["Open · full checklist", false, false, 3, 3],
      ["Open · partial checklist", false, false, 1, 3],
      ["Open · unchecked checklist", false, false, 0, 3],
      ["Canceled · full checklist", false, true, 3, 3],
      ["Overdue · full checklist", false, false, 3, 3],
    ];
    for (const [title, completed, canceled, checked, total] of expected) {
      const task = cases.find((task) => task.title === title);
      assert.ok(task, title);
      assert.equal(task.completed, completed);
      assert.equal(task.canceled, canceled);
      assert.equal(task.subtasks.length, total);
      assert.equal(task.subtasks.filter((item) => item.done).length, checked);
      assert.equal(Boolean(task.completedAt), completed);
      assert.equal(task.tags.includes("Done"), completed);
      assert.equal(task.tags.includes("Canceled"), canceled);
    }
    const medalCases = cases.filter((task) => task.completed && task.subtasks.length > 0 && task.subtasks.every((item) => item.done));
    assert.deepEqual(medalCases.map((task) => task.title), ["Done · full checklist"]);
    assert.ok(new Date(cases.find((task) => task.title === "Overdue · full checklist").dueAt) < now);
  }
});

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
    assert.ok(result.sections.length >= sections.length + 2 && result.sections.length <= sections.length + 6);
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

test("cards require real lists and nonempty lists cannot be deleted or unassigned", () => {
  const api = useTasks();
  const draft = { title: "New card", description: "", priority: "medium", dueAt: null, category: null, subtasks: [] };
  assert.throws(() => api.addTask(draft), /list/);
  assert.deepEqual(api.snapshot(), workspace([]));
  const list = api.addSection("My list");
  const task = api.addTask(draft, list.id);
  assert.equal(task.sectionId, list.id);
  api.setTaskSectionId(task.id, null);
  api.patchTask(task.id, { sectionId: null });
  assert.equal(api.snapshot().tasks[0].sectionId, list.id);
  assert.throws(() => api.addTask(draft, "missing"), /list/);
  api.deleteSection(list.id);
  assert.equal(api.snapshot().sections.length, 1);
  assert.equal(api.snapshot().tasks[0].sectionId, list.id);
  const other = api.addSection("Other");
  api.assignTaskToSection(task.id, other.id);
  api.deleteSection(list.id);
  assert.deepEqual(api.snapshot().sections, [other]);
  api.deleteTask(task.id);
  api.deleteSection(other.id);
  assert.deepEqual(api.snapshot(), workspace([]));
});

test("samples vary from two to six lists and populate every generated list", () => {
  const random = Math.random;
  try {
    for (const [value, count] of [[0, 2], [0.4, 4], [0.999, 6]]) {
      let first = true;
      Math.random = () => { if (first) { first = false; return value; } return random(); };
      const sections = createSampleSections();
      assert.equal(sections.length, count);
      assert.equal(new Set(sections.map((section) => section.id)).size, count);
      const tasks = distributeSampleTasks(createSampleTasks(), sections);
      assert.equal(new Set(tasks.map((task) => task.sectionId)).size, count);
    }
  } finally { Math.random = random; }
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
  assert.equal(api.snapshot().tasks[0].sectionId, "done");
  api.deleteTask(base.id);
  api.deleteSection("done");
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
  assert.equal(api.snapshot().tasks[0].sectionId, "b");
});

test("only real lists are displayed, including when legacy cards have no list", () => {
  const task = { ...createSampleTasks()[0], sectionId: null };
  const sections = structuredClone(lists);
  assert.deepEqual(getDisplaySections([{ ...task, sectionId: "a" }], sections, new Date()), lists);
  const displayed = getDisplaySections([task], sections, new Date());
  assert.deepEqual(displayed, lists);
  assert.deepEqual(getDisplaySections([task], [], new Date()), []);
  assert.deepEqual(sections, lists);
});

test("user-defined tags can be created, assigned, renamed and deleted without presets", () => {
  const api = useTasks();
  assert.deepEqual(api.snapshot().boards, []);
  const tag = api.createBoard({ label: "My own tag", color: "teal" });
  api.addSection("Tasks");
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

test("moving into status-named sections applies status tags but ordinary and event sections do not", () => {
  for (const [title, expectedTag, expectedCompleted, expectedCanceled] of [
    ["Done", "Done", true, false],
    ["Completed", "Done", true, false],
    ["Finished", "Done", true, false],
    ["Canceled", "Canceled", false, true],
    ["Cancelled", "Canceled", false, true],
    ["Overdue", "Overdue", false, false],
    ["Halloween", null, false, false],
    ["Christmas", null, false, false],
  ]) {
    const api = useTasks();
    const task = { ...createSampleTasks()[0], id: "test", completed: false, canceled: false, completedAt: null, sectionId: null };
    api.restore(workspace([{ id: "special", title }], [task]));
    assert.equal(api.snapshot().tasks[0].completed, false, "load does not run entry rules");
    api.assignTaskToSection("test", "special");
    const result = api.snapshot().tasks[0];
    assert.equal(result.sectionId, "special");
    assert.equal(result.completed, expectedCompleted, title);
    assert.equal(result.canceled, expectedCanceled, title);
    assert.equal(result.completedAt !== null, expectedCompleted, title);
    assert.deepEqual(result.tags.filter((tag) => tag === "Done" || tag === "Canceled" || tag === "Overdue"), expectedTag ? [expectedTag] : [], title);
    for (const key of ["dueAt", "category", "priority", "title", "description", "subtasks", "attachments"]) assert.deepEqual(result[key], task[key]);
    if (!expectedTag) assert.deepEqual(result.tags, task.tags, title);
  }
});

test("status tags follow the card across holders and undo restores their state", () => {
  const api = useTasks();
  const task = { ...createSampleTasks()[0], id: "test", completed: false, canceled: false, completedAt: null, sectionId: null };
  api.restore(workspace([{ id: "done", title: "Finished" }, { id: "todo", title: "To do" }, { id: "cancel", title: "Cancelled" }, { id: "plain", title: "My work" }], [task]));
  const original = api.snapshot();
  api.patchTask("test", { tags: ["Halloween", "Done"] });
  api.setTaskSectionId("test", "done");
  const completedAt = api.snapshot().tasks[0].completedAt;
  api.setTaskSectionId("test", "done");
  assert.equal(api.snapshot().tasks[0].completedAt, completedAt, "do not reset completion date");
  api.setTaskSectionId("test", "plain");
  assert.equal(api.snapshot().tasks[0].completed, true, "ordinary lists do not reopen tasks");
  api.setTaskSectionId("test", "todo");
  assert.equal(api.snapshot().tasks[0].completed, true);
  api.setTaskSectionId("test", "cancel");
  assert.equal(api.snapshot().tasks[0].completed, false);
  assert.equal(api.snapshot().tasks[0].canceled, true);
  assert.deepEqual(api.snapshot().tasks[0].tags, ["Halloween", "Canceled"]);
  api.setTaskSectionId("test", null);
  assert.equal(api.snapshot().tasks[0].canceled, true, "unassigning is not a status change");
  api.restore(original);
  assert.deepEqual(api.snapshot(), original);
  api.renameSection("plain", "Done");
  assert.equal(api.snapshot().tasks[0].completed, false, "rename must not run rules on existing cards");
});
