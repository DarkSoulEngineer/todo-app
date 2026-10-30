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
const constants = await load("../src/lib/domain/constants.ts");
const cardThemes = await load("../src/lib/features/card-themes.ts");
const colors = { card: "#303030", primary: "#aabb22", primarySoft: "#aabb2222", border: "#444444", foreground: "#eeeecc", mutedForeground: "#aaaaaa", backgroundAlt: "#202020", success: "#66cc88", successSoft: "#66cc8822", destructive: "#ff9988", destructiveSoft: "#ff998822", secondary: "#404040" };
let scheme = "dark", platform = "web";
const { MobileColumnTaskCard, taskCardBorderRadius } = await load("../src/components/board/mobile-column-task-card.tsx", {
  react: { useState: () => [false, () => {}] },
  "react-native": { Platform: { get OS() { return platform; } }, Pressable: "Pressable", View: "View", Text: "Text", StyleSheet: { create: (value) => value, hairlineWidth: 0.5 } },
  "@expo/vector-icons": { Ionicons: "Icon" },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors, scheme } }) },
  "@/lib/domain/status": status,
  "@/lib/domain/constants": constants,
  "@/lib/domain/boards": { boardColor: () => ({ dot: "#aa66ff" }) },
  "./mobile-board-colors": { useMobileBoardColors: () => colors },
  "@/components/ui/priority-stars": { PriorityStars: "PriorityStars" },
  "@/components/ui/status-icon": { StatusIcon: "StatusIcon" },
  "@/lib/features/card-themes": cardThemes,
  "@/components/ui/seasonal-card-decoration": { SeasonalCardDecoration: "SeasonalCardDecoration" },
});
const now = new Date(2026, 9, 29, 12);
const task = { id: "card", title: "Draft the design review notes", description: "Keep these details in the editor", priority: "medium", dueAt: new Date(2026, 9, 29, 18, 22).toISOString(), completed: false, canceled: false, subtasks: [] };
const render = (changes = {}, props = {}) => MobileColumnTaskCard({ task: { ...task, ...changes }, board: { label: "Design", color: "violet" }, now, selected: false, selectionMode: false, onPress() {}, onMenu() {}, onSelect() {}, onToggleSubtask() {}, ...props });
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const text = (node) => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : "";
const style = (node) => Object.assign({}, ...[node.props.style].flat().filter(Boolean));

test("board cards match the simple tile hierarchy without descriptions or decorative gradients", () => {
  const tree = render();
  assert.ok(text(tree).includes("6:22 PM"));
  assert.ok(text(tree).includes(task.title));
  const priority = nodes(tree).find((node) => node.type === "PriorityStars");
  assert.equal(priority.props.priority, "medium", "priority is an icon, not a text grade");
  assert.ok(text(tree).includes("Design"));
  assert.ok(!text(tree).includes(task.description));
  assert.ok(!nodes(tree).some((node) => node.type === "LinearGradient"));
  assert.equal(style(tree).borderColor, colors.border);
  assert.equal(style(tree).borderLeftColor, constants.PRIORITY_META.medium.dot);
  assert.equal(style(tree).borderRadius, taskCardBorderRadius);
  assert.equal(style(tree).backgroundColor, colors.card);
});

test("holiday titles activate seasonal decoration while preserving status and selection cues", () => {
  for (const [title, id] of [["Halloween party", "halloween"], ["Christmass gifts", "christmas"], ["Easter", "easter"], ["New Year", "new-year"], ["BIRTHDAY", "birthday"], ["Valentine's day", "valentines"]]) {
    const tags = [cardThemes.SEASONAL_CARD_THEMES.find((entry) => entry.id === id).label];
    const tree = render({ title, tags });
    const decoration = nodes(tree).find((node) => node.type === "SeasonalCardDecoration");
    assert.equal(decoration.props.theme.id, id);
    assert.equal(decoration.props.paused, false);
    assert.equal(style(render({ title, tags, completed: true })).borderLeftColor, colors.success);
    assert.equal(style(render({ title, tags }, { selected: true })).borderColor, colors.primary);
    for (const props of [{ compact: true }, { selectionMode: true }, { hideMoveArrows: true }, { animateSeasonal: false }]) {
      assert.equal(nodes(render({ title, tags }, props)).find((node) => node.type === "SeasonalCardDecoration").props.paused, true);
    }
  }
  assert.equal(nodes(render()).find((node) => node.type === "SeasonalCardDecoration"), undefined);
  assert.equal(nodes(render({ title: "Halloween" }, { listTitle: "Halloween" })).find((node) => node.type === "SeasonalCardDecoration"), undefined, "holder and card names no longer choose a design");
  const combined = nodes(render({ tags: ["Halloween", "Done"], completed: true })).find((node) => node.type === "SeasonalCardDecoration");
  assert.equal(combined.props.theme.id, "halloween");
});

