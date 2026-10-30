import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const dashboardPath = "@/components/insights/insights-dashboard";
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const field = (tree, id) => nodes(tree).find((node) => node.props?.testID === id);
const flatten = (styles) => Object.assign({}, ...[styles].flat().filter(Boolean));

function setup(width, empty = false) {
  const slots = [], cache = new Map();
  let cursor = 0, nextId = 0;
  let colors = Object.fromEntries(["primary", "info", "success", "warning", "destructive", "foreground", "mutedForeground", "card", "border", "secondary", "backgroundAlt", "primarySoft", "successSoft", "destructiveSoft"].map((key, index) => [key, `rgb(${index + 1}, 10, 20)`]));
  const react = { Children: require("react").Children, useMemo: (fn) => fn(), useId: () => `chart-${nextId++}`, useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (next) => { slots[index] = next; }]; } };
  const host = new Proxy({}, { get: (_, key) => key });
  const mocks = {
    react,
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { hairlineWidth: 0.5, create: (styles) => styles }, useWindowDimensions: () => ({ width }) },
    "react-native-svg": host,
    "@expo/vector-icons": { Ionicons: "Icon" },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors, fontFamily: "PresetFont" } }) },
    "@/lib/data/transfer": { exportWorkspaceCsv() {} },
    "@/components/ui/card": { Card: "Card" },
    "@/components/ui/button": { Button: "Button" },
  };
  function load(id, parent = "") {
    if (mocks[id]) return mocks[id];
    if (id.startsWith(".")) id = `${parent.slice(0, parent.lastIndexOf("/"))}/${id.slice(2)}`;
    if (!id.startsWith("@/")) return require(id);
    if (!cache.has(id)) {
      const exports = {};
      cache.set(id, exports);
      const suffix = id.startsWith("@/components/") ? "tsx" : "ts";
      const source = readFileSync(new URL(`../src/${id.slice(2)}.${suffix}`, import.meta.url), "utf8");
      vm.runInNewContext(compile(source), { exports, require: (next) => load(next, id) });
    }
    return cache.get(id);
  }
  const { InsightsDashboard } = load(dashboardPath);
  const exported = [];
  const task = { id: "a", title: "Finished task", description: "", priority: "high", completed: true, canceled: false, category: "work", dueAt: null, createdAt: "2026-10-28T10:00:00Z", completedAt: "2026-10-28T11:00:00Z", updatedAt: "2026-10-28T11:00:00Z", subtasks: [] };
  const props = { tasks: empty ? [] : [task], boards: [{ id: "work", label: "Work" }], now: new Date("2026-10-29T12:00:00Z"), onExport: (tasks) => exported.push(tasks) };
  function expand(node) {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(expand);
    if (typeof node.type === "function") return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  }
  const raw = () => { cursor = nextId = 0; return InsightsDashboard(props); };
  return { render: () => expand(raw()), raw, props, exported, load, get colors() { return colors; }, setColors(next) { colors = next; } };
}

test("diagram dashboard uses a reference-style grid on desktop and stacks on mobile", () => {
  for (const width of [320, 390, 699, 700, 1024, 1100, 1920]) {
    const tree = setup(width).render();
    assert.equal(flatten(field(tree, "insights-top-row").props.style).flexDirection, width >= 1100 ? "row" : undefined);
    assert.equal(flatten(field(tree, "insights-bottom-row").props.style).flexDirection, width >= 700 ? "row" : undefined);
    assert.equal(flatten(field(tree, "insights-dashboard").props.style).maxWidth, 1500);
    for (const id of ["insights-sparkline", "insights-health-rings", "insights-area-diagram", "insights-radial-diagram", "insights-weekday-diagram", "insights-priority-donut"]) assert.ok(field(tree, id), `${id} at ${width}px`);
    assert.equal(field(tree, "insights-stats-grid"), undefined, "the old metric-grid design is replaced");
  }
});

test("resizing preserves actual chart totals and a single working export", () => {
  for (const width of [390, 768, 1920]) {
    const app = setup(width), raw = app.raw();
    const charts = nodes(raw).filter((node) => node.type?.name === "AreaDiagram");
    assert.equal(charts.length, 2);
    for (const chart of charts) assert.equal(chart.props.points.reduce((sum, point) => sum + point.count, 0), 1);
    const tree = app.render();
    const buttons = nodes(tree).filter((node) => node.props?.accessibilityLabel === "Export filtered tasks as CSV");
    assert.equal(buttons.length, 1);
    buttons[0].props.onPress();
    assert.equal(app.exported[0].length, 1);
  }
});

