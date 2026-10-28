import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const dates = require("date-fns");
const colors = new Proxy({}, { get: () => "#888888" });
const react = { useMemo: (fn) => fn() };
const native = { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (value) => value, absoluteFill: {}, hairlineWidth: 0.5 } };
const panelSource = await readFile(new URL("../src/components/calendar/calendar-panel.tsx", import.meta.url), "utf8");
const panelExports = {};
vm.runInNewContext(ts.transpileModule(panelSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports: panelExports, require: (id) => ({
    react, "react-native": native, "date-fns": dates, "@expo/vector-icons": { Ionicons: "Icon" },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors } }) },
    "@/lib/domain/status": { deriveStatus: () => "upcoming" },
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
function render(mode, split, selectedDay = null, entries = tasks) {
  const selected = [];
  const edited = [];
  const actions = [];
  const exports = {};
  vm.runInNewContext(viewCode, {
    exports, require, ...dates, useTheme: () => ({ theme: { colors } }),
    usePreferences: () => ({ calendarDefaultView: mode, calendarWeekStart: 1 }),
    useMemo: react.useMemo, useState: (initial) => [initial, () => {}],
    View: "View", Text: "Text", Button: "Button", SectionHeading: "Heading", Ionicons: "Icon", CalendarPanel: "CalendarPanel", TaskCard: "TaskCard", StyleSheet: {},
  });
  const tree = exports.CalendarView({ month: day, selectedDay, tasks: entries, boards: [], now: day, split, setSelectedDay: (day) => selected.push(day), onTask: (task) => edited.push(task), onTaskAction: (task) => actions.push(task) });
  const props = nodes(tree).find((node) => node.type === "CalendarPanel").props;
  return { tree: panelExports.CalendarPanel(props), view: tree, selected, edited, actions, props };
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
    const rows = nodes(view).filter((node) => node.type === "TaskCard");
    assert.deepEqual(rows.map((node) => node.props.task.id), tasks.map((task) => task.id));
    rows[2].props.onPress();
    rows[2].props.onLongPress();
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
