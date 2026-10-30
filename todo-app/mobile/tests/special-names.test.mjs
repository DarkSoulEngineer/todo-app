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
const themes = load("lib/features/card-themes.ts");
const allDecorations = [...themes.SEASONAL_CARD_THEMES, ...themes.STATUS_CARD_THEMES];
const halloweenVariants = load("lib/features/halloween-variants.ts");

test("special tags match complete aliases without inferring rules from holder names", () => {
  for (const name of ["Done", "COMPLETED", " Finished ", "Resolved", "Delivered"]) assert.equal(themes.classifySpecialCardTag(name)?.theme.id, "done");
  for (const name of ["Cancelled", "CANCELED", "Abandoned"]) assert.equal(themes.classifySpecialCardTag(name)?.theme.id, "canceled");
  for (const name of ["Not done", "Unfinished", "Completed research", "Almost finished", "Don't cancel", "My backlog", "D", ""]) assert.equal(themes.classifySpecialCardTag(name), null, name);
});

test("seasonal titles handle aliases and take precedence over generic themes", () => {
  for (const [title, id] of [["Haloween", "halloween"], ["HALLOWEEN party", "halloween"], ["Urgent Christmass shopping", "christmas"], ["Xmas gifts", "christmas"], ["Easter eggs", "easter"], ["New Year's party", "new-year"], ["New year’s plans", "new-year"]]) {
    assert.equal(themes.detectSeasonalCardTheme(title)?.id, id, title);
  }
  for (const title of ["Eastern timezone", "Paste code", "Halloweenish", "Routine task"]) assert.equal(themes.detectSeasonalCardTheme(title), null, title);
  assert.equal(themes.detectSeasonalCardTheme("Meeting"), null);
  assert.notEqual(themes.detectCardTheme("Meeting", "Discuss Christmas")?.id, "christmas", "description mentions are not easter eggs");
});

test("status card names and synonyms match full names in every capitalization, never just initials", () => {
  for (const entry of themes.STATUS_CARD_THEMES) for (const name of entry.keywords) {
    for (const variant of [name, name.toUpperCase(), name[0].toUpperCase() + name.slice(1), name.split("").map((char, index) => index % 2 ? char.toUpperCase() : char).join("")]) {
      assert.equal(themes.detectStatusCardTheme(variant)?.id, entry.id, variant);
      assert.equal(themes.resolveCardDecoration([variant])?.id, entry.id, variant);
    }
  }
  for (const name of ["D", "C", "O", "B", "V", "Not done", "Unfinished", "Late night walk", "Completed research", "Overdue-ish", "cancellation"]) {
    assert.equal(themes.detectStatusCardTheme(name), null, name);
    assert.equal(themes.resolveCardDecoration([name]), null, name);
  }
});

test("Birthday and Valentine's designs match full words and aliases, case-insensitively", () => {
  for (const name of ["Birthday", "BIRTHDAY", "bIrThDaY party", "bday", "B-DAY"]) assert.equal(themes.detectSeasonalCardTheme(name)?.id, "birthday");
  for (const name of ["Valentine", "VALENTINES DAY", "valentine's day", "Valentine’s Day", "vAlEnTiNeS"]) assert.equal(themes.detectSeasonalCardTheme(name)?.id, "valentines");
  for (const name of ["b", "V", "Birthdaysuit", "Valentinesque"]) assert.equal(themes.detectSeasonalCardTheme(name), null);
});

test("tags combine one event design with status, and ordinary task state stays visible", () => {
  for (const [status, id] of [["completed", "done"], ["canceled", "canceled"], ["overdue", "overdue"]]) assert.equal(themes.resolveCardDecoration([], status)?.id, id);
  assert.equal(themes.resolveCardDecoration(["FINISHED"])?.id, "done");
  assert.equal(themes.resolveCardDecoration(["CANCELLED"])?.id, "canceled");
  assert.equal(themes.resolveCardDecoration(["OVERDUE"])?.id, "overdue");
  assert.equal(themes.resolveCardDecoration(["Done"], "canceled")?.id, "canceled");
  assert.equal(themes.resolveCardDecoration(["Halloween", "Done"], "completed")?.id, "halloween");
  assert.equal(themes.resolveCardDecoration(["Christmas", "Overdue"], "overdue")?.id, "christmas");
  assert.equal(themes.resolveCardDecoration([], "upcoming"), null);
});

test("holders and list editors no longer offer special-name behavior", () => {
  for (const path of ["components/board/mobile-task-columns.tsx", "components/board/create-list-dialog.tsx"]) {
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /SpecialListIdentity|listTitle=/);
  }
});

