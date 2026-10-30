import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/janus-board-ui.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function setup({ initialSectionId = null, task = null, width = 1200 } = {}) {
  const slots = [];
  let cursor = 0;
  const react = {
    useCallback: (fn) => fn, useRef: (current) => ({ current }), useEffect() {},
    createElement: require("react").createElement,
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
  };
  const fallback = new Proxy({}, { get: (_, key) => key });
  const mocks = {
    react,
    "react-native": { ...fallback, Platform: { OS: "web" }, View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", TextInput: "TextInput", StyleSheet: { create: (value) => value }, useWindowDimensions: () => ({ width }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
    "@/hooks/use-open-session": { useOpenSession: () => 1 },
    "@/lib/domain/sections": { getTaskSectionId: (task) => task.sectionId ?? undefined },
    "@/lib/domain/constants": { PRIORITY_ORDER: ["medium"], PRIORITY_META: { medium: { label: "Medium" } } },
  };
  const exports = {};
  new Function("require", "exports", compiled)((id) => id === "react/jsx-runtime" || id === "date-fns" ? require(id) : mocks[id] ?? fallback, exports);
  const saves = [];
  const sections = [{ id: "mine", title: "My workflow" }, { id: "hidden", title: "Hidden", hidden: true }];
  const form = exports.TaskEditor({ visible: true, task, initialSectionId, sections, boards: [], onClose() {}, onSave: (draft, sectionId) => saves.push({ draft, sectionId }) });
  return { render() { cursor = 0; return form.type(form.props); }, saves };
}

function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}

test("task editor lets users select a list or No list on phone and desktop", () => {
  for (const width of [390, 1200]) {
    const app = setup({ width });
    let tree = app.render();
    const choices = () => nodes(tree).find((node) => node.props?.testID === "task-editor-list-choices");
    const chip = (label) => nodes(choices()).find((node) => node.props?.label === label);
    assert.equal(chip("No list").props.active, true);
    assert.equal(chip("Hidden"), undefined);
    chip("My workflow").props.onPress();
    tree = app.render();
    assert.equal(chip("My workflow").props.active, true);
    chip("No list").props.onPress();
    tree = app.render();
    assert.equal(chip("No list").props.active, true);
    assert.ok(nodes(tree).some((node) => node.props?.children === "Create your own tags using Actions → Add filter/tag."));
  }
});

test("adding from a list preselects that list, but a user's No list choice wins on save", () => {
  const app = setup({ initialSectionId: "mine" });
  let tree = app.render();
  assert.equal(nodes(tree).find((node) => node.props?.label === "My workflow").props.active, true);
  nodes(tree).find((node) => node.props?.label === "No list").props.onPress();
  nodes(tree).find((node) => node.props?.accessibilityLabel === "Task title").props.onChangeText("New task");
  tree = app.render();
  const save = nodes(tree).find((node) => node.props?.label === "Create task" || node.props?.label === "Add task");
  assert.ok(save);
  save.props.onPress();
  assert.equal(app.saves[0].sectionId, null);
});
