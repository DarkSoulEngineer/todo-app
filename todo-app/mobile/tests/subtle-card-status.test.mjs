import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { exports, require: (id) => id === "react/jsx-runtime" || id === "date-fns" ? require(id) : mocks[id] });
  return exports;
}
const status = await load("../src/lib/domain/status.ts");
const themes = await load("../src/lib/features/card-themes.ts");
const constants = await load("../src/lib/domain/constants.ts");
const colors = { card: "#303030", border: "#444444", primary: "#aabb22", primarySoft: "#aabb2222" };
let expanded = false;
let activeEvents = [];
const { MobileColumnTaskCard } = await load("../src/components/board/mobile-column-task-card.tsx", {
  react: { useState: () => [expanded, (value) => { expanded = value; }], useRef: (current) => ({ current }) },
  "react-native": { Platform: { OS: "web" }, Pressable: "Pressable", View: "View", Text: "Text", StyleSheet: { create: (value) => value } },
  "@expo/vector-icons": { Ionicons: "Icon" },
  "@/lib/domain/status": status,
  "@/lib/domain/constants": constants,
  "@/lib/domain/boards": {},
  "./mobile-board-colors": { useMobileBoardColors: () => colors },
  "@/components/ui/priority-stars": { PriorityStars: "PriorityStars" },
  "@/components/ui/status-icon": { StatusIcon: "StatusIcon" },
  "@/components/ui/checklist-completion-medal": { ChecklistCompletionMedal: "ChecklistCompletionMedal" },
  "@/hooks/use-active-events": { useActiveEvents: () => ({ events: activeEvents, override: null }) },
  "@/lib/features/card-themes": themes,
  "@/components/ui/seasonal-card-decoration": { SeasonalCardDecoration: "SeasonalCardDecoration" },
  "@/components/ui/custom-checklist-decoration": { CustomChecklistDecoration: "CustomChecklistDecoration" },
});
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const now = new Date("2026-10-31T12:00:00Z");
const base = { id: "card", title: "Task", priority: "medium", tags: [], subtasks: [], dueAt: null, completed: false, canceled: false };
const render = (changes, props = {}) => MobileColumnTaskCard({ task: { ...base, ...changes }, now, selected: false, selectionMode: false, onPress() {}, onMenu() {}, ...props });

test("status cards use one small icon, neutral surfaces, and no status scene or label", () => {
  for (const compact of [false, true]) {
    for (const [changes, expected] of [[{ completed: true, tags: ["Done"] }, "completed"], [{ canceled: true }, "canceled"], [{ dueAt: "2026-10-30T12:00:00Z" }, "overdue"]]) {
      const tree = render(changes, { compact, zoom: 1.5 });
      const all = nodes(tree);
      const icons = all.filter((node) => node.type === "StatusIcon");
      assert.equal(icons.length, 1);
      assert.equal(icons[0].props.status, expected);
      assert.equal(icons[0].props.zoom, 1.5);
      assert.equal(all.some((node) => node.type === "SeasonalCardDecoration"), false);
      assert.equal(all.some((node) => node.type === "Text" && node.props.children === "Overdue"), false);
      const style = Object.assign({}, ...tree.props.style.filter(Boolean));
      assert.equal(style.backgroundColor, colors.card);
      assert.equal(style.borderColor, colors.border);
      assert.equal(style.borderLeftColor, colors.border);
      assert.ok(all.some((node) => node.props?.accessibilityLabel === "Actions for Task"));
    }
  }
});

test("the completion medal replaces Done only for a done task with a nonempty fully checked checklist", () => {
  for (const compact of [false, true]) {
    for (const [changes, expected] of [
      [{ completed: true, subtasks: [{ id: "one", done: true }, { id: "two", done: true }] }, 1],
      [{ completed: true, subtasks: [{ id: "one", done: true }, { id: "two", done: false }] }, 0],
      [{ completed: false, subtasks: [{ id: "one", done: true }] }, 0],
      [{ canceled: true, subtasks: [{ id: "one", done: true }] }, 0],
      [{ completed: true, subtasks: [] }, 0],
    ]) {
      const tree = render(changes, { compact, zoom: 1.5 });
      const medals = nodes(tree).filter((node) => node.type === "ChecklistCompletionMedal");
      assert.equal(medals.length, expected);
      if (expected) {
        assert.equal(medals[0].props.zoom, 1.5);
        assert.equal(nodes(tree).some((node) => node.type === "StatusIcon"), false, "the medal replaces the ordinary Done check");
      }
    }
  }
});

