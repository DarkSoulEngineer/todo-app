import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../app/board/[id].tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const ranking = {};
const navigation = {};
const ribbonContext = {}, constants = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/lib/features/ribbon-context.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: ribbonContext });
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/lib/domain/constants.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: constants });
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/lib/features/navigation-commands.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: navigation });
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/lib/features/top-tasks.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: ranking });
const task = { id: "a", title: "First", priority: "medium", subtasks: [], createdAt: "2026-10-28T10:00:00Z", updatedAt: "2026-10-28T10:00:00Z" };
const colors = new Proxy({}, { get: () => "#888888" });
function render(width, mode = "list", selected = task, visible = true, tasks = [task], updates = [], options = {}) {
  let state = 0;
  const effects = [];
  const boardId = options.boardId ?? "board";
  const states = { 0: mode, 11: selected, 12: visible, 24: options.calendarDay ?? null, 31: options.owner ?? boardId, ...options.states };
  const api = { tasks, sections: options.sections ?? [], boards: options.boards ?? [], versions: options.versions ?? [], projects: options.projects ?? [{ id: boardId, name: "Board" }], currentProjectId: boardId, ...options.api };
  const fallback = new Proxy({}, { get: (_, key) => key });
  const mocks = {
    react: { useState: (initial) => { const index = state++; return [index in states ? states[index] : typeof initial === "function" ? initial() : initial, (value) => updates.push([index, value])]; }, useRef: (current) => ({ current }), useEffect: (effect) => effects.push(effect), useMemo: (fn) => fn() },
    "react-native": { View: "View", Text: "Text", ScrollView: "ScrollView", Pressable: "Pressable", Platform: { OS: "web" }, StyleSheet: { create: (v) => v, hairlineWidth: 0.5 }, useWindowDimensions: () => ({ width, height: options.height ?? 1000 }) },
    "expo-router": { useLocalSearchParams: () => ({ id: boardId }), router: { replace: (destination) => options.onNavigate?.(destination) } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: options.colors ?? colors } }) },
    "@/providers/preferences-provider": { usePreferences: () => ({ boardDisplay: options.boardDisplay ?? { compactCards: false, focusedColumn: false, showMoveArrows: false, zoom: 1 }, setBoardDisplayPreferences: (patch) => options.onDisplayChange?.(patch) }) },
    "@/providers/tasks-provider": { useTasksContext: () => api },
    "@/providers/toast-provider": { useToast: () => options.toast ?? {} },
    "@/hooks/use-now": { useNow: () => new Date("2026-10-28") },
    "@/lib/domain/tasks-selectors": { sortTasks: (items) => items, matchesQuery: (task) => !(options.hiddenIds ?? []).includes(task.id) },
    "@/lib/domain/sections": { getTaskSectionId: (task) => task.sectionId, isCustomSection: () => false },
    "@/lib/domain/boards": { boardColor: () => ({ dot: "#888888" }), BOARD_COLORS: [] },
    "@/lib/features/ribbon-context": ribbonContext,
    "@/lib/features/top-tasks": ranking,
    "@/lib/features/navigation-commands": { createNavigationCommands: (options) => navigation.createNavigationCommands({ ...options, projects: options.projects.map((project) => ({ workspace: { tasks: [], sections: [] }, ...project })) }) },
    "@/lib/domain/constants": constants,
    "@/lib/data/transfer": { exportWorkspace: async (workspace, name) => options.onExport?.("json", workspace, name), exportWorkspaceCsv: async (workspace, name) => options.onExport?.("csv", workspace, name) },
    "@/theme/layout": { mobileContentStyle: {}, mobileBottomNavClearance: 112 },
  };
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (id) => mocks[id] ?? (id === "react/jsx-runtime" || id === "date-fns" ? require(id) : fallback) });
  const tree = exports.default();
  effects.forEach((effect) => effect());
  return tree;
}
function find(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((item) => find(item, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
}
const editor = (tree) => find(tree, (node) => node.type === "TaskEditor")[0];
const commandsFor = (tree) => find(tree, (node) => node.type === "CommandPalette")[0].props.commands;

test("ribbon command coverage follows the current view and includes filters, data, versions and selection", () => {
  const expected = ["search-tasks", "filter-tags", "clear-filters", "filters-tools", "add-tag", "sort-tasks", "home-tools", "actions-tools", "pin-ribbon", "expand-ribbon", "load-sample", "export-json", "export-csv", "import-board", "save-version", "clear-done", "close-board", "select-mode", "list-visibility"];
  const board = commandsFor(render(1200, "board", null, false));
  for (const id of expected) assert.ok(board.some((command) => command.id === id), id);
  const activity = commandsFor(render(1200, "list"));
  assert.ok(activity.some((command) => command.id === "filter-tags"));
  for (const id of ["sort-tasks", "select-mode", "compact", "dragging"]) assert.equal(activity.some((command) => command.id === id), false, id);
  const insights = commandsFor(render(1200, "insights"));
  for (const id of ["search-tasks", "filter-tags", "clear-filters", "sort-tasks", "list-visibility"]) assert.equal(insights.some((command) => command.id === id), false, id);
  assert.equal(commandsFor(render(390, "board", null, false)).some((command) => command.id === "dragging"), false);
});

test("filter and sort pickers apply choices and clear stale bulk selection", () => {
  const updates = [];
  const commands = commandsFor(render(1200, "board", null, false, [task], updates, { boards: [{ id: "work", label: "Work" }], states: { 1: "needle", 7: "work" } }));
  const filters = commands.find((command) => command.id === "filter-tags");
  assert.equal(filters.children.find((target) => target.id === "work").selected, true);
  filters.children.find((target) => target.id === "all").run();
  assert.ok(updates.some(([index, value]) => index === 7 && value === "all"));
  assert.ok(updates.some(([index, value]) => index === 28 && value.size === 0));
  commands.find((command) => command.id === "sort-tasks").children.find((target) => target.id === "priority").run();
  assert.ok(updates.some(([index, value]) => index === 6 && value === "priority"));
  commands.find((command) => command.id === "clear-filters").run();
  assert.ok(updates.some(([index, value]) => index === 1 && value === ""));
});

test("ribbon commands delegate tab/search/pin actions and exports use live workspace data", async () => {
  const calls = [];
  const tree = render(1200, "board", null, false, [task], [], { onExport: (format, workspace) => calls.push([format, workspace.tasks[0].id]) });
  const ribbon = find(tree, (node) => node.type === "MobileBoardRibbon")[0];
  ribbon.props.controlsRef.current = { openTab: (tab) => calls.push(tab), focusSearch: () => calls.push("search"), togglePin: () => calls.push("pin"), toggleExpanded: () => calls.push("expand") };
  const commands = commandsFor(tree);
  for (const id of ["home-tools", "actions-tools", "filters-tools", "search-tasks", "pin-ribbon", "expand-ribbon", "export-json", "export-csv"]) commands.find((command) => command.id === id).run();
  await Promise.resolve();
  assert.deepEqual(calls, ["home", "actions", "filters", "search", "pin", "expand", ["json", "a"], ["csv", "a"]]);
});

test("version deletion and tag removal wait for explicit confirmation; sample and clear support Undo", () => {
  const calls = [], toasts = [];
  const before = { tasks: [task] };
  const commands = commandsFor(render(1200, "board", null, false, [task], [], {
    versions: [{ id: "version", label: "Saved version" }], boards: [{ id: "work", label: "Work" }],
    api: { snapshot: () => before, loadSample: () => calls.push("sample"), restore: (value) => calls.push(value), clearCompleted: () => 2, deleteVersion: (id) => calls.push(id), deleteBoard: (id) => { calls.push(id); return { label: "Work", affected: 1 }; } },
    toast: { show: (_, options) => toasts.push(options), success: (_, options) => toasts.push(options) },
  }));
  const remove = commands.find((command) => command.id === "remove-tag");
  const removeVersion = commands.find((command) => command.id === "delete-version");
  assert.equal(remove.children[0].run, undefined);
  assert.equal(removeVersion.run, undefined);
  assert.deepEqual(calls, []);
  remove.children[0].children[0].run();
  removeVersion.children[0].run();
  const sample = commands.find((command) => command.id === "load-sample");
  assert.equal(sample.shortcut, "Shift M");
  sample.run();
  toasts.at(-1).action.onPress();
  commands.find((command) => command.id === "clear-done").children[0].run();
  toasts.at(-1).action.onPress();
  assert.deepEqual(calls, ["work", "version", "sample", before, before]);
});

test("selection commands only affect selected visible cards and require confirmation for deletion", () => {
  const first = { ...task, sectionId: "list" }, second = { ...task, id: "b", sectionId: "list" };
  const calls = [], updates = [];
  const commands = commandsFor(render(1200, "board", null, false, [first, second], updates, {
    sections: [{ id: "list", title: "List" }], states: { 27: true, 28: new Set(["a"]) },
    api: { snapshot: () => ({}), toggleComplete: (id) => calls.push(["complete", id]), patchTask: (id, patch) => calls.push([id, patch.priority]), deleteTask: (id) => calls.push(["delete", id]) }, toast: { success() {} },
  }));
  commands.find((command) => command.id === "complete-selected").run();
  commands.find((command) => command.id === "priority-selected").children.find((target) => target.id === "high").run();
  const remove = commands.find((command) => command.id === "delete-selected");
  assert.equal(remove.run, undefined);
  remove.children[0].run();
  assert.deepEqual(calls, [["complete", "a"], ["a", "high"], ["delete", "a"]]);
  assert.ok(updates.some(([index, value]) => index === 27 && value === false));
});
test("board ribbon restores saved display choices and automatically remembers changes", () => {
  const saved = { compactCards: true, focusedColumn: true, showMoveArrows: true, zoom: 1.2 };
  const updates = [];
  const tree = render(1200, "board", null, false, [task], [], { boardDisplay: saved, onDisplayChange: (patch) => updates.push(patch) });
  const ribbon = find(tree, (node) => node.type === "MobileBoardRibbon")[0];
  assert.equal(ribbon.props.compact, true);
  assert.equal(ribbon.props.focused, true);
  assert.equal(ribbon.props.showMoveArrows, true);
  assert.equal(ribbon.props.zoom, 1.2);
  ribbon.props.onCompact();
  ribbon.props.onFocused();
  ribbon.props.onShowMoveArrows();
  ribbon.props.onZoom(5);
  assert.equal(JSON.stringify(updates), JSON.stringify([{ compactCards: false }, { focusedColumn: false }, { showMoveArrows: false }, { zoom: 1.3 }]));
  const columns = find(tree, (node) => node.type === "MobileTaskColumns")[0];
  assert.equal(columns.props.compact, true);
  assert.equal(columns.props.focused, true);
  assert.equal(columns.props.zoom, 1.2);
});

test("workspace commands navigate views and Home, and inline Calendar selection does not block shortcuts", () => {
  const updates = [], routes = [];
  const tree = render(1200, "calendar", task, true, [task], updates, { calendarDay: new Date("2026-10-28"), onNavigate: (route) => routes.push(route) });
  const palette = find(tree, (node) => node.type === "CommandPalette")[0];
  assert.equal(palette.props.blocked, false);
  const commands = palette.props.commands;
  assert.equal(commands.find((command) => command.id === "view-board").shortcut, "1");
  commands.find((command) => command.id === "view-board").run();
  assert.ok(updates.some(([index, value]) => index === 0 && value === "board"));
  commands.find((command) => command.id === "all-boards").run();
  assert.deepEqual(routes, ["/"]);
  assert.ok(updates.some(([index, value]) => index === 12 && value === false), "navigation closes the task editor");
});
test("the workspace stays capped to the visible viewport across screen heights", () => {
  for (const height of [480, 844, 1000]) for (const width of [390, 1024, 1440]) {
    const tree = render(width, "board", null, false, [task], [], { height });
    const viewport = find(tree, (node) => node.props?.testID === "workspace-viewport")[0];
    const style = Object.assign({}, ...viewport.props.style);
    assert.equal(style.height, height);
    assert.equal(style.maxHeight, height);
    assert.equal(style.minHeight, 0);
    assert.equal(style.overflow, "hidden", "cards must scroll within the board, not extend the page");
  }
});

test("Calendar navigation clears editors and day/action sheets before changing tabs", () => {
  const day = new Date(2026, 9, 28);
  const scheduled = { ...task, dueAt: new Date(2026, 9, 28, 9).toISOString() };
  for (const width of [390, 768, 1200]) for (const target of ["board", "list", "insights"]) for (const control of ["MobileBoardRibbon", "MobileBoardBottomNav"]) {
    const updates = [];
    const tree = render(width, "calendar", scheduled, true, [scheduled], updates, { calendarDay: day, states: { 25: scheduled, 26: scheduled, 14: scheduled } });
    updates.length = 0;
    find(tree, (node) => node.type === control)[0].props.onMode(target);
    const modeIndex = updates.findIndex(([slot]) => slot === 0);
    assert.ok(modeIndex > 0);
    for (const [slot, value] of [[11, null], [12, false], [13, null], [22, null], [24, null], [25, null], [26, null], [14, null]]) {
      assert.ok(updates.some(([index, next], order) => index === slot && next === value && order < modeIndex), `${control}: state ${slot} closes before ${target}`);
    }
    const states = Object.fromEntries(updates);
    const next = render(width, target, null, false, [scheduled], [], { states });
    assert.equal(editor(next).props.presentation, width >= 900 && target === "list" ? "panel" : "sheet");
    assert.equal(editor(next).props.visible, width >= 900 && target === "list", "only the destination's desktop Activity panel may open");
    assert.equal(find(next, (node) => node.type === "Sheet" && node.props.visible === true).length, 0);
    const calendarAgain = render(width, "calendar", null, false, [scheduled], [], { states: { ...states, 0: "calendar" } });
    assert.equal(find(calendarAgain, (node) => node.type === "Sheet" && node.props.visible === true).length, 0, "returning to Calendar must not reopen the old day sheet");
  }
});

test("leaving the workspace clears task overlays before routing Home", () => {
  const updates = [];
  let navigated = false;
  const tree = render(1200, "calendar", task, true, [task], updates, {
    calendarDay: new Date(2026, 9, 28),
    onNavigate(destination) {
      assert.equal(destination, "/");
      assert.ok(updates.some(([slot, value]) => slot === 12 && value === false));
      assert.ok(updates.some(([slot, value]) => slot === 24 && value === null));
      navigated = true;
    },
  });
  updates.length = 0;
  find(tree, (node) => node.type === "MobileBoardRibbon")[0].props.onBoards();
  assert.equal(navigated, true);
});

test("a retained Calendar date cannot mount a day sheet on another screen", () => {
  for (const mode of ["board", "list", "insights"]) {
    const tree = render(390, mode, null, false, [task], [], { calendarDay: new Date(2026, 9, 28) });
    assert.equal(find(tree, (node) => node.type === "Sheet" && node.props.visible === true).length, 0);
  }
});

test("board switch menu excludes closed boards and closes the editor before navigating", () => {
  const updates = [];
  const destinations = [];
  const tree = render(1200, "board", task, true, [task], updates, {
    projects: [{ id: "board", name: "Current" }, { id: "other", name: "Other" }, { id: "closed", name: "Closed", closedAt: "2026-10-28" }],
    onNavigate: (destination) => destinations.push(destination),
  });
  const menu = find(tree, (node) => node.type === "OptionSheet" && node.props.title === "Switch board")[0];
  assert.deepEqual(Array.from(menu.props.options, (option) => option.label), ["Current", "Other"]);
  menu.props.options[1].onPress();
  assert.deepEqual(destinations, ["/board/other"]);
  assert.ok(updates.some(([slot, value]) => slot === 12 && value === false));
  assert.ok(updates.some(([slot, value]) => slot === 11 && value === null));
});
test("Activity and Calendar share the existing 900px desktop split breakpoint", () => {
  for (const width of [390, 768, 899, 900, 1200]) {
    for (const mode of ["list", "board", "calendar", "insights"]) {
      const split = (mode === "list" || mode === "calendar") && width >= 900;
      const tree = render(width, mode);
      if (split && mode === "calendar") {
        assert.ok(find(tree, (node) => node.props?.testID === "calendar-empty-day-watermark").length);
        assert.equal(editor(tree), undefined);
      } else assert.equal(editor(tree).props.presentation, split ? "panel" : "sheet");
    }
  }
});
test("Calendar opens in today's selected-day view without the legacy planner or an automatic create form", () => {
  assert.ok(!source.includes('title="Plan a day"'));
  for (const width of [900, 1024, 1440]) {
    const tree = render(width, "calendar", null, false, []);
    const calendar = find(tree, (node) => typeof node.type === "function" && node.type.name === "CalendarView")[0];
    assert.equal(calendar.props.selectedDay.toISOString(), "2026-10-28T00:00:00.000Z");
    assert.equal(editor(tree), undefined);
    assert.equal(find(tree, (node) => node.props?.testID === "calendar-empty-day-watermark").length, 1);
    const todayTask = { ...task, dueAt: "2026-10-28T09:00:00.000Z" };
    const scheduled = render(width, "calendar", null, false, [todayTask]);
    assert.equal(editor(scheduled).props.task.id, todayTask.id);
    const creating = render(width, "calendar", null, true, []);
    assert.equal(editor(creating).props.task, null, "explicit creation still opens the editor");
    assert.equal(find(creating, (node) => node.props?.testID === "calendar-empty-day-watermark").length, 0);
  }
  const mobile = render(390, "calendar", null, false, []);
  assert.equal(find(mobile, (node) => node.type === "Sheet" && node.props.visible === true).length, 0, "phones must not automatically open a day sheet");
});

test("desktop Calendar keeps day details inline while mobile keeps the day sheet", () => {
  const day = new Date("2026-10-28T00:00:00");
  const splitTree = render(1200, "calendar", null, false, [task], [], { calendarDay: day });
  const mobileTree = render(390, "calendar", null, false, [task], [], { calendarDay: day });
  const isCalendarView = (node) => typeof node.type === "function" && node.type.name === "CalendarView";
  const splitCalendar = find(splitTree, isCalendarView)[0];
  const mobileCalendar = find(mobileTree, isCalendarView)[0];
  assert.equal(splitCalendar.props.split, true);
  assert.equal(mobileCalendar.props.split, false);
  assert.equal(find(splitTree, (node) => node.type === "Sheet" && node.props.visible === true).length, 0);
  assert.ok(find(mobileTree, (node) => node.type === "Sheet" && node.props.visible === true).length > 0);
  assert.equal(editor(splitTree), undefined, "an empty date must not show an unrelated board task");
  assert.equal(find(splitTree, (node) => node.type === "EmptyState" && node.props.title === "A clear day").length, 0, "the right pane must not duplicate the empty-day message below the calendar");
  const watermark = find(splitTree, (node) => node.props?.testID === "calendar-empty-day-watermark")[0];
  assert.ok(watermark);
  assert.equal(watermark.props.pointerEvents, "none");
  assert.equal(watermark.props.importantForAccessibility, "no-hide-descendants");
  assert.equal(watermark.props.style.backgroundColor, undefined, "the icon must blend into the pane, not sit on another surface");
  assert.equal(watermark.props.children.props.style.opacity, 0.08);
  assert.equal(watermark.props.children.props.style.shadowOpacity, undefined, "the container must not cast a square shadow");
  assert.equal(watermark.props.children.props.children.props.shadow, true);
  assert.equal(watermark.props.children.props.children.type, "JanusLogo");
  assert.equal(watermark.props.children.props.children.props.size, 400, "the logo spans two-thirds of the 600-point right pane");
  assert.equal(find(mobileTree, (node) => node.props?.testID === "calendar-empty-day-watermark").length, 0);
});

test("web and tablet date selection opens the first active task only from that day", () => {
  const day = new Date(2026, 9, 28);
  const dueAt = new Date(2026, 9, 28, 9).toISOString();
  const dayTasks = [
    { ...task, id: "done", dueAt, completed: true },
    { ...task, id: "canceled", dueAt, canceled: true },
    { ...task, id: "active", dueAt },
    { ...task, id: "next", dueAt },
  ];
  const unrelated = { ...task, id: "other-day", priority: "urgent", dueAt: new Date(2026, 9, 29, 9).toISOString() };
  for (const width of [900, 1024, 1440]) {
    const updates = [];
    const tree = render(width, "calendar", unrelated, true, [unrelated, ...dayTasks], updates);
    find(tree, (node) => typeof node.type === "function" && node.type.name === "CalendarView")[0].props.setSelectedDay(day);
    assert.ok(updates.some(([slot, value]) => slot === 24 && value === day));
    assert.ok(updates.some(([slot, value]) => slot === 11 && value?.id === "active"));
    const selectedTree = render(width, "calendar", unrelated, false, [unrelated, ...dayTasks], [], { calendarDay: day });
    assert.equal(editor(selectedTree).props.task.id, "active", "fallback stays in the selected date");
    const manualTree = render(width, "calendar", dayTasks[3], true, [unrelated, ...dayTasks], [], { calendarDay: day });
    assert.equal(editor(manualTree).props.task.id, "next", "manual selection within the day is retained");
    const filteredTree = render(width, "calendar", unrelated, false, [unrelated, ...dayTasks], [], { calendarDay: day, hiddenIds: ["active"] });
    assert.equal(editor(filteredTree).props.task.id, "next", "date selection respects filters");
    const emptyTree = render(width, "calendar", unrelated, false, [unrelated], [], { calendarDay: day });
    assert.equal(editor(emptyTree), undefined);
    const finishedTree = render(width, "calendar", unrelated, false, [unrelated, ...dayTasks.slice(0, 2)], [], { calendarDay: day });
    assert.equal(editor(finishedTree).props.task.id, "done", "finished-only dates stay editable without unrelated tasks");
  }
});

test("mobile day list includes every matching task and opens the editor only from a full task row", () => {
  const day = new Date(2026, 9, 28);
  const dueTasks = Array.from({ length: 4 }, (_, index) => ({ ...task, id: `day-${index}`, dueAt: new Date(2026, 9, 28, 9 + index).toISOString() }));
  const otherTask = { ...task, id: "other", dueAt: new Date(2026, 9, 29, 9).toISOString() };
  const updates = [];
  const tree = render(390, "calendar", null, false, [...dueTasks, otherTask, { ...task, id: "undated", dueAt: null }], updates, { calendarDay: day });
  const sheet = find(tree, (node) => node.type === "Sheet" && node.props.visible === true)[0];
  const rows = find(sheet, (node) => node.type === "TaskCard");
  assert.deepEqual(rows.map((row) => row.props.task.id), dueTasks.map((task) => task.id));
  assert.equal(editor(tree).props.visible, false);
  rows[1].props.onPress();
  assert.ok(updates.some(([slot, value]) => slot === 24 && value === null), "dismiss the day list before opening the editor");
  assert.ok(updates.some(([slot, value]) => slot === 11 && value.id === "day-1"));
  assert.ok(updates.some(([slot, value]) => slot === 12 && value === true));
});
test("empty boards fall back to Board without an automatic Activity create editor", () => {
  for (const width of [390, 1200]) {
    const updates = [];
    const tree = render(width, "list", null, true, [], updates);
    const nav = find(tree, (node) => node.type === "MobileBoardBottomNav")[0];
    assert.equal(nav.props.mode, "board");
    assert.equal(nav.props.hasTasks, false);
    assert.equal(editor(tree).props.visible, false);
    assert.equal(editor(tree).props.presentation, "sheet");
    assert.equal(find(tree, (node) => node.type === "MobileTaskColumns").length, 1);
    assert.ok(updates.some(([index, value]) => index === 0 && value === "board"));
    assert.ok(updates.some(([index, value]) => index === 12 && value === false));
  }
});
test("deleted selections fall back to top priority, or leave Activity when the last task is removed", () => {
  const remaining = { ...task, id: "remaining", priority: "high" };
  assert.equal(editor(render(1000, "list", task, true, [remaining])).props.task.id, "remaining");
  assert.equal(editor(render(1000, "list", task, true, [])).props.visible, false);
});
test("desktop defaults to canonical top priority, not latest update; active tasks win", () => {
  const recent = { ...task, id: "recent", priority: "low", updatedAt: "2026-10-29T10:00:00Z" };
  const high = { ...task, id: "high", priority: "high", dueAt: "2026-10-30" };
  const earlier = { ...high, id: "earlier", dueAt: "2026-10-29" };
  const completed = { ...high, id: "done", completed: true, dueAt: "2026-10-20" };
  const updates = [];
  const tree = render(1200, "list", null, false, [recent, high, completed, earlier], updates);
  assert.equal(editor(tree).props.task.id, "earlier");
  assert.equal(updates.find(([index]) => index === 11)[1].id, "earlier");
  assert.equal(updates.find(([index]) => index === 12)[1], true);
  assert.equal(editor(render(1200, "list", null, false, [completed, { ...recent, canceled: true }])).props.task.id, "done");
});
test("manual selection stays stable across ranking changes, cancel and close; mobile is not auto-opened", () => {
  const high = { ...task, id: "high", priority: "high" };
  for (const selected of [task, { ...task, canceled: true }]) {
    for (const visible of [true, false]) {
      const tree = render(1200, "list", selected, visible, [high, selected]);
      assert.equal(editor(tree).props.task.id, "a");
      assert.equal(editor(tree).props.visible, true);
    }
  }
  for (const [width, mode, selected, visible] of [[390, "list", null, false], [1200, "board", null, false], [1200, "list", task, true], [1200, "list", null, true]]) {
    const changes = [];
    render(width, mode, selected, visible, [task, high], changes);
    assert.equal(changes.some(([index]) => index === 11 || index === 12), false);
  }
  assert.equal(editor(render(390, "list", task, false)).props.visible, false);
});
test("board switch selects the new board default, even when task IDs overlap", () => {
  const other = { ...task, title: "Other board task", priority: "high" };
  const tree = render(1200, "list", task, true, [other], [], { boardId: "other", owner: "board" });
  assert.equal(editor(tree).props.task.title, "Other board task");
  assert.equal(find(tree, (node) => node.props?.testID === "workspace-editor-pane")[0].key, "other");
});
test("filters do not replace an existing selection or change the board-wide default", () => {
  const high = { ...task, id: "high", priority: "high" };
  const options = { hiddenIds: ["a", "high"] };
  assert.equal(editor(render(1200, "list", task, true, [high, task], [], options)).props.task.id, "a");
  assert.equal(editor(render(1200, "list", null, false, [high, task], [], options)).props.task.id, "high");
  assert.equal(source.includes('title="Task details"'), false);
  const nav = find(render(1200, "list", task, true, [high, task], [], options), (node) => node.type === "MobileBoardBottomNav")[0];
  assert.equal(nav.props.hasTasks, true);
  assert.equal(nav.props.mode, "list");
});
test("pane widths stay identical for closed and deleted selections while cards remain", () => {
  for (const [selected, visible, tasks] of [[task, true, [task]], [task, false, [task]], [{ ...task, id: "deleted" }, true, [task]], [null, false, [task]]]) {
    const panel = find(render(1200, "list", selected, visible, tasks), (node) => node.props?.testID === "workspace-editor-pane")[0];
    assert.equal(panel.props.style.minWidth, 0);
    assert.equal(panel.props.style.width, undefined);
  }
});
test("desktop uses uncapped feed width and compact cards while retaining the original nav and scroll clearance", () => {
  const tree = render(1200);
  const feed = find(tree, (node) => node.type === "ScrollView" && node.props.style?.minWidth === 0)[0];
  assert.equal(feed.props.contentContainerStyle.maxWidth, undefined);
  assert.equal(feed.props.contentContainerStyle.padding, 12);
  assert.equal(feed.props.contentContainerStyle.paddingBottom, 112);
  assert.equal(feed.props.children.props.compact, true);
  const nav = find(tree, (node) => node.type === "MobileBoardBottomNav");
  assert.equal(nav.length, 1);
  assert.equal(nav[0].props.inline, undefined);
  const panel = find(tree, (node) => node.props?.testID === "workspace-editor-pane")[0];
  assert.equal(panel.props.style.marginTop, undefined);
  assert.equal(panel.props.style.marginBottom, undefined);
  assert.equal(panel.props.style.borderRadius, undefined);
  assert.equal(panel.props.style.maxWidth, undefined);
  const mobileNav = find(render(390), (node) => node.type === "MobileBoardBottomNav");
  assert.equal(mobileNav[0].props.inline, undefined);
});
test("resizing keeps the editor in the same tree position and retains its selected task", () => {
  for (const width of [390, 1000, 899, 1200]) {
    const current = editor(render(width));
    assert.equal(current.props.task.id, "a");
    assert.equal(current.props.visible, true);
    assert.equal(typeof current.props.onAutoSave, "function");
  }
  // Presentation must not participate in the form key: drafts survive resize.
  return readFile(new URL("../src/components/janus-board-ui.tsx", import.meta.url), "utf8").then((text) => {
    assert.match(text, /const editorKey = `\$\{session\}:\$\{task\?\.id \?\? "new"\}:\$\{initialDueAt \?\? ""\}`/);
  });
});

test("Activity and Calendar allocate equal space to the feed and editor throughout the split breakpoint", () => {
  for (const width of [900, 1024, 1440, 1920]) {
    for (const mode of ["list", "calendar"]) {
      const tree = render(width, mode);
      const feed = find(tree, (node) => node.props?.testID === "workspace-feed-pane")[0];
      const editorPane = find(tree, (node) => node.props?.testID === "workspace-editor-pane")[0];
      assert.equal(feed.props.style.flex, 1);
      assert.equal(editorPane.props.style.flex, 1);
      assert.equal(feed.props.style.minWidth, 0);
      assert.equal(editorPane.props.style.minWidth, 0);
      assert.equal(editorPane.props.style.width, undefined);
    }
  }
  const mobile = render(390, "calendar");
  assert.equal(find(mobile, (node) => node.props?.testID === "workspace-editor-pane")[0].props.style, undefined);
  assert.equal(editor(mobile).props.presentation, "sheet");
});

test("split editors use a flush classic panel surface while mobile sheets keep their own styling", () => {
  const palettes = [
    { card: "#211C17", backgroundAlt: "#191510", cardElevated: "#29231D", border: "#33291F" },
    { card: "#FFFFFF", backgroundAlt: "#EAE6E0", cardElevated: "#FFFFFF", border: "#D6D0C8" },
    { card: "#161B22", backgroundAlt: "#161B22", cardElevated: "#21262D", border: "#30363D" },
  ];
  for (const colors of palettes) for (const mode of ["list", "calendar"]) {
    const tree = render(1200, mode, task, true, [task], [], { colors });
    const pane = find(tree, (node) => node.props?.testID === "workspace-editor-pane")[0];
    assert.equal(pane.props.style.backgroundColor, colors.card);
    assert.equal(pane.props.style.borderLeftWidth, 0.5);
    assert.equal(pane.props.style.borderLeftColor, colors.border);
    assert.equal(pane.props.style.borderRadius, undefined, "the pane reaches the screen edges without rounding");
    assert.equal(pane.props.style.marginTop, undefined, "the panel background starts right under the ribbon");
    assert.equal(pane.props.style.marginRight, undefined);
    assert.equal(pane.props.style.marginBottom, undefined);
    const mobile = render(390, mode, task, true, [task], [], { colors });
    assert.equal(find(mobile, (node) => node.props?.testID === "workspace-editor-pane")[0].props.style, undefined);
  }
});

test("switching cards flushes a debounced draft to the previous task, not the next task", async () => {
  let editorWidth = 390;
  const editorSource = await readFile(new URL("../src/components/janus-board-ui.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(editorSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const slots = [];
  let cursor = 0;
  let effects = [];
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback: (fn) => fn,
    useEffect(fn, deps) { const index = cursor++; const previous = slots[index]; if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); },
  };
  const editorColors = new Proxy({ card: "#211C17", backgroundAlt: "#191510", cardElevated: "#29231D" }, { get: (target, key) => target[key] ?? "#888888" });
  const mocks = {
    react,
    "react-native": { View: "View", Text: "Text", TextInput: "TextInput", ScrollView: "ScrollView", Pressable: "Pressable", Platform: { OS: "web" }, StyleSheet: { create: (v) => v }, useWindowDimensions: () => ({ width: editorWidth, height: 900 }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: editorColors } }) },
    "@/hooks/use-open-session": { useOpenSession: () => 0 },
    "@/theme/layout": { mobileBottomNavClearance: 112 },
    "@/lib/domain/sections": { getTaskSectionId: () => undefined },
    "@/lib/domain/constants": { PRIORITY_ORDER: ["medium", "high"], PRIORITY_META: { medium: { label: "Medium", dot: "#888888" }, high: { label: "High", dot: "#FF0000" } } },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, setTimeout: () => 1, clearTimeout() {}, require: (id) => mocks[id] ?? (id === "react/jsx-runtime" || id === "date-fns" ? require(id) : new Proxy({}, { get: (_, key) => key })) });
  const saves = [];
  const props = { visible: true, task: { ...task, description: "", category: null, dueAt: null, subtasks: [{ id: "step", title: "First step", done: false }] }, boards: [], sections: [{ id: "first", title: "First list" }, { id: "second", title: "Second list" }], presentation: "panel", onAutoSave: (draft) => saves.push(["a", draft.title]) };
  const form = exports.TaskEditor(props).type;
  function renderForm(nextProps) {
    cursor = 0;
    effects = [];
    const tree = form(nextProps);
    effects.forEach((effect) => effect());
    return tree;
  }
  let tree = renderForm(props);
  assert.equal(tree.props.style.backgroundColor, "transparent");
  assert.equal(find(tree, (node) => node.props?.label === "Close task editor").length, 0);
  const panelScroll = find(tree, (node) => node.type === "ScrollView" && node.props.contentContainerStyle?.[1]?.paddingBottom === 112)[0];
  assert.ok(panelScroll, "panel keeps navigation clearance inside its own scrolling area, not a wasted outer margin");
  assert.equal(find(panelScroll, (node) => node.props?.accessibilityLabel === "Delete task").length, 1);
  const field = (id) => find(tree, (node) => node.props?.testID === id)[0];
  assert.equal(field("task-editor-title-field").props.style, undefined, "title spans the full editor width");
  assert.equal(field("task-editor-notes-field").props.style, undefined, "notes span the full editor width");
  const pairedRow = field("task-editor-priority-schedule-row");
  assert.equal(pairedRow.props.style.flexWrap, "wrap", "paired controls stack when the panel is narrow");
  assert.equal(pairedRow.props.children[0].props.testID, "task-editor-priority-field");
  assert.equal(pairedRow.props.children[1].props.testID, "task-editor-schedule-field");
  assert.equal(field("task-editor-tags-list-row").props.style.flexWrap, "wrap");
  assert.equal(field("task-editor-tags-wrap").props.style.flexWrap, "wrap");
  find(tree, (node) => node.props?.accessibilityRole === "checkbox")[0].props.onPress();
  find(tree, (node) => node.props?.accessibilityLabel === "Set due date")[0].props.onPress();
  tree = renderForm(props);
  assert.equal(find(tree, (node) => node.props?.mode === "date").length, 1, "schedule picker still opens");
  assert.equal(find(tree, (node) => node.props?.label === "High")[0].props.active, true);
  assert.equal(find(tree, (node) => node.props?.accessibilityRole === "checkbox")[0].props.accessibilityState.checked, true);
  find(tree, (node) => node.props?.accessibilityLabel === "Task title")[0].props.onChangeText("Edited just before switching");
  tree = renderForm(props);
  // A layout resize preserves the form hooks and doesn't save prematurely.
  editorWidth = 1200;
  tree = renderForm({ ...props, presentation: "sheet" });
  assert.equal(tree.type, "EditorWindow");
  assert.equal(tree.props.title, "Edit task");
  assert.equal(tree.props.subtitle, undefined);
  assert.equal(find(tree, (node) => node.props?.testID === "task-editor-tags-list-row").length, 1);
  assert.equal(find(tree, (node) => node.type === "ScrollView" && node.props.horizontal).length, 0);
  assert.equal(find(tree, (node) => node.props?.accessibilityLabel === "Task title")[0].props.value, "Edited just before switching");
  assert.equal(saves.length, 0);
  editorWidth = 390;
  tree = renderForm({ ...props, presentation: "sheet" });
  assert.equal(tree.props.style.backgroundColor, undefined, "mobile sheet keeps its own original surface");
  assert.equal(find(tree, (node) => node.props?.label === "Close task editor").length, 1);
  assert.equal(find(tree, (node) => node.props?.testID === "task-editor-tags-list-row").length, 0);
  assert.equal(find(tree, (node) => node.type === "ScrollView" && node.props.horizontal).length, 2, "mobile keeps its horizontal tag and list rails");
  assert.equal(find(tree, (node) => node.props?.label === "High")[0].props.active, true);
  assert.equal(saves.length, 0);
  assert.equal(find(tree, (node) => node.props?.accessibilityLabel === "Task title")[0].props.value, "Edited just before switching");
  slots.forEach((slot) => slot?.cleanup?.());
  assert.deepEqual(saves, [["a", "Edited just before switching"]]);
});
