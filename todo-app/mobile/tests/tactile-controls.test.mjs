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
    if (id === "@/components/ui/selection-led") return { SelectionLed: "SelectionLed" };
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
    assert.equal(resting.borderWidth, pressed.borderWidth);
    assert.equal(resting.borderColor, undefined);
    assert.equal(pressed.borderColor, undefined);
    assert.equal(selected.borderColor, undefined);
    assert.equal(tactileSurface({ dark, selected: true, pressed: true }).borderColor, selected.borderColor);
    assert.equal(pressed.backgroundColor, undefined);
    assert.equal(resting.borderBottomWidth, selected.borderBottomWidth);
    assert.equal(resting.transform[0].translateY, 0);
    assert.equal(pressed.transform[0].translateY, 2);
    assert.equal(selected.transform[0].translateY, 1);
    assert.equal(selected.borderBottomColor, "#aabbcc");
    assert.match(resting.boxShadow, dark ? /255,255,255,0.16/ : /255,255,255,0.85/);
    assert.match(resting.boxShadow, /0 4px 0 rgba\(0,0,0,0.16\), 0 7px 12px/);
    assert.notEqual(resting.boxShadow, pressed.boxShadow);
    const disabled = tactileSurface({ dark, disabled: true, pressed: true });
    assert.equal(disabled.boxShadow, "none");
    assert.equal(disabled.borderColor, undefined);
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

test("event chips keep their selection and toggle behavior with a tactile selected state", () => {
  const entry = { id: "done", label: "Done", symbol: "✓", accent: "#00aa88", wash: "#113322" };
  const { SpecialCardTagPicker } = load("special-card-tag-picker.tsx", {
    "react-native": native,
    "@/providers/theme-provider": { useTheme: () => ({ theme: { scheme: "dark", colors: { border: "#444444", borderStrong: "#777777", secondary: "#333333", cardElevated: "#222222" } } }) },
    "./tactile": { tactileSurface },
    "@/lib/features/card-themes": { STATUS_CARD_THEMES: [entry], EASTER_EGG_CARD_THEMES: [], classifySpecialCardTag: (tag) => tag === entry.label ? { theme: entry } : null },
    "@/hooks/use-active-events": { useActiveEvents: () => ({ events: [{ id: entry.id, label: entry.label }] }) },
    "@/lib/features/special-card-tags": { toggleCardTag: (tags, tag) => tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag] },
  });
  const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  for (const selected of [false, true]) {
    let result;
    const tree = SpecialCardTagPicker({ tags: selected ? [entry.label] : [], onChange: (tags) => { result = tags; } });
    const chip = nodes(tree).find((node) => node.type === "Pressable");
    assert.equal(nodes(chip).filter((node) => node.type === "Text").length, 1, "selection never inserts an icon or changes the content width");
    assert.equal(nodes(chip).find((node) => node.type === "Text").props.style.fontWeight, "600");
    assert.equal(chip.props.accessibilityState.selected, selected);
    const appearance = flatten(chip.props.style({ pressed: false }));
    assert.equal(appearance.borderColor, selected ? "#777777" : "#444444");
    assert.equal(appearance.backgroundColor, selected ? "#222222" : "#333333");
    assert.notEqual(appearance.borderBottomColor, entry.accent);
    assert.equal(flatten(chip.props.style({ pressed: true })).transform[0].translateY, 2);
    chip.props.onPress();
    assert.deepEqual(result, selected ? [] : [entry.label]);
  }
});

test("segmented choices use fixed tracks and icon-free content in both selection states", () => {
  const theme = { scheme: "dark", radius: { md: 12, lg: 16 }, colors: { primary: "#abcdef", primarySoft: "#223344", card: "#222222", border: "#444444" } };
  const { SegmentedControl } = load("segmented-control.tsx", { "react-native": native, "@/providers/theme-provider": { useTheme: () => ({ theme }) }, "./tactile": { tactileSurface } });
  for (const value of ["first", "second"]) {
    const changes = [];
    const tree = SegmentedControl({ options: [{ key: "first", label: "First" }, { key: "second", label: "Second" }], value, onChange: (next) => changes.push(next) });
    for (const button of tree.props.children) {
      const resting = flatten(button.props.style({ pressed: false }));
      const pressed = flatten(button.props.style({ pressed: true }));
      assert.equal(resting.flex, 1);
      assert.equal(resting.height, 44);
      assert.equal(pressed.height, resting.height);
      assert.equal(pressed.transform[0].translateY, 2);
      assert.equal(button.props.children[0].type, "Text");
      assert.equal(button.props.children[1].type, "SelectionLed");
      assert.equal(button.props.children[1].props.selected, button.props.accessibilityState.selected);
      assert.equal(button.props["aria-pressed"], button.props.accessibilityState.selected);
      button.props.onPress();
    }
    assert.deepEqual(changes, ["first", "second"]);
  }
});

test("selection LED is a centered rounded bar that remains lit without affecting layout or touch", () => {
  const { SelectionLed } = load("selection-led.tsx", {
    "react-native": native,
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: { success: "#00aa66", mutedForeground: "#888888" } } }) },
  });
  for (const color of [undefined, "#ee4444", "#888888"]) {
    const idle = SelectionLed({ selected: false, color });
    const active = SelectionLed({ selected: true, color });
    const idleStyle = flatten(idle.props.style);
    const activeStyle = flatten(active.props.style);
    assert.equal(activeStyle.position, "absolute");
    assert.equal(activeStyle.left, "50%");
    assert.equal(activeStyle.top, 4);
    assert.equal(activeStyle.bottom, undefined);
    assert.equal(activeStyle.transform[0].translateX, -7);
    assert.equal(activeStyle.width, 14);
    assert.equal(activeStyle.height, 3);
    assert.equal(activeStyle.borderRadius, 2);
    assert.equal(activeStyle.width, idleStyle.width);
    assert.equal(activeStyle.backgroundColor, color ?? "#00aa66");
    assert.equal(activeStyle.opacity, 1);
    assert.equal(idleStyle.backgroundColor, "#888888");
    assert.equal(idleStyle.opacity, 0.3);
    assert.equal(idleStyle.boxShadow, "none");
    assert.match(activeStyle.boxShadow, /0 0 4px/);
    assert.equal(active.props.pointerEvents, "none");
    assert.equal(active.props.importantForAccessibility, "no-hide-descendants");
  }
});

test("task-editor selection never appends decorative checkmarks or date-field icons", () => {
  const source = readFileSync(new URL("../src/components/janus-board-ui.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("board.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = (name) => ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast);
  assert.doesNotMatch(declaration("Chip"), /name="checkmark-circle"/);
  assert.doesNotMatch(declaration("TaskEditorForm"), /name="(?:checkmark-circle|calendar-outline|time-outline|chevron-down)"/);
  for (const name of ["Chip", "TaskEditorForm"]) {
    assert.doesNotMatch(declaration(name), /accent: theme.colors.primary/);
    assert.doesNotMatch(declaration(name), /theme.colors.(?:primarySoft|accentForeground)/);
  }
});
