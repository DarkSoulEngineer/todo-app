import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(path, mocks) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const exports = {};
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  vm.runInNewContext(outputText, { exports, require: (id) => id === "react/jsx-runtime" ? require(id) : mocks[id] });
  return exports;
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const react = { useMemo: (fn) => fn(), useRef: (current) => ({ current }), useState: (initial) => [initial, () => {}], useEffect() {} };
let width = 1440;
const native = { View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", useWindowDimensions: () => ({ width, height: 1000 }), StyleSheet: { create: (value) => value } };
const { MobileTaskColumns } = await load("../src/components/board/mobile-task-columns.tsx", {
  react, "react-native": native, "@expo/vector-icons": { Ionicons: "Icon" },
  "@/lib/domain/sections": { getTaskSectionId: (task) => task.sectionId },
  "./mobile-board-colors": { useMobileBoardColors: () => ({}) },
  "./mobile-column-task-card": { MobileColumnTaskCard: "Card" },
  "./board-column-carousel": { BoardColumnCarousel: "Carousel" },
  "./janus-drag-cell": { JanusDragCell: "DragCell" },
  "./board-drop-zone": { BoardDropZone: "DropZone" },
  "./use-native-drag-preview": { useNativeDragPreview: () => ({ host: null, layer: undefined, overlay: null }) },
  "@/hooks/use-janus-drag": { useJanusDrag: () => ({ drag: null, register() {}, start() {}, move() {}, drop() {}, cancel() {} }) },
  "@/hooks/use-native-janus-auto-scroll": { useNativeJanusAutoScroll: () => ({ trackPointer() {}, trackCarousel() {}, registerList() {}, trackList() {}, listOffset: () => 0 }) },
  "@/lib/features/janus-drag": { sectionDragId: (id) => `section:${id}`, taskDragId: (id) => `task:${id}` },
});
function renderColumns(overrides = {}) {
  return MobileTaskColumns({ tasks: [{ id: "one", title: "One", sectionId: "a" }], sections: [{ id: "a", title: "First" }], boards: [], now: new Date(), hiddenSections: [], selectionMode: false, selectedTaskIds: new Set(), focused: false, compact: false, zoom: 1, showMoveArrows: false, ...overrides });
}

test("cards and lists are draggable immediately without an extra arrange row", () => {
  const tree = renderColumns();
  const cells = nodes(tree).filter((node) => node.type === "DragCell");
  assert.deepEqual(cells.map((node) => node.props.id), ["section:a", "task:one"]);
  assert.ok(cells.every((node) => node.props.enabled));
  assert.ok(!nodes(tree).some((node) => /arrange|rearranging/i.test(node.props?.accessibilityLabel ?? "")));
  assert.ok(!JSON.stringify(tree).includes("Arrange cards and lists"));
});

test("Actions can disable dragging; selection and focus keep their normal interactions", () => {
  for (const overrides of [{ dragEnabled: false }, { selectionMode: true }, { focused: true }]) {
    const tree = renderColumns(overrides);
    const cells = nodes(tree).filter((node) => node.type === "DragCell");
    assert.ok(cells.length);
    assert.ok(cells.every((node) => !node.props.enabled));
    if (overrides.focused) assert.ok(nodes(tree).some((node) => node.props?.testID === "janus-focused-scroll"));
  }
  assert.ok(nodes(renderColumns({ dragEnabled: true })).filter((node) => node.type === "DragCell").every((node) => node.props.enabled));
});

test("phone resolutions disable both card and list dragging; tablets and desktop retain it", () => {
  try {
    for (width of [320, 390, 600, 767, 768, 1024, 1440]) {
      const cells = nodes(renderColumns({ dragEnabled: true })).filter((node) => node.type === "DragCell");
      assert.equal(cells.length, 2);
      assert.ok(cells.every((node) => node.props.enabled === (width >= 768)), `drag availability at ${width}px`);
    }
  } finally { width = 1440; }
});

test("Board Actions toggle dragging on and off, with no toggle on other views", async () => {
  const slots = [];
  let cursor = 0;
  const fallback = new Proxy({}, { get: (_, key) => key });
  const api = { tasks: [], sections: [], boards: [], versions: [], projects: [{ id: "board", name: "Board" }], currentProjectId: "board" };
  const mocks = new Proxy({
    react: { ...react, useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; } },
    "react-native": native,
    "expo-router": { useLocalSearchParams: () => ({ id: "board" }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    "@/hooks/use-now": { useNow: () => new Date("2026-10-28") },
    "@/providers/tasks-provider": { useTasksContext: () => api },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
    "@/providers/toast-provider": { useToast: () => ({}) },
    "@/lib/domain/tasks-selectors": { sortTasks: (tasks) => tasks },
    "@/lib/features/top-tasks": { rankTopTasks: () => [] },
    "@/lib/features/ribbon-context": { getRibbonContext: () => ({}) },
    "@/lib/domain/constants": { SORT_OPTIONS: [], PRIORITY_ORDER: [] },
  }, { get: (target, key) => target[key] ?? fallback });
  const { default: WorkspaceScreen } = await load("../app/board/[id].tsx", mocks);
  const render = () => { cursor = 0; return WorkspaceScreen(); };
  let tree = render();
  const columns = (tree) => nodes(tree).find((node) => node.type === "MobileTaskColumns");
  const toggle = (tree) => nodes(tree).find((node) => node.props?.label === "Disable dragging" || node.props?.label === "Enable dragging");
  assert.equal(columns(tree).props.dragEnabled, true);
  assert.equal(toggle(tree).props.label, "Disable dragging");
  toggle(tree).props.onPress();
  tree = render();
  assert.equal(columns(tree).props.dragEnabled, false);
  assert.equal(toggle(tree).props.label, "Enable dragging");
  toggle(tree).props.onPress();
  tree = render();
  assert.equal(columns(tree).props.dragEnabled, true);
  try {
    for (width of [390, 600, 767, 768, 1024, 1440]) {
      assert.equal(Boolean(toggle(render())), width >= 768, `drag action visibility at ${width}px`);
    }
  } finally { width = 1440; }
  slots[0] = "calendar";
  assert.equal(toggle(render()), undefined);
});
