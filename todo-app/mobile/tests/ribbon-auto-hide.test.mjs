import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const context = {};
vm.runInNewContext(await compile("../src/lib/features/ribbon-context.ts"), { exports: context });
const source = await compile("../src/components/board/mobile-board-ribbon.tsx");
const sameDeps = (a, b) => a && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

function setup({ width = 400, fontScale = 1, preferences = { ribbonPinned: false } } = {}) {
  const slots = [];
  const timers = new Map();
  const notifications = [];
  let cursor = 0;
  let nextTimer = 0;
  let effects = [];
  const props = { mode: "board", query: "", zoom: 1, selecting: false, selection: "Selection tools", children: "Action tools", filters: "Filter tools" };
  props.onSelect = () => { props.selecting = true; };
  props.onDeselect = () => { props.selecting = false; };
  const react = {
    useImperativeHandle(ref, create) { if (ref) ref.current = create(); },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: effect() };
      });

      test("Notifications button opens a board-scoped right-side popup and shows unread count", () => {
        const app = setup();
        app.notifications.push({
          id: 1, projectId: "board", message: "Moved to In progress", description: "Task Alpha", tone: "success", read: false,
        });
        let tree = app.render();
        const notificationButton = button(tree, "Notifications, 1 unread");
        assert.ok(notificationButton);
        assert.ok(nodes(tree).some((node) => node.props?.testID === "board-notification-indicator"));
        notificationButton.props.onPress();
        tree = app.render();
        const panel = nodes(tree).find((node) => node.type === "NotificationPanel");
        assert.equal(panel.props.visible, true);
      });
    },
  };
  const colors = new Proxy({ primary: "#86b840", borderStrong: "#555555" }, { get: (target, key) => target[key] ?? "#888888" });
  const mocks = {
    react, "@expo/vector-icons": { Ionicons: "Icon", MaterialCommunityIcons: "Icon" },
     "react-native": { Platform: { OS: "web" }, Pressable: "Pressable", ScrollView: "ScrollView", View: "View", Text: "Text", TextInput: "TextInput", StyleSheet: { create: (styles) => styles }, useWindowDimensions: () => ({ width, fontScale }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0 }) },
    "./mobile-board-colors": { useMobileBoardColors: () => colors }, "@/lib/features/ribbon-context": context,
    "@/components/ui/sheet": { Sheet: "Sheet" },
    "@/components/ui/ribbon-scroll-view": { RibbonScrollView: "RibbonScrollView" },
    "@/providers/preferences-provider": { usePreferences: () => ({ ribbonPinned: preferences.ribbonPinned, setRibbonPinned: (pinned) => { preferences.ribbonPinned = pinned; } }) },
    "@/providers/toast-provider": { useToast: () => ({
      notifications,
    }) },
    "./notification-panel": { NotificationPanel: "NotificationPanel" },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: (id) => mocks[id] ?? require(id),
    setTimeout: (callback) => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    props, timers, notifications,
    render() { cursor = 0; effects = []; const tree = exports.MobileBoardRibbon(props); effects.forEach((effect) => effect()); return tree; },
    elapse() { const pending = [...timers.values()]; timers.clear(); pending.forEach((callback) => callback()); },
  };
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const button = (tree, label) => nodes(tree).find((node) => node.props?.accessibilityLabel === label);
const hasSelection = (tree) => JSON.stringify(tree).includes("Selection tools");

test("Insights uses the same tab and action heights as other workspace ribbons", () => {
  const flatten = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  for (const width of [390, 1024]) {
    const app = setup({ width });
    const board = app.render();
    app.props.mode = "insights";
    const insights = app.render();
    for (const label of ["Home tools", "Actions tools", "Filters tools", "Back to boards", "Pin ribbon open"]) {
      const normal = flatten(button(board, label).props.style);
      const insight = flatten(button(insights, label).props.style);
      assert.equal(insight.height ?? insight.minHeight, normal.height ?? normal.minHeight, label);
    }
  }
});

test("saved ribbon pin survives remounts and disables auto-hide until unpinned", () => {
  const preferences = { ribbonPinned: true };
  const app = setup({ preferences });
  let tree = app.render();
  assert.equal(button(tree, "Unpin ribbon").props.accessibilityState.checked, true);
  assert.equal(app.timers.size, 0);
  app.elapse();
  assert.ok(nodes(app.render()).some((node) => node.props?.accessibilityLabel === "Home ribbon tools"));
  button(tree, "Unpin ribbon").props.onPress();
  tree = app.render();
  assert.equal(preferences.ribbonPinned, false);
  assert.equal(app.timers.size, 1);
  const reopened = setup({ preferences });
  tree = reopened.render();
  assert.ok(button(tree, "Pin ribbon open"));
  assert.equal(reopened.timers.size, 1);
  button(tree, "Pin ribbon open").props.onPress();
  reopened.render();
  assert.equal(preferences.ribbonPinned, true);
  assert.equal(reopened.timers.size, 0);
  const restarted = setup({ preferences });
  assert.ok(button(restarted.render(), "Unpin ribbon"));
  assert.equal(restarted.timers.size, 0);
});

