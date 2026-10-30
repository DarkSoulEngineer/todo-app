import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)((id) => id === "react/jsx-runtime" ? require(id) : mocks[id], exports);
  return exports;
}
const rules = load("lib/features/special-lists.ts");
const themes = load("lib/features/card-themes.ts");

test("special list names match synonyms, case, spaces and emoji, not partial or negated phrases", () => {
  for (const name of ["Done", "COMPLETED", " Finished ", "✅ Done", "Resolved", "Delivered"]) assert.equal(rules.getSpecialListRule(name)?.id, "completed");
  for (const name of ["Cancelled", "CANCELED", "Abandoned"]) assert.equal(rules.getSpecialListRule(name)?.id, "canceled");
  for (const name of ["TO DO", "To-do", "  In   progress  ", "Backlog"]) assert.equal(rules.getSpecialListRule(name)?.id, "open");
  for (const name of ["Not done", "Unfinished", "Completed research", "Almost finished", "Don't cancel", "My backlog", "Halloween", ""]) assert.equal(rules.getSpecialListRule(name), null, name);
});

test("seasonal titles handle aliases and take precedence over generic themes", () => {
  for (const [title, id] of [["Haloween", "halloween"], ["HALLOWEEN party", "halloween"], ["Urgent Christmass shopping", "christmas"], ["Xmas gifts", "christmas"], ["Easter eggs", "easter"], ["New Year's party", "new-year"], ["New year’s plans", "new-year"]]) {
    assert.equal(themes.detectSeasonalCardTheme(title)?.id, id, title);
    assert.equal(themes.detectCardTheme(title, "")?.id, id, title);
  }
  for (const title of ["Eastern timezone", "Paste code", "Halloweenish", "Routine task"]) assert.equal(themes.detectSeasonalCardTheme(title), null, title);
  assert.equal(themes.detectSeasonalCardTheme("Meeting"), null);
  assert.notEqual(themes.detectCardTheme("Meeting", "Discuss Christmas")?.id, "christmas", "description mentions are not easter eggs");
});

test("special list appearance tells users what happens before moving a card", () => {
  const { SpecialListIdentity } = load("components/board/special-list-identity.tsx", {
    "react-native": { View: "View", Text: "Text", StyleSheet: { create: (value) => value } },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: { success: "green", destructive: "red", info: "blue", foreground: "ink" } } }) },
    "@/lib/features/special-lists": rules,
    "@/lib/features/card-themes": themes,
  });
  const text = (node) => typeof node === "string" ? node : Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : "";
  for (const [name, expected] of [["Done", "Mark complete"], ["Cancelled", "Cancel task"], ["To do", "Reopen task"]]) assert.ok(text(SpecialListIdentity({ title: name })).includes(expected));
  for (const title of ["Halloween", "Christmas", "Easter", "New Year"]) assert.equal(SpecialListIdentity({ title }), null, "seasonal designs stay on cards, without a list subtitle");
  assert.equal(SpecialListIdentity({ title: "My workflow" }), null);
});

function decorationHarness({ paused = false, compact = false, active = true, id = "halloween" } = {}) {
  let cleanup, resolvePreference, starts = 0, stops = 0, removals = 0;
  const callbacks = {}, configs = [];
  class Value { setValue() {} interpolate(value) { return value; } }
  const artwork = load("components/ui/seasonal-card-artwork.tsx", {
    "react-native": { View: "View", Animated: { View: "AnimatedView" }, StyleSheet: { create: (value) => value, absoluteFill: {} } },
    "react-native-svg": { default: "Svg", Circle: "Circle", G: "G", Line: "Line", Path: "Path", Rect: "Rect" },
  });
  const { SeasonalCardDecoration } = load("components/ui/seasonal-card-decoration.tsx", {
    react: { useState: (initial) => [initial(), () => {}], useEffect: (effect) => { cleanup = effect(); } },
    "react-native": {
      View: "View", Text: "Text", Platform: { OS: "ios" }, StyleSheet: { create: (value) => value, absoluteFill: {} },
      AppState: { currentState: active ? "active" : "background", addEventListener: (_, fn) => { callbacks.app = fn; return { remove() { removals++; } }; } },
      AccessibilityInfo: { addEventListener: (_, fn) => { callbacks.motion = fn; return { remove() { removals++; } }; }, isReduceMotionEnabled: () => new Promise((resolve) => { resolvePreference = resolve; }) },
      Animated: { Value, View: "AnimatedView", timing: (_, config) => { configs.push(config); return config; }, sequence: (animations) => animations, loop: () => ({ start() { starts++; }, stop() { stops++; } }) },
    },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: { foreground: "ink" } } }) },
    "./seasonal-card-artwork": artwork,
  });
  const tree = SeasonalCardDecoration({ theme: themes.SEASONAL_CARD_THEMES.find((theme) => theme.id === id), paused, compact });
  return { tree, callbacks, configs, cleanup: () => cleanup(), resolvePreference: (value) => resolvePreference(value), get starts() { return starts; }, get stops() { return stops; }, get removals() { return removals; } };
}

