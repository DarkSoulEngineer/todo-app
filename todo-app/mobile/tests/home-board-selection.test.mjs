import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const layout = {};
vm.runInNewContext(compile(read("../src/lib/features/board-layout.ts")), { exports: layout });
// Exercise the real provider removal implementation, including current-board
// fallback and deletion of the final board, rather than mocking its behavior.
const hook = ts.createSourceFile("use-tasks.ts", read("../src/hooks/use-tasks.ts"), ts.ScriptTarget.Latest, true);
const projectActions = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && ["removeProject", "closeProject", "reopenProject", "duplicateProject"].includes(node.name.getText(hook))) projectActions[node.name.getText(hook)] = node.initializer.getText(hook);
  ts.forEachChild(node, visit);
}
visit(hook);

async function setup() {
  const workspace = { tasks: [], sections: [], boards: [] };
  let registry = { currentId: "a", projects: ["a", "b", "c", "closed"].map((id) => ({ id, name: id === "c" ? "Other" : `Board ${id}`, createdAt: "2026-10-29", workspace, ...(id === "closed" ? { closedAt: "2026-10-29" } : {}) })) };
  const removed = [], savedPins = [], savedLayouts = [], routes = [];
  const removal = {};
  let copyIndex = 0;
  vm.runInNewContext(compile(Object.entries(projectActions).map(([name, source]) => `export const ${name} = ${source};`).join("\n")), {
    exports: removal, useCallback: (fn) => fn,
    registryWithLiveWorkspace: () => registry,
    cloneProject: (source) => ({ ...source, id: `copy-${++copyIndex}`, name: `${source.name} (copy)`, closedAt: undefined }),
    applyRegistry: (next) => { removed.push(...registry.projects.filter((project) => !next.projects.some((item) => item.id === project.id)).map((project) => project.id)); registry = next; },
  });
  const api = { get projects() { return registry.projects; }, get currentProjectId() { return registry.currentId; }, ...workspace, isLoading: false, ...removal };
  const slots = [];
  let cursor = 0;
  const react = {
    useMemo: (fn) => fn(),
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) { slots[index] = deps; effect(); }
    },
  };
  const host = new Proxy({}, { get: (_, key) => key });
  const mocks = {
    react,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "react-native": { ...host, View: "View", StyleSheet: { create: (styles) => styles } },
    "expo-router": { router: { push: (path) => routes.push(path), replace: (path) => routes.push(path) } },
    "@/providers/tasks-provider": { useTasksContext: () => api },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
    "@/providers/toast-provider": { useToast: () => ({ success() {}, error() {} }) },
    "@/lib/features/navigation-commands": { createNavigationCommands: () => [] },
    "@/lib/features/board-layout": layout,
    "@/lib/data/manager-state": {
      loadManagerState: async () => ({ pinnedIds: new Set(["a", "c"]), layout: { order: ["a", "b", "c", "closed"], cols: 2 } }),
      getWorkspaceMetrics: () => ({}),
      saveManagerPins: (ids) => savedPins.push([...ids]),
      saveManagerLayout: (next) => savedLayouts.push(next),
    },
  };
  const exports = {};
  vm.runInNewContext(compile(read("../app/index.tsx")), { exports, require: (id) => mocks[id] ?? host, setInterval() {}, clearInterval() {} });
  const render = () => { cursor = 0; return exports.default(); };
  render();
  await Promise.resolve();
  const content = () => nodes(render()).find((node) => node.type === "BoardManagerContent").props;
  const confirmation = () => nodes(render()).find((node) => node.type === "ConfirmationDialog" && node.props.confirmLabel === "Remove selected").props;
  return { content, confirmation, render, removed, savedPins, savedLayouts, routes, get registry() { return registry; } };
}

