import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/board/board-switch-indicator.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const exports = {};
const scrolls = [];
const mocks = {
  react: { useRef: () => ({ current: { scrollTo: (value) => scrolls.push(value.x) } }), useEffect: (fn) => fn(), useCallback: (fn) => fn },
  "react-native": { View: "View", Pressable: "Pressable", ScrollView: "ScrollView", StyleSheet: { create: (value) => value } },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: { primary: "#00FF41", borderStrong: "#258C45" } } }) },
};
vm.runInNewContext(outputText, { exports, require: (id) => mocks[id] ?? require(id) });
const { BoardSwitchIndicator } = exports;

test("single boards need no switch indicator", () => {
  assert.equal(BoardSwitchIndicator({ boards: [{ id: "a", name: "A" }], activeId: "a" }), null);
  assert.equal(BoardSwitchIndicator({ boards: [], activeId: "missing" }), null);
});

test("current board has a longer themed marker; other markers switch boards", () => {
  const calls = [];
  const tree = BoardSwitchIndicator({ boards: [{ id: "a", name: "Work" }, { id: "b", name: "Personal" }], activeId: "a", onSwitch: (id) => calls.push(id) });
  const tabs = tree.props.children.props.children;
  assert.equal(tabs[0].props.accessibilityState.selected, true);
  assert.equal(tabs[0].props.children.props.style[1].width, 28);
  assert.equal(tabs[0].props.children.props.style[1].backgroundColor, "#00FF41");
  assert.equal(tabs[1].props.children.props.style[1].width, 20);
  assert.equal(tabs[1].props.accessibilityLabel, "Personal, board 2 of 2");
  tabs[0].props.onPress(); tabs[1].props.onPress();
  assert.deepEqual(calls, ["b"]);
});

test("long board lists scroll to keep the current board visible", () => {
  const boards = Array.from({ length: 20 }, (_, id) => ({ id: `${id}`, name: `Board ${id}` }));
  BoardSwitchIndicator({ boards, activeId: "19", onSwitch() {} });
  assert.equal(scrolls.at(-1), 19 * 36 - 126);
});