function expand(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(expand);
  if (typeof node.type === "function") return expand(node.type(node.props));
  return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}

test("holiday cards use distinct event-specific artwork without event title labels or added layout rows", () => {
  const compositions = {
    halloween: ["halloween-orbit"],
    christmas: ["christmas-lights", "christmas-snow", "christmas-tree"],
    easter: ["easter-meadow", "easter-eggs"],
    "new-year": ["new-year-confetti", "new-year-fireworks"],
  };
  for (const [id, expected] of Object.entries(compositions)) {
    const h = decorationHarness({ id });
    const tree = expand(h.tree);
    assert.equal(tree.type, "View", "decoration is only one absolute overlay, not an in-flow label");
    assert.equal(tree.props.pointerEvents, "none");
    const ids = nodes(tree).map((node) => node.props?.testID).filter(Boolean);
    for (const motif of expected) assert.ok(ids.includes(motif), `${id} has ${motif}`);
    for (const [other, motifs] of Object.entries(compositions)) if (other !== id) for (const motif of motifs) assert.ok(!ids.includes(motif), `${id} does not reuse ${motif}`);
    const texts = nodes(tree).filter((node) => node.type === "Text").map((node) => node.props.children);
    for (const theme of themes.SEASONAL_CARD_THEMES) assert.ok(!texts.some((text) => String(text).toLowerCase().includes(theme.label.toLowerCase())), "no added holiday title");
    for (const node of nodes(tree)) {
      if (node.props?.d) assert.doesNotMatch(node.props.d, /NaN|Infinity/);
      if (node.props?.x1 !== undefined) assert.ok(Number.isFinite(node.props.x1));
    }
    h.cleanup();
  }
});

test("snowfall, Easter eggs and fireworks have different motion styles", () => {
  for (const [id, motif, transform] of [["christmas", "christmas-snow", "translateY"], ["easter", "easter-eggs", "rotate"], ["new-year", "new-year-fireworks", "scale"]]) {
    const h = decorationHarness({ id });
    const node = nodes(expand(h.tree)).find((node) => node.props?.testID === motif);
    const style = Object.assign({}, ...node.props.style.filter(Boolean));
    assert.ok(style.transform.some((item) => transform in item));
    h.cleanup();
  }
});

test("seasonal motion is opt-in after accessibility is known, stops in background, and cleans up", async () => {
  const h = decorationHarness();
  assert.equal(h.starts, 0);
  h.resolvePreference(false);
  await Promise.resolve();
  assert.equal(h.starts, 1);
  assert.ok(h.configs.every((config) => config.isInteraction === false && config.useNativeDriver === true));
  h.callbacks.motion(true);
  assert.equal(h.stops, 1);
  h.callbacks.motion(false);
  assert.equal(h.starts, 2);
  h.callbacks.app("background");
  assert.equal(h.stops, 2);
  h.callbacks.app("active");
  assert.equal(h.starts, 3);
  h.cleanup();
  assert.equal(h.stops, 3);
  assert.equal(h.removals, 2);
});

test("reduced motion, paused previews and background apps keep seasonal designs static", async () => {
  for (const options of [{}, { paused: true }, { compact: true }, { active: false }]) {
    const h = decorationHarness(options);
    h.resolvePreference(!options.paused && !options.compact && options.active !== false);
    await Promise.resolve();
    assert.equal(h.starts, 0);
    h.cleanup();
  }
  const h = decorationHarness();
  h.callbacks.motion(true);
  h.resolvePreference(false);
  await Promise.resolve();
  assert.equal(h.starts, 0, "a late initial query must not override a live preference change");
  h.cleanup();
  const unmounted = decorationHarness();
  unmounted.cleanup();
  unmounted.resolvePreference(false);
  await Promise.resolve();
  assert.equal(unmounted.starts, 0, "no animation starts after unmount");
});
