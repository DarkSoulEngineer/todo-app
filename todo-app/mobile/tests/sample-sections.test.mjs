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
const { getTaskSectionId, reconcileSectionIds } = load("lib/domain/sections");
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

test("empty, hidden-only, and status-only boards get visible sample lists", () => {
  for (const sections of [[], [{ id: "hidden", title: "Hidden", hidden: true }], [{ id: "status", title: "Completed", status: "completed" }]]) {
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

test("unassigned cards resolve into a real list, and hidden cards stay hidden", () => {
  const task = createSampleTasks()[0];
  const now = new Date();
  assert.equal(getTaskSectionId({ ...task, sectionId: null }, lists, now), "a");
  assert.equal(getTaskSectionId({ ...task, sectionId: "missing" }, lists, now), "a");
  assert.equal(getTaskSectionId({ ...task, sectionId: "hidden" }, [...lists, { id: "hidden", title: "Hidden", hidden: true }], now), "hidden");
  const sections = [];
  const tasks = [{ sectionId: null }];
  reconcileSectionIds(tasks, sections);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, "Inbox");
});

test("new cards and cards from a deleted list stay in real lists", () => {
  const api = useTasks();
  const task = api.addTask({ title: "New card", description: "", priority: "medium", dueAt: null, category: null, subtasks: [] });
  const before = api.snapshot();
  assert.equal(before.sections[0].id, task.sectionId);
  api.deleteSection(task.sectionId);
  const after = api.snapshot();
  assert.equal(after.tasks.length, 1);
  assert.equal(after.tasks[0].sectionId, after.sections[0].id);
  assert.notEqual(after.tasks[0].sectionId, task.sectionId);

  api.restore(workspace(lists, [{ ...task, sectionId: "a" }]));
  api.deleteSection("a");
  assert.equal(api.snapshot().tasks[0].sectionId, "b");
});
