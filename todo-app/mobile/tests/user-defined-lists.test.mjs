import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/janus-board-ui.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function loadHelper(path, mocks = {}) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)((id) => id === "react/jsx-runtime" ? require(id) : mocks[id], exports);
  return exports;
}
const cardThemes = loadHelper("lib/features/card-themes.ts");
const activeEvents = loadHelper("lib/features/active-events.ts", { "@/lib/features/card-themes": cardThemes });
const cardTags = loadHelper("lib/features/special-card-tags.ts", { "@/lib/features/card-themes": cardThemes });

function setup({ initialSectionId = null, initialDueAt = null, task = null, width = 1200, presentation = "sheet", sections = [{ id: "mine", title: "My workflow" }, { id: "hidden", title: "Hidden", hidden: true }] } = {}) {
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
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "./tactile": { tactileSurface: () => ({}) },
    "@/components/ui/selection-led": { SelectionLed: "SelectionLed" },
    "react-native": { ...fallback, Platform: { OS: "web" }, View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", TextInput: "TextInput", StyleSheet: { create: (value) => value }, useWindowDimensions: () => ({ width }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
    "@/hooks/use-open-session": { useOpenSession: () => 1 },
    "@/hooks/use-active-events": { useActiveEvents: () => ({ events: activeEvents.getActiveEventThemes(new Date(), activeEvents.getEventOverride()) }) },
    "@/lib/domain/sections": { getTaskSectionId: (task) => task.sectionId ?? undefined },
    "@/lib/domain/constants": { PRIORITY_ORDER: ["medium"], PRIORITY_META: { medium: { label: "Medium" } } },
    "@/lib/features/card-themes": cardThemes,
    "@/lib/features/special-card-tags": cardTags,
  };
  mocks["@/components/ui/special-card-tag-picker"] = loadHelper("components/ui/special-card-tag-picker.tsx", mocks);
  mocks["@/components/ui/card-status-picker"] = loadHelper("components/ui/card-status-picker.tsx", mocks);
  mocks["@/components/ui/card-status-picker"] = {
    CardStatusPicker: ({ tags, onChange }) => react.createElement("View", null,
      cardThemes.STATUS_CARD_THEMES.map((entry) => react.createElement("Pressable", {
        key: entry.id,
        accessibilityRole: "radio",
        accessibilityLabel: `Status tag ${entry.label}`,
        onPress: () => onChange(cardTags.toggleCardTag(tags, entry.label)),
      })),
    ),
  };
  const exports = {};
  new Function("require", "exports", compiled)((id) => id === "react/jsx-runtime" || id === "date-fns" ? require(id) : mocks[id] ?? fallback, exports);
  const saves = [];
  const form = exports.TaskEditor({ visible: true, task, initialDueAt, initialSectionId, sections, boards: [], presentation, onClose() {}, onSave: (draft, sectionId) => saves.push({ draft, sectionId }) });
  return { render() { cursor = 0; return form.type(form.props); }, saves };
}

function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}

test("calendar creation keeps its selected date and replaces Schedule with time-only controls", () => {
  const initialDueAt = new Date(2027, 0, 2, 9, 0).toISOString();
  for (const width of [390, 1200]) for (const presentation of ["sheet", "panel"]) {
    const app = setup({ initialDueAt, width, presentation });
    let tree = app.render();
    const picker = nodes(tree).find((node) => node.type === "TaskSchedulePicker");
    assert.equal(picker.props.value, initialDueAt);
    assert.equal(picker.props.dateLocked, true);
    const sections = nodes(tree).filter((node) => node.type === "CollapsibleTaskSection");
    assert.ok(sections.some((node) => node.props.title === "Time"));
    assert.equal(sections.some((node) => node.props.title === "Schedule"), false);
    const changed = new Date(2027, 0, 2, 16, 45).toISOString();
    picker.props.onChange(changed);
    nodes(tree).find((node) => node.props?.accessibilityLabel === "Task title").props.onChangeText("Calendar day task");
    tree = app.render();
    nodes(tree).find((node) => node.props?.label === "Add task").props.onPress();
    assert.equal(app.saves[0].draft.dueAt, changed);
  }
  const normal = setup().render();
  assert.equal(nodes(normal).find((node) => node.type === "TaskSchedulePicker").props.dateLocked, false);
  const edited = setup({ task: { id: "existing", title: "Task", priority: "medium", sectionId: "mine", dueAt: initialDueAt, subtasks: [] } }).render();
  assert.equal(nodes(edited).find((node) => node.type === "TaskSchedulePicker").props.dateLocked, false);
});

