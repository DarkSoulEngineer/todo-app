import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (id) => {
    if (id === "react/jsx-runtime" || id === "date-fns") return require(id);
    assert.ok(id in mocks, `Unexpected import ${id}`);
    return mocks[id];
  } });
  return exports;
}
const layoutModule = await load("../src/lib/features/home-layout.ts");
const { getHomeLayout } = layoutModule;
const metrics = { total: 26, open: 13, done: 7, overdue: 7, canceled: 6, dueSoon: 5, completionPercent: 27 };
let width = 390;
let activeDrag = null;
let boardPaneMeasurement = null;
const colors = new Proxy({}, { get: () => "#888888" });
const { BoardManagerContent } = await load("../src/components/board/board-manager-content.tsx", {
  react: { useState: (value) => value === null ? [boardPaneMeasurement, (next) => { boardPaneMeasurement = next; }] : [value, () => {}] },
  "react-native": { View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", Platform: { select: (values) => values.default }, useWindowDimensions: () => ({ width }), StyleSheet: { create: (value) => value, hairlineWidth: 0.5 } },
  "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 20, left: 0, right: 0 }) },
  "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle" },
  "@expo/vector-icons": { Ionicons: "Icon" },
  "@/components/janus-board-ui": { IconButton: "IconButton" },
  "@/components/reference/mobile/reference-primitives": { ScreenHeader: "Header" },
  "@/components/ui/button": { Button: "Button" }, "@/components/ui/empty-state": { EmptyState: "EmptyState" },
  "@/components/ui/mobile-top-bar": { MobileTopBarAction: "Action", MobileSearchField: "Search" },
  "@/components/ui/section-heading": { SectionHeading: "Heading" },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors } }) },
  "@/lib/data/manager-state": { getTaskMetrics: () => metrics },
  "@/theme/layout": { mobileContentStyle: { maxWidth: 600, width: "100%" }, mobileBottomNavClearance: 112 },
  "@/lib/features/home-layout": layoutModule,
  "./board-drag-cell": { BoardDragCell: "BoardDragCell" },
  "@/hooks/use-board-grid-drag": { useBoardGridDrag: () => ({ drag: activeDrag, register() {}, start() {}, move() {}, drop() {}, cancel() {} }) },
});
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const find = (tree, id) => nodes(tree).find((node) => node.props?.testID === id);
const flatten = (value) => Object.assign({}, ...[value].flat(Infinity).filter(Boolean));
const projects = Array.from({ length: 7 }, (_, id) => ({ id: `${id}`, name: `Board ${id}`, createdAt: "2026-10-28", workspace: { tasks: [] } }));
function render(overrides = {}) {
  return BoardManagerContent({ projects, statsProjects: projects, closedProjects: projects.slice(0, 2), totalBoards: 7, metrics, pinnedIds: new Set(), ready: true, loading: false, editing: false, now: 0, ...overrides });
}

test("responsive grid fills available width without overflowing cards or safe areas", () => {
  for (const viewport of [320, 390, 767, 768, 1024, 1440, 1920, 2560]) {
    for (const inset of [0, 44]) {
      const layout = getHomeLayout(viewport, inset, inset);
      assert.equal(layout.wide, viewport - inset * 2 >= 768);
      assert.ok(layout.cardWidth > 0);
      const occupied = layout.columns * layout.cardWidth + (layout.columns - 1) * 16 + layout.padding * 2 + inset * 2 + (layout.sidebar ? layout.statsWidth + 24 : 0);
      assert.ok(Math.abs(occupied - viewport) < 0.01);
      if (layout.wide) assert.ok(layout.cardWidth >= 300);
      else assert.equal(layout.columns, 1);
      assert.ok(layout.columns <= 2, "wide layouts keep two columns of boards");
      assert.equal(layout.sidebar, viewport - inset * 2 >= 1320);
    }
  }
});

test("desktop divides the page evenly between two board columns and Stats", () => {
  for (const viewport of [1320, 1366, 1440, 1536, 1920, 2560]) {
    const layout = getHomeLayout(viewport);
    assert.equal(layout.columns, 2);
    assert.ok(layout.cardWidth >= 300);
    assert.equal(layout.statsWidth, (viewport - layout.padding * 2 - 24) / 2);
    assert.equal(layout.cardWidth * 2 + 16, layout.statsWidth);
    assert.ok(layout.statsChartSize >= 240 && layout.statsChartSize <= 360);
  }
});

test("two card columns fit the measured panel despite scrollbars and fractional pixels", () => {
  try {
    for (width of [768, 1320, 1440, 1920]) {
      const layout = getHomeLayout(width);
      const expectedPanel = layout.sidebar ? layout.statsWidth : width - layout.padding * 2;
      for (const lostSpace of [0, 0.5, 17.25]) {
        const measured = expectedPanel - lostSpace;
        const initial = render();
        find(initial, "home-boards-pane").props.onLayout({ nativeEvent: { layout: { width: measured } } });
        const tree = render();
        const grid = find(tree, "home-board-grid");
        const cards = grid.props.children.filter((cell) => cell && cell.props.testID !== "home-add-board-card");
        const cellWidth = cards[0].props.width;
        assert.equal(cellWidth, Math.floor((measured - 16) / 2));
        assert.ok(cellWidth * 2 + 16 <= measured, "second column must not wrap");
        assert.ok(measured - (cellWidth * 2 + 16) < 2, "both columns should fill the panel");
        assert.equal(flatten(find(tree, "home-add-board-card").props.style({ pressed: false })).width, cellWidth);
        for (const cell of find(tree, "home-closed-board-grid").props.children) assert.equal(cell.props.style.width, cellWidth);
      }
    }
  } finally { boardPaneMeasurement = null; }
});