test("the smaller medal uses the theme accent, scales with zoom, and has an accessible explanation", async () => {
  for (const [scheme, color] of [["light", "#6D28D9"], ["dark", "#E8BD70"]]) {
    const { ChecklistCompletionMedal } = await load("../src/components/ui/checklist-completion-medal.tsx", {
      "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", Path: "Path" },
      "@/components/ui/hover-label": { HoverLabel: "HoverLabel" },
      "@/providers/theme-provider": { useTheme: () => ({ theme: { scheme, colors: { accent: color } } }) },
    });
    const tree = ChecklistCompletionMedal({ zoom: 1.5 });
    assert.equal(tree.props.accessibilityLabel, "Task and checklist fully completed");
    assert.equal(nodes(tree).find((node) => node.type === "Circle").props.stroke, color);
    assert.equal(nodes(tree).find((node) => node.type === "Svg").props.width, 21);
    assert.equal(nodes(tree).find((node) => node.type === "Svg").props.height, 24.75);
  }
});

test("board cards render naturally active holiday artwork without enabling debug", () => {
  activeEvents = themes.SEASONAL_CARD_THEMES.filter((entry) => entry.id === "halloween");
  try {
    const tree = render({ tags: ["Halloween"], completed: true });
    assert.equal(nodes(tree).find((node) => node.type === "SeasonalCardDecoration").props.theme.id, "halloween");
    assert.equal(nodes(render({ tags: ["Christmas"] })).some((node) => node.type === "SeasonalCardDecoration"), false);
  } finally {
    activeEvents = [];
  }
});

test("custom artwork and selection remain available with a status icon", () => {
  const tree = render({ tags: ["Janus"], completed: true }, { selected: true });
  assert.equal(nodes(tree).find((node) => node.type === "SeasonalCardDecoration").props.theme.id, "janus");
  assert.equal(nodes(tree).find((node) => node.type === "StatusIcon").props.status, "completed");
  assert.equal(Object.assign({}, ...tree.props.style.filter(Boolean)).borderColor, colors.primary);
});

test("expanding a custom card keeps its artwork in the summary and adds an ornament per checklist row", () => {
  for (const tag of ["DarkSoulEngineer", "Janus"]) {
    expanded = false;
    const changes = { tags: [tag], subtasks: [{ id: "one", title: "First", done: true }, { id: "two", title: "Second", done: false }] };
    const props = { onToggleSubtask() {} };
    const collapsed = render(changes, props);
    nodes(collapsed).find((node) => node.props?.accessibilityLabel === "Checklist for Task").props.onPress({ stopPropagation() {} });
    const open = render(changes, props);
    const summary = nodes(open).find((node) => node.props?.testID === "janus-card-summary-card");
    assert.equal(nodes(summary).filter((node) => node.type === "SeasonalCardDecoration").length, 1);
    assert.equal(nodes(summary).some((node) => node.props?.accessibilityRole === "checkbox"), false);
    const previousSummary = nodes(collapsed).find((node) => node.props?.testID === "janus-card-summary-card");
    const bounds = nodes(summary).find((node) => node.props?.testID === "janus-card-decoration-bounds-card");
    assert.equal(bounds.props.style.top, -12);
    assert.equal(bounds.props.style.bottom, -12);
    assert.equal(bounds.props.style.left, -12);
    assert.equal(bounds.props.style.right, -12);
    assert.equal(bounds.props.pointerEvents, "none");
    assert.deepEqual(summary.props.style, previousSummary.props.style, "summary layout is independent of expansion");
    assert.deepEqual(nodes(summary).find((node) => node.type === "SeasonalCardDecoration").props, nodes(previousSummary).find((node) => node.type === "SeasonalCardDecoration").props);
    const checklist = nodes(open).find((node) => node.props?.testID === "janus-card-checklist-card");
    assert.equal(Object.assign({}, ...[checklist.props.style].flat()).borderTopWidth, undefined, "expansion does not introduce a fractional divider border");
    const ornaments = nodes(checklist).filter((node) => node.type === "CustomChecklistDecoration");
    assert.equal(ornaments.length, 2);
    assert.deepEqual(ornaments.map((node) => node.props.done), [true, false]);
    assert.equal(nodes(checklist).some((node) => node.type === "SeasonalCardDecoration"), false);
  }
  expanded = false;
});
