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
let platform = "web";
let activeDrag = null;
let boardPaneMeasurement = null;
const colors = new Proxy({}, { get: () => "#888888" });
const { BoardManagerContent } = await load("../src/components/board/board-manager-content.tsx", {
  react: { useRef: (value) => ({ current: value }), useState: (value) => value === null ? [boardPaneMeasurement, (next) => { boardPaneMeasurement = next; }] : [value, () => {}] },
  "react-native": { View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", Platform: { get OS() { return platform; }, select: (values) => values.default }, useWindowDimensions: () => ({ width }), StyleSheet: { create: (value) => value, hairlineWidth: 0.5 } },
  "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 20, left: 0, right: 0 }) },
  "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle" },
  "@expo/vector-icons": { Ionicons: "Icon" },
  "@/components/janus-board-ui": { IconButton: "IconButton" },
  "@/components/reference/mobile/reference-primitives": { ScreenHeader: "Header" },
  "@/components/ui/button": { Button: "Button" }, "@/components/ui/empty-state": { EmptyState: "EmptyState" },
  "@/components/ui/janus-logo": { JanusLogo: "JanusLogo" },
  "@/components/ui/mobile-top-bar": { MobileTopBarAction: "Action", MobileSearchField: "Search" },
  "@/components/ui/section-heading": { SectionHeading: "Heading" },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors } }) },
  "@/lib/data/manager-state": { getTaskMetrics: () => metrics, getBoardTaskMetrics: () => metrics },
  "@/theme/layout": { mobileContentStyle: { maxWidth: 600, width: "100%" }, mobileBottomNavClearance: 112 },
  "@/lib/features/home-layout": layoutModule,
  "./board-drag-cell": { BoardDragCell: "BoardDragCell" },
  "./bulk-selection-toolbar": { BulkSelectionToolbar: "BulkSelectionToolbar" },
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
    const container = find(tree, "home-content");
    const content = flatten(container.props.contentContainerStyle ?? container.props.style);
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

