import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const dates = require("date-fns");
function compile(path) {
  return ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
}
const utilityCode = compile("lib/utils/task-schedule.ts");
const utils = {};
new Function("require", "exports", utilityCode)(require, utils);
const tactile = {};
new Function("exports", compile("components/ui/tactile.ts"))(tactile);
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const button = (tree, label) => nodes(tree).find((node) => node.props?.accessibilityLabel === label || node.props?.label === label);

function setup({ value: initial = null, now = new Date(2026, 9, 30, 10, 15), weekStart = 1, dateLocked = false } = {}) {
  let active, cursor = 0, value = initial, timeKey;
  const rootState = [], timeState = [], changes = [];
  const react = { useState(initial) {
    const slots = active, index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
    return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
  } };
  const mocks = {
    react, "date-fns": dates,
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (style) => style } },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { scheme: "dark", colors: { foreground: "#eee", mutedForeground: "#aaa", primary: "#fa0", card: "#222", cardElevated: "#333", secondary: "#444", border: "#555", success: "#0a8" } } }) },
    "@/providers/preferences-provider": { usePreferences: () => ({ calendarWeekStart: weekStart }) },
    "@/lib/utils/task-schedule": utils,
    "./button": { Button: "Button" }, "./input": { Input: "Input" }, "./selection-led": { SelectionLed: "Led" }, "./tactile": tactile,
    "./sheet": { Sheet: "Sheet" },
    "react/jsx-runtime": require("react/jsx-runtime"),
  };
  const exports = {};
  new Function("require", "exports", compile("components/ui/task-schedule-picker.tsx"))((id) => {
    assert.ok(id in mocks, `Unexpected import ${id}`);
    return mocks[id];
  }, exports);
  const render = () => {
    active = rootState; cursor = 0;
    return exports.TaskSchedulePicker({ value, now, dateLocked, onChange: (next) => { changes.push(next); value = next; } });
  };
  return { render, changes, timePanel() {
    const child = nodes(render()).find((node) => node.type?.name === "ScheduleTimePanel");
    assert.ok(child, "Time controls must be inline");
    if (child.key !== timeKey) { timeState.length = 0; timeKey = child.key; }
    active = timeState; cursor = 0;
    return child.type(child.props);
  } };
}

test("calendar and time controls are directly visible without launcher buttons or popup state", () => {
  const app = setup({ now: new Date(2026, 11, 30) });
  let tree = app.render();
  assert.ok(nodes(tree).some((node) => node.props?.testID === "schedule-calendar"));
  assert.equal(button(tree, "Set due date"), undefined);
  assert.equal(button(tree, "Edit due time"), undefined);
  assert.equal(button(app.timePanel(), "Due hour").props.editable, false);
  assert.equal(button(app.timePanel(), "Apply time").props.disabled, true);
  assert.ok(nodes(tree).some((node) => node.props?.children === "December 2026"));
  button(tree, "Next picker month").props.onPress();
  tree = app.render();
  assert.ok(nodes(tree).some((node) => node.props?.children === "January 2027"));
  button(tree, "Previous picker month").props.onPress();
  assert.equal(nodes(app.render()).some((node) => node.props?.testID === "schedule-calendar"), true);
  assert.deepEqual(app.changes, []);
});

test("calendar honors either week start, including leading/trailing days and leap years", () => {
  for (const weekStart of [0, 1]) {
    const app = setup({ weekStart });
    const cells = nodes(app.render()).filter((node) => node.props?.accessibilityLabel?.startsWith("Choose ") && node.type === "Pressable" && node.props?.["aria-pressed"] !== undefined);
    assert.equal(cells.length, 42);
    assert.match(cells[0].props.accessibilityLabel, weekStart === 1 ? /Monday, September 28, 2026/ : /Sunday, September 27, 2026/);
    const leap = utils.scheduleCalendarDays(new Date(2028, 1, 1), weekStart);
    assert.ok(leap.some((day) => day.getMonth() === 1 && day.getDate() === 29));
    assert.equal(new Set(leap.map((day) => dates.format(day, "yyyy-MM-dd"))).size, 42);
  }
});

test("choosing a date sets local end of day, keeps the calendar visible and enables time", () => {
  const app = setup();
  button(app.render(), "Choose Saturday, October 31, 2026").props.onPress();
  const due = new Date(app.changes[0]);
  assert.equal(due.getDate(), 31);
  assert.equal(due.getMonth(), 9);
  assert.equal(due.getHours(), 23);
  assert.equal(due.getMinutes(), 59);
  assert.equal(button(app.timePanel(), "Due hour").props.editable, true);
  assert.equal(nodes(app.render()).some((node) => node.props?.testID === "schedule-calendar"), true);
  button(app.render(), "Clear due date").props.onPress();
  assert.equal(app.changes.at(-1), null);
});

