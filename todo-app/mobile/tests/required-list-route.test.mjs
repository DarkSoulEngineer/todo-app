import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/task/new.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function harness({ sections = [], params = {}, ready = true } = {}) {
  const redirects = [], additions = [];
  const api = {
    currentProjectId: "board", currentProjectName: "Board", isLoading: !ready,
    sections, boards: [], projects: [], switchProject() {},
    addTask: (draft, sectionId) => { additions.push({ draft, sectionId }); return { id: "task" }; },
    addAttachment() {},
  };
  const mocks = {
    "expo-router": { router: { replace: (path) => redirects.push(path) }, useLocalSearchParams: () => params },
    react: { useEffect: (fn) => fn(), useMemo: (fn) => fn() },
    "@/providers/tasks-provider": { useTasksContext: () => api },
    "@/components/reference/mobile": { ReferenceNewTaskScreen: "NewTaskScreen" },
  };
  const exports = {};
  new Function("require", "exports", compiled)((id) => id === "react/jsx-runtime" ? require(id) : mocks[id], exports);
  return { tree: exports.default(), redirects, additions };
}

test("new-card routes return empty or hidden-only boards to the board without creating cards", () => {
  for (const sections of [[], [{ id: "hidden", title: "Hidden", hidden: true }]]) {
    const app = harness({ sections });
    assert.equal(app.tree, null);
    assert.deepEqual(app.redirects, ["/board/board"]);
    assert.deepEqual(app.additions, []);
  }
  const loading = harness({ ready: false });
  assert.equal(loading.tree, null);
  assert.deepEqual(loading.redirects, []);
});

test("new-card routes assign the requested real list atomically, or default to a visible list", () => {
  const sections = [{ id: "hidden", title: "Hidden", hidden: true }, { id: "a", title: "First" }, { id: "b", title: "Second" }];
  for (const [requested, expected] of [[undefined, "a"], ["b", "b"], ["missing", "a"], ["hidden", "a"]]) {
    const app = harness({ sections, params: { sectionId: requested } });
    app.tree.props.onSubmit({ title: "Card", category: null }, []);
    assert.equal(app.additions[0].sectionId, expected);
    assert.equal(app.tree.props.sectionLabel, sections.find((section) => section.id === expected).title);
  }
});
