import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/features/ribbon-context.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { getRibbonContext, isRibbonTabAvailable, resolveRibbonTab } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const modes = ["board", "list", "calendar", "insights"];
const tabs = ["home", "actions", "filters", "select"];

test("Board retains every ribbon tab and board tool group", () => {
  for (const tab of tabs) assert.equal(isRibbonTabAvailable(tab, "board"), true);
  for (const available of Object.values(getRibbonContext("board"))) assert.equal(available, true);
});

test("Activity and Calendar hide selection, sorting, display and zoom tools", () => {
  for (const mode of ["list", "calendar"]) {
    assert.equal(isRibbonTabAvailable("select", mode), false);
    assert.deepEqual(getRibbonContext(mode), {
      selection: false, boardDisplay: false, sorting: false, filters: true, search: true,
    });
    assert.equal(isRibbonTabAvailable("filters", mode), true);
  }
});

test("Insights hides filters and search that do not affect its data", () => {
  assert.equal(isRibbonTabAvailable("filters", "insights"), false);
  assert.equal(isRibbonTabAvailable("select", "insights"), false);
  assert.equal(getRibbonContext("insights").search, false);
  assert.equal(getRibbonContext("insights").boardDisplay, false);
  assert.equal(isRibbonTabAvailable("home", "insights"), true);
  assert.equal(isRibbonTabAvailable("actions", "insights"), true);
});

test("leaving selection falls back safely instead of showing hidden tools", () => {
  assert.equal(resolveRibbonTab("board", "home", "home", true), "select");
  assert.equal(resolveRibbonTab("board", "select", "actions", false), "actions");
  assert.equal(resolveRibbonTab("list", "select", "actions", false), "actions");
  assert.equal(resolveRibbonTab("insights", "select", "filters", false), "home");
  assert.equal(resolveRibbonTab("insights", "filters", "home", false), "home");
});

test("every mode transition resolves to a visible tab, even with stale selection", () => {
  for (const mode of modes) for (const tab of tabs) for (const previous of tabs) for (const selecting of [false, true]) {
    const result = resolveRibbonTab(mode, tab, previous, selecting);
    assert.equal(isRibbonTabAvailable(result, mode), true);
    if (mode !== "board") assert.notEqual(result, "select");
  }
});