test("quick dates preserve an existing local time across month and year boundaries", () => {
  for (const [label, expected] of [["Today", new Date(2026, 11, 31)], ["Tomorrow", new Date(2027, 0, 1)], ["+1 week", new Date(2027, 0, 7)]]) {
    const app = setup({ value: new Date(2026, 11, 30, 14, 35).toISOString(), now: new Date(2026, 11, 31) });
    button(app.render(), label).props.onPress();
    const due = new Date(app.changes[0]);
    assert.equal(due.toDateString(), expected.toDateString());
    assert.equal(due.getHours(), 14);
    assert.equal(due.getMinutes(), 35);
  }
});

test("date shortcuts have clear raised button surfaces and month arrows keep their compact faces", () => {
  const app = setup();
  const flatten = (style) => Object.assign({}, ...[style].flat().filter(Boolean));
  for (const label of ["Today", "Tomorrow", "+1 week"]) {
    const shortcut = button(app.render(), label);
    const surface = flatten(shortcut.props.style({ pressed: false }));
    assert.equal(surface.minHeight, 44);
    assert.equal(surface.backgroundColor, "#444");
    assert.equal(surface.borderWidth, 1);
    assert.equal(surface.borderRadius, 10);
    assert.ok(surface.boxShadow);
    const pressed = flatten(shortcut.props.style({ pressed: true }));
    assert.equal(pressed.transform[0].translateY, 2);
    assert.equal(pressed.minHeight, surface.minHeight);
    const text = nodes(shortcut).find((node) => node.type === "Text");
    assert.equal(flatten(text.props.style).color, "#eee");
  }
  button(app.render(), "Tomorrow").props.onPress();
  for (const label of ["Today", "Tomorrow", "+1 week"]) {
    const shortcut = button(app.render(), label);
    const text = nodes(shortcut).find((node) => node.type === "Text");
    assert.equal(shortcut.props.accessibilityState.selected, label === "Tomorrow");
    assert.equal(flatten(text.props.style).color, "#eee");
    assert.equal(flatten(text.props.style).fontWeight, "600");
    const surface = flatten(shortcut.props.style({ pressed: false }));
    assert.equal(surface.backgroundColor, label === "Tomorrow" ? "#333" : "#444");
    assert.equal(nodes(shortcut).find((node) => node.type === "Led").props.selected, label === "Tomorrow");
  }
  for (const label of ["Previous picker month", "Next picker month"]) {
    const arrow = button(app.render(), label);
    const target = flatten(arrow.props.style({ pressed: false }));
    const face = nodes(arrow).find((node) => node.type === "View");
    assert.equal(target.width, 44);
    assert.equal(target.height, 44);
    assert.equal(target.boxShadow, undefined);
    assert.equal(flatten(face.props.style).width, 30);
    assert.equal(flatten(face.props.style).height, 30);
  }
});

test("time entry is a draft until applied, rejects invalid values, and preserves the chosen day", () => {
  const original = new Date(2026, 9, 31, 16, 30);
  const app = setup({ value: original.toISOString() });
  let panel = app.timePanel();
  button(panel, "Due hour").props.onChangeText("99");
  assert.equal(button(app.timePanel(), "Apply time").props.disabled, true);
  button(app.timePanel(), "Apply time").props.onPress();
  assert.deepEqual(app.changes, []);
  button(app.timePanel(), "Morning").props.onPress();
  assert.equal(button(app.timePanel(), "Due hour").props.value, "09");
  assert.deepEqual(app.changes, [], "presets edit the draft only");
  button(app.timePanel(), "Due minute").props.onChangeText("07");
  button(app.timePanel(), "Apply time").props.onPress();
  const due = new Date(app.changes[0]);
  assert.equal(due.toDateString(), original.toDateString());
  assert.equal(due.getHours(), 9);
  assert.equal(due.getMinutes(), 7);
  assert.equal(button(app.timePanel(), "Due hour").props.value, "09");
});

