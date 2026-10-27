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
  vm.runInNewContext(outputText, { exports, require: (id) => mocks[id] ?? require(id) });
  return exports;
}
const ranking = await load("../src/lib/features/top-tasks.ts");
const task = (id, priority = "medium", dueAt = null, extra = {}) => ({
  id, title: id, description: "Notes", priority, dueAt, completed: false, canceled: false,
  createdAt: "2026-10-01T09:00:00Z", updatedAt: "2026-10-01T09:00:00Z", sectionId: null,
  subtasks: [], tags: [], category: null, ...extra,
});
const entry = (task, projectId = "a") => ({ task, projectId, projectName: projectId, boards: [] });
const ids = (items) => Array.from(items, (item) => item.task.id);

test("priority wins, then earliest deadline; undated work comes last within each priority", () => {
  const input = [entry(task("low-overdue", "low", "2026-09-01T09:00:00Z")),
    entry(task("high-undated", "high")), entry(task("high-later", "high", "2026-11-01T09:00:00Z")),
    entry(task("medium-overdue", "medium", "2026-09-01T09:00:00Z")), entry(task("high-overdue", "high", "2026-09-01T09:00:00Z"))];
  assert.deepEqual(ids(ranking.rankTopTasks(input)), ["high-overdue", "high-later", "high-undated", "medium-overdue", "low-overdue"]);
  assert.equal(input[0].task.id, "low-overdue");
});

test("settled tasks are excluded and invalid/missing dates have deterministic ties", () => {
  const input = [entry(task("done", "high", null, { completed: true })), entry(task("canceled", "high", null, { canceled: true })),
    entry(task("z", "medium", "invalid"), "b"), entry(task("b"), "a"), entry(task("a"), "a"),
    entry(task("old", "medium", null, { createdAt: "2026-01-01T09:00:00Z" }))];
  assert.deepEqual(ids(ranking.rankTopTasks(input)), ["old", "a", "b", "z"]);
  assert.deepEqual(ids(ranking.rankTopTasks(input.slice().reverse())), ["old", "a", "b", "z"]);
});

test("Top 3 / Top 10 limits do not invent cards when fewer tasks exist", () => {
  const input = Array.from({ length: 12 }, (_, index) => entry(task(String(index).padStart(2, "0"))));
  assert.equal(ranking.getTopTasks(input, 3).length, 3);
  assert.equal(ranking.getTopTasks(input, 10).length, 10);
  assert.equal(ranking.getTopTasks(input.slice(0, 2), 10).length, 2);
  assert.equal(ranking.getTopTasks([], 3).length, 0);
});

const find = (node, type) => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  return [...(node.type === type ? [node] : []), ...find(node.props?.children, type)];
};

async function setupRoute(openTasks = Array.from({ length: 12 }, (_, index) => task(`task-${String(index).padStart(2, "0")}`, index < 4 ? "high" : "medium"))) {
  const states = [];
  const calls = [];
  let cursor = 0;
  const projects = [
    { id: "a", name: "Board A", workspace: { tasks: openTasks.slice(0, 2), sections: [], boards: [] } },
    { id: "b", name: "Board B", workspace: { tasks: openTasks.slice(2), sections: [], boards: [{ id: "tag-b" }] } },
    { id: "closed", name: "Closed board", closedAt: "2026-10-01", workspace: { tasks: [task("closed-high", "high", "2025-01-01T00:00:00Z")], sections: [], boards: [] } },
  ];
  const api = {
    projects, currentProjectId: "a", tasks: projects[0].workspace.tasks, sections: [], boards: [], isLoading: false,
    switchProject(id) {
      calls.push(`switch:${id}`);
      this.projects.find((project) => project.id === this.currentProjectId).workspace = { tasks: this.tasks, sections: this.sections, boards: this.boards };
      const project = this.projects.find((project) => project.id === id);
      this.currentProjectId = id; this.tasks = project.workspace.tasks; this.sections = project.workspace.sections; this.boards = project.workspace.boards;
    },
    toggleComplete(id) { calls.push(`complete:${this.currentProjectId}:${id}`); this.tasks = this.tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task); },
    updateTask(id, draft) { calls.push(`edit:${this.currentProjectId}:${id}`); this.tasks = this.tasks.map((task) => task.id === id ? { ...task, ...draft } : task); },
    assignTaskToSection() {}, setTaskSectionId() {},
  };
  const react = {
    useMemo: (factory) => factory(),
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
  };
  // Use the real aggregation hook to cover live active tasks and closed-board exclusion.
  const hooks = await load("../src/hooks/use-all-board-tasks.ts", { react, "@/providers/tasks-provider": { useTasksContext: () => api } });
  const colors = new Proxy({}, { get: () => "#888888" });
  const { default: TopTasksRoute } = await load("../app/top-tasks.tsx", {
    react, "expo-router": { router: { replace: (path) => calls.push(path), push: (path) => calls.push(path) } },
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "react-native": { ActivityIndicator: "Loading", Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", View: "View", StyleSheet: { create: (styles) => styles } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
    "@/components/janus-board-ui": { OptionSheet: "OptionSheet", TaskCard: "TaskCard", TaskEditor: "TaskEditor" },
    "@/components/reference/mobile/reference-mobile-bottom-nav": { ReferenceMobileBottomNav: "BottomNav" },
    "@/components/reference/mobile/reference-primitives": { Pill: "Pill", ScreenHeader: "ScreenHeader" },
    "@/components/reference/reference-theme": { useReferenceTheme: () => ({ colors, type: {} }) },
    "@/components/ui/atmosphere": { ThemeAtmosphere: "Atmosphere" }, "@/components/ui/empty-state": { EmptyState: "EmptyState" },
    "@/components/ui/section-heading": { SectionHeading: "SectionHeading" }, "@/hooks/use-all-board-tasks": hooks,
    "@/hooks/use-now": { useNow: () => new Date("2026-10-27T12:00:00Z") },
    "@/lib/domain/sections": { getTaskSectionId: () => null }, "@/lib/features/top-tasks": ranking,
    "@/providers/toast-provider": { useToast: () => ({ success: (message) => calls.push(message) }) },
    "@/theme/layout": { mobileContentStyle: {}, mobileBottomNavClearance: 76 },
  });
  return { calls, api, render: () => { cursor = 0; return TopTasksRoute(); } };
}

