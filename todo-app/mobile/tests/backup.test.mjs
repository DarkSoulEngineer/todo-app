import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Resolve the app's TypeScript aliases while Node strips types in pure modules.
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith(new URL("../src/", import.meta.url).href) && url.endsWith(".ts")) {
      return nextLoad(url, { ...context, format: "module-typescript" });
    }
    return nextLoad(url, context);
  },
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { parseBackupJson, parseBoardsJson, serializeFullBackup } = await import("../src/lib/data/backup.ts");
const { serializeSettings } = await import("../src/lib/data/settings.ts");
const settings = { theme: "dark", calendarDefaultView: "week", calendarWeekStart: 0 };
const board = { name: "Work", workspace: { tasks: [], sections: [], boards: [] } };

test("All saves preferences and boards together in an importable file", () => {
  const raw = serializeFullBackup([board], settings);
  const parsed = parseBackupJson(raw);
  assert.deepEqual(parsed.settings, settings);
  assert.equal(parsed.boards.length, 1);
  assert.equal(parsed.boards[0].name, "Work");
  assert.deepEqual(parsed.boards[0].workspace.tasks, []);
  assert.equal(parseBoardsJson(raw)[0].name, "Work");
});

test("All works without boards", () => {
  assert.deepEqual(parseBackupJson(serializeFullBackup([], settings)), { boards: [], settings });
});

test("combined backups keep tasks and closed boards", () => {
  const closedAt = "2026-10-27T10:00:00.000Z";
  const populated = { ...board, closedAt, workspace: { ...board.workspace, tasks: [{ id: "task-1", title: "Keep this task", done: false }] } };
  const backup = parseBackupJson(serializeFullBackup([populated], settings));
  assert.equal(backup.boards[0].closedAt, closedAt);
  assert.equal(backup.boards[0].workspace.tasks[0].id, "task-1");
  assert.equal(backup.boards[0].workspace.tasks[0].title, "Keep this task");
});

test("preferences-only import leaves boards out", () => {
  assert.deepEqual(parseBackupJson(serializeSettings(settings)), { boards: [], settings });
});

test("boards-only and legacy imports leave preferences out", () => {
  for (const payload of [
    { app: "janus", version: 2, kind: "janus-boards", projects: [board] },
    { app: "janus", version: 1, name: board.name, ...board.workspace },
  ]) {
    const backup = parseBackupJson(JSON.stringify(payload));
    assert.equal(backup.settings, null);
    assert.equal(backup.boards[0].name, "Work");
  }
  // Bare task arrays are also a supported legacy board backup format.
  assert.equal(parseBackupJson("[]").boards.length, 1);
  assert.equal(parseBackupJson("[]").settings, null);
});

test("an invalid half rejects the entire combined backup", () => {
  const payload = JSON.parse(serializeFullBackup([board], settings));
  for (const patch of [
    { settings: { ...settings, theme: "invalid" } },
    { settings: null },
    { projects: [null] },
    { projects: [{ name: "Broken", workspace: {} }] },
    { projects: null },
    { version: 99 },
    { app: "other" },
  ]) {
    assert.equal(parseBackupJson(JSON.stringify({ ...payload, ...patch })), null);
  }
  assert.deepEqual(payload.settings, settings);
});

test("malformed input and CSV cannot be imported", () => {
  for (const raw of ["{", "null", "{}", "title,status\nTask,done"]) {
    assert.equal(parseBackupJson(raw), null);
  }
});
