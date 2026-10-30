import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url), cache = new Map();
let viewportWidth = 1024;
const mocks = {
  react: { useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}], useRef: (current) => ({ current }), useCallback: (fn) => fn, useMemo: (fn) => fn(), useEffect() {} },
  "react-native": { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (styles) => styles, hairlineWidth: 0.5 }, useWindowDimensions: () => ({ width: viewportWidth }) },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: { card: "#211C17", cardElevated: "#29231D", backgroundAlt: "#181512", primary: "#D9A441", primarySoft: "#3A2E19", success: "#45BF82", successSoft: "#1D3A2C", destructive: "#F36164", destructiveSoft: "#431B1D", mutedForeground: "#B0A79C", secondary: "#29231D", border: "#342D25", borderStrong: "#4A4035" } } }) },
  "@expo/vector-icons": { Ionicons: "Ionicons" },
  "@/components/ui/sheet": { Sheet: "Sheet" },
  "@/components/ui/editor-window": { EditorWindow: "EditorWindow" },
  "./tactile": { tactileSurface: () => ({}) },
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
const events = load("lib/features/active-events");
const { createTask, applyDraft, applyTaskPatch } = load("lib/domain/task-factory");
const { deriveStatus } = load("lib/domain/status");
const { buildWorkspace } = load("lib/data/workspace");
const { useTasks } = load("hooks/use-tasks");
const completionCelebrations = load("lib/features/task-completion-celebration");
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

test("custom easter-egg designs coexist and survive independent editor merges", () => {
  const selected = tags.normalizeCardTags(["Dark Soul Engineer", "Janus", "DSE", "Work"]);
  assert.deepEqual(selected, ["Janus", "DarkSoulEngineer", "Work"]);
  const merged = tags.mergeCardTagDraft(["DarkSoulEngineer", "Janus"], ["DarkSoulEngineer"], ["DarkSoulEngineer", "Janus"]);
  assert.deepEqual(merged, ["DarkSoulEngineer", "Janus"]);
  assert.deepEqual(tags.toggleCardTag(selected, "Janus"), ["DarkSoulEngineer", "Work"]);
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
  api.addSection("Tasks");
  const task = api.addTask(draft({ tags: ["Work", "Halloween"] }));
  api.toggleComplete(task.id);
  assert.deepEqual(api.snapshot().tasks[0].tags, ["Work", "Halloween", "Done"]);
  api.toggleCancel(task.id);
  assert.deepEqual(api.snapshot().tasks[0].tags, ["Work", "Halloween", "Canceled"]);
  api.setTaskStatus(task.id, "open");
  assert.deepEqual(api.snapshot().tasks[0].tags, ["Work", "Halloween"]);
});

test("bulk status completion updates selected tasks with one celebration", () => {
  const api = useTasks();
  api.addSection("Tasks");
  const first = api.addTask(draft({ tags: ["Work"] }));
  const second = api.addTask(draft({ tags: ["Halloween"], subtasks: [{ id: "check", title: "Check", done: true }] }));
  const received = [];
  const unsubscribe = completionCelebrations.subscribeToTaskCompletionCelebrations((event) => received.push(event));
  api.setTasksStatus([first.id, second.id], "completed");
  unsubscribe();
  assert.equal(api.snapshot().tasks.filter((task) => task.completed).length, 2);
  assert.deepEqual(api.snapshot().tasks.map((task) => task.tags), [["Work", "Done"], ["Halloween", "Done"]]);
  assert.equal(received.length, 1);
  assert.equal(received[0].title, "2 tasks completed");
  assert.equal(received[0].completedChecklistItems, 1);
});

