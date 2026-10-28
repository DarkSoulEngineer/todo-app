import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

async function load(path, mocks = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (id) => {
    assert.ok(id in mocks, `Unexpected import: ${id}`);
    return mocks[id];
  } });
  return exports;
}

const palettes = await load("../src/theme/palettes.ts");
const contrast = await load("../src/theme/contrast.ts");
const tokens = await load("../src/theme/tokens.ts", { "./palettes": palettes, "./contrast": contrast });
let active = tokens.themes.light;
let memo;
const adapter = await load("../src/components/reference/reference-theme.ts", {
  "@/theme/tokens": tokens,
  "@/providers/theme-provider": { useTheme: () => ({ theme: active, toggle }) },
  react: { useMemo(fn, deps) {
    if (!memo || deps.some((value, index) => value !== memo.deps[index])) memo = { deps, value: fn() };
    return memo.value;
  } },
});
function toggle() {}

test("Matrix and Neon Circuit retain intense green and cyan accents after contrast correction", () => {
  assert.equal(tokens.themes.matrix.colors.primary, "#00FF41");
  assert.equal(tokens.themes["neon-circuit"].colors.primary, "#00F5FF");
  assert.equal(tokens.themes["neon-circuit"].colors.accent, "#FF2BEB");
  assert.equal(tokens.themes.matrix.colors.accent, "#B6FF00");
});

test("Gruvbox uses its warm golden accent instead of pink", () => {
  assert.equal(palettes.themesById["gruvbox-dark"].colors.primary, "#FABD2F");
  assert.equal(palettes.themesById["gruvbox-light"].colors.primary, "#B57614");
});

test("all themes have readable body, muted, selected-chip and button text", () => {
  for (const [id, { colors: c }] of Object.entries(tokens.themes)) {
    const pairs = [
      ...[c.background, c.backgroundAlt, c.card, c.cardElevated, c.input, c.secondary]
        .flatMap((surface) => [[c.foreground, surface], [c.mutedForeground, surface]]),
      [c.accentForeground, c.primarySoft], [c.secondaryForeground, c.secondary],
      [c.primaryForeground, c.primary], [c.destructiveForeground, c.destructive],
      [c.successForeground, c.success],
      ...[[c.primary, c.primarySoft], [c.destructive, c.destructiveSoft],
        [c.success, c.successSoft], [c.warning, c.warningSoft], [c.info, c.infoSoft]]
        .flatMap(([ink, soft]) => [c.background, c.backgroundAlt, c.card, c.cardElevated, c.secondary, soft].map((surface) => [ink, surface])),
    ];
    for (const [ink, surface] of pairs) {
      assert.ok(contrast.contrastRatio(ink, surface) >= 4.5, `${id}: ${ink} on ${surface} must meet 4.5:1`);
    }
    assert.equal(c.background, palettes.themesById[id].colors.background);
    assert.equal(c.accent, palettes.themesById[id].colors.accent);
  }
});

test("contrast correction leaves readable colors and source palettes unchanged", () => {
  assert.equal(contrast.readableInk("#FFFFFF", ["#000000"]), "#FFFFFF");
  assert.equal(contrast.readableInk("#000000", ["#FFFFFF"]), "#000000");
  const original = JSON.stringify(palettes.themesById["tokyo-night"].colors);
  const lowContrast = { ...palettes.themesById["tokyo-night"].colors, accentForeground: "#000000" };
  const corrected = contrast.withReadableText(lowContrast);
  assert.notEqual(corrected.accentForeground, lowContrast.accentForeground);
  assert.equal(JSON.stringify(palettes.themesById["tokyo-night"].colors), original);
});

test("theme catalog has unique ids, names and visual palettes; System is a mode, not another palette", () => {
  assert.equal(new Set(palettes.themes.map((theme) => theme.id)).size, palettes.themes.length);
  assert.equal(new Set(palettes.themes.map((theme) => theme.name.toLowerCase())).size, palettes.themes.length);
  const signatures = Object.values(tokens.themes).map(({ colors: c }) => JSON.stringify([c.background, c.card, c.primary, c.accent]));
  assert.equal(new Set(signatures).size, signatures.length);
  assert.equal(tokens.themes.system, undefined);
  for (const id of ["matrix", "neon-circuit"]) {
    assert.equal(tokens.themes[id].scheme, "dark");
    assert.equal(palettes.themesById[id].category, "colorful");
  }
});

