import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(file, mocks = {}, globals = {}) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (id) => mocks[id] ?? (id === "react/jsx-runtime" ? require(id) : undefined), ...globals });
  return exports;
}
const logic = await load("../src/lib/features/commands.ts");
const navigation = await load("../src/lib/features/navigation-commands.ts");

test("shortcuts use exact modifiers and leave editing, IME, repeats and browser shortcuts alone", () => {
  for (const key of ["n", "b", "l", "r", "?", "/"]) assert.equal(logic.commandShortcut({ key }, true), null);
  for (const flag of ["isComposing", "repeat", "defaultPrevented"]) assert.equal(logic.commandShortcut({ key: "n", [flag]: true }, false), null);
  assert.equal(logic.commandShortcut({ key: "/" }, false), "palette");
  assert.equal(logic.commandShortcut({ key: "?", shiftKey: true }, false), "help");
  assert.equal(logic.commandShortcut({ key: "/", shiftKey: true }, false), "help");
  assert.equal(logic.commandShortcut({ key: "r", shiftKey: true }, false), "rename-board");
  assert.equal(logic.commandShortcut({ key: "ArrowLeft", shiftKey: true }, false), "card-left");
  for (const event of [{ key: "r", ctrlKey: true }, { key: "n", metaKey: true }, { key: "n", shiftKey: true }, { key: "k", ctrlKey: true, altKey: true }]) assert.equal(logic.commandShortcut(event, false), null);
});

test("command search matches all words across labels and context without executing", () => {
  const commands = [{ id: "a", label: "Rename card", detail: "Inbox", run() { throw Error("must not run"); } }, { id: "b", label: "Create board" }];
  assert.equal(logic.filterCommands(commands, " CARD inbox ")[0].id, "a");
  assert.equal(logic.filterCommands(commands, "card board").length, 0);
  assert.equal(logic.filterCommands(commands, " ").length, 2);
});

test("navigation bindings use Shift and disabled quick actions keep commands/help available", () => {
  for (const [event, id] of [
    [{ key: "B", shiftKey: true }, "switch-board"],
    [{ key: "H", shiftKey: true }, "all-boards"],
    [{ key: "T", shiftKey: true }, "top-tasks"],
    [{ key: "S", shiftKey: true }, "settings"],
    ...["Left", "Right", "Up", "Down"].map((direction) => [{ key: `Arrow${direction}`, shiftKey: true }, `card-${direction.toLowerCase()}`]),
  ]) {
    assert.equal(logic.commandShortcut(event, false), id);
    assert.equal(logic.commandShortcut(event, false, false), null);
  }
  assert.equal(logic.commandShortcut({ key: "/" }, false, false), "palette");
  assert.equal(logic.commandShortcut({ key: "?", shiftKey: true }, false, false), "help");
  for (const [key, id] of [["1", "view-board"], ["2", "view-list"], ["3", "view-calendar"], ["4", "view-insights"], ["[", "previous-board"], ["]", "next-board"]]) {
    assert.equal(logic.commandShortcut({ key }, false), id);
    assert.equal(logic.commandShortcut({ key }, false, false), null);
  }
  assert.equal(logic.commandShortcut({ key: "n" }, false, false), null);
  assert.equal(logic.commandShortcut({ key: "ArrowOops", altKey: true }, false), null);
  assert.equal(logic.commandShortcut({ key: "B", shiftKey: true }, false), "switch-board");
  assert.equal(logic.commandShortcut({ key: "B", shiftKey: true }, false, false), null);
});