function decorationHarness({ paused = false, compact = false, active = true, id = "halloween", cardId = "" } = {}) {
  let cleanup, resolvePreference, starts = 0, stops = 0, removals = 0;
  const callbacks = {}, configs = [];
  class Value { setValue() {} interpolate(value) { return value; } }
  const artwork = load("components/ui/seasonal-card-artwork.tsx", {
    "react-native": { View: "View", Animated: { View: "AnimatedView" }, StyleSheet: { create: (value) => value, absoluteFill: {} } },
    "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", G: "G", Line: "Line", Path: "Path", Rect: "Rect" },
  });
  const statusArtwork = load("components/ui/status-card-artwork.tsx", {
    "react-native": { View: "View", Animated: { View: "AnimatedView" }, StyleSheet: { create: (value) => value } },
    "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", G: "G", Line: "Line", Path: "Path", Rect: "Rect" },
  });
  const halloweenArtwork = load("components/ui/halloween-card-artwork.tsx", {
    "react-native": { View: "View", Animated: { View: "AnimatedView" }, StyleSheet: { create: (value) => value } },
    "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", Ellipse: "Ellipse", G: "G", Path: "Path", Rect: "Rect" },
    "@/lib/features/halloween-variants": halloweenVariants,
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
    "./status-card-artwork": statusArtwork,
    "./halloween-card-artwork": halloweenArtwork,
  });
  const tree = SeasonalCardDecoration({ theme: allDecorations.find((theme) => theme.id === id), cardId, paused, compact });
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
    halloween: ["halloween-cobweb", "halloween-bats"],
    christmas: ["christmas-lights", "christmas-snow", "christmas-tree"],
    easter: ["easter-meadow", "easter-eggs"],
    "new-year": ["new-year-confetti", "new-year-fireworks"],
    birthday: ["birthday-bunting", "birthday-balloons", "birthday-cake"],
    valentines: ["valentines-petals", "valentines-hearts", "valentines-envelope"],
    done: ["done-seal"],
    canceled: ["canceled-ticket"],
    overdue: ["overdue-clock"],
  };
  for (const [id, expected] of Object.entries(compositions)) {
    const h = decorationHarness({ id });
    const tree = expand(h.tree);
    assert.equal(tree.type, "View", "decoration is only one absolute overlay, not an in-flow label");
    assert.equal(tree.props.pointerEvents, "none");
    const ids = nodes(tree).map((node) => node.props?.testID).filter(Boolean);
    if (["done", "canceled", "overdue"].includes(id)) assert.ok(!nodes(tree).some((node) => node.type === "AnimatedView"), "basic status artwork is a static image, not an animated view");
    for (const motif of expected) assert.ok(ids.includes(motif), `${id} has ${motif}`);
    for (const [other, motifs] of Object.entries(compositions)) if (other !== id) for (const motif of motifs) assert.ok(!ids.includes(motif), `${id} does not reuse ${motif}`);
    const texts = nodes(tree).filter((node) => node.type === "Text").map((node) => node.props.children);
    for (const theme of allDecorations) assert.ok(!texts.some((text) => String(text).toLowerCase().includes(theme.label.toLowerCase())), "no added event or status title");
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

test("Halloween costumes are stable, distributed, and distinct in normal and compact cards", () => {
  const seen = new Map();
  for (let index = 0; index < 600; index++) {
    const cardId = `task-${index}`;
    const variant = halloweenVariants.halloweenVariantForCard(cardId);
    assert.equal(halloweenVariants.halloweenVariantForCard(cardId), variant);
    seen.set(variant, cardId);
  }
  assert.deepEqual([...seen.keys()].sort(), [...halloweenVariants.HALLOWEEN_VARIANTS].sort());
  const drawings = new Set();
  for (const [variant, cardId] of seen) {
    for (const compact of [false, true]) {
      const h = decorationHarness({ cardId, compact });
      const tree = nodes(expand(h.tree));
      const character = tree.find((node) => node.props?.testID === `halloween-character-${variant}`);
      assert.ok(character, `${variant} is rendered, including in compact mode`);
      assert.equal(tree.some((node) => node.props?.testID === "halloween-bats"), !compact);
      assert.equal(h.tree.props.accessibilityElementsHidden, true);
      if (!compact) drawings.add(JSON.stringify(nodes(character).filter((node) => node.props?.d).map((node) => node.props.d)));
      h.cleanup();
    }
  }
  assert.equal(drawings.size, 6, "every costume has its own vector drawing");
  for (const path of ["components/board/mobile-column-task-card.tsx", "components/janus-board-ui.tsx"]) {
    assert.match(readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"), /<SeasonalCardDecoration[^>]*cardId=\{task.id\}/);
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
  for (const options of [{}, { paused: true }, { compact: true }, { active: false }, { id: "done" }, { id: "canceled" }, { id: "overdue" }]) {
    const h = decorationHarness(options);
    h.resolvePreference(!options.paused && !options.compact && options.active !== false && !["done", "canceled", "overdue"].includes(options.id));
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