test("moving into status-named sections applies matching status tags without affecting ordinary sections", () => {
  const api = useTasks();
  const task = createTask(draft({ tags: ["Work", "Halloween"] }));
  const sections = ["Done", "Canceled", "Overdue", "Christmas"].map((title, index) => ({ id: String(index), title }));
  api.restore(workspace([task], sections));
  api.assignTaskToSection(task.id, "0");
  let moved = api.snapshot().tasks[0];
  assert.equal(moved.completed, true);
  assert.deepEqual(moved.tags, ["Work", "Halloween", "Done"]);
  const completedAt = moved.completedAt;
  assert.equal(themes.resolveCardDecoration(moved.tags, deriveStatus(moved, now))?.id, "done");

  api.assignTaskToSection(task.id, "0");
  assert.equal(api.snapshot().tasks[0].completedAt, completedAt, "moving into the same completed section preserves completion time");

  api.assignTaskToSection(task.id, "1");
  moved = api.snapshot().tasks[0];
  assert.equal(moved.completed, false);
  assert.equal(moved.canceled, true);
  assert.deepEqual(moved.tags, ["Work", "Halloween", "Canceled"]);

  api.assignTaskToSection(task.id, "2");
  moved = api.snapshot().tasks[0];
  assert.equal(moved.completed, false);
  assert.equal(moved.canceled, false);
  assert.deepEqual(moved.tags, ["Work", "Halloween", "Overdue"]);

  api.assignTaskToSection(task.id, "3");
  moved = api.snapshot().tasks[0];
  assert.equal(moved.completed, false);
  assert.equal(moved.canceled, false);
  assert.deepEqual(moved.tags, ["Work", "Halloween", "Overdue"], "ordinary and event tags are retained on ordinary section moves");
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
  api.addSection("Tasks");
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
  const { CardStatusPicker } = load("components/ui/card-status-picker");
  let selected = ["Work"];
  const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const press = (component, label) => {
    const tree = component({ tags: selected, onChange: (next) => { selected = next; } });
    nodes(tree).find((node) => node.props?.accessibilityLabel === label).props.onPress();
  };
  events.setEventOverride("halloween");
  press(SpecialCardTagPicker, "Event tag Halloween"); press(CardStatusPicker, "Status tag Done");
  assert.deepEqual(selected, ["Work", "Halloween", "Done"]);
  press(CardStatusPicker, "Status tag Canceled");
  assert.deepEqual(selected, ["Work", "Halloween", "Canceled"]);
  events.setEventOverride("christmas");
  press(SpecialCardTagPicker, "Event tag Christmas");
  assert.deepEqual(selected, ["Work", "Canceled", "Christmas"]);
  const picker = nodes(SpecialCardTagPicker({ tags: selected, onChange: () => assert.fail("Rendering must not edit tags") }));
  assert.equal(picker.some((node) => node.props?.accessibilityLabel?.startsWith("Easter egg tag ")), false);
  assert.deepEqual(tags.normalizeCardTags([...selected, "DarkSoulEngineer", "Janus"]), ["Work", "Canceled", "Christmas", "DarkSoulEngineer", "Janus"], "typing custom names in the add-tag field enables their designs");
  events.setEventOverride(null);
});

test("the neutral status has no tag and explicit status buttons toggle independently", () => {
  const { CardStatusPicker } = load("components/ui/card-status-picker");
  const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(typeof node.props?.children === "function" ? node.props.children({ pressed: false }) : node.props?.children)];
  for (const selected of [[], ["Done"], ["Canceled"], ["Overdue"]]) {
    const tree = nodes(CardStatusPicker({ tags: selected, onChange() {} }));
    const buttons = tree.filter((node) => node.props?.accessibilityLabel?.startsWith("Status tag "));
    assert.deepEqual(buttons.map((node) => node.props.accessibilityLabel), themes.STATUS_CARD_THEMES.map((entry) => `Status tag ${entry.label}`));
    assert.equal(tree.some((node) => node.props?.children === "No status tag selected"), false);
    for (const entry of themes.STATUS_CARD_THEMES) {
      const button = tree.find((node) => node.props?.accessibilityLabel === `Status tag ${entry.label}`);
      assert.deepEqual(nodes(button).filter((node) => node.type === "Text").map((node) => node.props.children), [entry.label]);
      assert.equal(button.props.accessibilityState.selected, selected.includes(entry.label));
      assert.equal(button.props.accessibilityRole, "radio");
      const style = Object.assign({}, ...[button.props.style].flat());
      assert.equal(style.minHeight, 44);
      assert.equal(style.borderWidth, 1);
      assert.equal(style.borderRadius, 999);
      assert.equal(style.backgroundColor, undefined);
      assert.equal(style.boxShadow, "0 1px 3px rgba(0,0,0,0.16)");
      assert.equal(style.elevation, 1);
      const unpressed = nodes(button.props.children({ pressed: false }));
      const pressed = nodes(button.props.children({ pressed: true }));
      const unpressedDot = unpressed.find((node) => Object.assign({}, ...[node.props?.style ?? []].flat()).width === 7);
      const pressedDot = pressed.find((node) => Object.assign({}, ...[node.props?.style ?? []].flat()).width === 7);
      assert.equal(Object.assign({}, ...[unpressedDot.props.style].flat()).opacity, selected.includes(entry.label) ? 1 : 0.7);
      assert.equal(Object.assign({}, ...[pressedDot.props.style].flat()).opacity, 1);
      const labelStyle = Object.assign({}, ...[unpressed.find((node) => node.type === "Text").props.style].flat());
      const pressedLabelStyle = Object.assign({}, ...[pressed.find((node) => node.type === "Text").props.style].flat());
      assert.deepEqual(pressedLabelStyle, labelStyle);
      assert.equal(labelStyle.fontWeight, "600");
    }
  }
  let updated;
  const tree = nodes(CardStatusPicker({ tags: ["Work", "Done"], onChange: (tags) => { updated = tags; } }));
  tree.find((node) => node.props?.accessibilityLabel === "Status tag Done").props.onPress();
  assert.deepEqual(updated, ["Work"], "clearing a status removes its tag without adding an Open tag");
});

