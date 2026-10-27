import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const colors = new Proxy({}, { get: () => "#888888" });
const mocks = {
  react: { useState: (value) => [value, () => {}], useMemo: (factory) => factory() },
  "react-native": { Pressable: "Pressable", ScrollView: "ScrollView", View: "View", Text: "Text", StyleSheet: { create: (styles) => styles } },
  "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
  "@expo/vector-icons": { Ionicons: "Ionicons" },
  "expo-router": { Redirect: "Redirect" },
  "@/components/janus-board-ui": { OptionSheet: "OptionSheet" },
  "@/hooks/use-now": { useNow: () => new Date("2026-10-27T12:00:00Z") },
  "@/lib/domain/status": { deriveStatus: (task) => task.completed ? "completed" : task.canceled ? "canceled" : task.dueAt ? "overdue" : "open", describeDue: () => null },
  "./reference-mobile-bottom-nav": { ReferenceMobileBottomNav: "BottomNav" },
  "./reference-primitives": { ScreenHeader: "ScreenHeader", Pill: "Pill", ProgressRing: "ProgressRing", SurfaceCard: "SurfaceCard", resolveReferenceTask: (input) => input.task ? input : { task: input } },
  "../reference-theme": { useReferenceTheme: () => ({ colors, type: {} }), referenceSpacing: {}, referenceRadii: {} },
  "@/components/ui/atmosphere": { ThemeAtmosphere: "Atmosphere" },
  "@/components/ui/mobile-top-bar": { MobileSearchField: "SearchField" },
  "@/components/ui/section-heading": { SectionHeading: "SectionHeading" },
  "@/theme/layout": { mobileContentStyle: {}, mobileBottomNavClearance: 76 },
};
async function loadComponent(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (id) => mocks[id] ?? require(id) });
  return exports;
}
const { ReferenceMyTasksScreen } = await loadComponent("../src/components/reference/mobile/reference-my-tasks-screen.tsx");
const find = (node, type) => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  return [...(node.type === type ? [node] : []), ...find(node.props?.children, type)];
};

test("embedded My Tasks has search and filters without a nested screen or scroller", () => {
  const tree = ReferenceMyTasksScreen({ tasks: [], embedded: true });
  for (const type of ["ScrollView", "ScreenHeader", "BottomNav", "Atmosphere"]) assert.equal(find(tree, type).length, 0);
  assert.equal(find(tree, "SearchField")[0].props.accessibilityLabel, "Search my tasks");
  assert.equal(find(tree, "SectionHeading")[0].props.title, "My tasks");
  assert.equal(find(tree, "OptionSheet")[0].props.options.length, 5);
});

test("standalone reference screen remains usable without embedded mode", () => {
  const tree = ReferenceMyTasksScreen({ tasks: [] });
  for (const type of ["ScrollView", "ScreenHeader", "BottomNav", "Atmosphere"]) assert.equal(find(tree, type).length, 1);
});

test("overview keeps a neutral surface and preserves progress and overdue actions", () => {
  let reviewed = 0;
  let rescheduled = 0;
  const tasks = [
    { id: "done", completed: true },
    { id: "late", dueAt: "2026-10-01T12:00:00Z" },
    { id: "open", dueAt: null },
    { id: "canceled", canceled: true },
  ];
  const tree = ReferenceMyTasksScreen({ tasks, embedded: true, onReviewAttention: () => reviewed++, onRescheduleAttention: () => rescheduled++ });
  const summary = find(tree, "SurfaceCard")[0];
  assert.equal(summary.props.style.backgroundColor, undefined);
  assert.equal(summary.props.style.borderLeftWidth, undefined);
  assert.equal(find(tree, "ProgressRing")[0].props.value, 0.25);
  const buttons = find(tree, "Pressable");
  buttons.find((button) => button.props.accessibilityLabel === "Review overdue tasks").props.onPress();
  buttons.find((button) => button.props.accessibilityLabel === "Reschedule overdue tasks").props.onPress();
  assert.equal(reviewed, 1);
  assert.equal(rescheduled, 1);
});

test("overview omits overdue actions when no task is overdue", () => {
  const tree = ReferenceMyTasksScreen({ tasks: [], embedded: true });
  assert.equal(find(tree, "ProgressRing")[0].props.value, 0);
  assert.equal(find(tree, "Pressable").some((button) => button.props.accessibilityLabel === "Review overdue tasks"), false);
});

test("bottom navigation now contains only Home, Calendar, and Settings", async () => {
  const { ReferenceMobileBottomNav } = await loadComponent("../src/components/reference/mobile/reference-mobile-bottom-nav.tsx");
  const labels = find(ReferenceMobileBottomNav({ active: "calendar" }), "Pressable").map((node) => node.props.accessibilityLabel);
  assert.deepEqual(labels, ["Home", "Calendar", "Settings"]);
});

test("legacy My Tasks bookmarks redirect to Calendar", async () => {
  const { default: MyTasksRoute } = await loadComponent("../app/my-tasks.tsx");
  assert.equal(MyTasksRoute().props.href, "/calendar");
});

test("Calendar embeds My Tasks after its calendar inside the main scroll content", async () => {
  const source = await readFile(new URL("../app/calendar.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("calendar.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements = [];
  function visit(node, inScroll = false) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "ScrollView") inScroll = true;
    if (ts.isJsxSelfClosingElement(node)) elements.push({ name: node.tagName.getText(ast), inScroll, node });
    ts.forEachChild(node, (child) => visit(child, inScroll));
  }
  visit(ast);
  const calendar = elements.findIndex((item) => item.name === "CalendarPanel");
  const agenda = elements.findIndex((item) => item.name === "ReferenceMyTasksScreen");
  assert.ok(calendar >= 0 && agenda > calendar);
  assert.equal(elements[agenda].inScroll, true);
  assert.ok(elements[agenda].node.attributes.properties.some((prop) => prop.name?.getText(ast) === "embedded"));
});