test("Home retains phone sizing and uses full-width grids for active and closed boards", () => {
  for (width of [390, 767, 768, 1024, 1440, 1920]) {
    const tree = render();
    const layout = getHomeLayout(width);
    const content = flatten(find(tree, "home-content").props.contentContainerStyle);
    assert.equal(content.maxWidth, layout.wide ? "100%" : 600);
    assert.equal(content.paddingBottom, 132);
    for (const id of ["home-board-grid", "home-closed-board-grid"]) {
      const grid = find(tree, id);
      assert.equal(flatten(grid.props.style).flexWrap, layout.wide ? "wrap" : undefined);
      for (const cell of grid.props.children) {
        if (!cell || cell.props.testID === "home-add-board-card") continue;
        assert.equal(cell.props.width ?? cell.props.style?.width, layout.wide ? layout.cardWidth : undefined);
      }
    }
    const overview = nodes(tree).find((node) => node.type?.name === "WorkspaceOverview");
    const stats = overview.type(overview.props);
    assert.equal(flatten(find(stats, "home-stats-layout").props.style).flexDirection, layout.wide && !layout.sidebar ? "row" : undefined);
    assert.equal(flatten(find(tree, "home-dashboard").props.style).flexDirection, layout.sidebar ? "row" : undefined);
    assert.equal(find(tree, "home-stats-panel").props.style?.width, layout.sidebar ? layout.statsWidth : undefined);
    const donut = nodes(stats).find((node) => node.props?.accessible && node.props.accessibilityLabel?.includes("26 tasks"));
    if (layout.wide) assert.equal(flatten(donut.props.style).width, layout.sidebar ? layout.statsChartSize : 200);
    const shares = nodes(stats).filter((node) => node.props?.accessibilityRole === "progressbar");
    assert.equal(shares.length, 4);
    assert.equal(shares[2].props.accessibilityValue.text, "6 tasks, 23%");
  }
});

test("grid keeps ordering and board actions intact", () => {
  width = 1440;
  const calls = [];
  const tree = render({ onOpen: (id) => calls.push(["open", id]), onMove: (id, direction) => calls.push(["move", id, direction]) });
  const cards = find(tree, "home-board-grid").props.children.filter((cell) => cell && cell.props.testID !== "home-add-board-card").map((cell) => cell.props.children);
  assert.deepEqual(Array.from(cards, (card) => card.props.project.id), projects.map((project) => project.id));
  cards[0].props.onOpen();
  cards[1].props.onMove(-1);
  assert.deepEqual(calls, [["open", "0"], ["move", "1", -1]]);
  assert.equal(cards[0].props.first, true);
  assert.equal(cards.at(-1).props.last, true);
});

test("desktop stats stretch to available height without a panel background", () => {
  width = 1920;
  const tree = render({ projects: projects.slice(0, 1) });
  assert.equal(flatten(find(tree, "home-content").props.contentContainerStyle).flexGrow, 1);
  const dashboard = flatten(find(tree, "home-dashboard").props.style);
  assert.equal(dashboard.flexGrow, 1);
  assert.equal(dashboard.alignItems, "stretch");
  const overview = nodes(tree).find((node) => node.type?.name === "WorkspaceOverview");
  assert.equal(overview.props.projects.length, 7, "search filtering must not change workspace statistics");
  const stats = overview.type(overview.props);
  assert.equal(flatten(stats.props.style).flexGrow, 1);
  const surface = flatten(find(stats, "home-stats-surface").props.style);
  assert.equal(surface.flexGrow, 1);
  assert.equal(surface.backgroundColor, undefined);
  assert.equal(surface.borderWidth, undefined);
  assert.ok(find(stats, "home-board-comparison"));
});

test("outline create card fills a grid slot and opens the existing create action", () => {
  for (width of [390, 768, 1440]) {
    let created = 0;
    const tree = render({ onCreate: () => created++ });
    const add = find(tree, "home-add-board-card");
    assert.ok(add);
    assert.equal(add.props.accessibilityLabel, "Add new board");
    const style = flatten(add.props.style({ pressed: false }));
    assert.equal(style.borderStyle, "dashed");
    assert.equal(style.backgroundColor, "transparent");
    assert.equal(style.width, getHomeLayout(width).wide ? getHomeLayout(width).cardWidth : undefined);
    add.props.onPress();
    assert.equal(created, 1);
    assert.equal(find(render({ editing: true }), "home-add-board-card"), undefined);
    assert.equal(find(render({ ready: false }), "home-add-board-card").props.disabled, true);
  }
});

test("move arrows vanish on every card while dragging and return without layout changes", () => {
  width = 1440;
  for (const dragging of [false, true, false]) {
    activeDrag = dragging ? { id: "0", target: "1" } : null;
    const tree = render({ editing: true });
    const cells = find(tree, "home-board-grid").props.children.filter(Boolean);
    for (const cell of cells) {
      const card = cell.props.children;
      const rendered = card.type(card.props);
      const arrows = find(rendered, `board-move-arrows-${card.props.project.id}`);
      assert.ok(arrows, "keep arrow space reserved to preserve drag measurements");
      assert.equal(flatten(arrows.props.style).opacity, dragging ? 0 : 1);
      assert.equal(arrows.props.pointerEvents, dragging ? "none" : "box-none");
      assert.equal(arrows.props.accessibilityElementsHidden, dragging);
    }
  }
  activeDrag = null;
});
