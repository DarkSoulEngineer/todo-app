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
  "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 20 }) },
  "@/theme/layout": { mobileBottomNavClearance: 112 },
  "@/components/ui/anchored-menu": { anchorFromEvent: (event) => ({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }) },
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
  return MobileTaskColumns({ tasks: [{ id: "one", title: "One", sectionId: "a" }], sections: [{ id: "a", title: "First" }], boards: [], now: new Date(), selectionMode: false, selectedTaskIds: new Set(), focused: false, compact: false, zoom: 1, showMoveArrows: false, ...overrides });
}

test("cards and lists are draggable immediately without an extra arrange row", () => {
  const tree = renderColumns();
  const cells = nodes(tree).filter((node) => node.type === "DragCell");
  assert.deepEqual(cells.map((node) => node.props.id), ["section:a", "task:one"]);
  assert.ok(cells.every((node) => node.props.enabled));
  assert.ok(!nodes(tree).some((node) => /arrange|rearranging/i.test(node.props?.accessibilityLabel ?? "")));
  assert.ok(!JSON.stringify(tree).includes("Arrange cards and lists"));
});

test("list backgrounds wrap their content with navigation clearance outside the surface", () => {
  const tree = renderColumns({ sections: [{ id: "a", title: "First" }, { id: "empty", title: "Empty" }] });
  for (const id of ["a", "empty"]) {
    const cell = nodes(tree).find((node) => node.type === "DragCell" && node.props.id === `section:${id}`);
    assert.equal(cell.props.constrainHeight, true);
    const column = nodes(cell).find((node) => node.props?.testID === `janus-column-${id}`);
    const style = Object.assign({}, ...column.props.style);
    assert.equal(style.flex, undefined, "short and empty lists must not stretch into unused space");
    assert.equal(style.flexShrink, 0, "the surface wraps all its cards inside the scroll holder");
    assert.equal(style.minHeight, 0);
    const holder = nodes(cell).find((node) => node.props?.testID === `janus-column-holder-${id}`);
    assert.equal(holder.props.style.maxHeight, "100%");
    const scroll = nodes(holder).find((node) => node.type === "ScrollView");
    assert.equal(scroll.props.style.flexGrow, 0);
    assert.equal(scroll.props.style.flexShrink, 1);
    assert.equal(Object.assign({}, ...scroll.props.contentContainerStyle).paddingBottom, 92, "two 20-point dot rows are removed from the navigation clearance");
    assert.ok(!nodes(column).some((node) => node.props?.testID === `janus-add-card-footer-${id}`), "creation tile must be outside the column background");
    assert.ok(nodes(cell).some((node) => node.props?.testID === `janus-add-card-footer-${id}`));
  }
  const contentStyle = Object.assign({}, ...nodes(tree).find((node) => node.type === "Carousel").props.contentContainerStyle);
  assert.equal(contentStyle.alignItems, "flex-start");
  assert.equal(contentStyle.paddingBottom, 32, "holders extend to a 12-point bottom gap plus the safe area");
});

test("focused tabs fit their touch targets without clipping or shrinking into the column", () => {
  for (const viewport of [390, 768, 1440]) {
    width = viewport;
    const tree = renderColumns({ focused: true });
    const rail = nodes(tree).find((node) => node.type === "ScrollView" && node.props.horizontal);
    const tab = nodes(rail).find((node) => node.props?.accessibilityRole === "tab");
    const tabStyle = Object.assign({}, ...tab.props.style);
    assert.equal(rail.props.style.flexShrink, 0);
    assert.equal(tabStyle.minHeight, 44);
    assert.ok(rail.props.style.height >= tabStyle.minHeight + rail.props.contentContainerStyle.paddingVertical * 2);
    const scroll = nodes(tree).find((node) => node.props?.testID === "janus-focused-scroll");
    const holder = nodes(tree).find((node) => Array.isArray(node.props?.style) && node.props.children?.includes?.(scroll));
    assert.equal(holder.props.style[1].marginHorizontal, rail.props.contentContainerStyle.paddingHorizontal);
    assert.equal(holder.props.style[1].marginTop, undefined);
  }
  width = 1440;
});

test("header and trailing Add card buttons target the correct list in normal and focused views", () => {
  for (const focused of [false, true]) {
    const added = [];
    const tree = renderColumns({ focused, onAddTask: (id) => added.push(id) });
    const header = nodes(tree).find((node) => node.props?.testID === "janus-add-card-header-a");
    const footer = nodes(tree).find((node) => node.props?.testID === "janus-add-card-footer-a");
    header.props.onPress();
    nodes(footer).find((node) => node.type === "Pressable").props.onPress();
    assert.deepEqual(added, ["a", "a"]);
    const tile = nodes(footer).find((node) => node.type === "Pressable");
    const style = Object.assign({}, ...tile.props.style({ pressed: false }));
    assert.equal(style.borderStyle, "dashed");
    assert.equal(style.borderRadius, 20);
    assert.equal(style.minHeight, 110);
    assert.equal(style.alignItems, "center");
    assert.equal(style.backgroundColor, "transparent");
    const scroll = nodes(tree).find((node) => node.props?.testID === (focused ? "janus-focused-scroll" : "janus-column-scroll-a"));
    const fixedHeader = nodes(tree).find((node) => node.props?.testID === "janus-column-header-a");
    assert.ok(!nodes(scroll).includes(fixedHeader), "header must stay outside the scrolling card area");
    assert.ok(!nodes(scroll).includes(header), "header Add card remains fixed and accessible while scrolling");
    assert.ok(nodes(scroll).includes(footer), "Add card scrolls inside the holder");
    const stack = nodes(tree).find((node) => Array.isArray(node.props?.children) && node.props.children[1] === footer);
    assert.ok(stack, "creation tile is a sibling below the background surface");
    assert.equal(stack, scroll, "the surface and tile share one scrolling holder");
    assert.equal(stack.props.children[0].type, "View");
  }
});

test("empty lists keep the header add button but have no bottom creation tile", () => {
  for (const focused of [false, true]) {
    const tree = renderColumns({ focused, tasks: [] });
    assert.ok(nodes(tree).some((node) => node.props?.testID === "janus-add-card-header-a"));
    const footer = nodes(tree).find((node) => node.props?.testID === "janus-add-card-footer-a");
    assert.equal(nodes(footer).filter((node) => node.type === "Pressable").length, 0);
  }
});

test("hidden lists no longer add a restore row above the board canvas", () => {
  const tree = renderColumns({ sections: [{ id: "a", title: "First" }, { id: "secret", title: "Secret", hidden: true }] });
  assert.ok(!nodes(tree).some((node) => node.props?.testID === "janus-column-secret"));
  assert.ok(!nodes(tree).some((node) => node.props?.accessibilityLabel === "Show Secret"));
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
