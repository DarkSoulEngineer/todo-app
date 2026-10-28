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
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/lib/features/top-tasks.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: ranking });
const task = { id: "a", title: "First", priority: "medium", subtasks: [], createdAt: "2026-10-28T10:00:00Z", updatedAt: "2026-10-28T10:00:00Z" };
const colors = new Proxy({}, { get: () => "#888888" });
function render(width, mode = "list", selected = task, visible = true, tasks = [task], updates = [], options = {}) {
  let state = 0;
  const effects = [];
  const boardId = options.boardId ?? "board";
  const states = { 0: mode, 11: selected, 12: visible, 24: options.calendarDay ?? null, 31: options.owner ?? boardId };
  const api = { tasks, sections: [], boards: [], versions: [], projects: options.projects ?? [{ id: boardId, name: "Board" }], currentProjectId: boardId };
  const fallback = new Proxy({}, { get: (_, key) => key });
  const mocks = {
    react: { useState: (initial) => { const index = state++; return [index in states ? states[index] : typeof initial === "function" ? initial() : initial, (value) => updates.push([index, value])]; }, useRef: (current) => ({ current }), useEffect: (effect) => effects.push(effect), useMemo: (fn) => fn() },
    "react-native": { View: "View", Text: "Text", ScrollView: "ScrollView", Pressable: "Pressable", StyleSheet: { create: (v) => v, hairlineWidth: 0.5 }, useWindowDimensions: () => ({ width }) },
    "expo-router": { useLocalSearchParams: () => ({ id: boardId }), router: { replace: (destination) => options.onNavigate?.(destination) } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors } }) },
    "@/providers/tasks-provider": { useTasksContext: () => api },
    "@/providers/toast-provider": { useToast: () => ({}) },
    "@/hooks/use-now": { useNow: () => new Date("2026-10-28") },
    "@/lib/domain/tasks-selectors": { sortTasks: (items) => items, matchesQuery: (task) => !(options.hiddenIds ?? []).includes(task.id) },
    "@/lib/domain/sections": { getTaskSectionId: () => undefined },
    "@/lib/features/ribbon-context": { getRibbonContext: () => ({}) },
    "@/lib/features/top-tasks": ranking,
    "@/lib/domain/constants": { SORT_OPTIONS: [], PRIORITY_ORDER: [] },
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
      assert.equal(editor(render(width, mode)).props.presentation, split ? "panel" : "sheet");
    }
  }
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
  assert.equal(editor(splitTree).props.presentation, "panel");
  assert.equal(editor(splitTree).props.visible, true);
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
  assert.equal(find(tree, (node) => node.props?.style?.flex === 6)[0].key, "other");
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
    const panel = find(render(1200, "list", selected, visible, tasks), (node) => node.props?.style?.flex === 6)[0];
    assert.equal(panel.props.style.minWidth, 440);
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
  const panel = find(tree, (node) => node.props?.style?.flex === 6)[0];
  assert.equal(panel.props.style.marginBottom, 12);
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

test("switching cards flushes a debounced draft to the previous task, not the next task", async () => {
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
  const mocks = {
    react,
    "react-native": { View: "View", Text: "Text", TextInput: "TextInput", ScrollView: "ScrollView", Pressable: "Pressable", StyleSheet: { create: (v) => v } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors } }) },
    "@/hooks/use-open-session": { useOpenSession: () => 0 },
    "@/theme/layout": { mobileBottomNavClearance: 112 },
    "@/lib/domain/sections": { getTaskSectionId: () => undefined },
    "@/lib/domain/constants": { PRIORITY_ORDER: [] },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, setTimeout: () => 1, clearTimeout() {}, require: (id) => mocks[id] ?? (id === "react/jsx-runtime" || id === "date-fns" ? require(id) : new Proxy({}, { get: (_, key) => key })) });
  const saves = [];
  const props = { visible: true, task: { ...task, description: "", category: null, dueAt: null }, boards: [], sections: [], presentation: "panel", onAutoSave: (draft) => saves.push(["a", draft.title]) };
  const form = exports.TaskEditor(props).type;
  function renderForm(nextProps) {
    cursor = 0;
    effects = [];
    const tree = form(nextProps);
    effects.forEach((effect) => effect());
    return tree;
  }
  let tree = renderForm(props);
  assert.equal(find(tree, (node) => node.props?.label === "Close task editor").length, 0);
  const panelScroll = find(tree, (node) => node.type === "ScrollView" && node.props.contentContainerStyle?.[1]?.paddingBottom === 112)[0];
  assert.ok(panelScroll, "panel keeps navigation clearance inside its own scrolling area, not a wasted outer margin");
  assert.equal(find(panelScroll, (node) => node.props?.accessibilityLabel === "Delete task").length, 1);
  find(tree, (node) => node.props?.accessibilityLabel === "Task title")[0].props.onChangeText("Edited just before switching");
  tree = renderForm(props);
  // A layout resize preserves the form hooks and doesn't save prematurely.
  tree = renderForm({ ...props, presentation: "sheet" });
  assert.equal(find(tree, (node) => node.props?.label === "Close task editor").length, 1);
  assert.equal(saves.length, 0);
  assert.equal(find(tree, (node) => node.props?.accessibilityLabel === "Task title")[0].props.value, "Edited just before switching");
  slots.forEach((slot) => slot?.cleanup?.());
  assert.deepEqual(saves, [["a", "Edited just before switching"]]);
});
