import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url), cache = new Map();
const mocks = {
  react: { useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}], useRef: (current) => ({ current }), useCallback: (fn) => fn, useMemo: (fn) => fn(), useEffect() {} },
  "react-native": { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (styles) => styles } },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
  "@/lib/domain/projects": {}, "@/lib/data/versions": {},
};
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const exports = {};
  cache.set(path, exports);
  const ext = path.startsWith("components/") ? "tsx" : "ts";
  const source = readFileSync(new URL(`../src/${path}.${ext}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "exports", compiled)((id) => mocks[id] ?? (id.startsWith("@/") ? load(id.slice(2)) : require(id)), exports);
  return exports;
}
const tags = load("lib/features/special-card-tags");
const themes = load("lib/features/card-themes");
const { createTask, applyDraft, applyTaskPatch } = load("lib/domain/task-factory");
const { deriveStatus } = load("lib/domain/status");
const { buildWorkspace } = load("lib/data/workspace");
const { useTasks } = load("hooks/use-tasks");
const now = new Date("2026-10-30T12:00:00Z");
const draft = (extra = {}) => ({ title: "Task", description: "Notes", priority: "medium", category: null, dueAt: "2035-01-01T12:00:00Z", subtasks: [], ...extra });
const workspace = (tasks, sections = []) => ({ tasks, sections, boards: [] });

test("one status and one event tag are enforced independently; ordinary tags stay unrestricted", () => {
  const input = Object.freeze(["Work", "Done", "Halloween", "Study", "Cancelled", "Christmas", "Fitness", "done", "HALOWEEN"]);
  const result = tags.normalizeCardTags(input);
  assert.deepEqual(result, ["Work", "Study", "Fitness", "Done", "Halloween"]);
  for (const group of ["status", "event"]) assert.equal(result.filter((tag) => themes.classifySpecialCardTag(tag)?.group === group).length, 1);
  assert.deepEqual(tags.normalizeCardTags(["Halloween", "Done"]), ["Halloween", "Done"]);
  assert.deepEqual(tags.normalizeCardTags(["D", "C", "O", "H", "Work", "work"]), ["D", "C", "O", "H", "work"]);
});

test("selecting another special tag replaces only its own group and supports removal", () => {
  let selected = ["Work", "Halloween", "Done"];
  selected = tags.toggleCardTag(selected, "Canceled");
  assert.deepEqual(selected, ["Work", "Halloween", "Canceled"]);
  selected = tags.toggleCardTag(selected, "Birthday");
  assert.deepEqual(selected, ["Work", "Canceled", "Birthday"]);
  selected = tags.toggleCardTag(selected, "cancelled");
  assert.deepEqual(selected, ["Work", "Birthday"]);
});

test("an open editor merges external status changes without losing local event and ordinary tags", () => {
  const merged = tags.mergeCardTagDraft(["Work", "Study", "Halloween"], ["Work"], ["Work", "Done"]);
  assert.deepEqual(merged, ["Work", "Study", "Halloween", "Done"]);
  assert.deepEqual(tags.mergeCardTagDraft(["Halloween", "Canceled"], ["Halloween"], ["Halloween", "Done"]), ["Halloween", "Canceled"], "an explicit unsaved status choice wins");
  assert.deepEqual(tags.mergeCardTagDraft(["Halloween", "Done"], ["Halloween", "Done"], ["Halloween", "Canceled"]), ["Halloween", "Canceled"]);
  const unchanged = ["Halloween", "Done"];
  assert.equal(tags.mergeCardTagDraft(unchanged, unchanged, unchanged), unchanged);
});

test("create, edit and patch apply status tags without changing deadline or holder", () => {
  const created = createTask(draft({ tags: ["Halloween", "Finished"] }));
  assert.equal(created.completed, true);
  assert.deepEqual(created.tags, ["Halloween", "Done"]);
  assert.ok(created.completedAt);
  const canceled = applyTaskPatch(created, { tags: ["Halloween", "Canceled"] });
  assert.equal(canceled.completed, false);
  assert.equal(canceled.canceled, true);
  assert.equal(canceled.completedAt, null);
  const overdue = applyDraft(canceled, draft({ tags: ["Halloween", "Late"] }));
  assert.equal(overdue.canceled, false);
  assert.equal(deriveStatus(overdue, now), "overdue");
  assert.equal(overdue.dueAt, created.dueAt, "explicit overdue does not invent a deadline");
  assert.equal(overdue.sectionId, created.sectionId);
  assert.equal(themes.resolveCardDecoration(overdue.tags, deriveStatus(overdue, now))?.id, "halloween");
  const reopened = applyTaskPatch(overdue, { tags: ["Halloween"] });
  assert.equal(deriveStatus(reopened, now), "upcoming");
  for (const title of ["Done", "Canceled", "Halloween"]) {
    const ordinary = createTask(draft({ title }));
    assert.equal(ordinary.completed, false);
    assert.equal(ordinary.canceled, false);
    assert.equal(themes.resolveCardDecoration(ordinary.tags), null, "titles no longer opt into special behavior");
  }
});

test("ordinary edits do not reset completion dates or drop event/custom tags", () => {
  const task = createTask(draft({ tags: ["Work", "Halloween", "Done"] }));
  const next = applyDraft(task, draft({ title: "Edited", tags: task.tags }));
  assert.equal(next.completedAt, task.completedAt);
  assert.deepEqual(next.tags, task.tags);
  const patched = applyTaskPatch(task, { description: "Changed notes" });
  assert.equal(patched.completed, true);
  assert.deepEqual(patched.tags, task.tags);
});

test("direct Complete, Cancel and Restore actions synchronize the exclusive status tag", () => {
  const api = useTasks();
  const task = api.addTask(draft({ tags: ["Work", "Halloween"] }));
  api.toggleComplete(task.id);
  assert.deepEqual(api.snapshot().tasks[0].tags, ["Work", "Halloween", "Done"]);
  api.toggleCancel(task.id);
  assert.deepEqual(api.snapshot().tasks[0].tags, ["Work", "Halloween", "Canceled"]);
  api.setTaskStatus(task.id, "open");
  assert.deepEqual(api.snapshot().tasks[0].tags, ["Work", "Halloween"]);
});

test("moving between specially named holders never changes tags, status or design", () => {
  const api = useTasks();
  const task = createTask(draft({ tags: ["Halloween", "Done"] }));
  const sections = ["Done", "Canceled", "Overdue", "Christmas"].map((title, index) => ({ id: String(index), title }));
  api.restore(workspace([task], sections));
  for (const section of sections) {
    api.assignTaskToSection(task.id, section.id);
    const moved = api.snapshot().tasks[0];
    assert.equal(moved.completed, true);
    assert.deepEqual(moved.tags, ["Halloween", "Done"]);
    assert.equal(themes.resolveCardDecoration(moved.tags, deriveStatus(moved, now))?.id, "halloween");
  }
});

test("name-based event designs migrate once, and removing a migrated tag stays removed", () => {
  const legacy = { ...createTask(draft()), specialTagsVersion: undefined, sectionId: "holder" };
  const imported = buildWorkspace(workspace([legacy], [{ id: "holder", title: "Halloween" }]));
  assert.deepEqual(imported.tasks[0].tags, ["Halloween"]);
  assert.equal(imported.tasks[0].specialTagsVersion, 1);
  const removed = applyTaskPatch(imported.tasks[0], { tags: [] });
  const reloaded = buildWorkspace(JSON.parse(JSON.stringify(workspace([removed], imported.sections))));
  assert.deepEqual(reloaded.tasks[0].tags, []);
  const created = buildWorkspace(workspace([{ ...createTask(draft()), sectionId: "holder" }], imported.sections));
  assert.deepEqual(created.tasks[0].tags, [], "new cards in old special holders stay ordinary");
});

test("imports sanitize conflicting special tags and round-trip canonical state", () => {
  const task = { ...createTask(draft()), tags: ["Done", "Cancelled", "Halloween", "Christmas", "Work"] };
  const imported = buildWorkspace(workspace([task]));
  assert.deepEqual(imported.tasks[0].tags, ["Canceled", "Christmas", "Work"]);
  assert.equal(imported.tasks[0].canceled, true);
  assert.equal(imported.tasks[0].completed, false);
  assert.deepEqual(buildWorkspace(JSON.parse(JSON.stringify(imported))), imported);
});

test("legacy category tags cannot bypass the special-tag limits", () => {
  const api = useTasks();
  const special = api.createBoard({ label: "Cancelled", color: "slate" });
  const task = api.addTask(draft({ category: special.id, tags: ["Halloween", "Done"] }));
  assert.equal(task.category, null);
  assert.equal(task.canceled, true);
  assert.deepEqual(task.tags, ["Halloween", "Canceled"]);
  const ordinary = api.createBoard({ label: "Work", color: "blue" });
  const other = api.addTask(draft({ category: ordinary.id, tags: ["Christmas", "Done"] }));
  api.renameBoard(ordinary.id, "Halloween");
  const renamed = api.snapshot().tasks.find((task) => task.id === other.id);
  assert.equal(renamed.category, null);
  assert.deepEqual(renamed.tags, ["Done", "Halloween"]);
});

test("special tags work with board filters, Insights status filters and text search", () => {
  const { filterTasksByFilters, DEFAULT_FILTERS, exportTasksToCSV } = load("lib/features/insights-filters");
  const { matchesQuery } = load("lib/domain/tasks-selectors");
  const boards = [{ id: "event", label: "Halloween", color: "amber" }, { id: "status", label: "Finished", color: "teal" }];
  const task = createTask(draft({ tags: ["Work", "Halloween", "Done"] }));
  for (const board of boards) assert.equal(tags.matchesBoardTag(task, board.id, boards), true);
  assert.equal(filterTasksByFilters([task], { ...DEFAULT_FILTERS, boardId: "event", status: "completed" }, now, boards).length, 1);
  const overdue = applyTaskPatch(task, { tags: ["Halloween", "Overdue"] });
  assert.equal(filterTasksByFilters([overdue], { ...DEFAULT_FILTERS, status: "overdue" }, now).length, 1);
  assert.ok(exportTasksToCSV([overdue], boards).includes('"overdue"'));
  assert.equal(matchesQuery(task, "halloween"), true);
});

test("the tag picker enforces independent selections on the actual controls", () => {
  const { SpecialCardTagPicker } = load("components/ui/special-card-tag-picker");
  let selected = ["Work"];
  const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const press = (label) => {
    const tree = SpecialCardTagPicker({ tags: selected, onChange: (next) => { selected = next; } });
    nodes(tree).find((node) => node.props?.accessibilityLabel === label).props.onPress();
  };
  press("Event tag Halloween"); press("Status tag Done");
  assert.deepEqual(selected, ["Work", "Halloween", "Done"]);
  press("Status tag Canceled");
  assert.deepEqual(selected, ["Work", "Halloween", "Canceled"]);
  press("Event tag Christmas");
  assert.deepEqual(selected, ["Work", "Canceled", "Christmas"]);
});
