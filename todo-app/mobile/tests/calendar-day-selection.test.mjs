import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const dates = require("date-fns");
const colors = new Proxy({ primary: "#0066aa", card: "#ffffff", primarySoft: "#ddeeff" }, { get: (target, key) => target[key] ?? "#888888" });
const react = { useMemo: (fn) => fn() };
const native = { Platform: { OS: "web" }, View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (value) => value, absoluteFill: {}, hairlineWidth: 0.5 } };
const panelSource = await readFile(new URL("../src/components/calendar/calendar-panel.tsx", import.meta.url), "utf8");
const panelExports = {};
const tactile = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/components/ui/tactile.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: tactile });
vm.runInNewContext(ts.transpileModule(panelSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports: panelExports, require: (id) => ({
    react, "react-native": native, "date-fns": dates, "@expo/vector-icons": { Ionicons: "Icon" },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors } }) },
    "@/lib/domain/status": { deriveStatus: () => "upcoming" },
    "@/components/ui/tactile": tactile,
    "@/components/ui/selection-led": { SelectionLed: "SelectionLed" },
  })[id] ?? require(id),
});
const screenSource = await readFile(new URL("../app/board/[id].tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("board.tsx", screenSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "CalendarView");
const viewCode = ts.transpileModule(`export ${declaration.getText(ast)}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const day = new Date(2026, 9, 28);
const tasks = Array.from({ length: 4 }, (_, index) => ({ id: `task-${index}`, title: `Task ${index}`, priority: "medium", completed: false, canceled: false, dueAt: new Date(2026, 9, 28, 9 + index).toISOString() }));
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function render(mode, split, selectedDay = null, entries = tasks, { now = day, month = day, weekStartsOn = 1 } = {}) {
  const selected = [];
  const anchors = [];
  const edited = [];
  const actions = [];
  const additions = [];
  const exports = {};
  vm.runInNewContext(viewCode, {
    exports, require, ...dates, useTheme: () => ({ theme: { colors } }),
    usePreferences: () => ({ calendarDefaultView: mode, calendarWeekStart: weekStartsOn }),
    useMemo: react.useMemo, useState: (initial) => [initial, () => {}],
    View: "View", Text: "Text", Button: "Button", SectionHeading: "Heading", Ionicons: "Icon", CalendarPanel: "CalendarPanel", CalendarDayTasks: "CalendarDayTasks", TaskCard: "TaskCard", StyleSheet: {},
  });
  const tree = exports.CalendarView({ month, setMonth: (day) => anchors.push(day), selectedDay, tasks: entries, boards: [], now, split, setSelectedDay: (day) => selected.push(day), onTask: (task) => edited.push(task), onTaskAction: (task) => actions.push(task), onAddTask: (dueAt) => additions.push(dueAt) });
  const props = nodes(tree).find((node) => node.type === "CalendarPanel").props;
  return { tree: panelExports.CalendarPanel(props), view: tree, selected, anchors, edited, actions, props, additions };
}

test("mobile month and week task chips select the day instead of opening tiny task targets", () => {
  for (const mode of ["month", "week"]) {
    const { tree, selected, edited, actions, props } = render(mode, false);
    assert.equal(props.daySelectionOnly, true);
    const chips = nodes(tree).filter((node) => node.props?.accessibilityLabel === `View tasks for ${dates.format(day, "EEEE, MMMM d")}`);
    assert.equal(chips.length, mode === "month" ? 2 : 4);
    for (const chip of chips) {
      let stopped = false;
      chip.props.onPress({ stopPropagation: () => { stopped = true; } });
      assert.ok(stopped);
      assert.equal(chip.props.onLongPress, undefined, "small chips must not open task action sheets either");
    }
    assert.ok(selected.every((selectedDay) => dates.isSameDay(selectedDay, day)));
    assert.equal(edited.length, 0);
    assert.equal(actions.length, 0);
    const dateButton = nodes(tree).find((node) => node.props?.accessibilityLabel === `Select ${dates.format(day, "EEEE, MMMM d")}`);
    dateButton.props.onPress();
    assert.equal(selected.length, chips.length + 1);
  }
});

test("web and tablet chips select the day; full day rows retain editing and long-press actions", () => {
  for (const mode of ["month", "week"]) {
    const { tree, selected, edited, actions, props, view } = render(mode, true, day, [...tasks, { ...tasks[0], id: "other", dueAt: dates.addDays(day, 1).toISOString() }]);
    assert.equal(props.daySelectionOnly, true);
    const chip = nodes(tree).find((node) => node.props?.accessibilityLabel === `View tasks for ${dates.format(day, "EEEE, MMMM d")}`);
    chip.props.onPress({ stopPropagation() {} });
    assert.equal(selected.length, 1);
    assert.equal(edited.length, 0);
    const rows = nodes(view).filter((node) => node.type === "CalendarDayTasks");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].props.day, day);
    assert.deepEqual(rows[0].props.tasks.map((task) => task.id), tasks.map((task) => task.id));
    rows[0].props.onTask(tasks[2]);
    rows[0].props.onTaskAction(tasks[2]);
    assert.deepEqual(edited, [tasks[2]]);
    assert.deepEqual(actions, [tasks[2]]);
  }
});

test("empty mobile dates still open day selection without opening an editor", () => {
  const { tree, selected, edited } = render("month", false);
  const emptyDay = dates.addDays(day, 1);
  nodes(tree).find((node) => node.props?.accessibilityLabel === `Select ${dates.format(emptyDay, "EEEE, MMMM d")}`).props.onPress();
  assert.ok(dates.isSameDay(selected[0], emptyDay));
  assert.equal(edited.length, 0);
});

test("Today navigates and selects the current date in month/week, mobile/split and either week-start setting", () => {
  const now = new Date(2026, 10, 1, 15, 45);
  const stale = new Date(2026, 9, 22);
  for (const mode of ["month", "week"]) for (const split of [false, true]) for (const weekStartsOn of [0, 1]) {
    const result = render(mode, split, stale, [], { now, month: stale, weekStartsOn });
    nodes(result.tree).find((node) => node.props?.accessibilityLabel === "Jump to today").props.onPress();
    assert.equal(result.selected.length, 1);
    assert.equal(result.selected[0].getTime(), dates.startOfDay(now).getTime());
    assert.equal(result.anchors.length, 1);
    const expected = mode === "week" ? dates.startOfWeek(now, { weekStartsOn }) : dates.startOfMonth(now);
    assert.equal(result.anchors[0].getTime(), expected.getTime());
    assert.equal(result.edited.length, 0, "Today does not open an arbitrary task");
  }
});

test("selection uses a rounded date tile with an LED without tinting cells or changing task previews", () => {
  const flatten = (styles) => Object.assign({}, ...[styles].flat().filter(Boolean));
  const { tree } = render("month", true, day);
  const cell = nodes(tree).find((node) => node.props?.testID === `calendar-day-${dates.format(day, "yyyy-MM-dd")}`);
  assert.equal(flatten(cell.props.style).backgroundColor, colors.card, "selected day has no full-cell tint");
  const badge = nodes(cell).find((node) => node.props?.testID === `calendar-date-${dates.format(day, "yyyy-MM-dd")}`);
  assert.equal(flatten(badge.props.style).backgroundColor, colors.secondary);
  assert.equal(flatten(badge.props.style).borderColor, colors.borderStrong);
  assert.equal(flatten(badge.props.style).borderRadius, 10);
  assert.equal(flatten(badge.props.style).height, 44);
  assert.equal(flatten(badge.props.style).flex, 1);
  assert.equal(nodes(badge).find((node) => node.type === "SelectionLed").props.selected, true);
  const previews = nodes(cell).filter((node) => node.props?.accessibilityLabel === `View tasks for ${dates.format(day, "EEEE, MMMM d")}`);
  for (const preview of previews) {
    assert.equal(flatten(preview.props.style({ pressed: false })).backgroundColor, undefined);
    assert.equal(nodes(preview).filter((node) => node.type === "View").length, 0, "no colored dot beside the task");
    assert.equal(nodes(preview).find((node) => node.type === "Text").props.numberOfLines, 1);
  }
});

test("today uses the picker's green text instead of a circle when another day is selected", () => {
  const { tree } = render("month", true, dates.addDays(day, -6));
  const badge = nodes(tree).find((node) => node.props?.testID === `calendar-date-${dates.format(day, "yyyy-MM-dd")}`);
  const appearance = Object.assign({}, ...badge.props.style.filter(Boolean));
  assert.equal(appearance.borderColor, "transparent");
  assert.equal(appearance.backgroundColor, undefined);
  const text = nodes(badge).find((node) => node.type === "Text");
  assert.equal(Object.assign({}, ...text.props.style.filter(Boolean)).color, colors.success);
  assert.equal(nodes(badge).some((node) => node.type === "SelectionLed"), false);
});

test("month and week selections keep exactly one lit tile, including Today and populated days", () => {
  const flatten = (style) => Object.assign({}, ...style.filter(Boolean));
  for (const mode of ["month", "week"]) for (const split of [false, true]) {
    const { tree } = render(mode, split, day);
    const leds = nodes(tree).filter((node) => node.type === "SelectionLed");
    assert.equal(leds.length, 1);
    const badge = nodes(tree).find((node) => node.props?.testID === `calendar-date-${dates.format(day, "yyyy-MM-dd")}`);
    assert.equal(flatten(badge.props.style).borderRadius, 10);
    assert.equal(flatten(nodes(badge).find((node) => node.type === "Text").props.style).color, colors.foreground);
    const cell = nodes(tree).find((node) => node.props?.testID === `calendar-day-${dates.format(day, "yyyy-MM-dd")}`);
    assert.ok(nodes(cell).some((node) => Array.isArray(node.props?.children) && node.props.children.join("") === "+2") || mode === "week");
    const selection = nodes(cell).find((node) => node.props?.accessibilityLabel?.startsWith("Select "));
    assert.equal(selection.props["aria-pressed"], true);
    selection.props.onPress();
  }
});

test("main calendar uses the Schedule picker's borderless grid and unboxed weekdays", () => {
  const flatten = (style) => Object.assign({}, ...[style].flat().filter(Boolean));
  for (const mode of ["month", "week"]) {
    const { tree } = render(mode, true, day);
    const grid = nodes(tree).find((node) => node.props?.testID === "main-calendar-grid");
    assert.equal(flatten(grid.props.style).borderWidth, undefined);
    const weekdays = nodes(tree).find((node) => node.props?.testID === "calendar-weekdays");
    assert.equal(flatten(weekdays.props.style).backgroundColor, undefined);
    for (const cell of nodes(grid).filter((node) => node.props?.testID?.startsWith("calendar-day-"))) {
      const style = flatten(cell.props.style);
      assert.equal(style.borderRightWidth, undefined);
      assert.equal(style.borderBottomWidth, undefined);
    }
  }
});

test("the selected-day creation card supplies that exact local day without mutating selection", () => {
  for (const mode of ["month", "week"]) for (const selected of [new Date(2026, 11, 31), new Date(2027, 0, 1)]) {
    const result = render(mode, true, selected, [], { month: selected });
    const dayTasks = nodes(result.view).find((node) => node.type === "CalendarDayTasks");
    const original = selected.getTime();
    dayTasks.props.onAddTask();
    assert.equal(new Date(result.additions[0]).toDateString(), selected.toDateString());
    assert.equal(selected.getTime(), original);
  }
});

test("Today confirms selection without changing its label, width or icon-free content", () => {
  for (const mode of ["month", "week"]) for (const split of [false, true]) {
    const result = render(mode, split, dates.addDays(day, -1));
    const button = nodes(result.tree).find((node) => node.props?.accessibilityLabel === "Jump to today");
    assert.equal(button.props.disabled, false);
    button.props.onPress();
    const updated = render(mode, split, result.selected[0], tasks, { month: result.anchors[0] });
    const selected = nodes(updated.tree).find((node) => node.props?.accessibilityLabel === "Jump to today");
    assert.equal(selected.props.disabled, true);
    assert.equal(selected.props.accessibilityState.disabled, true);
    assert.equal(selected.props.accessibilityState.selected, true);
    assert.equal(selected.props.onPress, undefined);
    assert.equal(nodes(selected).filter((node) => node.type === "Icon").length, 0);
    assert.ok(nodes(selected).some((node) => node.props?.children === "Today"));
    const appearance = Object.assign({}, ...selected.props.style({ pressed: false }).filter(Boolean));
    const original = Object.assign({}, ...button.props.style({ pressed: false }).filter(Boolean));
    assert.equal(appearance.width, original.width);
    assert.equal(appearance.height, original.height);
    const face = nodes(selected).find((node) => node.type === "View" && node.props.pointerEvents === "none");
    const faceStyle = face.props.style;
    assert.equal(faceStyle.borderWidth, undefined);
    assert.equal(faceStyle.backgroundColor, undefined, "Today is text-only, including when selected");
    assert.equal(faceStyle.height, 30);
    const text = nodes(selected).find((node) => node.props?.children === "Today");
    assert.equal(Object.assign({}, ...text.props.style.filter(Boolean)).color, colors.primary);
  }
});

test("Today stays available with no selection, a different day, or a different visible period", () => {
  for (const mode of ["month", "week"]) for (const selectedDay of [null, dates.addDays(day, 1), day]) {
    const month = selectedDay === day ? dates.addMonths(day, 2) : day;
    const { tree } = render(mode, true, selectedDay, [], { month });
    const button = nodes(tree).find((node) => node.props?.accessibilityLabel === "Jump to today");
    assert.equal(button.props.disabled, false);
    assert.equal(typeof button.props.onPress, "function");
    assert.equal(nodes(button).filter((node) => node.type === "Icon").length, 0);
    assert.ok(nodes(button).some((node) => node.props?.children === "Today"));
    const text = nodes(button).find((node) => node.props?.children === "Today");
    assert.equal(Object.assign({}, ...text.props.style.filter(Boolean)).color, colors.mutedForeground);
    const face = nodes(button).find((node) => node.type === "View" && node.props.pointerEvents === "none");
    assert.equal(face.props.style.borderWidth, undefined);
    assert.equal(face.props.style.backgroundColor, undefined);
  }
});

test("calendar controls use compact flat faces while retaining 44-point targets and actions", () => {
  const flatten = (styles) => Object.assign({}, ...styles.filter(Boolean));
  const { tree, props } = render("month", false);
  const tabs = nodes(tree).filter((node) => node.props?.accessibilityRole === "tab");
  assert.equal(tabs.length, 2);
  for (const tab of tabs) {
    const normal = flatten(tab.props.style({ pressed: false }));
    const pressed = flatten(tab.props.style({ pressed: true }));
    assert.equal(pressed.width, normal.width);
    assert.equal(pressed.height, 44);
    assert.equal(pressed.boxShadow, undefined);
    assert.equal(pressed.opacity, 0.6);
    const face = nodes(tab).find((node) => node.type === "View" && node.props.pointerEvents === "none");
    const faceStyle = flatten(face.props.style);
    assert.equal(faceStyle.height, 28);
    assert.equal(faceStyle.width, 56);
    assert.notEqual(faceStyle.backgroundColor, colors.primary);
    assert.equal(nodes(tab).some((node) => node.type === "SelectionLed"), false);
    assert.equal(nodes(tab).filter((node) => node.type === "Icon").length, 0);
  }
  const modeChanges = [];
  const updated = panelExports.CalendarPanel({ ...props, onModeChange: (mode) => modeChanges.push(mode) });
  nodes(updated).filter((node) => node.props?.accessibilityRole === "tab").forEach((tab) => tab.props.onPress());
  assert.deepEqual(modeChanges, ["month", "week"]);
  const nav = nodes(tree).filter((node) => node.type?.name === "NavButton");
  assert.equal(nav.length, 2);
  for (const component of nav) {
    const button = component.type(component.props);
    const normal = flatten(button.props.style({ pressed: false }));
    const pressed = flatten(button.props.style({ pressed: true }));
    assert.equal(normal.width, 44);
    assert.equal(normal.height, 44);
    assert.equal(pressed.width, normal.width);
    assert.equal(pressed.boxShadow, undefined);
    assert.equal(pressed.opacity, 0.5);
    const face = nodes(button).find((node) => node.type === "View");
    assert.equal(face.props.style.width, 30);
    assert.equal(face.props.style.height, 30);
    assert.equal(button.props.onPress, component.props.onPress);
  }
});