test("web reserves exactly two tracks in normal and rearrange modes without changing native or phone layouts", () => {
  try {
    for (platform of ["web", "ios", "android"]) {
      for (width of [390, 768, 1320, 2000]) {
        for (const editing of [false, true]) {
          const tree = render({ editing });
          for (const id of ["home-board-grid", "home-closed-board-grid"]) {
            const style = flatten(find(tree, id).props.style);
            const webGrid = platform === "web" && width >= 768;
            assert.equal(style.display, webGrid ? "grid" : undefined);
            assert.equal(style.gridTemplateColumns, webGrid ? "repeat(2, minmax(0, 1fr))" : undefined);
          }
        }
      }
    }
  } finally { platform = "web"; }
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

test("desktop stats keep their natural height inside the original aligned columns", () => {
  width = 1920;
  const tree = render({ projects: projects.slice(0, 1) });
  assert.equal(flatten(find(tree, "home-content").props.style).flex, 1);
  const dashboard = flatten(find(tree, "home-dashboard").props.style);
  assert.equal(dashboard.flex, 1);
  assert.equal(dashboard.alignItems, "stretch");
  const overview = nodes(tree).find((node) => node.type?.name === "WorkspaceOverview");
  assert.equal(overview.props.projects.length, 7, "search filtering must not change workspace statistics");
  const stats = overview.type(overview.props);
  assert.equal(flatten(stats.props.style).flexGrow, undefined);
  const surface = flatten(find(stats, "home-stats-surface").props.style);
  assert.equal(surface.flexGrow, undefined);
  assert.equal(surface.justifyContent, undefined);
  assert.equal(surface.gap, 28);
  assert.equal(surface.backgroundColor, undefined);
  assert.equal(surface.borderWidth, undefined);
  assert.ok(find(stats, "home-board-comparison"));
});

test("duplicating boards cannot stretch the stats surface or insert space above Board progress", () => {
  for (width of [1320, 1920]) for (const count of [2, 10, 100]) {
    const many = Array.from({ length: count }, (_, id) => ({ ...projects[0], id: String(id) }));
    const tree = render({ projects: many, statsProjects: many, totalBoards: count });
    const overview = nodes(tree).find((node) => node.type?.name === "WorkspaceOverview");
    const stats = overview.type(overview.props);
    const sectionStyle = flatten(stats.props.style);
    const surface = find(stats, "home-stats-surface");
    const surfaceStyle = flatten(surface.props.style);
    assert.equal(sectionStyle.flexGrow, undefined);
    assert.equal(surfaceStyle.flexGrow, undefined);
    assert.equal(surfaceStyle.justifyContent, undefined, "space-between would push progress to the bottom of the growing grid");
    assert.equal(surfaceStyle.gap, 28);
    assert.equal(surface.props.children[1].props.testID, "home-board-comparison", "progress follows the stats immediately");
    assert.equal(find(tree, "home-stats-panel").props.style.width, getHomeLayout(width).statsWidth);
    assert.equal(flatten(find(tree, "home-boards-scroll").props.style).flex, 1);
  }
});

test("desktop Home keeps equal-width panes while the board grid scrolls independently", () => {
  for (width of [390, 768, 1319, 1320, 1920]) {
    const tree = render();
    const page = find(tree, "home-content");
    const boards = find(tree, "home-boards-scroll");
    const stats = find(tree, "home-stats-panel");
    if (getHomeLayout(width).sidebar) {
      assert.equal(page.type, "View", "no shared desktop page scroll moves statistics with the board grid");
      assert.equal(flatten(page.props.style).flex, 1);
      assert.equal(flatten(page.props.style).minHeight, 0);
      assert.equal(boards.type, "ScrollView");
      assert.equal(stats.type, "ScrollView");
      assert.equal(flatten(boards.props.style).flex, 1);
      assert.equal(stats.props.style.width, getHomeLayout(width).statsWidth);
      assert.equal(stats.props.style.flexGrow, 0, "ScrollView's default growth must not make statistics consume extra width");
      assert.equal(stats.props.style.flexShrink, 0);
      assert.equal(flatten(find(tree, "home-dashboard").props.style).flex, 1);
    } else {
      assert.equal(page.type, "ScrollView");
      assert.equal(page.props.scrollEnabled, true);
      assert.equal(boards.type, "View");
      assert.equal(stats.type, "View");
    }
  }
});

test("Board progress uses the right pane's single scrollbar and keeps every row accessible", () => {
  for (width of [390, 1920]) for (const count of [0, 2, 4, 5, 100]) {
    const many = Array.from({ length: count }, (_, id) => ({ ...projects[0], id: String(id), name: `Board ${id}` }));
    const tree = render({ projects: many, statsProjects: many, totalBoards: count });
    const overview = nodes(tree).find((node) => node.type?.name === "WorkspaceOverview");
    const stats = overview.type(overview.props);
    const list = find(stats, "home-board-progress-list");
    assert.equal(list.type, "View");
    assert.equal(flatten(list.props.style).maxHeight, undefined, "progress expands inside the existing pane scroll");
    assert.equal(nodes(stats).filter((node) => node.type === "ScrollView").length, 0, "no nested scrollbars inside statistics");
    assert.equal(find(stats, "home-board-progress-scroll"), undefined);
    assert.equal(nodes(list).filter((node) => node.props?.testID?.startsWith("board-progress-")).length, count);
    assert.equal(nodes(stats).some((node) => Array.isArray(node.props?.children) && node.props.children.join("") === `Scroll to see all ${count} boards.`), false);
    if (!count) assert.ok(nodes(list).some((node) => node.props?.children === "Create a board to start tracking progress."));
  }
});

test("board-grid scrolling pauses while dragging without changing the statistics pane", () => {
  width = 1920;
  try {
    for (const dragging of [false, true, false]) {
      activeDrag = dragging ? { id: "0", target: "1" } : null;
      const tree = render({ editing: true });
      assert.equal(find(tree, "home-boards-scroll").props.scrollEnabled, !dragging);
      assert.equal(find(tree, "home-stats-panel").type, "ScrollView");
    }
  } finally { activeDrag = null; width = 390; }
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

test("board context menus preserve pointer coordinates and never open the board", () => {
  width = 1200;
  platform = "web";
  const calls = [];
  const tree = render({ onMenu: (project, event) => calls.push([project.id, event.nativeEvent.pageX, event.nativeEvent.pageY]), onOpen: () => assert.fail("right-click must not navigate") });
  const card = find(tree, "home-board-grid").props.children[0].props.children;
  const surface = card.type(card.props);
  let prevented = false, stopped = false;
  surface.props.onContextMenu({ nativeEvent: { pageX: 320, pageY: 180 }, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.deepEqual(calls, [["0", 320, 180]]);
  const blocked = card.type({ ...card.props, editing: true });
  blocked.props.onContextMenu({ nativeEvent: { pageX: 5, pageY: 6 }, preventDefault() {}, stopPropagation() {} });
  assert.equal(calls.length, 1, "rearranging must not open menus");
});

test("double-clicking names renames active and closed boards without navigating", () => {
  width = 1200;
  platform = "web";
  const renamed = [], opened = [];
  const tree = render({ onRename: (project) => renamed.push(project.id), onOpen: (id) => opened.push(id), onMenu() {} });
  const active = find(tree, "home-board-grid").props.children[0].props.children;
  const closed = find(tree, "home-closed-board-grid").props.children[0].props.children;
  const event = { nativeEvent: { detail: 1 }, stopPropagation() {} };
  for (const card of [active, closed]) {
    const surface = card.type(card.props);
    const name = find(surface, `board-name-${card.props.project.id}`);
    const before = renamed.length;
    name.props.onPress(event);
    assert.equal(renamed.length, before, "first click waits for a second name click");
    name.props.onPress(event);
    assert.equal(renamed.length, before + 1);
    assert.deepEqual(opened, []);
    // Context-menu activation must not leave half of a double-click behind.
    name.props.onPress(event);
    surface.props.onContextMenu({ nativeEvent: { pageX: 0, pageY: 0 }, preventDefault() {}, stopPropagation() {} });
    name.props.onPress(event);
    assert.equal(renamed.length, before + 1);
  }
});

test("tablet names support double-tap while phone name taps still open boards", () => {
  try {
    platform = "ios";
    for (width of [390, 1024]) {
      let renamed = 0, opened = 0, menus = 0;
      const tree = render({ onRename: () => renamed++, onOpen: () => opened++, onMenu: () => menus++ });
      const cell = find(tree, "home-board-grid").props.children[0];
      const card = cell.props.children;
      const surface = card.type(card.props);
      assert.equal(surface.props.onContextMenu, undefined, "DOM events must not reach native views");
      const name = find(surface, "board-name-0");
      const event = { nativeEvent: {}, stopPropagation() {} };
      name.props.onPress(event);
      name.props.onPress(event);
      assert.equal(renamed, width >= 768 ? 1 : 0);
      assert.equal(opened, width >= 768 ? 0 : 2);
      name.props.onLongPress(event);
      assert.equal(menus, 1);
    }
  } finally { platform = "web"; width = 390; }
});

test("keyboard can rename directly, and unavailable cards cannot rename", () => {
  width = 1200;
  platform = "web";
  let renamed = 0;
  const tree = render({ onRename: () => renamed++ });
  const card = find(tree, "home-board-grid").props.children[0].props.children;
  const event = { nativeEvent: { detail: 0 }, stopPropagation() {} };
  find(card.type(card.props), "board-name-0").props.onPress(event);
  assert.equal(renamed, 1);
  for (const blocked of [{ editing: true }, { ready: false }]) {
    const name = find(card.type({ ...card.props, ...blocked }), "board-name-0");
    assert.equal(name.props.disabled, true);
    name.props.onPress(event);
    assert.equal(renamed, 1);
  }
});

test("Home selection checkboxes toggle active and closed boards without opening or renaming them", () => {
  try {
    for (platform of ["web", "ios", "android"]) for (width of [390, 1200]) {
      const toggled = [];
      let opened = 0, renamed = 0, menus = 0;
      const tree = render({ selecting: true, selectedIds: new Set(["0"]), onToggleSelection: (id) => toggled.push(id), onOpen: () => opened++, onRename: () => renamed++, onMenu: () => menus++ });
      for (const grid of ["home-board-grid", "home-closed-board-grid"]) {
        const card = find(tree, grid).props.children[0].props.children;
        const surface = card.type(card.props);
        const checkbox = nodes(surface).find((node) => node.props?.accessibilityRole === "checkbox");
        assert.equal(checkbox.props.accessibilityState.checked, true);
        assert.equal(flatten(checkbox.props.style).width, 44);
        checkbox.props.onPress();
        nodes(surface).find((node) => node.type === "Pressable" && !node.props.testID).props.onPress();
        const name = find(surface, "board-name-0");
        name.props.onPress({ stopPropagation() {}, nativeEvent: {} });
        name.props.onLongPress({ nativeEvent: {} });
        surface.props.onContextMenu?.({ preventDefault() {}, stopPropagation() {} });
        assert.equal(nodes(surface).some((node) => node.props?.label === "Remove"), false);
      }
      assert.equal(toggled.length, 8);
      assert.equal(opened + renamed + menus, 0);
      assert.equal(find(tree, "home-add-board-card"), undefined);
    }
  } finally { platform = "web"; width = 390; }
});

test("selection uses the shared ribbon toolbar and keeps rearrange separate", () => {
  let selecting = false;
  const tree = render({ onSelecting: (active) => { selecting = active; } });
  const heading = nodes(tree).find((node) => node.type === "Heading" && node.props.title === "Your boards");
  nodes(heading.props.right).find((node) => node.props?.label === "Select").props.onPress();
  assert.equal(selecting, true);
  for (const count of [0, 2]) {
    const selected = render({ selecting: true, selectedIds: new Set(projects.slice(0, count).map((project) => project.id)), onSelecting() {} });
    const toolbar = find(selected, "home-board-selection");
    const ribbon = nodes(toolbar).find((node) => node.type === "BulkSelectionToolbar");
    assert.equal(ribbon.props.entity, "board");
    assert.equal(ribbon.props.selectedCount, count);
    assert.equal(ribbon.props.disabled, false);
    const heading = nodes(selected).find((node) => node.type === "Heading" && node.props.title === "Your boards");
    const arrange = nodes(heading.props.right).find((node) => node.props?.label === "Rearrange");
    assert.ok(arrange);
    assert.equal(arrange.props.disabled, true);
  }
});

test("Home hides card checkboxes outside Select mode and places an icon before the Select label", () => {
  try {
    for (width of [390, 1200]) {
      for (const selecting of [false, true]) {
        const tree = render({ selecting, onSelecting() {}, onToggleSelection() {} });
        for (const grid of ["home-board-grid", "home-closed-board-grid"]) {
          const card = find(tree, grid).props.children[0].props.children;
          const surface = card.type(card.props);
          assert.equal(nodes(surface).some((node) => node.props?.accessibilityRole === "checkbox"), selecting);
        }
        const heading = nodes(tree).find((node) => node.type === "Heading" && node.props.title === "Your boards");
        const button = nodes(heading.props.right).find((node) => node.props?.accessibilityLabel === (selecting ? "Finish selecting boards" : "Select boards"));
        assert.equal(button.props.children[0].type, "Icon");
        assert.equal(button.props.children[0].props.name, selecting ? "checkmark" : "checkbox-outline");
        assert.equal(button.props.children[1].props.children, selecting ? "Done" : "Select");
        assert.equal(flatten(button.props.style).width, 88);
        assert.equal(heading.props.right.props.children[0], button);
        const arrange = heading.props.right.props.children[1];
        assert.equal(arrange.props.label, "Rearrange");
        assert.equal(arrange.props.disabled, selecting);
      }
    }
  } finally { width = 390; }
});

test("Select stays visible but disabled during Rearrange", () => {
  const tree = render({ editing: true, onSelecting() {} });
  const heading = nodes(tree).find((node) => node.type === "Heading" && node.props.title === "Your boards");
  const select = nodes(heading.props.right).find((node) => node.props?.accessibilityLabel === "Select boards");
  assert.equal(select.props.disabled, true);
  assert.equal(flatten(select.props.style).width, 88);
});
