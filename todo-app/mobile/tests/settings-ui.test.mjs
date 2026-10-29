import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const native = { View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", Platform: { OS: "web" }, StyleSheet: { create: (v) => v, hairlineWidth: 0.5 } };
const colors = new Proxy({}, { get: (_, key) => key === "background" ? "#101020" : "#cccccc" });
const reference = { useReferenceTheme: () => ({ colors, type: { body: {}, bodyStrong: {}, caption: {}, title: {} } }), referenceSpacing: { md: 12, lg: 16 }, referenceRadii: { md: 12, lg: 16 } };
function hooks() {
  const slots = [];
  let index = 0;
  return {
    react: { useRef: (current) => ({ current }), useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], (value) => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }];
    } },
    render(component, props) { index = 0; return component(props); },
  };
}
async function load(path, mocks) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (id) => {
    if (id === "react/jsx-runtime") return require(id);
    assert.ok(id in mocks, `Unexpected import ${id}`);
    return mocks[id];
  } });
  return exports;
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const byLabel = (tree, label) => nodes(tree).find((node) => node.props?.accessibilityLabel === label);
const byText = (tree, text) => nodes(tree).find((node) => node.type === "Text" && node.props.children === text);

test("theme picker shows a sun/moon switch and only the palettes for that mode", async () => {
  const state = hooks();
  const choices = [];
  let preference = "matrix";
  const entries = [
    { id: "system", name: "System", scheme: "light" },
    { id: "light", name: "Light", scheme: "light" },
    { id: "dark", name: "Dark", scheme: "dark" },
    { id: "matrix", name: "Matrix", scheme: "dark" },
    { id: "neon-circuit", name: "Neon Circuit", scheme: "dark" },
    { id: "solarized-light", name: "Solarized Light", scheme: "light" },
  ];
  const darkTheme = { scheme: "dark", colors: { background: "#101020", card: "#202030", primary: "#00ff41", borderStrong: "#999999" } };
  const lightTheme = { scheme: "light", colors: { background: "#f7f7f7", card: "#ffffff", primary: "#6d28d9", borderStrong: "#999999" } };
  const { ThemePicker } = await load("../src/components/settings/theme-picker.tsx", {
    react: state.react, "react-native": native,
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "@/components/ui/input": { Input: "Input" },
    "@/components/reference/reference-theme": reference,
    "@/providers/theme-provider": { useTheme: () => ({ preference, theme: entries.find((entry) => entry.id === preference)?.scheme === "light" ? lightTheme : darkTheme, setPreference: (id) => { choices.push(id); preference = id; } }) },
    "@/theme/palettes": { themes: entries }, "@/theme/tokens": { getThemeById: (id) => entries.find((entry) => entry.id === id)?.scheme === "light" ? lightTheme : darkTheme },
  });
  let tree = state.render(ThemePicker, {});
  // Dark is the active mode, so its palettes are shown and light-only ones are hidden.
  assert.equal(byLabel(tree, "Use dark appearance").props.accessibilityState.checked, true);
  assert.equal(byLabel(tree, "Use light appearance").props.accessibilityState.checked, false);
  assert.equal(nodes(tree).filter((node) => node.type === "Ionicons").length, 2, "the switch shows sun and moon icons");
  assert.equal(byLabel(tree, "Choose interface theme").props.accessibilityState.expanded, false);
  byLabel(tree, "Choose interface theme").props.onPress();
  tree = state.render(ThemePicker, {});
  assert.equal(byLabel(tree, "Matrix").props.accessibilityState.checked, true);
  assert.ok(byLabel(tree, "Dark"), "dark palettes are listed");
  assert.equal(byLabel(tree, "Solarized Light"), undefined, "light palettes are hidden in dark mode");
  byLabel(tree, "Search themes").props.onChangeText("neon");
  tree = state.render(ThemePicker, {});
  assert.equal(byLabel(tree, "Matrix"), undefined);
  byLabel(tree, "Neon Circuit").props.onPress();
  assert.deepEqual(choices, ["neon-circuit"]);
  tree = state.render(ThemePicker, {});
  assert.equal(byLabel(tree, "Choose interface theme").props.accessibilityState.expanded, false);
  // Switching mode selects a light palette and filters the list to light themes.
  byLabel(tree, "Use light appearance").props.onPress();
  assert.equal(choices.at(-1), "light");
  tree = state.render(ThemePicker, {});
  assert.equal(byLabel(tree, "Use light appearance").props.accessibilityState.checked, true);
  byLabel(tree, "Choose interface theme").props.onPress();
  tree = state.render(ThemePicker, {});
  assert.ok(byLabel(tree, "Solarized Light"));
  assert.equal(byLabel(tree, "Matrix"), undefined, "the previous dark palette is hidden");
  assert.equal(byLabel(tree, "Neon Circuit"), undefined);
  byLabel(tree, "Solarized Light").props.onPress();
  tree = state.render(ThemePicker, {});
  // Returning to dark restores the dark palette last used in that mode.
  byLabel(tree, "Use dark appearance").props.onPress();
  assert.equal(choices.at(-1), "neon-circuit");
  tree = state.render(ThemePicker, {});
  byLabel(tree, "Choose interface theme").props.onPress();
  tree = state.render(ThemePicker, {});
  assert.ok(byLabel(tree, "Neon Circuit"));
  assert.equal(byLabel(tree, "Solarized Light"), undefined);
  byLabel(tree, "Search themes").props.onChangeText("solar");
  tree = state.render(ThemePicker, {});
  assert.ok(byText(tree, "No themes match your search."));
  tree = state.render(ThemePicker, { disabled: true });
  assert.equal(byLabel(tree, "Choose interface theme").props.disabled, true);
  assert.equal(byLabel(tree, "Use light appearance").props.disabled, true);
});