test("filter, display, ribbon and bulk shortcuts are browser-safe and obey quick-action preference", () => {
  const plain = { q: "search-tasks", f: "filter-tags", o: "sort-tasks", v: "select-mode", a: "select-all", u: "unselect-all", m: "move-selected", p: "priority-selected", d: "complete-selected", c: "cancel-selected", k: "compact", g: "focus-column", w: "move-arrows", "=": "zoom-in", "-": "zoom-out", "0": "zoom-reset" };
  const shifted = { f: "clear-filters", l: "add-tag", x: "remove-tag", v: "hidden-tools", o: "actions-tools", u: "home-tools", p: "pin-ribbon", c: "restore-selected", d: "dragging", m: "load-sample" };
  for (const [bindings, shiftKey] of [[plain, false], [shifted, true]]) for (const [key, id] of Object.entries(bindings)) {
    const event = { key, shiftKey };
    assert.equal(logic.commandShortcut(event, false), id);
    assert.equal(logic.commandShortcut(event, true), null);
    assert.equal(logic.commandShortcut(event, false, false), null);
    for (const modifier of ["ctrlKey", "metaKey", "altKey"]) assert.equal(logic.commandShortcut({ ...event, [modifier]: true }, false), null);
  }
});

test("board selection shows current board, excludes closed boards, and cycles open boards", () => {
  const selected = [], routes = [];
  const projects = ["one", "closed", "two"].map((id) => ({ id, name: id, closedAt: id === "closed" ? "yesterday" : undefined, workspace: { tasks: [], sections: [] } }));
  const commands = navigation.createNavigationCommands({ projects, currentProjectId: "two", openBoard: (id) => selected.push(id), navigate: (route) => routes.push(route) });
  const popup = commands.find((command) => command.id === "switch-board");
  assert.deepEqual(Array.from(popup.children, (entry) => entry.id), ["one", "two"]);
  assert.equal(popup.children[1].selected, true);
  commands.find((command) => command.id === "next-board").run();
  commands.find((command) => command.id === "previous-board").run();
  popup.children[0].run();
  assert.deepEqual(selected, ["one", "one", "one"]);
  for (const id of ["all-boards", "top-tasks", "settings"]) commands.find((command) => command.id === id).run();
  assert.deepEqual(routes, ["/", "/top-tasks", "/settings"]);
  const empty = navigation.createNavigationCommands({ projects: [], currentProjectId: null, openBoard() {}, navigate() {} });
  assert.equal(empty.some((command) => command.id === "next-board"), false);
  assert.equal(empty.find((command) => command.id === "switch-board").children.length, 0);
});

async function palette(singleKeyShortcuts = true) {
  const slots = [], refs = [], listeners = new Set();
  let cursor = 0, refCursor = 0, focused = true;
  let props = { mode: null, commands: [], blocked: false, onMode(mode) { props.mode = mode; } };
  const effects = [];
  const doc = { addEventListener(_, fn) { listeners.add(fn); }, removeEventListener(_, fn) { listeners.delete(fn); } };
  const { CommandPalette } = await load("../src/components/ui/command-palette.tsx", {
    react: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
      useRef(initial) { const i = refCursor++; return refs[i] ??= { current: initial }; },
      useEffect(fn) { effects.push(fn); },
    },
    "expo-router": { useIsFocused: () => focused },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "react-native": { Platform: { OS: "web" }, Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", View: "View", StyleSheet: { create: (value) => value } },
    "@/components/ui/editor-window": { EditorWindow: "EditorWindow" },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
    "@/providers/preferences-provider": { usePreferences: () => ({ singleKeyShortcuts }) },
    "@/lib/features/commands": logic,
  }, { document: doc });
  let cleanup = [];
  const render = () => { cleanup.forEach((fn) => fn?.()); cleanup = []; effects.length = 0; cursor = refCursor = 0; const tree = CommandPalette(props); cleanup = effects.map((effect) => effect()); return tree; };
  const key = (key, extra = {}) => { const event = { key, target: { closest: () => null }, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...extra }; [...listeners].forEach((fn) => fn(event)); return event; };
  return { props, render, key, refs, listeners, setFocused(value) { focused = value; } };
}

