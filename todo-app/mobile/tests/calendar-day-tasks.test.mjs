import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const dates = require("date-fns");

const source = await readFile(new URL("../src/components/calendar/calendar-day-tasks.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });

const colors = new Proxy({}, { get: () => "#888888" });
const day = new Date(2026, 9, 28);
const now = new Date(2026, 9, 28, 12);

function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}

function makeTask(id, overrides = {}) {
  return { id, title: `Task ${id}`, priority: "medium", completed: false, canceled: false, subtasks: [], dueAt: new Date(2026, 9, 28, 9).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString(), ...overrides };
}

function render({ tasks = [makeTask("a")], boards = [], width = 0 } = {}) {
  const calls = { edited: [], actions: [], added: 0 };
  let measuredWidth = width;
  const mocks = {
    react: {
      useState: (initial) => [measuredWidth || initial, (next) => { measuredWidth = typeof next === "function" ? next(measuredWidth) : next; }],
    },
    "react-native": {
      View: "View", Text: "Text", Pressable: "Pressable",
      StyleSheet: { create: (value) => value, hairlineWidth: 0.5 },
    },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "date-fns": dates,
    "@/components/ui/button": { Button: "Button" },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors } }) },
    "@/lib/domain/boards": { boardColor: () => ({ dot: "#123456", tint: "#12345620" }) },
    "@/lib/domain/constants": {
      PRIORITY_META: {
        high: { label: "High", dot: "#F97316", ink: "#C2410C", tint: "rgba(249,115,22,0.14)" },
        medium: { label: "Medium", dot: "#F59E0B", ink: "#B45309", tint: "rgba(245,158,11,0.16)" },
        low: { label: "Low", dot: "#94A3B8", ink: "#64748B", tint: "rgba(100,116,139,0.14)" },
      },
    },
    "@/lib/domain/status": {
      deriveStatus: (task) => task.completed ? "completed" : task.canceled ? "canceled" : task.dueAt && dates.parseISO(task.dueAt) < now ? "overdue" : "upcoming",
    },
  };
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: (id) => mocks[id] ?? (id === "react/jsx-runtime" ? require(id) : (() => { throw new Error(`Unexpected import ${id}`); })()),
  });
  const tree = exports.CalendarDayTasks({
    day,
    tasks,
    boards,
    now,
    onTask: (task) => calls.edited.push(task),
    onTaskAction: (task) => calls.actions.push(task),
    onAddTask: () => { calls.added += 1; },
  });
  return { tree, calls, rerender: () => exports.CalendarDayTasks({ day, tasks, boards, now, onTask: (task) => calls.edited.push(task), onTaskAction: (task) => calls.actions.push(task), onAddTask: () => { calls.added += 1; } }) };
}

test("selected-day tasks render as a two-column grid that grows to three on wide panes", () => {
  const tasks = [makeTask("a"), makeTask("b"), makeTask("c")];
  const { tree, rerender } = render({ tasks });
  const grid = nodes(tree).find((node) => node.props?.testID === "calendar-day-task-grid");
  const cellWidth = (tree) => nodes(tree).filter((node) => Array.isArray(node.props?.style) && node.props.style.some((entry) => entry?.width?.endsWith?.("%")))[0].props.style.find((entry) => entry?.width)?.width;
  assert.equal(cellWidth(tree), "50%");
  grid.props.onLayout({ nativeEvent: { layout: { width: 820 } } });
  const wide = rerender();
  assert.equal(cellWidth(wide), `${100 / 3}%`);
});

test("tiles keep task editing, long-press actions and checklist progress", () => {
  const tasks = [
    makeTask("done", { completed: true, subtasks: [{ id: "s1", title: "Step", done: true }] }),
    makeTask("late", { dueAt: new Date(2026, 9, 28, 8).toISOString() }),
  ];
  const boards = [{ id: "board-1", label: "Product", color: "slate" }];
  const { tree, calls } = render({ tasks: tasks.map((task) => ({ ...task, category: "board-1" })), boards });
  const tileElements = nodes(tree).filter((node) => typeof node.type === "function" && node.type.name === "CalendarDayTaskTile");
  assert.equal(tileElements.length, 2);
  const renderedTiles = tileElements.map((element) => element.type(element.props));
  const tiles = renderedTiles.filter((tile) => tile.type === "Pressable");
  assert.equal(tiles.length, 2);
  tiles[0].props.onPress();
  tiles[1].props.onLongPress();
  assert.deepEqual(calls.edited.map((task) => task.id), ["done"]);
  assert.deepEqual(calls.actions.map((task) => task.id), ["late"]);
  const labels = renderedTiles.flatMap((tile) => nodes(tile).map((node) => node.props?.children).flat().filter((child) => typeof child === "string"));
  assert.ok(labels.includes("Product"));
  assert.ok(labels.includes("Overdue"));
  assert.ok(renderedTiles.some((tile) => nodes(tile).some((node) => node.type === "Text" && Array.isArray(node.props?.children) && node.props.children.join("") === "1/1")));
});

test("a date without tasks keeps the add card in the grid", () => {
  const { tree, calls } = render({ tasks: [] });
  const labels = nodes(tree).map((node) => node.props?.children).flat().filter((child) => typeof child === "string");
  assert.equal(labels.includes("No tasks due"), false);
  assert.ok(nodes(tree).find((node) => node.props?.testID === "calendar-day-task-grid"));
  const add = nodes(tree).find((node) => node.props?.testID === "calendar-add-task-card");
  add.props.onPress();
  assert.equal(calls.added, 1);
});
