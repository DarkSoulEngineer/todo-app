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
let scheme = "light";
vm.runInNewContext(outputText, {
  exports, require, useTheme: () => ({ theme: { colors, scheme } }),
  View: "View", Text: "Text", Svg: "Svg", Circle: "Circle", SectionHeading: "SectionHeading", serif: "serif",
  styles: new Proxy({}, { get: () => ({}) }),
});
function find(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
}
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