test("event availability follows local holiday dates and excludes unrelated events", () => {
  const cases = [[2026, 10, 31, "halloween"], [2026, 12, 25, "christmas"], [2027, 1, 1, "new-year"], [2026, 2, 14, "valentines"], [2026, 4, 5, "easter"], [2027, 3, 28, "easter"]];
  for (const [year, month, day, id] of cases) {
    assert.deepEqual(events.getActiveEventThemes(new Date(year, month - 1, day, 0, 1)).map((entry) => entry.id), [id]);
    assert.deepEqual(events.getActiveEventThemes(new Date(year, month - 1, day, 23, 59)).map((entry) => entry.id), [id]);
  }
  for (const date of [new Date(2026, 9, 30), new Date(2026, 10, 1), new Date(2026, 11, 24), new Date(2026, 3, 6)]) assert.deepEqual(events.getActiveEventThemes(date), []);
});

test("debug triggers exactly one event, notifies subscribers and resets without modifying tags", () => {
  let changes = 0;
  const unsubscribe = events.subscribeToEvents(() => changes++);
  const ordinaryDay = new Date(2026, 6, 10);
  for (const entry of themes.SEASONAL_CARD_THEMES) {
    events.setEventOverride(entry.id);
    assert.deepEqual(events.getActiveEventThemes(ordinaryDay, events.getEventOverride()).map((item) => item.id), [entry.id]);
  }
  events.setEventOverride(null);
  assert.deepEqual(events.getActiveEventThemes(ordinaryDay, events.getEventOverride()), []);
  assert.equal(changes, 7);
  unsubscribe();
  assert.equal(themes.resolveCardDecoration(["Halloween"])?.id, "halloween");
});

test("picker hides the empty Event group and inactive saved events without dropping tags", () => {
  const { SpecialCardTagPicker } = load("components/ui/special-card-tag-picker");
  const { CardStatusPicker } = load("components/ui/card-status-picker");
  const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  // An invalid preview deterministically represents a day with no active events.
  events.setEventOverride("none");
  const selected = ["Work", "Halloween"];
  const tree = nodes(SpecialCardTagPicker({ tags: selected, onChange: () => assert.fail("Rendering must not edit tags") }));
  assert.equal(tree.some((node) => node.props?.children === "EVENT"), false);
  assert.equal(tree.filter((node) => node.props?.accessibilityLabel?.startsWith("Event tag ")).length, 0);
  const statuses = nodes(CardStatusPicker({ tags: selected, onChange: () => assert.fail("Rendering must not edit tags") }));
  assert.equal(statuses.filter((node) => node.props?.accessibilityLabel?.startsWith("Status tag ")).length, 3);
  assert.deepEqual(selected, ["Work", "Halloween"]);
  events.setEventOverride(null);
});

test("Actions debug controls trigger each corresponding picker option and reset", () => {
  const { EventDebugButton } = load("components/ui/event-debug-button");
  const { SpecialCardTagPicker } = load("components/ui/special-card-tag-picker");
  const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  let opened = false;
  viewportWidth = 375;
  const phoneTree = nodes(EventDebugButton({ onOpenChange: (open) => { opened = open; } }));
  assert.ok(phoneTree.some((node) => node.type === "Sheet"), "phones use the bottom sheet");
  assert.ok(!phoneTree.some((node) => node.type === "EditorWindow"), "phones do not use the desktop window");
  viewportWidth = 1024;
  const controls = nodes(EventDebugButton({ onOpenChange: (open) => { opened = open; } }));
  assert.ok(controls.some((node) => node.type === "EditorWindow"), "tablets and web use the centered editor window");
  controls.find((node) => node.props?.accessibilityLabel === "Debug events").props.onPress();
  assert.equal(opened, true);
  for (const entry of themes.SEASONAL_CARD_THEMES) {
    controls.find((node) => node.props?.accessibilityLabel === `Trigger ${entry.label} event`).props.onPress();
    const picker = nodes(SpecialCardTagPicker({ tags: [], onChange() {} }));
    const choices = picker.filter((node) => node.props?.accessibilityLabel?.startsWith("Event tag "));
    assert.deepEqual(choices.map((node) => node.props.accessibilityLabel), [`Event tag ${entry.label}`]);
  }
  controls.find((node) => node.props?.accessibilityLabel === "Reset events to automatic dates").props.onPress();
  assert.equal(events.getEventOverride(), null);
  const route = readFileSync(new URL("../app/board/[id].tsx", import.meta.url), "utf8");
  assert.match(route.slice(route.indexOf("const actionsContent"), route.indexOf("const activeFilterBoard")), /<EventDebugButton/);
});
