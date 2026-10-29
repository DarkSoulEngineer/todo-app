import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (id) => mocks[id] ?? (id === "react/jsx-runtime" ? require(id) : undefined) });
  return exports;
}
const codec = await load("../src/lib/data/board-display-preferences.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("old and invalid preferences keep safe defaults; zoom is rounded and bounded", () => {
  for (const value of [null, undefined, [], "invalid", { compactCards: "true", zoom: NaN }, { zoom: Infinity }]) {
    assert.deepEqual(plain(codec.normalizeBoardDisplay(value)), plain(codec.defaultBoardDisplay));
  }
  assert.equal(codec.normalizeBoardDisplay({ zoom: 9 }).zoom, 1.3);
  assert.equal(codec.normalizeBoardDisplay({ zoom: -9 }).zoom, 0.7);
  assert.equal(codec.normalizeBoardDisplay({ zoom: 1.14 }).zoom, 1.1);
});

async function provider(raw) {
  let cursor = 0, initialized = false, effect;
  const slots = [], writes = [];
  const mocks = {
    react: {
      createContext: () => ({ Provider: "Provider" }),
      useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
      useEffect(fn) { if (!initialized) effect = fn; },
      useCallback: (fn) => fn, useMemo: (fn) => fn(),
    },
    "@react-native-async-storage/async-storage": { getItem: async () => raw, setItem: async (_, value) => { raw = value; writes.push(JSON.parse(value)); } },
    "@/lib/data/board-display-preferences": codec,
  };
  const exports = await load("../src/providers/preferences-provider.tsx", mocks);
  const render = () => { cursor = 0; return exports.PreferencesProvider({ children: "app" })?.props.value; };
  assert.equal(render(), undefined, "children wait for saved preferences to hydrate");
  effect(); initialized = true;
  await new Promise((resolve) => setImmediate(resolve));
  return { render, writes, stored: () => raw };
}

test("display preferences survive provider restarts and calendar settings saves", async () => {
  const first = await provider(JSON.stringify({ calendarWeekStart: 0, calendarDefaultView: "week" }));
  assert.deepEqual(plain(first.render().boardDisplay), plain(codec.defaultBoardDisplay));
  first.render().setBoardDisplayPreferences({ compactCards: true });
  first.render().setBoardDisplayPreferences({ focusedColumn: true });
  first.render().setBoardDisplayPreferences({ showMoveArrows: true, zoom: 1.2 });
  const display = { compactCards: true, focusedColumn: true, showMoveArrows: true, zoom: 1.2 };
  assert.deepEqual(plain(first.render().boardDisplay), display);
  await first.render().savePreferences({ calendarDefaultView: "month", calendarWeekStart: 1 });
  assert.deepEqual(plain(first.render().boardDisplay), display);
  first.render().setCalendarWeekStart(0);
  assert.deepEqual(first.writes.at(-1).boardDisplay, display);
  const restarted = await provider(first.stored());
  assert.deepEqual(plain(restarted.render().boardDisplay), display);
  assert.equal(restarted.render().calendarDefaultView, "month");
  assert.equal(restarted.render().calendarWeekStart, 0);
});

test("malformed storage does not prevent the app from opening", async () => {
  for (const raw of [null, "{", "null"]) {
    const app = await provider(raw);
    assert.deepEqual(plain(app.render().boardDisplay), plain(codec.defaultBoardDisplay));
  }
});

test("single-key shortcut setting defaults safely, persists, and survives calendar saves", async () => {
  for (const raw of [null, JSON.stringify({ singleKeyShortcuts: "false" })]) {
    const app = await provider(raw);
    assert.equal(app.render().singleKeyShortcuts, true);
  }
  const app = await provider(null);
  app.render().setSingleKeyShortcuts(false);
  assert.equal(app.render().singleKeyShortcuts, false);
  await app.render().savePreferences({ calendarWeekStart: 0, calendarDefaultView: "week" });
  assert.equal((await provider(app.stored())).render().singleKeyShortcuts, false);
});

test("ribbon pin defaults safely and both states survive restarts and other preference saves", async () => {
  for (const raw of [null, JSON.stringify({ ribbonPinned: "true" })]) {
    assert.equal((await provider(raw)).render().ribbonPinned, false);
  }
  const app = await provider(null);
  app.render().setRibbonPinned(true);
  assert.equal(app.render().ribbonPinned, true);
  await app.render().savePreferences({ calendarWeekStart: 0, calendarDefaultView: "week" });
  app.render().setBoardDisplayPreferences({ compactCards: true });
  const restarted = await provider(app.stored());
  assert.equal(restarted.render().ribbonPinned, true);
  restarted.render().setRibbonPinned(false);
  assert.equal((await provider(restarted.stored())).render().ribbonPinned, false);
});