test("Top Tasks switches 3/10, excludes closed boards, and refills after completion", async () => {
  const { render, calls } = await setupRoute();
  let tree = render();
  let cards = find(tree, "TaskCard");
  assert.equal(cards.length, 3);
  assert.equal(cards.some((card) => card.props.task.id === "closed-high"), false);
  assert.equal(cards[0].props.onComplete, undefined);
  cards[0].props.onLongPress();
  tree = render();
  find(tree, "OptionSheet")[0].props.options.find((option) => option.label === "Complete task").onPress();
  tree = render();
  cards = find(tree, "TaskCard");
  assert.equal(cards.length, 3);
  assert.equal(cards.some((card) => card.props.task.id === "task-00"), false);
  assert.ok(calls.includes("complete:a:task-00"));
  find(tree, "Pressable").find((button) => button.props.accessibilityLabel === "Show top 10 tasks").props.onPress();
  tree = render();
  assert.equal(find(tree, "TaskCard").length, 10);
  assert.equal(find(tree, "BottomNav")[0].props.active, "top-tasks");
});

test("editing uses the owning board and changes immediately affect ranking", async () => {
  const { render, calls } = await setupRoute();
  let tree = render();
  const card = find(tree, "TaskCard").find((card) => card.props.task.id === "task-02");
  card.props.onPress();
  tree = render();
  const editor = find(tree, "TaskEditor")[0];
  assert.equal(editor.props.visible, true);
  assert.ok(calls.includes("switch:b"));
  assert.equal(editor.props.boards[0].id, "tag-b");
  editor.props.onAutoSave({ ...editor.props.task, priority: "low" }, null);
  tree = render();
  assert.ok(calls.includes("edit:b:task-02"));
  assert.equal(find(tree, "TaskCard").some((card) => card.props.task.id === "task-02"), false);
});

test("empty overview offers Home rather than a global calendar", async () => {
  const { render, calls } = await setupRoute([]);
  const tree = render();
  assert.equal(find(tree, "TaskCard").length, 0);
  find(tree, "EmptyState")[0].props.onAction();
  assert.deepEqual(calls, ["/"]);
});

test("board calendars remain available and honor saved view and week-start preferences", async () => {
  const source = await readFile(new URL("../app/board/[id].tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("board.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "CalendarView");
  assert.ok(declaration);
  const { outputText } = ts.transpileModule(`export ${declaration.getText(ast)}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const colors = new Proxy({}, { get: () => "#888888" });
  for (const [calendarDefaultView, calendarWeekStart] of [["week", 0], ["month", 1]]) {
    const exports = {};
    vm.runInNewContext(outputText, {
      exports, require, ...require("date-fns"),
      useTheme: () => ({ theme: { colors } }), usePreferences: () => ({ calendarDefaultView, calendarWeekStart }),
      useState: (initial) => [initial, () => {}], View: "View", Text: "Text", Button: "Button", SectionHeading: "SectionHeading", Ionicons: "Ionicons", CalendarPanel: "CalendarPanel", StyleSheet: {},
    });
    const now = new Date(2026, 9, 27);
    let anchor;
    const tree = exports.CalendarView({ month: now, selectedDay: null, tasks: [], now, setMonth: (day) => { anchor = day; } });
    const panel = find(tree, "CalendarPanel")[0];
    assert.equal(panel.props.mode, calendarDefaultView);
    assert.equal(panel.props.weekStartsOn, calendarWeekStart);
    panel.props.onToday();
    if (calendarDefaultView === "week") assert.equal(anchor.getDay(), 0);
    else assert.equal(anchor.getDate(), 1);
  }
});