test("status designs follow task state and complete case-insensitive names without changing controls", () => {
  for (const [changes, id] of [[{ completed: true }, "done"], [{ canceled: true }, "canceled"], [{ dueAt: new Date(2026, 9, 28).toISOString() }, "overdue"], [{ tags: ["dOnE"] }, "done"], [{ tags: ["CANCELLED"] }, "canceled"], [{ tags: ["OVERDUE"] }, "overdue"]]) {
    const tree = render(changes);
    const decoration = nodes(tree).find((node) => node.type === "SeasonalCardDecoration");
    assert.equal(decoration.props.theme.id, id);
    assert.ok(nodes(tree).some((node) => node.props?.accessibilityLabel === `Actions for ${changes.title ?? task.title}`));
    assert.equal(tree.props.accessibilityLabel, changes.title ?? task.title);
  }
  for (const title of ["D", "C", "O", "B", "V"]) assert.equal(nodes(render({ title })).find((node) => node.type === "SeasonalCardDecoration"), undefined);
});

test("board cards have a subtle shadow in normal, compact, selected and calendar layouts", () => {
  for (const props of [{}, { compact: true }, { selected: true }, { calendarLayout: true }]) {
    const card = style(render({}, props));
    assert.equal(card.boxShadow, "0 2px 5px rgba(0,0,0,0.16)");
    assert.equal(card.borderRadius, taskCardBorderRadius);
    assert.equal(card.borderLeftWidth, 3);
  }
  const calendar = style(render({}, { calendarLayout: true }));
  assert.equal(calendar.minHeight, 108);
  assert.equal(calendar.paddingLeft, 13);
  assert.equal(calendar.borderWidth, 0.5);
});

test("basic status tags have no glyphs; event and ordinary custom tags keep text labels", () => {
  for (const [tag, changes] of [["Done", { completed: true }], ["Canceled", { canceled: true }], ["Overdue", {}]]) {
    const tree = render({ tags: ["Work custom", "Halloween", tag], ...changes });
    assert.ok(text(tree).includes("Halloween"));
    assert.ok(text(tree).includes("Work custom"));
    assert.ok(!text(tree).includes(tag), `${tag} is not duplicated as text`);
    assert.equal(nodes(tree).find((node) => node.type === "StatusIcon"), undefined);
  }
});

test("due badges distinguish days, tolerate invalid dates, and status beats priority", () => {
  assert.ok(text(render({ dueAt: new Date(2026, 9, 30, 18, 22).toISOString() })).includes("Oct 30 · 6:22 PM"));
  for (const dueAt of [null, "invalid"]) assert.ok(text(render({ dueAt })).includes("Any time"));
  const overdue = { dueAt: new Date(2026, 9, 28, 12).toISOString() };
  assert.equal(style(render(overdue)).borderLeftColor, colors.destructive);
  assert.equal(nodes(render(overdue)).find((node) => node.type === "StatusIcon"), undefined);
  for (const [changes, accent] of [[{ completed: true }, colors.success], [{ canceled: true }, colors.mutedForeground]]) {
    const tree = render({ ...overdue, ...changes });
    assert.equal(nodes(tree).find((node) => node.type === "StatusIcon"), undefined);
    assert.equal(style(tree).borderLeftColor, accent);
  }
});

test("checklist count and slim progress bar reflect zero, partial and full completion", () => {
  for (const done of [0, 1, 2]) {
    const subtasks = Array.from({ length: 2 }, (_, index) => ({ id: String(index), title: "Step", done: index < done }));
    const tree = render({ subtasks });
    assert.ok(text(tree).includes(`${done}/2`));
    const progress = nodes(tree).find((node) => node.props?.accessibilityRole === "progressbar");
    assert.equal(progress.props.accessibilityValue.now, done);
    assert.equal(style(progress).height, 3);
    assert.equal(style(progress.props.children).width, `${done * 50}%`);
    assert.equal(style(progress.props.children).backgroundColor, done === 2 ? colors.success : colors.primary);
  }
  assert.ok(!nodes(render()).some((node) => node.props?.accessibilityRole === "progressbar"));
});

test("compact mode, zoom, theme contrast and selected state remain available", () => {
  const compact = render({}, { compact: true, zoom: 1.3 });
  assert.ok(text(compact).includes(task.title));
  assert.ok(!nodes(compact).some((node) => node.type === "PriorityStars"));
  const title = nodes(compact).find((node) => node.type === "Text" && node.props.children === task.title);
  assert.equal(style(title).fontSize, 13 * 1.3);
  assert.equal(style(render({}, { selected: true })).backgroundColor, colors.primarySoft);
  try {
    scheme = "light";
    const priority = nodes(render()).find((node) => node.type === "PriorityStars");
    assert.equal(priority.props.priority, "medium");
    platform = "ios";
    assert.equal(render().props.onContextMenu, undefined);
  } finally { scheme = "dark"; platform = "web"; }
});