test("command controls reveal tabs, focus search, pin, and preserve selection expansion", () => {
  const app = setup();
  app.props.controlsRef = { current: null };
  app.render(); app.elapse(); app.render();
  app.props.controlsRef.current.openTab("filters");
  assert.ok(JSON.stringify(app.render()).includes("Filter tools"));
  app.props.controlsRef.current.focusSearch();
  let tree = app.render();
  assert.ok(nodes(tree).some((node) => node.type === "TextInput" && node.props.autoFocus));
  app.props.controlsRef.current.togglePin();
  tree = app.render();
  assert.equal(button(tree, "Unpin ribbon").props.accessibilityState.checked, true);
  assert.equal(app.timers.size, 0);
  app.props.controlsRef.current.openTab("select");
  assert.ok(hasSelection(app.render()));
  app.props.controlsRef.current.toggleExpanded();
  assert.ok(hasSelection(app.render()));
});

test("opening and reopening search requests focus; typing preserves the field", () => {
  const app = setup();
  let tree = app.render();
  const search = (tree) => nodes(tree).find((node) => node.type === "TextInput");
  assert.equal(search(tree), undefined);
  button(tree, "Search tasks").props.onPress();
  tree = app.render();
  assert.equal(search(tree).props.autoFocus, true);
  button(tree, "Search tasks").props.onPress();
  tree = app.render();
  assert.equal(search(tree), undefined);
  button(tree, "Search tasks").props.onPress();
  tree = app.render();
  assert.equal(search(tree).props.autoFocus, true);
  let focuses = 0;
  search(tree).props.ref.current = { focus: () => focuses++ };
  app.props.onQuery = (query) => { app.props.query = query; };
  app.props.onQuery("meeting");
  tree = app.render();
  assert.equal(search(tree).props.value, "meeting");
  assert.equal(focuses, 0, "typing does not repeatedly steal focus");
  button(tree, "Search tasks").props.onPress();
  assert.equal(focuses, 1, "a visible nonempty search is refocused instead of hidden");
  tree = app.render();
  button(tree, "Clear search").props.onPress();
  tree = app.render();
  assert.equal(focuses, 2);
  assert.equal(search(tree).props.value, "");
  assert.equal(search(tree).props.autoFocus, true);
});

test("ribbon search focus follows the theme around the whole control at a fixed size", () => {
  const app = setup();
  button(app.render(), "Search tasks").props.onPress();
  let tree = app.render();
  const input = (tree) => nodes(tree).find((node) => node.type === "TextInput");
  const surface = (tree) => nodes(tree).find((node) => Array.isArray(node.props?.children) && node.props.children.includes(input(tree)));
  const flatten = (style) => Object.assign({}, ...[style].flat().filter(Boolean));
  const original = flatten(surface(tree).props.style);
  assert.equal(original.borderColor, "#555555");
  assert.equal(flatten(input(tree).props.style).outlineWidth, 0);
  input(tree).props.onFocus();
  tree = app.render();
  const active = flatten(surface(tree).props.style);
  assert.equal(active.borderColor, "#86b840");
  for (const key of ["height", "borderWidth", "borderRadius"]) assert.equal(active[key], original[key]);
  assert.equal(active.height, 44);
  assert.equal(flatten(input(tree).props.style).height + active.borderWidth * 2, active.height);
  input(tree).props.onBlur();
  assert.equal(flatten(surface(app.render()).props.style).borderColor, "#555555");
});

test("mobile overflow menu names every available tab even with icon-only labels", () => {
  for (const width of [320, 390, 600]) for (const fontScale of [1, 1.5]) {
    const app = setup({ width, fontScale });
    app.props.hiddenSections = [{ id: "hidden", title: "Backlog", hidden: true }];
    let tree = app.render();
    button(tree, "More ribbon tabs").props.onPress();
    tree = app.render();
    assert.equal(nodes(tree).find((node) => node.type === "Sheet").props.visible, true);
    assert.equal(app.timers.size, 0, "reading the menu pauses ribbon auto-hide");
    const options = nodes(tree).filter((node) => node.props?.accessibilityLabel?.endsWith("ribbon tab"));
    assert.deepEqual(options.map((node) => node.props.accessibilityLabel), ["Show Home ribbon tab", "Show Actions ribbon tab", "Show Filters ribbon tab", "Show Select ribbon tab", "Show Hidden ribbon tab"]);
    button(tree, "Show Hidden ribbon tab").props.onPress();
    tree = app.render();
    assert.equal(nodes(tree).find((node) => node.type === "Sheet").props.visible, false);
    assert.ok(button(tree, "Show Backlog"));
    assert.equal(app.timers.size, 1);
    button(tree, "More ribbon tabs").props.onPress();
    tree = app.render();
    button(tree, "Show Select ribbon tab").props.onPress();
    tree = app.render();
    assert.equal(app.props.selecting, true);
    assert.equal(hasSelection(tree), true);
  }
});