test("filter counts appear only for active filters and disappear again when cleared", () => {
  const app = setup(1200);
  const defaults = app.load("@/lib/features/insights-filters").DEFAULT_FILTERS;
  assert.equal(field(app.render(), "insights-filter-count"), undefined);
  for (const filter of [{ status: "completed" }, { boardId: "work" }, { priority: "high" }, { dateRange: "30d" }]) {
    app.props.filters = { ...defaults, ...filter };
    assert.ok(field(app.render(), "insights-filter-count"));
  }
  app.props.filters = { ...defaults };
  assert.equal(field(app.render(), "insights-filter-count"), undefined);
});

test("desktop overview balances card heights and expands the weekly chart, without restoring the comparison block", () => {
  const app = setup(1200);
  let tree = app.render();
  assert.equal(flatten(field(tree, "insights-bottom-row").props.style).alignItems, "stretch");
  assert.equal(flatten(field(tree, "insights-weekly").props.style).flexGrow, 1);
  const chart = nodes(field(tree, "insights-weekday-diagram")).find((node) => node.type === "Svg");
  assert.equal(chart.props.height, 270);
  assert.ok(!nodes(tree).some((node) => node.props?.children === "Current / previous period"));
  app.props.filters = { ...app.load("@/lib/features/insights-filters").DEFAULT_FILTERS, boardId: "work" };
  tree = app.render();
  assert.equal(flatten(field(tree, "insights-bottom-row").props.style).alignItems, "flex-start", "filtered modules remain content-sized");
});

test("empty data renders one compact empty state instead of blank charts, with disabled export", () => {
  const tree = setup(1200, true).render();
  assert.ok(field(tree, "insights-empty-results"));
  const watermark = field(tree, "insights-empty-watermark");
  assert.ok(watermark);
  assert.equal(watermark.props.pointerEvents, "none");
  assert.equal(flatten(watermark.props.style).opacity, 0.08);
  assert.equal(field(tree, "insights-empty-results").type, "View", "no empty banner card");
  assert.ok(nodes(watermark).some((node) => node.props?.accessibilityLabel === "Janus logo"));
  for (const id of ["insights-top-row", "insights-bottom-row", "insights-area-diagram", "insights-weekday-diagram"]) assert.equal(field(tree, id), undefined);
  assert.equal(nodes(tree).find((node) => node.props?.accessibilityLabel === "Export filtered tasks as CSV").props.disabled, true);
  for (const node of nodes(tree)) {
    if (node.props?.d) assert.doesNotMatch(node.props.d, /NaN|Infinity/);
    if (typeof node.props?.height === "number") assert.ok(node.props.height >= 0);
  }
});

test("modular grids pack only visible cards and omit empty rows", () => {
  const app = setup(1200);
  const { InsightsModuleGrid } = app.load("@/components/insights/insights-module-grid");
  const jsx = require("react/jsx-runtime").jsx;
  for (const columns of [1, 2, 3]) for (const count of [0, 1, 2, 3]) {
    const children = Array.from({ length: 3 }, (_, index) => index < count ? jsx("Card", {}, `card-${index}`) : null);
    const tree = InsightsModuleGrid({ columns, children });
    if (!count) { assert.equal(tree, null); continue; }
    assert.equal(tree.props.children.length, count);
    assert.equal(flatten(tree.props.style).alignItems, columns > 1 ? "flex-start" : undefined);
    for (const item of tree.props.children) {
      if (columns > 1) {
        assert.equal(item.props.style.flexGrow, 1);
        assert.equal(item.props.style.flexBasis, `${90 / Math.min(columns, count)}%`);
      }
    }
  }
});

test("all filter combinations retain useful content, including fully scoped and empty selections", () => {
  for (const width of [390, 768, 1200]) {
    const app = setup(width);
    const defaults = app.load("@/lib/features/insights-filters").DEFAULT_FILTERS;
    app.props.tasks.push({ ...app.props.tasks[0], id: "canceled", completed: false, completedAt: null, canceled: true });
    for (const status of ["all", "completed", "canceled", "overdue"]) for (const boardId of ["all", "work", "missing"]) for (const priority of ["all", "high", "low"]) {
      app.props.filters = { ...defaults, status, boardId, priority };
      const tree = app.render();
      const empty = status === "overdue" || boardId === "missing" || priority === "low";
      assert.equal(Boolean(field(tree, "insights-empty-results")), empty);
      if (empty) {
        assert.equal(field(tree, "insights-bottom-row"), undefined);
      } else {
        assert.ok(field(tree, status === "canceled" ? "insights-filtered-summary" : "insights-performance"));
      }
    }
  }
});