test("right-click targets the card and prevents the list holder menu from replacing it", () => {
  let received, prevented = false, stopped = false;
  const tree = render({}, { onMenu: (event) => { received = event; } });
  const event = { nativeEvent: { pageX: 120, pageY: 240 }, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } };
  tree.props.onContextMenu(event);
  assert.equal(received, event);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
});

test("web cards support Space without activating a nested control or duplicating Enter", () => {
  let opened = 0;
  const tree = render({}, { onPress: () => opened++ });
  assert.equal(tree.props.role, "group");
  assert.equal(tree.props.tabIndex, 0);
  assert.equal(tree.props.accessibilityRole, undefined);
  const target = {};
  let prevented = 0;
  const event = { key: " ", target, currentTarget: target, nativeEvent: {}, preventDefault() { prevented++; }, stopPropagation() {} };
  tree.props.onKeyDown(event);
  assert.equal(opened, 1);
  assert.equal(prevented, 1);
  for (const change of [{ target: {} }, { repeat: true }, { defaultPrevented: true }, { key: "Enter" }, { nativeEvent: { isComposing: true } }]) tree.props.onKeyDown({ ...event, ...change });
  assert.equal(opened, 1, "Enter is owned by Pressable; descendant, repeated and composing keys are ignored");
  try {
    platform = "ios";
    assert.equal(render().props.accessibilityRole, "button");
    assert.equal(render().props.onKeyDown, undefined);
  } finally { platform = "web"; }
});

test("real React Native Web renders a group with sibling buttons, never nested HTML buttons", async () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const native = require("react-native-web");
  const artworkMocks = { "react-native": native, "react-native-svg": { __esModule: true, default: "svg", Circle: "circle", Ellipse: "ellipse", G: "g", Line: "line", Path: "path", Rect: "rect" } };
  const eventArtwork = await load("../src/components/ui/seasonal-card-artwork.tsx", artworkMocks);
  const statusArtwork = await load("../src/components/ui/status-card-artwork.tsx", artworkMocks);
  const halloweenVariants = await load("../src/lib/features/halloween-variants.ts", {});
  const halloweenArtwork = await load("../src/components/ui/halloween-card-artwork.tsx", { ...artworkMocks, "@/lib/features/halloween-variants": halloweenVariants });
  const decorations = await load("../src/components/ui/seasonal-card-decoration.tsx", {
    react: React, "react-native": native,
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors } }) },
    "./seasonal-card-artwork": eventArtwork,
    "./status-card-artwork": statusArtwork,
    "./halloween-card-artwork": halloweenArtwork,
  });
  const { MobileColumnTaskCard: WebCard } = await load("../src/components/board/mobile-column-task-card.tsx", {
    react: React,
    "react-native": native,
    "@expo/vector-icons": { Ionicons: () => null },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors, scheme: "dark" } }) },
    "@/lib/domain/status": status,
    "@/lib/domain/constants": constants,
    "@/lib/domain/boards": { boardColor: () => ({ dot: "#aa66ff" }) },
    "./mobile-board-colors": { useMobileBoardColors: () => colors },
    "@/components/ui/priority-stars": { PriorityStars: () => null },
    "@/components/ui/status-icon": { StatusIcon: () => null },
    "@/lib/features/card-themes": cardThemes,
    "@/components/ui/seasonal-card-decoration": decorations,
  });
  for (const title of [task.title, "Halloween party", "Birthday", "Valentine's Day", "DONE", "cAnCeLeD", "OVERDUE"]) for (const compact of [false, true]) for (const selectionMode of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(WebCard, {
      task: { ...task, title, tags: title === "Halloween party" ? ["Halloween"] : [title], subtasks: [{ id: "step", title: "Step", done: false }] },
      now, compact, selectionMode, selected: selectionMode,
      onPress() {}, onMenu() {}, onSelect() {}, onToggleSubtask() {}, onMoveLeft() {}, onMoveRight() {},
    }));
    assert.match(html, /^<div\b[^>]*role="group"/);
    assert.match(html, /tabindex="0"/);
    assert.match(html, /<button\b[^>]*aria-label="Actions for/);
    let depth = 0;
    for (const tag of html.match(/<\/?button\b[^>]*>/g) ?? []) {
      if (tag.startsWith("</")) depth--;
      else { assert.equal(depth, 0, "a button must not have a button ancestor"); depth++; }
    }
    assert.equal(depth, 0);
  }
});