test("System remains available in either mode and follows the device appearance", async () => {
  const state = hooks();
  let preference = "system";
  const choices = [];
  const entries = [
    { id: "system", name: "System", scheme: "light" },
    { id: "light", name: "Light", scheme: "light" },
    { id: "solarized-light", name: "Solarized Light", scheme: "light" },
    { id: "dark", name: "Dark", scheme: "dark" },
    { id: "matrix", name: "Matrix", scheme: "dark" },
  ];
  const lightTheme = { scheme: "light", colors: { background: "#f7f7f7", card: "#ffffff", primary: "#6d28d9", borderStrong: "#999999" } };
  const { ThemePicker } = await load("../src/components/settings/theme-picker.tsx", {
    react: state.react, "react-native": native,
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "@/components/ui/input": { Input: "Input" },
    "@/components/reference/reference-theme": reference,
    "@/providers/theme-provider": { useTheme: () => ({ preference, theme: lightTheme, setPreference: (id) => { choices.push(id); preference = id; } }) },
    "@/theme/palettes": { themes: entries }, "@/theme/tokens": { getThemeById: () => lightTheme },
  });
  let tree = state.render(ThemePicker, {});
  assert.equal(byLabel(tree, "Use light appearance").props.accessibilityState.checked, true, "System resolves to the device scheme");
  byLabel(tree, "Choose interface theme").props.onPress();
  tree = state.render(ThemePicker, {});
  assert.ok(byLabel(tree, "System"), "System is offered while following the device");
  assert.ok(byLabel(tree, "Solarized Light"));
  assert.equal(byLabel(tree, "Matrix"), undefined);
  byLabel(tree, "System").props.onPress();
  assert.deepEqual(choices, ["system"]);
});