test("Task/Create/Edit use the same logical section order on phones, windows and side panels", () => {
  for (const width of [390, 1200]) for (const presentation of ["sheet", "panel"]) for (const task of [null, { id: "existing", title: "Task", priority: "medium", sectionId: "mine", subtasks: [] }]) {
    const tree = setup({ width, presentation, task }).render();
    const all = nodes(tree);
    const sections = all.filter((node) => node.type === "CollapsibleTaskSection");
    assert.deepEqual(sections.map((node) => node.props.title), ["List", "Priority", "Schedule", "Notes", "Checklist", "Tags"]);
    const titleIndex = all.findIndex((node) => node.props?.accessibilityLabel === "Task title");
    assert.ok(titleIndex >= 0 && titleIndex < all.indexOf(sections[0]));
    const actionIndex = all.findIndex((node) => node.props?.label === (task ? "Cancel task" : "Add task"));
    assert.ok(actionIndex > all.indexOf(sections.at(-1)), "main actions stay after the form");
  }
});

test("task editor selects a real list and never offers No list on phone and desktop", () => {
  for (const width of [390, 1200]) {
    const app = setup({ width });
    let tree = app.render();
    const choices = () => nodes(tree).find((node) => node.props?.testID === "task-editor-list-choices");
    const chip = (label) => nodes(choices()).find((node) => node.props?.label === label);
    assert.equal(chip("No list"), undefined);
    assert.equal(chip("My workflow").props.active, true);
    assert.equal(chip("Hidden"), undefined);
    chip("My workflow").props.onPress();
    tree = app.render();
    assert.equal(chip("My workflow").props.active, true);
    assert.ok(nodes(tree).some((node) => node.props?.accessibilityLabel === "New card tag"));
  }
});

test("editor saves one event and one status plus unlimited ordinary tags on mobile and desktop", () => {
  for (const width of [390, 1200]) {
    const app = setup({ width });
    let tree = app.render();
    const pressSpecial = (label) => {
      if (label.startsWith("Event tag ")) activeEvents.setEventOverride("all");
      const component = label.startsWith("Status tag ") ? "CardStatusPicker" : "SpecialCardTagPicker";
      const picker = nodes(tree).find((node) => node.type?.name === component);
      nodes(picker.type(picker.props)).find((node) => node.props?.accessibilityLabel === label).props.onPress();
      tree = app.render();
    };
    pressSpecial("Event tag Halloween"); pressSpecial("Status tag Done"); pressSpecial("Status tag Canceled"); pressSpecial("Event tag Christmas");
    for (const label of ["Work", "Study"]) {
      nodes(tree).find((node) => node.props?.accessibilityLabel === "New card tag").props.onChangeText(label);
      tree = app.render();
      nodes(tree).find((node) => node.props?.label === "Add" && node.props.accessibilityLabel !== "Add subtask").props.onPress();
      tree = app.render();
    }
    nodes(tree).find((node) => node.props?.accessibilityLabel === "Task title").props.onChangeText("Tagged task");
    tree = app.render();
    nodes(tree).find((node) => node.props?.label === "Add task").props.onPress();
    assert.deepEqual(app.saves[0].draft.tags, ["Canceled", "Christmas", "Work", "Study"]);
    assert.equal(app.saves[0].sectionId, "mine");
    activeEvents.setEventOverride(null);
  }
});

test("adding from a list preserves that list on save", () => {
  const app = setup({ initialSectionId: "other", sections: [{ id: "mine", title: "My workflow" }, { id: "other", title: "Other" }] });
  let tree = app.render();
  assert.equal(nodes(tree).find((node) => node.props?.label === "Other").props.active, true);
  nodes(tree).find((node) => node.props?.accessibilityLabel === "Task title").props.onChangeText("New task");
  tree = app.render();
  const save = nodes(tree).find((node) => node.props?.label === "Create task" || node.props?.label === "Add task");
  assert.ok(save);
  save.props.onPress();
  assert.equal(app.saves[0].sectionId, "other");
});

test("an empty board cannot save a card or invent a list", () => {
  const app = setup({ sections: [] });
  let tree = app.render();
  nodes(tree).find((node) => node.props?.accessibilityLabel === "Task title").props.onChangeText("Task");
  tree = app.render();
  const save = nodes(tree).find((node) => node.props?.label === "Add task");
  assert.equal(save.props.disabled, true);
  save.props.onPress();
  assert.deepEqual(app.saves, []);
  assert.equal(nodes(tree).some((node) => node.props?.label === "No list"), false);
});

test("legacy unassigned cards require an explicit list choice without helper text", () => {
  const app = setup({ task: { id: "legacy", title: "Existing card", sectionId: null, subtasks: [] } });
  let tree = app.render();
  assert.equal(nodes(tree).find((node) => node.props?.label === "My workflow").props.active, false);
  assert.ok(!nodes(tree).some((node) => node.props?.children === "Choose a list to save this card."));
  nodes(tree).find((node) => node.props?.label === "My workflow").props.onPress();
  tree = app.render();
  assert.equal(nodes(tree).find((node) => node.props?.label === "My workflow").props.active, true);
});
