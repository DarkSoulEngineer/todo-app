import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Run the pure codec without loading Expo native modules or adding a test runner.
const source = await readFile(new URL("../src/lib/data/settings.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { parseSettingsJson, serializeSettings } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const defaults = { theme: "system", calendarDefaultView: "month", calendarWeekStart: 1 };

test("every supported combination round-trips through JSON", () => {
  for (const theme of ["system", "light", "dark"]) {
    for (const calendarDefaultView of ["month", "week"]) {
      for (const calendarWeekStart of [0, 1]) {
        const settings = { theme, calendarDefaultView, calendarWeekStart };
        assert.deepEqual(parseSettingsJson(serializeSettings(settings)), settings);
      }
    }
  }
});

test("export contains version metadata and only preference fields", () => {
  const payload = JSON.parse(serializeSettings({ ...defaults, tasks: [{ title: "Private" }] }));
  assert.equal(payload.app, "janus");
  assert.equal(payload.kind, "janus-settings");
  assert.equal(payload.version, 1);
  assert.ok(!Number.isNaN(Date.parse(payload.exportedAt)));
  assert.deepEqual(payload.settings, defaults);
  assert.ok(!JSON.stringify(payload).includes("Private"));
});

test("malformed, unrelated, and unsupported backups are rejected", () => {
  for (const raw of ["", "{", "null", "[]", "42", JSON.stringify(defaults)]) {
    assert.equal(parseSettingsJson(raw), null);
  }
  const valid = JSON.parse(serializeSettings(defaults));
  for (const patch of [{ app: "other" }, { kind: "janus-boards" }, { version: 2 }, { settings: null }, { settings: [] }]) {
    assert.equal(parseSettingsJson(JSON.stringify({ ...valid, ...patch })), null);
  }
});

test("invalid or missing fields reject the whole file without changing input", () => {
  const valid = JSON.parse(serializeSettings(defaults));
  for (const [key, invalid] of [["theme", "auto"], ["calendarDefaultView", "day"], ["calendarWeekStart", 2], ["calendarWeekStart", "0"]]) {
    assert.equal(parseSettingsJson(JSON.stringify({ ...valid, settings: { ...defaults, [key]: invalid } })), null);
  }
  for (const key of Object.keys(defaults)) {
    const settings = { ...defaults };
    delete settings[key];
    assert.equal(parseSettingsJson(JSON.stringify({ ...valid, settings })), null);
  }
  assert.deepEqual(valid.settings, defaults);
});

test("UTF-8 BOM and unknown fields are safe", () => {
  const payload = JSON.parse(serializeSettings(defaults));
  payload.settings.extra = "ignored";
  assert.deepEqual(parseSettingsJson(`\uFEFF${JSON.stringify(payload)}`), defaults);
});