test("settings sections keep calendar, export and import actions functional", async () => {
  const state = hooks();
  const calls = [];
  const settings = { theme: "matrix", calendarDefaultView: "month", calendarWeekStart: 1 };
  const { default: Settings } = await load("../app/settings.tsx", {
    react: state.react, "react-native": native,
    "expo-constants": { __esModule: true, default: { expoConfig: { version: "1.2.0" } } }, "expo-blur": { BlurTargetView: "BlurTargetView" }, "expo-router": { router: {} },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
    "@/components/reference/mobile/reference-mobile-bottom-nav": { ReferenceMobileBottomNav: "Navigation" },
    "@/components/reference/mobile/reference-primitives": { ScreenHeader: "Header" },
    "@/components/settings/theme-picker": { ThemePicker: "ThemePicker" },
    "@/components/settings/keyboard-settings": { KeyboardSettings: "KeyboardSettings" },
    "@/components/ui/command-palette": { CommandPalette: "CommandPalette" },
    "@/components/ui/mobile-top-bar": { MobileTopBarAction: "MobileTopBarAction" },
    "@/lib/features/navigation-commands": { createNavigationCommands: () => [] },
    "@/components/reference/reference-theme": reference,
    "@/providers/preferences-provider": { usePreferences: () => ({ ...settings, setCalendarDefaultView: (value) => calls.push(["view", value]), setCalendarWeekStart: (value) => calls.push(["week", value]), savePreferences: async () => calls.push(["preferences"]) }) },
    "@/providers/tasks-provider": { useTasksContext: () => ({ projects: [], tasks: [] }) },
    "@/providers/theme-provider": { useTheme: () => ({ preference: "matrix", savePreference: async (value) => calls.push(["theme", value]) }) },
    "@/components/ui/section-heading": { SectionHeading: "Heading" }, "@/components/ui/sheet": { Sheet: "Sheet" }, "@/components/ui/button": { Button: "Button" }, "@/components/ui/janus-logo": { JanusLogo: "JanusLogo" },
    "@/lib/data/transfer": { exportFullBackup: async (_, value) => calls.push(["export", value.theme]), pickBackupFile: async () => ({ settings, boards: [] }) },
    "@/theme/layout": { mobileContentStyle: {}, mobileBottomNavClearance: 112 },
  });
  let tree = state.render(Settings);
  assert.ok(nodes(tree).some((node) => node.type === "ThemePicker"));
  function section(name) {
    const tab = nodes(tree).find((node) => node.props?.accessibilityRole === "tab" && byText(node, name));
    tab.props.onPress();
    tree = state.render(Settings);
  }
  section("Calendar");
  assert.equal(nodes(tree).some((node) => node.type === "ThemePicker"), false);
  byLabel(tree, "Open calendar in week view").props.onPress();
  byLabel(tree, "Start weeks on Sunday").props.onPress();
  assert.deepEqual(calls.slice(0, 2), [["view", "week"], ["week", 0]]);
  section("Commands");
  byLabel(tree, "Open commands").props.onPress();
  tree = state.render(Settings);
  assert.equal(nodes(tree).find((node) => node.type === "CommandPalette").props.mode, "commands");
  section("Data & backups");
  byLabel(tree, "Save backup").props.onPress();
  tree = state.render(Settings);
  assert.equal(nodes(tree).find((node) => node.type === "Sheet").props.visible, true);
  nodes(tree).find((node) => node.type === "Button" && node.props.label === "Save file").props.onPress();
  await new Promise(setImmediate);
  assert.ok(calls.some(([action, value]) => action === "export" && value === "matrix"));
  tree = state.render(Settings);
  byLabel(tree, "Import backup").props.onPress();
  await new Promise(setImmediate);
  assert.ok(calls.some(([action, value]) => action === "theme" && value === "matrix"));
  section("About");
  assert.ok(nodes(tree).some((node) => node.type === "Heading" && node.props.subtitle === "Version 1.2.0"));
});

test("keyboard settings toggles the persistent single-key preference and opens help", async () => {
  let enabled = true, helped = false;
  const { KeyboardSettings } = await load("../src/components/settings/keyboard-settings.tsx", {
    "react-native": native,
    "@/components/ui/button": { Button: "Button" },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors } }) },
    "@/providers/preferences-provider": { usePreferences: () => ({ singleKeyShortcuts: enabled, setSingleKeyShortcuts: (value) => { enabled = value; } }) },
  });
  const render = () => KeyboardSettings({ onHelp: () => { helped = true; } });
  let tree = render();
  assert.equal(byLabel(tree, "Single-key shortcuts").props.accessibilityState.checked, true);
  byLabel(tree, "Single-key shortcuts").props.onPress();
  tree = render();
  assert.equal(byLabel(tree, "Single-key shortcuts").props.accessibilityState.checked, false);
  nodes(tree).find((node) => node.type === "Button").props.onPress();
  assert.equal(helped, true);
});