test("palette shortcut selects a target, keyboard navigation runs only the chosen action", async () => {
  const app = await palette();
  const ran = [];
  app.props.commands = [{ id: "rename-card", label: "Rename card", shortcut: "R", children: [{ id: "a", label: "Alpha", run: () => ran.push("a") }, { id: "b", label: "Beta", run: () => ran.push("b") }] }];
  app.render();
  assert.equal(app.key("r").prevented, true);
  assert.equal(app.props.mode, "commands");
  const tree = app.render();
  assert.equal(tree.props.title, "Rename card");
  app.refs[0].current = {};
  app.key("ArrowDown"); app.render();
  app.key("Enter", { target: app.refs[0].current });
  assert.deepEqual(ran, ["b"]);
  assert.equal(app.props.mode, null);
});

test("Escape backs out, empty target lists are safe, focus and overlay guards remove global handling", async () => {
  const app = await palette();
  app.props.commands = [{ id: "rename-card", label: "Rename card", children: [] }];
  app.render(); app.key("r"); app.render();
  app.refs[0].current = {};
  app.key("ArrowDown"); app.key("Enter", { target: app.refs[0].current });
  assert.equal(app.props.mode, "commands");
  app.key("Escape"); assert.equal(app.render().props.title, "Commands");
  app.key("Escape"); assert.equal(app.props.mode, null);
  app.props.blocked = true; app.render();
  assert.equal(app.key("/").prevented, undefined);
  app.props.blocked = false; app.setFocused(false); app.render();
  assert.equal(app.listeners.size, 0);
});

test("change-board shortcut opens searchable selection and Enter selects a filtered board", async () => {
  const app = await palette();
  const selected = [];
  app.props.commands = navigation.createNavigationCommands({ projects: ["Work", "Personal"].map((name) => ({ id: name, name, workspace: { tasks: [], sections: [] } })), currentProjectId: "Work", openBoard: (id) => selected.push(id), navigate() {} });
  app.render(); app.key("B", { shiftKey: true });
  let tree = app.render();
  assert.equal(tree.props.title, "Change board");
  const children = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(children) : [node, ...children(node.props?.children)];
  children(tree).find((node) => node.type === "TextInput").props.onChangeText("personal");
  tree = app.render();
  app.refs[0].current = {};
  app.key("Enter", { target: app.refs[0].current });
  assert.deepEqual(selected, ["Personal"]);
  assert.equal(app.props.mode, null);
});

test("browser modifier combinations are never intercepted, even in the open palette", async () => {
  const app = await palette();
  const browserKeys = [
    ["P", { ctrlKey: true, shiftKey: true }], ["P", { metaKey: true, shiftKey: true }],
    ["k", { ctrlKey: true }], ["k", { metaKey: true }], ["j", { ctrlKey: true }],
    ["B", { ctrlKey: true, shiftKey: true }], [",", { metaKey: true }],
    ["ArrowLeft", { altKey: true }], ["ArrowRight", { altKey: true }],
    ["1", { altKey: true }], ["/", { ctrlKey: true }], ["?", { altKey: true }],
    ["ArrowDown", { ctrlKey: true }],
  ];
  for (const mode of [null, "commands", "help"]) {
    app.props.mode = mode; app.render();
    for (const [key, modifiers] of browserKeys) {
      assert.equal(logic.commandShortcut({ key, ...modifiers }, false), null);
      assert.equal(app.key(key, modifiers).prevented, undefined, `${key} stays browser-owned in ${mode}`);
      assert.equal(app.props.mode, mode);
    }
  }
});

test("slash opens commands and Shift slash opens help without stealing typed punctuation", async () => {
  const app = await palette(false);
  app.render();
  assert.equal(app.key("/", { target: { closest: () => ({}) } }).prevented, undefined);
  assert.equal(app.props.mode, null);
  assert.equal(app.key("/").prevented, true);
  assert.equal(app.props.mode, "commands");
  app.render(); app.key("Escape"); app.render();
  app.key("?", { shiftKey: true });
  assert.equal(app.props.mode, "help");
  assert.equal(app.render().props.title, "Keyboard shortcuts");
});