test("removing the date discards time drafts, and invalid stored dates are treated as unscheduled", () => {
  const app = setup({ value: new Date(2026, 9, 31, 16, 30).toISOString() });
  button(app.timePanel(), "End of day").props.onPress();
  assert.deepEqual(app.changes, []);
  button(app.render(), "Clear due date").props.onPress();
  assert.equal(button(app.timePanel(), "Due hour").props.value, "");
  assert.equal(button(app.timePanel(), "Due hour").props.editable, false);
  assert.equal(button(setup({ value: "invalid" }).timePanel(), "Apply time").props.disabled, true);
  for (const [hour, minute] of [["", "00"], ["24", "00"], ["23", "60"], ["-1", "00"], ["aa", "00"], ["1.5", "00"]]) assert.equal(utils.applyScheduleTime(new Date(), hour, minute), null);
});

test("calendar and time sit side by side only when the measured container has room", () => {
  const app = setup();
  let tree = app.render();
  const flatten = (style) => Object.assign({}, ...[style].flat().filter(Boolean));
  assert.equal(flatten(tree.props.children[0].props.style).flexDirection, undefined);
  tree.props.onLayout({ nativeEvent: { layout: { width: 900 } } });
  tree = app.render();
  assert.equal(flatten(tree.props.children[0].props.style).flexDirection, "row");
  tree.props.onLayout({ nativeEvent: { layout: { width: 280 } } });
  assert.equal(flatten(app.render().props.children[0].props.style).flexDirection, undefined);
});

test("calendar-origin creation hides the duplicate calendar and date removal while keeping the selected day", () => {
  const selected = new Date(2027, 0, 2, 9, 0);
  const app = setup({ value: selected.toISOString(), dateLocked: true });
  let tree = app.render();
  assert.equal(nodes(tree).some((node) => node.props?.testID === "schedule-calendar"), false);
  assert.equal(button(tree, "Today"), undefined);
  assert.equal(button(tree, "Clear due date"), undefined);
  assert.ok(nodes(tree).some((node) => typeof node.props?.children === "string" && node.props.children.includes("2 Jan 2027")));
  button(app.timePanel(), "Due hour").props.onChangeText("16");
  button(app.timePanel(), "Due minute").props.onChangeText("45");
  button(app.timePanel(), "Apply time").props.onPress();
  const changed = new Date(app.changes[0]);
  assert.equal(changed.toDateString(), selected.toDateString());
  assert.equal(changed.getHours(), 16);
  assert.equal(changed.getMinutes(), 45);
  tree = app.render();
  tree.props.onLayout({ nativeEvent: { layout: { width: 900 } } });
  assert.equal(nodes(app.render()).some((node) => node.props?.testID === "schedule-calendar"), false);
});

test("invalid or missing calendar-origin dates never hide the only date-selection controls", () => {
  for (const value of [null, "invalid"]) {
    const app = setup({ value, dateLocked: true });
    assert.ok(nodes(app.render()).some((node) => node.props?.testID === "schedule-calendar"));
  }
});

test("date/time edits keep the intended local day in UTC, positive/negative offsets and DST zones", () => {
  for (const zone of ["UTC", "Europe/Bucharest", "America/New_York", "Asia/Tokyo"]) {
    const script = `const exports = {}; ${utilityCode}; const d = new Date(2026, 11, 31); const chosen = new Date(exports.selectScheduleDay(d, null)); if(chosen.getDate()!==31 || chosen.getHours()!==23) throw Error('local date shifted'); const timed = new Date(exports.applyScheduleTime(chosen, '00', '15')); if(timed.getDate()!==31 || timed.getHours()!==0 || timed.getMinutes()!==15) throw Error('local time shifted');`;
    execFileSync(process.execPath, ["-e", script], { env: { ...process.env, TZ: zone } });
  }
  const dst = `const exports = {}; ${utilityCode}; if(exports.applyScheduleTime(new Date(2026,2,8,12), '02', '30') !== null) throw Error('DST gap normalized silently');`;
  execFileSync(process.execPath, ["-e", dst], { env: { ...process.env, TZ: "America/New_York" } });
});

test("the real task editor wires the shared picker to its draft and no longer embeds browser date/time inputs", () => {
  const source = readFileSync(new URL("../src/components/janus-board-ui.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("board.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const form = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "TaskEditorForm").getText(ast);
  assert.match(form, /<TaskSchedulePicker value=\{dueAt\} onChange=\{setDueAt\} dateLocked=\{calendarDateFixed\}/);
  assert.match(form, /calendarDateFixed \? "Time" : "Schedule"/);
  assert.doesNotMatch(form, /createElement\("input"|DateTimePicker|setPicker/);
  const pickerSource = readFileSync(new URL("../src/components/ui/task-schedule-picker.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(pickerSource, /SchedulePickerSurface|<Modal|<Sheet|Set due date|Edit due time/);
});
