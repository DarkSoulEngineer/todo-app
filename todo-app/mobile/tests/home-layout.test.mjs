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
const colors = new Proxy({}, { get: () => "#888888" });
const { BoardManagerContent } = await load("../src/components/board/board-manager-content.tsx", {
  react: { useState: (value) => [value, () => {}] },
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
  return BoardManagerContent({ projects, closedProjects: projects.slice(0, 2), totalBoards: 7, metrics, pinnedIds: new Set(), ready: true, loading: false, editing: false, now: 0, ...overrides });
}

test("responsive grid fills available width without overflowing cards or safe areas", () => {
  for (const viewport of [320, 390, 767, 768, 1024, 1440, 1920, 2560]) {
    for (const inset of [0, 44]) {
      const layout = getHomeLayout(viewport, inset, inset);
      assert.equal(layout.wide, viewport - inset * 2 >= 768);
      assert.ok(layout.cardWidth > 0);
      const occupied = layout.columns * layout.cardWidth + (layout.columns - 1) * 16 + layout.padding * 2 + inset * 2 + (layout.sidebar ? layout.statsWidth + 24 : 0);
      assert.ok(Math.abs(occupied - viewport) < 0.01);
      if (layout.wide) assert.ok(layout.cardWidth >= 340);
      else assert.equal(layout.columns, 1);
      assert.ok(layout.columns <= 3, "large screens must wrap boards rather than becoming one long row");
      assert.equal(layout.sidebar, viewport - inset * 2 >= 1200);
    }
  }
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
      for (const cell of grid.props.children) assert.equal(cell.props.style?.width, layout.wide ? layout.cardWidth : undefined);
    }
    const overview = nodes(tree).find((node) => node.type?.name === "WorkspaceOverview");
    const stats = overview.type(overview.props);
    assert.equal(flatten(find(stats, "home-stats-layout").props.style).flexDirection, layout.wide && !layout.sidebar ? "row" : undefined);
    assert.equal(flatten(find(tree, "home-dashboard").props.style).flexDirection, layout.sidebar ? "row" : undefined);
    assert.equal(find(tree, "home-stats-panel").props.style?.width, layout.sidebar ? layout.statsWidth : undefined);
    const donut = nodes(stats).find((node) => node.props?.accessible && node.props.accessibilityLabel?.includes("26 tasks"));
    if (layout.wide) assert.equal(flatten(donut.props.style).width, layout.sidebar ? 240 : 200);
    const shares = nodes(stats).filter((node) => node.props?.accessibilityRole === "progressbar");
    assert.equal(shares.length, 4);
    assert.equal(shares[2].props.accessibilityValue.text, "6 tasks, 23%");
  }
});

test("grid keeps ordering and board actions intact", () => {
  width = 1440;
  const calls = [];
  const tree = render({ onOpen: (id) => calls.push(["open", id]), onMove: (id, direction) => calls.push(["move", id, direction]) });
  const cards = find(tree, "home-board-grid").props.children.map((cell) => cell.props.children);
  assert.deepEqual(Array.from(cards, (card) => card.props.project.id), projects.map((project) => project.id));
  cards[0].props.onOpen();
  cards[1].props.onMove(-1);
  assert.deepEqual(calls, [["open", "0"], ["move", "1", -1]]);
  assert.equal(cards[0].props.first, true);
  assert.equal(cards.at(-1).props.last, true);
});