test("overflow menu respects the current view and desktop keeps its full ribbon", () => {
  const desktop = setup({ width: 1024 });
  assert.equal(button(desktop.render(), "More ribbon tabs"), undefined);
  const app = setup();
  app.props.mode = "insights";
  let tree = app.render();
  button(tree, "More ribbon tabs").props.onPress();
  tree = app.render();
  assert.ok(button(tree, "Show Home ribbon tab"));
  assert.ok(button(tree, "Show Actions ribbon tab"));
  assert.ok(button(tree, "Show Filters ribbon tab"));
  assert.equal(button(tree, "Show Select ribbon tab"), undefined);
  assert.equal(button(tree, "Show Hidden ribbon tab"), undefined);
});

test("Select cancels pending auto-hide and stays open during inactivity and interaction", () => {
  const app = setup();
  let tree = app.render();
  assert.equal(app.timers.size, 1);
  button(tree, "Select tasks").props.onPress();
  tree = app.render();
  assert.equal(app.timers.size, 0);
  assert.equal(hasSelection(tree), true);
  tree.props.onPointerDown();
  assert.equal(app.timers.size, 0);
  app.elapse();
  tree = app.render();
  assert.equal(hasSelection(tree), true);
  assert.equal(button(tree, "Pin ribbon open").props.accessibilityState.checked, false);
});

test("leaving Select resumes normal auto-hide", () => {
  const app = setup();
  let tree = app.render();
  button(tree, "Select tasks").props.onPress();
  tree = app.render();
  button(tree, "Actions tools").props.onPress();
  tree = app.render();
  assert.equal(app.timers.size, 1);
  assert.equal(JSON.stringify(tree).includes("Action tools"), true);
  app.elapse();
  tree = app.render();
  assert.equal(JSON.stringify(tree).includes("Action tools"), false);
});

test("filter menus and date pickers pause ribbon auto-hide until dismissed", () => {
  const app = setup();
  let tree = app.render();
  button(tree, "Filters tools").props.onPress();
  app.props.toolsOverlayOpen = true;
  app.render();
  assert.equal(app.timers.size, 0);
  app.elapse();
  assert.ok(JSON.stringify(app.render()).includes("Filter tools"));
  app.props.toolsOverlayOpen = false;
  tree = app.render();
  assert.equal(app.timers.size, 1);
  app.elapse();
  tree = app.render();
  assert.equal(JSON.stringify(tree).includes("Filter tools"), false);
});

test("Insights desktop ribbon keeps compact spacing without shrinking its height", () => {
  const flatten = (style) => Object.assign({}, ...[style].flat().filter(Boolean));
  for (const [width, mode, height] of [[1024, "insights", 44], [390, "insights", 44], [1024, "board", 44]]) {
    const app = setup({ width });
    app.props.mode = mode;
    const tree = app.render();
    assert.equal(flatten(button(tree, "Home tools").props.style).minHeight, height);
    assert.equal(flatten(button(tree, "Back to boards").props.style).height, height);
    assert.equal(flatten(button(tree, "Pin ribbon open").props.style).height, height);
  }
});

test("selection forces an already collapsed ribbon open", () => {
  const app = setup();
  app.render(); app.elapse(); app.render();
  app.props.selecting = true;
  const tree = app.render();
  assert.equal(hasSelection(tree), true);
  assert.equal(app.timers.size, 0);
});

test("manual pinning still keeps the ribbon open after selection ends", () => {
  const app = setup();
  let tree = app.render();
  button(tree, "Select tasks").props.onPress();
  tree = app.render();
  button(tree, "Pin ribbon open").props.onPress();
  tree = app.render();
  button(tree, "Actions tools").props.onPress();
  tree = app.render();
  assert.equal(app.timers.size, 0);
  assert.equal(button(tree, "Unpin ribbon").props.accessibilityState.checked, true);
  app.elapse();
  assert.equal(JSON.stringify(app.render()).includes("Action tools"), true);
});