test("bulk removal requires confirmation and only removes selected boards, cleaning saved pins and layout", async () => {
  const app = await setup();
  assert.equal(app.content().ready, true);
  app.content().onToggleSelection("a");
  app.content().onToggleSelection("b");
  assert.equal(app.content().selecting, true);
  assert.equal(app.content().selectedIds.size, 2);
  app.content().onRemoveSelected();
  assert.deepEqual(app.removed, []);
  assert.equal(app.confirmation().visible, true);
  app.confirmation().onClose();
  assert.equal(app.confirmation().visible, false);
  assert.equal(app.content().selectedIds.size, 2);
  assert.deepEqual(app.removed, []);
  app.content().onRemoveSelected();
  app.confirmation().onConfirm();
  assert.deepEqual(app.removed, ["a", "b"]);
  assert.deepEqual(app.registry.projects.map((project) => project.id), ["c", "closed"]);
  assert.equal(app.registry.currentId, "c");
  assert.deepEqual(app.savedPins.at(-1), ["c"]);
  assert.deepEqual([...app.savedLayouts.at(-1).order], ["c", "closed"]);
  assert.equal(app.content().selecting, false);
  assert.equal(app.content().selectedIds.size, 0);
  assert.deepEqual(app.routes, []);
});

test("select all respects search, includes closed boards, and clearing or exiting never deletes", async () => {
  const app = await setup();
  app.content().onSelecting(true);
  app.content().onQuery("Board");
  app.content().onSelectAll();
  assert.deepEqual([...app.content().selectedIds], ["a", "b", "closed"]);
  app.content().onClearSelection();
  assert.equal(app.content().selectedIds.size, 0);
  app.content().onToggleSelection("c");
  app.content().onEdit(true);
  assert.equal(app.content().editing, true);
  assert.equal(app.content().selecting, false);
  assert.equal(app.content().selectedIds.size, 0);
  app.content().onToggleSelection("a");
  assert.equal(app.content().editing, true);
  assert.equal(app.content().selecting, false);
  assert.equal(app.content().selectedIds.size, 0);
  app.content().onSelecting(true);
  assert.equal(app.content().selecting, false);
  app.content().onEdit(false);
  app.content().onToggleSelection("a");
  assert.equal(app.content().selecting, true);
  app.content().onSelecting(false);
  assert.deepEqual(app.removed, []);
});

test("bulk removal may delete every board and returns to the existing welcome screen", async () => {
  const app = await setup();
  app.content().onSelecting(true);
  app.content().onSelectAll();
  app.content().onRemoveSelected();
  app.confirmation().onConfirm();
  assert.equal(app.registry.projects.length, 0);
  assert.equal(app.registry.currentId, "");
  assert.equal(app.render().type, "WelcomeScreen");
  assert.deepEqual(app.savedPins.at(-1), []);
  assert.equal(app.savedLayouts.at(-1).order.length, 0);
});

test("board ribbon closes, reopens and duplicates only eligible selected boards", async () => {
  const app = await setup();
  assert.equal(app.content().boardSelectionActions.canClose, false);
  app.content().onToggleSelection("a");
  app.content().onToggleSelection("closed");
  assert.equal(app.content().boardSelectionActions.canClose, true);
  assert.equal(app.content().boardSelectionActions.canReopen, true);
  app.content().boardSelectionActions.onClose();
  assert.ok(app.registry.projects.find((project) => project.id === "a").closedAt);
  assert.equal(app.registry.projects.find((project) => project.id === "b").closedAt, undefined);
  assert.equal(app.content().boardSelectionActions.canClose, false);
  assert.equal(app.content().boardSelectionActions.canDuplicate, false);
  app.content().boardSelectionActions.onDuplicate();
  assert.equal(app.registry.projects.length, 4);
  app.content().boardSelectionActions.onReopen();
  assert.equal(app.registry.projects.filter((project) => project.closedAt).length, 0);
  assert.equal(app.content().boardSelectionActions.canReopen, false);
  app.content().boardSelectionActions.onDuplicate();
  assert.equal(app.registry.projects.length, 6);
  assert.deepEqual([...app.registry.projects.slice(4)].map((project) => project.name), ["Board a (copy)", "Board closed (copy)"]);
  assert.deepEqual([...app.content().selectedIds], ["a", "closed"]);
  assert.deepEqual(app.removed, []);
  assert.deepEqual(app.routes, []);
});
