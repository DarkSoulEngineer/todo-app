import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const source = readFileSync(new URL(`../src/components/ui/${file}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)((id) => {
    if (id === "react/jsx-runtime") return require(id);
    assert.ok(id in mocks, `Unexpected import ${id}`);
    return mocks[id];
  }, exports);
  return exports;
}
const { tactileSurface } = load("tactile.ts");
const flatten = (styles) => Object.assign({}, ...styles.flat(Infinity).filter(Boolean));
const native = { Pressable: "Pressable", View: "View", Text: "Text", StyleSheet: { create: (styles) => styles, hairlineWidth: 0.5 } };

test("bevels depress without changing layout and adapt their highlight to light/dark themes", () => {
  for (const dark of [true, false]) {
    const resting = tactileSurface({ dark });
    const pressed = tactileSurface({ dark, pressed: true });
    const selected = tactileSurface({ dark, selected: true, accent: "#aabbcc" });
    assert.equal(resting.borderBottomWidth, pressed.borderBottomWidth);
    assert.equal(resting.borderBottomWidth, selected.borderBottomWidth);
    assert.equal(resting.transform[0].translateY, 0);
    assert.equal(pressed.transform[0].translateY, 2);
    assert.equal(selected.transform[0].translateY, 1);
    assert.equal(selected.borderBottomColor, "#aabbcc");
    assert.match(resting.boxShadow, dark ? /255,255,255,0.16/ : /255,255,255,0.85/);
    assert.notEqual(resting.boxShadow, pressed.boxShadow);
    const disabled = tactileSurface({ dark, disabled: true, pressed: true });
    assert.equal(disabled.boxShadow, "none");
    assert.equal(disabled.transform[0].translateY, 0);
  }
});

test("shared actions keep theme colors, callbacks, disabled semantics and dimensions for every variant", () => {
  for (const scheme of ["light", "dark"]) {
    const theme = { scheme, fontFamily: "", radius: { md: 12, lg: 16 }, colors: {
      primary: "#aabbcc", primaryForeground: "#111111", secondary: "#333333", secondaryForeground: "#eeeeee",
      card: "#222222", border: "#555555", foreground: "#ffffff", mutedForeground: "#aaaaaa",
      destructive: "#bb1122", destructiveForeground: "#ffffff", primarySoft: "#444433", accentForeground: "#ffffaa",
    } };
    const { Button } = load("button.tsx", { "react-native": native, "@/providers/theme-provider": { useTheme: () => ({ theme }) }, "./tactile": { tactileSurface } });
    for (const variant of ["primary", "secondary", "outline", "soft", "danger", "ghost"]) {
      let calls = 0;
      const button = Button({ variant, label: "Action", onPress: () => calls++, style: { minWidth: 120 } });
      const resting = flatten(button.props.style({ pressed: false }));
      const pressed = flatten(button.props.style({ pressed: true }));
      assert.equal(resting.height, pressed.height);
      assert.equal(resting.minWidth, 120);
      assert.equal(resting.backgroundColor, pressed.backgroundColor);
      assert.equal(button.props.accessibilityRole, "button");
      assert.equal(button.props.accessibilityLabel, "Action");
      assert.equal(button.props.children.props.style[1].color, variant === "danger" ? theme.colors.destructiveForeground : variant === "primary" ? theme.colors.primaryForeground : variant === "soft" ? theme.colors.accentForeground : variant === "secondary" ? theme.colors.secondaryForeground : variant === "ghost" ? theme.colors.mutedForeground : theme.colors.foreground);
      button.props.onPress();
      assert.equal(calls, 1);
      if (variant !== "ghost") assert.equal(pressed.transform[0].translateY, 2);
      else assert.equal(resting.boxShadow, undefined);
      const disabled = Button({ variant, label: "Action", disabled: true, accessibilityState: { selected: true, disabled: false } });
      assert.equal(disabled.props.disabled, true);
      assert.equal(disabled.props.accessibilityState.disabled, true);
      assert.equal(disabled.props.accessibilityState.selected, true);
      assert.equal(flatten(disabled.props.style({ pressed: true })).opacity, 0.45);
    }
  }
});

test("status/event chips keep their selection and toggle behavior with a tactile selected state", () => {
  const entry = { id: "done", label: "Done", symbol: "✓", accent: "#00aa88", wash: "#113322" };
  const { SpecialCardTagPicker } = load("special-card-tag-picker.tsx", {
    "react-native": native,
    "@/providers/theme-provider": { useTheme: () => ({ theme: { scheme: "dark", colors: { border: "#444444", secondary: "#333333" } } }) },
    "./tactile": { tactileSurface },
    "@/lib/features/card-themes": { STATUS_CARD_THEMES: [entry], classifySpecialCardTag: (tag) => tag === entry.label ? { theme: entry } : null },
    "@/hooks/use-active-events": { useActiveEvents: () => ({ events: [] }) },
    "@/lib/features/special-card-tags": { toggleCardTag: (tags, tag) => tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag] },
  });
  const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  for (const selected of [false, true]) {
    let result;
    const tree = SpecialCardTagPicker({ tags: selected ? [entry.label] : [], onChange: (tags) => { result = tags; } });
    const chip = nodes(tree).find((node) => node.type === "Pressable");
    assert.equal(chip.props.accessibilityState.selected, selected);
    assert.equal(flatten(chip.props.style({ pressed: false })).borderColor, selected ? entry.accent : "#444444");
    assert.equal(flatten(chip.props.style({ pressed: true })).transform[0].translateY, 2);
    chip.props.onPress();
    assert.deepEqual(result, selected ? [] : [entry.label]);
  }
});
