import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/ui/bottom-sheet-modal.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function harness(platform = "ios", initiallyVisible = true) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let closes = 0;
  let keyboardDismissals = 0;
  const animations = [];
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    stopAnimation() {}
  }
  const animation = (kind, value, config) => ({ start(callback) { animations.push({ kind, ...config }); value.setValue(config.toValue); callback?.({ finished: true }); } });
  const mocks = {
    react: {
      useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (value) => { slots[index] = value; }]; },
      useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
      useCallback: (fn) => fn,
      useMemo: (fn) => fn(),
      useEffect(fn, deps) { const index = cursor++; const previous = slots[index]; if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); },
    },
    "react-native": {
      Animated: { Value, View: "AnimatedView", add: (a, b) => ({ a, b }), timing: (value, config) => animation("timing", value, config), spring: (value, config) => animation("spring", value, config), parallel: (items) => ({ start(callback) { items.forEach((item) => item.start()); callback?.({ finished: true }); } }) },
      Easing: { cubic: "cubic", in: () => "in", out: () => "out" },
      Keyboard: { dismiss: () => keyboardDismissals++ },
      PanResponder: { create: (handlers) => ({ panHandlers: handlers }) },
      KeyboardAvoidingView: "KeyboardAvoidingView", Modal: "Modal", View: "View", Pressable: "Pressable",
      Platform: { OS: platform }, StyleSheet: { create: (v) => v, absoluteFill: {} }, useWindowDimensions: () => ({ height: 844 }),
    },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 24 }) },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {}, radius: { xl: 24 } } }) },
    "@/theme/layout": { mobileModalMaxWidth: 600 },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (id) => id === "react/jsx-runtime" ? require(id) : mocks[id] });
  const props = { visible: initiallyVisible, onClose: () => closes++, children: { type: "ScrollView", props: {} } };
  const render = (visible = true) => { cursor = 0; effects = []; const tree = exports.BottomSheetModal({ ...props, visible }); effects.forEach((fn) => fn()); return tree; };
  let tree = render(initiallyVisible);
  const handle = () => nodes(tree).find((node) => node.props?.testID === "bottom-sheet-drag-handle");
  const offset = () => nodes(tree).find((node) => node.props?.testID === "bottom-sheet-surface").props.style.at(-1).transform[0].translateY.b.value;
  const gesture = (overrides) => ({ dx: 0, dy: 80, vy: 0, numberActiveTouches: 1, ...overrides });
  return { get tree() { return tree; }, handle, offset, gesture, animations, get closes() { return closes; }, get keyboardDismissals() { return keyboardDismissals; }, render(visible) { tree = render(visible); return tree; } };
}

test("only downward one-finger drags on the handle claim the gesture", () => {
  const h = harness();
  const claim = (overrides) => h.handle().props.onMoveShouldSetPanResponderCapture({}, h.gesture(overrides));
  assert.equal(h.handle().props.onStartShouldSetPanResponder(), false);
  for (const gesture of [{ dy: 3 }, { dy: -90 }, { dx: 100 }, { numberActiveTouches: 2 }]) assert.equal(claim(gesture), false);
  assert.equal(claim({ dy: 30 }), true);
  const surface = nodes(h.tree).find((node) => node.props?.testID === "bottom-sheet-surface");
  assert.equal(surface.props.onMoveShouldSetPanResponderCapture, undefined, "content scrolling and form controls are not hijacked");
  h.render(false);
  assert.equal(claim({ dy: 100 }), false);
});

test("short pulls track the finger then snap back, while long pulls close once", () => {
  for (const platform of ["ios", "android", "web"]) {
    const h = harness(platform);
    const handlers = h.handle().props;
    handlers.onPanResponderGrant();
    handlers.onPanResponderMove({}, h.gesture({ dy: 40 }));
    assert.equal(h.offset(), 40);
    handlers.onPanResponderRelease({}, h.gesture({ dy: 40 }));
    assert.equal(h.offset(), 0);
    assert.equal(h.closes, 0);
    assert.equal(h.animations.at(-1).kind, "spring");
    assert.equal(h.animations.at(-1).useNativeDriver, platform !== "web");
    handlers.onPanResponderMove({}, h.gesture({ dy: -10 }));
    assert.equal(h.offset(), 0);
    handlers.onPanResponderMove({}, h.gesture({ dy: 120 }));
    handlers.onPanResponderRelease({}, h.gesture({ dy: 120 }));
    h.tree.props.onRequestClose();
    assert.equal(h.closes, 1, "swipe and native Back must not request duplicate closes");
    assert.ok(h.keyboardDismissals >= 1);
    h.render(false);
    h.render(true);
    h.render(true); // The rendered state mounts the reopened sheet on the next render.
    assert.equal(h.offset(), 0, "reopening resets the dragged position");
    nodes(h.tree).find((node) => node.props?.accessibilityLabel === "Close sheet").props.onPress();
    assert.equal(h.closes, 2, "the handle can be activated accessibly after reopening");
  }
});

test("quick downward flicks dismiss; canceled drags and upward flicks do not", () => {
  const h = harness();
  h.handle().props.onPanResponderRelease({}, h.gesture({ dy: 30, vy: -2 }));
  assert.equal(h.closes, 0);
  h.handle().props.onPanResponderMove({}, h.gesture({ dy: 60 }));
  h.handle().props.onPanResponderTerminate();
  assert.equal(h.offset(), 0);
  assert.equal(h.closes, 0);
  h.handle().props.onPanResponderRelease({}, h.gesture({ dy: 30, vy: 1.2 }));
  assert.equal(h.closes, 1);
});

test("short sheets use a proportional threshold and hidden sheets ignore dismissals", () => {
  const h = harness();
  nodes(h.tree).find((node) => node.props?.testID === "bottom-sheet-surface").props.onLayout({ nativeEvent: { layout: { height: 200 } } });
  h.handle().props.onPanResponderRelease({}, h.gesture({ dy: 55 }));
  assert.equal(h.closes, 1);
  const hidden = harness("android", false);
  hidden.tree.props.onRequestClose();
  assert.equal(hidden.closes, 0);
});
