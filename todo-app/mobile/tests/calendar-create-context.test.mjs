import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../app/board/[id].tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("board.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "addNewTask") initializer = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule(`exports.addNewTask = ${initializer}`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

test("new-card actions inherit the selected calendar day, while explicit dates and normal creation remain independent", () => {
  const selected = new Date(2027, 0, 2, 15, 30);
  const original = selected.getTime();
  for (const mode of ["calendar", "board", "list"]) for (const due of [undefined, null, new Date(2026, 11, 31, 11).toISOString()]) {
    const state = {}, exports = {};
    const names = ["exports", "sections", "mode", "selectedCalendarDay", "currentProjectId", "setAddSectionOpen", "toast", "setEditorProjectId", "setEditorTask", "setInitialDueAt", "setInitialSectionId", "setEditorVisible"];
    const values = [exports, [{ id: "list", title: "In progress" }], mode, selected, "project", () => {}, { show() {} }, (v) => { state.project = v; }, (v) => { state.task = v; }, (v) => { state.dueAt = v; }, (v) => { state.section = v; }, (v) => { state.open = v; }];
    new Function(...names, code)(...values);
    exports.addNewTask(due);
    assert.equal(state.open, true);
    assert.equal(state.section, "list");
    if (due) assert.equal(state.dueAt, due);
    else if (mode === "calendar" && due === undefined) assert.equal(new Date(state.dueAt).toDateString(), selected.toDateString());
    else assert.equal(state.dueAt, null);
  }
  assert.equal(selected.getTime(), original);
});
