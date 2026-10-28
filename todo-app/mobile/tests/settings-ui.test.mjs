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

test("theme picker expands, searches, selects and closes without decorative icons", async () => {
  const state = hooks();
  const choices = [];
  const catalog = ["system", "matrix", "neon-circuit"].map((id) => ({ id, name: id === "matrix" ? "Matrix" : id }));
  const theme = { scheme: "dark", colors: { background: "#101020", card: "#202030", primary: "#00ff41", borderStrong: "#999999" } };
  const { ThemePicker } = await load("../src/components/settings/theme-picker.tsx", {
    react: state.react, "react-native": native,
    "@/components/ui/input": { Input: "Input" },
    "@/components/reference/reference-theme": reference,
    "@/providers/theme-provider": { useTheme: () => ({ preference: "matrix", theme, setPreference: (id) => choices.push(id) }) },
    "@/theme/palettes": { themes: catalog }, "@/theme/tokens": { getThemeById: () => theme },
  });
  let tree = state.render(ThemePicker, {});
  assert.equal(byLabel(tree, "Choose interface theme").props.accessibilityState.expanded, false);
  byLabel(tree, "Choose interface theme").props.onPress();
  tree = state.render(ThemePicker, {});
  assert.equal(byLabel(tree, "Matrix").props.accessibilityState.checked, true);
  byLabel(tree, "Search themes").props.onChangeText("neon");
  tree = state.render(ThemePicker, {});
  assert.equal(byLabel(tree, "Matrix"), undefined);
  byLabel(tree, "neon-circuit").props.onPress();
  assert.deepEqual(choices, ["neon-circuit"]);
  tree = state.render(ThemePicker, {});
  assert.equal(byLabel(tree, "Choose interface theme").props.accessibilityState.expanded, false);
  assert.equal(nodes(tree).some((node) => node.type === "Icon"), false);
  byLabel(tree, "Choose interface theme").props.onPress();
  tree = state.render(ThemePicker, {});
  byLabel(tree, "Search themes").props.onChangeText("not-a-theme");
  tree = state.render(ThemePicker, {});
  assert.ok(byText(tree, "No themes match your search."));
  assert.equal(nodes(tree).some((node) => node.props?.accessibilityRole === "radio"), false);
  tree = state.render(ThemePicker, { disabled: true });
  assert.equal(byLabel(tree, "Choose interface theme").props.disabled, true);
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
    "@/components/reference/reference-theme": reference,
    "@/providers/preferences-provider": { usePreferences: () => ({ ...settings, setCalendarDefaultView: (value) => calls.push(["view", value]), setCalendarWeekStart: (value) => calls.push(["week", value]), savePreferences: async () => calls.push(["preferences"]) }) },
    "@/providers/tasks-provider": { useTasksContext: () => ({ projects: [], tasks: [] }) },
    "@/providers/theme-provider": { useTheme: () => ({ preference: "matrix", savePreference: async (value) => calls.push(["theme", value]) }) },
    "@/components/ui/section-heading": { SectionHeading: "Heading" }, "@/components/ui/sheet": { Sheet: "Sheet" }, "@/components/ui/button": { Button: "Button" },
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
