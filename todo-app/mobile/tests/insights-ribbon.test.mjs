import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/janus-board-ui.tsx", import.meta.url), "utf8");
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const filtersLib = {};
const labelsLib = {};
vm.runInNewContext(compile(await readFile(new URL("../src/lib/utils/ribbon-label.ts", import.meta.url), "utf8")), { exports: labelsLib });
vm.runInNewContext(compile(await readFile(new URL("../src/lib/features/insights-filters.ts", import.meta.url), "utf8")), { exports: filtersLib, require });
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}

test("ribbon labels cap display characters without changing short values or splitting emoji", () => {
  assert.equal(labelsLib.ribbonLabel("All boards"), "All boards");
  assert.equal(labelsLib.ribbonLabel("1234567890123456"), "1234567890123456");
  assert.equal(labelsLib.ribbonLabel("12345678901234567"), "1234567890123...");
  assert.equal(labelsLib.ribbonLabel("😀".repeat(17)), `${"😀".repeat(13)}...`);
});
function setup(platform = "web", width = 1024) {
  const slots = [];
  let cursor = 0;
  const props = { filters: { ...filtersLib.DEFAULT_FILTERS }, now: new Date(2026, 9, 29), boards: [{ id: "work", label: "Work" }], onChange: (next) => { props.filters = next; } };
  const fallback = new Proxy({}, { get: (_, key) => key });
  const mocks = {
    react: { ...require("react"), useEffect: (effect) => { effect(); }, useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (next) => { slots[index] = next; }]; } },
    "react-native": { ...fallback, Platform: { OS: platform }, View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (value) => value }, useWindowDimensions: () => ({ width }) },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
    "@/lib/features/insights-filters": filtersLib,
    "@/lib/utils/ribbon-label": labelsLib,
    "@/components/ui/anchored-menu": { anchorFromEvent: () => ({ x: 0, y: 0, width: 40, height: 40 }) },
    "@react-native-community/datetimepicker": { __esModule: true, default: "DateTimePicker" },
  };
  const exports = {};
  vm.runInNewContext(compile(source), { exports, require: (id) => mocks[id] ?? (["react/jsx-runtime", "date-fns"].includes(id) ? require(id) : fallback) });
  const render = () => { cursor = 0; return exports.InsightsFiltersRibbon(props); };
  const button = (label) => nodes(render()).find((node) => node.props?.accessibilityLabel === label);
  const choose = (field, current, next) => {
    button(`Insights ${field}: ${current}`).props.onPress({});
    nodes(render()).find((node) => node.props?.options)?.props.options.find((item) => item.label === next).onPress();
  };
  return { props, render, button, choose };
}

test("Insights ribbon reuses the scroll lane and filters remain controlled across remounts", () => {
  const app = setup();
  assert.ok(app.button("Insights filters"));
  app.choose("period", "7 days", "30 days");
  app.choose("status", "All status", "Completed");
  app.choose("priority", "All priority", "Critical");
  app.choose("board", "All boards", "Work");
  assert.equal(app.props.filters.dateRange, "30d");
  assert.equal(app.props.filters.status, "completed");
  assert.equal(app.props.filters.priority, "critical");
  assert.equal(app.props.filters.boardId, "work");
  const remounted = setup();
  remounted.props.filters = app.props.filters;
  assert.ok(remounted.button("Insights status: Completed"));
  remounted.button("Reset insights filters").props.onPress();
  assert.deepEqual({ ...remounted.props.filters }, { ...filtersLib.DEFAULT_FILTERS });
});

test("custom range uses accessible web inputs and keeps start/end ordered", () => {
  const app = setup();
  app.choose("period", "7 days", "Custom");
  const input = () => nodes(app.render()).find((node) => node.type === "input");
  assert.equal(input().props["aria-label"], "Insights start date");
  input().props.onChange({ target: { value: "2026-10-20" } });
  assert.equal(app.props.filters.customStart.getDate(), 20);
  app.button("Insights end date").props.onPress();
  input().props.onChange({ target: { value: "2026-10-10" } });
  assert.equal(app.props.filters.customStart.getDate(), 10);
  assert.equal(app.props.filters.customEnd.getDate(), 10);
});

test("native custom ranges keep the native date picker", () => {
  const app = setup("android");
  app.choose("period", "7 days", "Custom");
  const picker = nodes(app.render()).find((node) => node.type === "DateTimePicker");
  assert.equal(picker.props.mode, "date");
  picker.props.onChange({}, new Date(2026, 9, 10));
  assert.equal(app.props.filters.customStart.getDate(), 10);
});

test("Insights source parses in Babel and no longer contains the inline filter card", () => {
  require("@babel/parser").parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] });
  assert.equal(source.includes("Focus your period"), false);
});

test("Insights board filter stays small with long names, without losing its full label", () => {
  const flatten = (style) => Object.assign({}, ...style.filter(Boolean));
  for (const [platform, width, height] of [["web", 1024, 36], ["web", 390, 44], ["android", 1024, 44]]) {
    const app = setup(platform, width);
    const label = "An unusually long board name that must not widen the ribbon";
    app.props.boards = [{ id: "long", label }];
    app.props.filters.boardId = "long";
    const board = app.button(`Insights board: ${label}`);
    assert.equal(flatten(board.props.style).width, 132);
    assert.equal(flatten(board.props.style).minHeight, height);
    const text = nodes(board).find((node) => node.type === "Text");
    assert.equal(text.props.numberOfLines, 1);
    assert.equal(text.props.ellipsizeMode, "tail");
    assert.equal(text.props.children, "An unusually ...");
    board.props.onPress({});
    assert.ok(nodes(app.render()).find((node) => node.props?.options)?.props.options.some((option) => option.label === label));
  }
});

test("Insights filter lanes keep the standard ribbon row height and padding", () => {
  for (const [platform, width] of [["web", 1024], ["web", 390], ["android", 1024]]) {
    const app = setup(platform, width);
    const lane = app.button("Insights filters");
    assert.equal(lane.props.contentContainerStyle.paddingTop, 5);
    assert.equal(lane.props.contentContainerStyle.paddingBottom, 4);
    const groups = nodes(lane).filter((node) => node.props?.style?.[0]?.gap === 3);
    assert.equal(groups.length, 4);
    for (const group of groups) {
      assert.equal(group.props.children[0].props.style.minHeight, 48);
    }
    app.choose("period", "7 days", "Custom");
    const dateRow = nodes(app.render()).find((node) => Array.isArray(node.props?.children) && node.props.children.some((child) => child?.props?.accessibilityLabel === "Insights start date"));
    assert.equal(dateRow.props.style[0].minHeight, 48);
  }
});