test("matching tasks without completions use compact messages, but previous-period data stays visible", () => {
  const app = setup(1200);
  app.props.tasks[0] = { ...app.props.tasks[0], completed: false, completedAt: null };
  let tree = app.render();
  assert.ok(field(tree, "insights-performance"));
  assert.equal(field(tree, "insights-area-diagram"), undefined);
  assert.equal(field(tree, "insights-sparkline"), undefined);
  assert.equal(field(tree, "insights-weekday-diagram"), undefined);
  assert.ok(nodes(tree).some((node) => node.props?.children === "A fresh start for this period"));
  app.props.tasks.push({ ...app.props.tasks[0], id: "previous", completed: true, completedAt: "2026-10-20T11:00:00Z" });
  tree = app.render();
  assert.ok(field(tree, "insights-area-diagram"));
  assert.ok(field(tree, "insights-sparkline"));
});

test("date controls select real chart details, dismiss them, and clear stale selections after a period change", () => {
  const app = setup(1200);
  let tree = app.render();
  const date = nodes(tree).find((node) => node.type === "Pressable" && node.props.accessibilityLabel?.includes("completed, "));
  date.props.onPress();
  tree = app.render();
  assert.ok(field(tree, "insights-trend-detail"));
  field(tree, "insights-trend-detail").props.onPress();
  assert.equal(field(app.render(), "insights-trend-detail"), undefined);
  date.props.onPress();
  app.props.filters = { ...app.load("@/lib/features/insights-filters").DEFAULT_FILTERS, dateRange: "30d" };
  assert.equal(field(app.render(), "insights-trend-detail"), undefined);
});

test("every diagram recolors from the active preset rather than copying reference colors", () => {
  const app = setup(1200);
  for (const shift of [30, 70]) {
    const colors = Object.fromEntries(Object.keys(app.colors).map((key, index) => [key, `rgb(${shift + index}, 20, 30)`]));
    app.setColors(colors);
    const tree = app.render();
    const diagramNodes = nodes(tree);
    assert.ok(diagramNodes.some((node) => node.props?.stopColor === colors.primary));
    assert.ok(diagramNodes.some((node) => node.props?.stopColor === colors.info));
    assert.ok(diagramNodes.some((node) => node.props?.stroke === colors.primary));
    assert.ok(diagramNodes.some((node) => node.type === "Svg" && node.props.fontFamily === "PresetFont"));
    for (const node of diagramNodes) for (const key of ["fill", "stroke", "stopColor"]) {
      const value = node.props?.[key];
      if (value && value !== "none" && !value.startsWith("url(")) assert.ok(Object.values(colors).includes(value), `${key} ${value} follows the preset`);
    }
  }
});

test("category bars account for uncategorized tasks and all categories", () => {
  const app = setup(1200);
  app.props.tasks.push({ ...app.props.tasks[0], id: "b", category: null });
  const items = nodes(app.render()).filter((node) => node.props?.testID === "insights-category-item");
  assert.equal(items.length, 2);
  assert.ok(nodes(items).some((node) => node.props?.children === "Uncategorized"));
  assert.ok(nodes(items).some((node) => Array.isArray(node.props?.children) && node.props.children.join("").includes("50%")));
});

test("board filters apply to every diagram and exported data, including comparisons", () => {
  const app = setup(1200);
  app.props.tasks.push({ ...app.props.tasks[0], id: "hidden", category: "home" });
  app.props.filters = { ...app.load("@/lib/features/insights-filters").DEFAULT_FILTERS, boardId: "work" };
  const charts = nodes(app.raw()).filter((node) => node.type?.name === "AreaDiagram");
  assert.equal(charts[0].props.points.reduce((sum, point) => sum + point.count, 0), 1);
  nodes(app.render()).find((node) => node.props?.accessibilityLabel === "Export filtered tasks as CSV").props.onPress();
  assert.equal(app.exported[0].length, 1);
  assert.equal(app.exported[0][0].category, "work");
});