test("Hidden tab keeps its dot while collapsed and restores lists from the ribbon", () => {
  const app = setup();
  app.props.hiddenSections = [{ id: "a", title: "Backlog", hidden: true }, { id: "b", title: "Planning", hidden: true }];
  const restored = [];
  app.props.onShowSection = (section) => {
    restored.push(section.id);
    app.props.hiddenSections = app.props.hiddenSections.filter((item) => item.id !== section.id);
  };
  const dot = (tree) => nodes(tree).find((node) => node.props?.testID === "board-hidden-indicator");
  let tree = app.render();
  assert.ok(dot(tree));
  assert.equal(button(tree, "Show Backlog"), undefined, "restore controls belong only to the Hidden tab");
  app.elapse();
  tree = app.render();
  assert.ok(dot(tree), "collapsed ribbons must still advertise hidden lists");
  button(tree, "Hidden tools, 2 hidden lists").props.onPress();
  tree = app.render();
  assert.equal(button(tree, "Hidden tools, 2 hidden lists").props["aria-selected"], true);
  button(tree, "Show Backlog").props.onPress();
  tree = app.render();
  assert.deepEqual(restored, ["a"]);
  assert.ok(dot(tree));
  assert.ok(button(tree, "Hidden tools, 1 hidden list"));
  assert.equal(button(tree, "Show Backlog"), undefined);
  button(tree, "Show Planning").props.onPress();
  tree = app.render();
  assert.deepEqual(restored, ["a", "b"]);
  assert.equal(dot(tree), undefined);
  assert.equal(button(tree, "Hidden tools"), undefined);
  assert.equal(button(tree, "Home tools").props["aria-selected"], true);
  assert.ok(!JSON.stringify(tree).includes("HIDDEN LISTS"));
});

test("each ribbon tab mounts its own lane so horizontal scroll restarts at the first item", () => {
  const app = setup();
  const lane = (tree) => nodes(tree).find((node) => node.props?.testID === "ribbon-tab-body");
  let tree = app.render();
  assert.equal(lane(tree).key, "home");
  button(tree, "Actions tools").props.onPress();
  tree = app.render();
  assert.equal(lane(tree).key, "actions");
  assert.equal(JSON.stringify(lane(tree)).includes("Action tools"), true);
  button(tree, "Filters tools").props.onPress();
  tree = app.render();
  assert.equal(lane(tree).key, "filters");
  assert.equal(JSON.stringify(lane(tree)).includes("Filter tools"), true);
  button(tree, "Select tasks").props.onPress();
  tree = app.render();
  assert.equal(lane(tree).key, "select");
  assert.equal(hasSelection(lane(tree)), true);
});

test("Hidden tab exists only for hidden lists and sits after Select", () => {
  const app = setup();
  const tabs = (tree) => nodes(tree).filter((node) => node.props?.accessibilityRole === "tab").map((node) => node.props.accessibilityLabel);
  assert.deepEqual(tabs(app.render()), ["Home tools", "Actions tools", "Filters tools", "Select tasks"]);
  app.props.hiddenSections = [{ id: "a", title: "Backlog", hidden: true }];
  let tree = app.render();
  assert.deepEqual(tabs(tree), ["Home tools", "Actions tools", "Filters tools", "Select tasks", "Hidden tools, 1 hidden list"]);
  button(tree, "Hidden tools, 1 hidden list").props.onPress();
  tree = app.render();
  app.props.hiddenSections = [];
  tree = app.render();
  assert.equal(button(tree, "Hidden tools"), undefined);
  assert.equal(button(tree, "Home tools").props["aria-selected"], true);
  assert.equal(button(tree, "Show Backlog"), undefined);
});

test("Hidden indication is independent of Filters and disappears outside Board view", () => {
  const app = setup();
  app.props.filtersActive = true;
  app.props.hiddenSections = [{ id: "a", title: "Backlog", hidden: true }];
  let tree = app.render();
  assert.ok(nodes(tree).some((node) => node.props?.testID === "board-filter-indicator"));
  assert.ok(nodes(tree).some((node) => node.props?.testID === "board-hidden-indicator"));
  button(tree, "Hidden tools, 1 hidden list").props.onPress();
  tree = app.render();
  app.props.mode = "calendar";
  tree = app.render();
  assert.equal(button(tree, "Hidden tools, 1 hidden list"), undefined);
  assert.equal(button(tree, "Show Backlog"), undefined);
  assert.ok(nodes(tree).some((node) => node.props?.testID === "board-filter-indicator"));
  app.props.mode = "board";
  app.props.hiddenSections = [];
  tree = app.render();
  assert.ok(nodes(tree).some((node) => node.props?.testID === "board-filter-indicator"));
  assert.ok(!nodes(tree).some((node) => node.props?.testID === "board-hidden-indicator"));
});
