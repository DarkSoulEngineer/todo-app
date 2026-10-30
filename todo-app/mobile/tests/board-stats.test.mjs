import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/board/board-manager-content.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("stats.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "WorkspaceOverview");
const { outputText } = ts.transpileModule(`export ${declaration.getText(ast)}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const colors = { success: "#00AA66", destructive: "#FF3344", info: "#3399FF", primary: "#AA55FF", border: "#444444" };
const exports = {};
const metricsSource = await readFile(new URL("../src/lib/data/manager-state.ts", import.meta.url), "utf8");
const metricsAst = ts.createSourceFile("metrics.ts", metricsSource, ts.ScriptTarget.Latest, true);
const metricsDeclaration = metricsAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "getTaskMetrics");
const boardMetricsDeclaration = metricsAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "getBoardTaskMetrics");
const workspaceMetricsDeclaration = metricsAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "getWorkspaceMetrics");
const metricsExports = {};
vm.runInNewContext(ts.transpileModule(`export ${metricsDeclaration.getText(metricsAst)}\n${boardMetricsDeclaration.getText(metricsAst)}\n${workspaceMetricsDeclaration.getText(metricsAst)}`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: metricsExports });
let scheme = "light";
vm.runInNewContext(outputText, {
  exports, require, getTaskMetrics: metricsExports.getTaskMetrics, getBoardTaskMetrics: metricsExports.getBoardTaskMetrics, useTheme: () => ({ theme: { colors, scheme } }),
  View: "View", Text: "Text", ScrollView: "ScrollView", Svg: "Svg", Circle: "Circle", SectionHeading: "SectionHeading", serif: "serif",
  styles: new Proxy({}, { get: () => ({}) }),
});

test("per-board comparison uses exclusive status shares and handles empty boards", () => {
  const projects = [
    { id: "populated", name: "Development", workspace: { tasks: [
      { sectionId: "todo", completed: true }, { sectionId: "todo", dueAt: "2026-01-01" }, { sectionId: "todo" }, { sectionId: "todo", canceled: true, completed: true },
      { sectionId: "hidden", dueAt: "2026-01-01" }, { dueAt: "2026-01-01" },
    ], sections: [{ id: "todo" }, { id: "hidden", hidden: true }] } },
    { id: "empty", name: "Empty", workspace: { tasks: [], sections: [] } },
  ];
  const tree = exports.WorkspaceOverview({ metrics: metricsExports.getBoardTaskMetrics(projects[0], Date.parse("2026-10-28")), boards: 2, projects, now: Date.parse("2026-10-28") });
  const populated = find(tree, (node) => node.props?.testID === "board-progress-populated")[0];
  assert.equal(populated.props.accessibilityLabel, "Development: 1 of 4 tasks completed, 25%, 1 overdue");
  const segments = populated.props.children[1].props.children;
  assert.deepEqual(Array.from(segments, (node) => node.props.style.width), ["25%", "25%", "25%", "25%"]);
  assert.deepEqual(Array.from(segments, (node) => node.props.style.backgroundColor), [colors.success, colors.destructive, colors.info, "#6B7280"]);
  const empty = find(tree, (node) => node.props?.testID === "board-progress-empty")[0];
  assert.equal(empty.props.accessibilityLabel, "Empty: 0 of 0 tasks completed, 0%, 0 overdue");
  assert.ok(empty.props.children[1].props.children.every((node) => node.props.style.width === "0%"));
  const boardMetrics = metricsExports.getBoardTaskMetrics(projects[0], Date.parse("2026-10-28"));
  assert.equal(boardMetrics.total, 4, "hidden-list and unassigned tasks are not counted as available board tasks");
  assert.equal(boardMetrics.open, 2, "visible active cards exclude completed and canceled cards");
  assert.equal(metricsExports.getWorkspaceMetrics(projects, Date.parse("2026-10-28")).total, 4);
});
function find(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
}
test("workspace totals appear once and board count sits with the donut", () => {
  const tree = exports.WorkspaceOverview({ metrics: { total: 73, done: 19, open: 40, overdue: 15, canceled: 14 }, boards: 4 });
  const allNodes = find(tree, () => true);
  const text = allNodes.filter((node) => node.type === "Text").map((node) => node.props.children);
  assert.equal(text.includes("TOTAL TASKS"), false);
  const donutColumn = allNodes.find((node) => node.props?.testID === "home-stats-donut-column");
  assert.ok(donutColumn);
  assert.equal(find(donutColumn, (node) => node.type === "Text" && Array.from(node.props.children).join("") === "Across 4 boards").length, 1);
});

test("open board-card metrics count active tasks, excluding completed and canceled tasks", () => {
  const metrics = metricsExports.getBoardTaskMetrics({ workspace: {
    sections: [{ id: "todo" }, { id: "hidden", hidden: true }],
    tasks: [
      { sectionId: "todo" }, { sectionId: "todo" }, { sectionId: "todo", completed: true }, { sectionId: "todo", canceled: true }, { sectionId: "hidden" }, {},
    ],
  } }, Date.parse("2026-10-28"));
  assert.equal(metrics.open, 2);
  assert.equal(metrics.done, 1);
  assert.equal(metrics.canceled, 1);
  assert.equal(metrics.total, 4);
});

const rows = (tree) => find(tree, (node) => node.props?.accessibilityRole === "progressbar");
const fillStyle = (row) => Object.assign({}, ...row.props.children[1].props.children.props.style);

test("status bars show accurate percentages without counting overdue tasks twice", () => {
  const tree = exports.WorkspaceOverview({ metrics: { total: 43, done: 11, open: 18, overdue: 7, canceled: 14 }, boards: 2 });
  const bars = rows(tree);
  assert.deepEqual(bars.map((row) => row.props.accessibilityLabel), ["Completed", "Overdue", "Open (not overdue)", "Canceled"]);
  assert.deepEqual(bars.map((row) => row.props.accessibilityValue.now), [26, 16, 26, 33]);
  const values = [11, 7, 11, 14];
  bars.forEach((row, index) => {
    assert.equal(fillStyle(row).width, `${values[index] / 43 * 100}%`);
    assert.ok(row.props.accessibilityValue.text.startsWith(`${values[index]} tasks`));
  });
});

test("bar colors match the donut, with gray canceled status in both themes", () => {
  for (const currentScheme of ["light", "dark"]) {
    scheme = currentScheme;
    const tree = exports.WorkspaceOverview({ metrics: { total: 4, done: 1, open: 2, overdue: 1, canceled: 1 }, boards: 1 });
    const palette = [colors.success, colors.destructive, colors.info, scheme === "dark" ? "#9CA3AF" : "#6B7280"];
    assert.deepEqual(rows(tree).map((row) => fillStyle(row).backgroundColor), palette);
    const slices = find(tree, (node) => node.type === "Circle" && node.props.strokeDasharray);
    assert.deepEqual(slices.map((node) => node.props.stroke), palette);
  }
  scheme = "light";
});

test("an empty workspace renders zero-width bars without NaN percentages", () => {
  const tree = exports.WorkspaceOverview({ metrics: { total: 0, done: 0, open: 0, overdue: 0, canceled: 0 }, boards: 0 });
  const bars = rows(tree);
  assert.equal(bars.length, 4);
  bars.forEach((row) => {
    assert.equal(fillStyle(row).width, "0%");
    assert.equal(row.props.accessibilityValue.now, 0);
  });
});
