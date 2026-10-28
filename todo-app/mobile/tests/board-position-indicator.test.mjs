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
  vm.runInNewContext(outputText, { exports, require: (id) => id === "react/jsx-runtime" ? require(id) : mocks[id] });
  return exports;
}
const { getBoardScrollPosition } = await load("../src/lib/features/board-scroll-position.ts");
const columns = [{ id: "a", title: "Todo" }, { id: "b", title: "Doing" }, { id: "c", title: "Done" }];
const position = (offset, viewport = 390, content = 1202) => getBoardScrollPosition(columns, 298, viewport, content, offset);

test("markers and directional hints reflect the actual start, middle and end", () => {
  const start = position(0);
  assert.equal(start.activeIndex, 0);
  assert.equal(start.canLeft, false);
  assert.equal(start.canRight, true);
  const middle = position(298);
  assert.equal(middle.activeIndex, 1);
  assert.equal(middle.canLeft, true);
  assert.equal(middle.canRight, true);
  const end = position(812);
  assert.equal(end.activeIndex, end.stops.length - 1);
  assert.equal(end.canLeft, true);
  assert.equal(end.canRight, false);
  assert.equal(end.stops.at(-1).title, "Add list");
  assert.equal(position(9999).canRight, false);
  assert.equal(position(-20).canLeft, false);
});

test("fitting columns need no indicator; resize and duplicate endpoints stay accurate", () => {
  assert.equal(position(0, 1400).stops.length, 0);
  assert.equal(position(0, 0).stops.length, 0);
  const narrowOverflow = position(0, 1100);
  assert.deepEqual(Array.from(narrowOverflow.stops, (stop) => stop.offset), [0, 102]);
  assert.equal(narrowOverflow.stops.at(-1).title, "Add list");
});

const native = { View: "View", Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", StyleSheet: { create: (value) => value } };
test("indicator highlights the current column position and scrolls in both directions", async () => {
  const calls = [];
  const { BoardPositionIndicator } = await load("../src/components/board/board-position-indicator.tsx", {
    react: { useRef: () => ({ current: { scrollTo() {} } }), useEffect: (fn) => fn(), useCallback: (fn) => fn },
    "react-native": native,
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: { primary: "#00FF41", borderStrong: "#258C45" } } }) },
  });
  assert.equal(BoardPositionIndicator({ ...position(0, 1400), onPosition() {} }), null);
  const tree = BoardPositionIndicator({ ...position(298), onPosition: (offset) => calls.push(offset) });
  const [left, rail, right] = tree.props.children;
  assert.equal(left.props.disabled, false);
  assert.equal(right.props.disabled, false);
  assert.equal(rail.props.children[1].props.accessibilityState.selected, true);
  assert.equal(rail.props.children[1].props.children.props.style[1].backgroundColor, "#00FF41");
  left.props.onPress(); right.props.onPress(); rail.props.children.at(-1).props.onPress();
  assert.deepEqual(calls, [0, 596, 812]);
});

test("carousel forwards real scroll metrics without replacing its card children", async () => {
  let value = { viewport: 0, content: 0, offset: 0 };
  const scrolls = [];
  const { BoardColumnCarousel } = await load("../src/components/board/board-column-carousel.tsx", {
    react: { useState: () => [value, (update) => { value = update(value); }] },
    "react-native": native,
    "@/lib/features/board-scroll-position": { getBoardScrollPosition },
    "./board-position-indicator": { BoardPositionIndicator: "Indicator" },
  });
  const cards = { type: "Cards", props: {} };
  const props = { columns, interval: 298, children: cards, carouselRef: { current: { scrollTo: (offset) => scrolls.push(offset.x) } }, onContentSizeChange() {}, onScroll() {} };
  const render = () => BoardColumnCarousel(props);
  let tree = render();
  let carousel = tree.props.children[1];
  carousel.props.onLayout({ nativeEvent: { layout: { width: 390 } } });
  carousel.props.onContentSizeChange(1202, 500);
  carousel.props.onScroll({ nativeEvent: { contentOffset: { x: 298 } } });
  tree = render();
  assert.equal(tree.props.children[0].props.activeIndex, 1);
  assert.equal(tree.props.children[0].props.canLeft, true);
  assert.equal(tree.props.children[0].props.canRight, true);
  assert.equal(tree.props.children[1].props.children, cards);
  tree.props.children[0].props.onPosition(596);
  assert.deepEqual(scrolls, [596]);
  carousel = tree.props.children[1];
  carousel.props.onScroll({ nativeEvent: { contentOffset: { x: 812 } } });
  tree = render();
  assert.equal(tree.props.children[0].props.activeIndex, 3);
  assert.equal(tree.props.children[0].props.canRight, false);
  carousel.props.onLayout({ nativeEvent: { layout: { width: 1400 } } });
  assert.equal(render().props.children[0].props.stops.length, 0);
});