test("status filters hide irrelevant charts and restore them when cleared on mobile and desktop", () => {
  for (const width of [390, 1200]) {
    const app = setup(width);
    const defaults = app.load("@/lib/features/insights-filters").DEFAULT_FILTERS;
    const completed = app.props.tasks[0];
    app.props.tasks.push({ ...completed, id: "canceled", completed: false, completedAt: null, canceled: true });
    app.props.tasks.push({ ...completed, id: "overdue", completed: false, completedAt: null, dueAt: "2026-10-20T10:00:00Z" });
    for (const status of ["canceled", "overdue", "completed", "all"]) {
      app.props.filters = { ...defaults, status };
      const tree = app.render();
      for (const id of ["insights-completed-card", "insights-performance", "insights-weekly"]) {
        assert.equal(Boolean(field(tree, id)), status === "all" || status === "completed", `${id} for ${status}`);
      }
      for (const id of ["insights-health-rings", "insights-balance"]) {
        assert.equal(Boolean(field(tree, id)), status === "all", `${id} for ${status}`);
      }
      assert.ok(field(tree, "insights-distribution"));
      nodes(tree).find((node) => node.props?.accessibilityLabel === "Export filtered tasks as CSV").props.onPress();
      assert.equal(app.exported.at(-1).length, status === "all" ? 3 : 1);
    }
  }
});

test("fixed category and priority filters hide only their own breakdowns", () => {
  for (const width of [390, 1200]) {
    const app = setup(width);
    const defaults = app.load("@/lib/features/insights-filters").DEFAULT_FILTERS;
    for (const boardId of ["all", "work"]) for (const priority of ["all", "high"]) {
      app.props.filters = { ...defaults, boardId, priority };
      const tree = app.render();
      assert.equal(Boolean(field(tree, "insights-category-bars")), boardId === "all");
      assert.equal(Boolean(field(tree, "insights-priority-donut")), priority === "all");
      assert.equal(Boolean(field(tree, "insights-distribution")), boardId === "all" || priority === "all");
      assert.ok(field(tree, "insights-performance"));
    }
  }
});

test("ring charts rotate with SVG transforms, not deprecated origin DOM attributes", () => {
  const app = setup(1200);
  const { ProgressRing, RadialDiagram, DonutDiagram } = app.load("@/components/insights/insights-charts");
  const slices = [{ label: "High", value: 1, color: app.colors.primary }];
  for (const [tree, expected] of [
    [ProgressRing({ value: 1, total: 2, color: app.colors.primary, label: "Completed" }), "rotate(-90 38 38)"],
    [RadialDiagram({ slices, total: 2 }), "rotate(-90 120 120)"],
    [DonutDiagram({ slices, total: 2 }), "rotate(-90 64 64)"],
  ]) {
    const arcs = nodes(tree).filter((node) => node.type === "Circle" && node.props?.strokeDasharray);
    assert.equal(arcs.length, 1);
    assert.equal(arcs[0].props.transform, expected);
    for (const node of nodes(tree)) {
      assert.equal(node.props?.origin, undefined);
      assert.equal(node.props?.rotation, undefined);
      assert.equal(node.props?.["transform-origin"], undefined);
    }
  }
});

test("geometry preserves whole-period totals and keeps smoothing within chart bounds", () => {
  const app = setup(1200);
  const { bucketChartPoints, chartCoordinates, smoothChartPath, ringFraction } = app.load("@/lib/features/insights-chart-geometry");
  const points = Array.from({ length: 30 }, (_, index) => ({ key: `2026-10-${String(index + 1).padStart(2, "0")}`, label: "day", count: index % 5 }));
  const buckets = bucketChartPoints(points, 6);
  assert.equal(buckets.length, 6);
  assert.equal(buckets.reduce((sum, point) => sum + point.count, 0), points.reduce((sum, point) => sum + point.count, 0));
  const coords = chartCoordinates([0, 8, 0, 1], 600, 200, 8);
  assert.ok(coords.every((point) => point.x >= 0 && point.x <= 600 && point.y >= 0 && point.y <= 200));
  assert.match(smoothChartPath(coords), / C /);
  assert.equal(smoothChartPath([]), "");
  assert.equal(ringFraction(0, 0), 0);
  assert.equal(ringFraction(2, 1), 1);
});
