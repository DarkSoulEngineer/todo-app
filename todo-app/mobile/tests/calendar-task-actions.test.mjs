import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../app/board/[id].tsx", import.meta.url), "utf8");
const start = source.indexOf("function CalendarTaskActions(");
const end = source.indexOf("\nfunction ", start + 1);
const compiled = ts.transpileModule(`export ${source.slice(start, end)}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const Platform = { OS: "web" };
const exports = {};
vm.runInNewContext(compiled, { exports, require, Platform, OptionSheet: "OptionSheet", ...require("date-fns") });

test("browser calendar menus omit Choose a day while native menus retain it", () => {
  for (const os of ["web", "ios", "android"]) {
    Platform.OS = os;
    const calls = [];
    const handlers = Object.fromEntries(["onComplete", "onChooseDate", "onToday", "onTomorrow", "onClearDue"].map((name) => [name, () => calls.push(name)]));
    const tree = exports.CalendarTaskActions({ task: { title: "Task", dueAt: "2026-10-30" }, now: new Date(2026, 9, 29), ...handlers });
    const options = tree.props.options;
    const choose = options.find((option) => option.label === "Choose a day");
    assert.equal(Boolean(choose), os !== "web");
    assert.equal(options.length, os === "web" ? 4 : 5);
    choose?.onPress();
    options.find((option) => option.label.startsWith("Move to today")).onPress();
    options.find((option) => option.label.startsWith("Move to tomorrow")).onPress();
    options.find((option) => option.label === "Remove due date").onPress();
    assert.deepEqual(calls, [...(os === "web" ? [] : ["onChooseDate"]), "onToday", "onTomorrow", "onClearDue"]);
  }
});