test("all catalog colors are valid and containers are distinct from their base", () => {
  for (const [id, { colors: c }] of Object.entries(tokens.themes)) {
    for (const [key, value] of Object.entries(c)) {
      assert.match(value, /^(#[0-9a-f]{6}|rgba\([\d.,\s]+\))$/i, `${id}.${key}`);
    }
    for (const key of ["primarySoft", "destructiveSoft", "successSoft", "warningSoft", "infoSoft"]) {
      assert.notEqual(c[key], c.background, `${id}.${key} must not disappear into the canvas`);
    }
  }
});

test("every palette reaches shared view surfaces, text, controls and cards", () => {
  for (const theme of Object.values(tokens.themes)) {
    active = theme;
    const { colors, type, card, scheme } = adapter.useReferenceTheme();
    assert.equal(scheme, theme.scheme);
    for (const [target, source] of Object.entries({
      background: "background", workspace: "backgroundAlt", card: "card",
      surfaceHighest: "cardElevated", text: "foreground", muted: "mutedForeground",
      primary: "primary", onPrimary: "primaryForeground", outlineVariant: "border",
      error: "destructive", success: "success", warning: "warning",
    })) assert.equal(colors[target], theme.colors[source], `${target} must use the selected palette`);
    assert.equal(type.body.color, theme.colors.foreground);
    assert.equal(card.backgroundColor, theme.colors.card);
    assert.equal(card.borderColor, theme.colors.border);
  }
});

test("switching between dark palettes invalidates memoized view styles", () => {
  active = tokens.themes.dracula;
  const previous = adapter.useReferenceTheme();
  active = tokens.themes.monokai;
  const next = adapter.useReferenceTheme();
  assert.notEqual(previous, next);
  assert.equal(next.colors.background, active.colors.background);
  assert.notEqual(previous.colors.background, next.colors.background);
});

test("legacy light/dark adapter callers still work", () => {
  for (const scheme of ["light", "dark"]) {
    assert.equal(adapter.getReferenceColors(scheme).background, tokens.themes[scheme].colors.background);
  }
});

test("navigation glass uses each palette rather than fixed light/dark colors", async () => {
  const { BottomNavIsland } = await load("../src/components/ui/bottom-nav-island.tsx", {
    "react/jsx-runtime": createRequire(import.meta.url)("react/jsx-runtime"),
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "react-native": { View: "View", StyleSheet: { create: (value) => value, absoluteFill: {} } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0 }) },
    "@/providers/theme-provider": { useTheme: () => ({ theme: active }) },
  });
  for (const theme of Object.values(tokens.themes)) {
    active = theme;
    const tree = BottomNavIsland({ children: "tabs" });
    const surface = tree.props.children.find((node) => node.props.testID === "navigation-island-surface");
    assert.equal(surface.props.style[1].backgroundColor, `${theme.colors.card}B3`);
    assert.equal(surface.props.children.props.style[1].backgroundColor, `${theme.colors.card}B3`);
  }
});

test("board tag labels use readable foregrounds on dark cards", async () => {
  const { MobileColumnTaskCard } = await load("../src/components/board/mobile-column-task-card.tsx", {
    "react/jsx-runtime": createRequire(import.meta.url)("react/jsx-runtime"),
    react: { useState: (value) => [value, () => {}] },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (value) => value } },
    "@/providers/theme-provider": { useTheme: () => ({ theme: active }) },
    "./mobile-board-colors": { useMobileBoardColors: () => active.colors },
    "@/lib/domain/status": { describeDue: () => null },
    "@/lib/features/card-themes": { detectCardTheme: () => null },
    "@/lib/domain/boards": { boardColor: () => ({ dot: "#8B5CF6", ink: "#6D28D9", tint: "rgba(139,92,246,0.16)", ring: "#8B5CF6" }) },
  });
  function nodes(node) {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  }
  for (const theme of Object.values(tokens.themes).filter((theme) => theme.scheme === "dark")) {
    active = theme;
    const tree = MobileColumnTaskCard({
      task: { id: "task", title: "Task", priority: "medium", subtasks: [] },
      board: { label: "Tag", color: "violet" }, now: new Date(),
    });
    const label = nodes(tree).find((node) => node.type === "Text" && node.props.children === "Tag");
    assert.equal(label.props.style[1].color, theme.colors.foreground);
  }
});
