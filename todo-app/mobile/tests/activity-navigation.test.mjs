import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/board/mobile-board-bottom-nav.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const mocks = {
  "react-native": { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (value) => value } },
  "@expo/vector-icons": { Ionicons: "Icon" },
  "@/components/ui/bottom-nav-island": { BottomNavIsland: "Island" },
  "../reference/reference-theme": { useReferenceTheme: () => ({ colors: {}, type: {} }) },
};
const exports = {};
vm.runInNewContext(outputText, { exports, require: (id) => mocks[id] ?? require(id) });

test("Activity is hidden only for empty boards; remaining tabs still navigate", () => {
  for (const hasTasks of [false, true]) {
    const pressed = [];
    const tree = exports.MobileBoardBottomNav({ mode: "board", hasTasks, onMode: (mode) => pressed.push(mode) });
    assert.equal(tree.props.tabCount, hasTasks ? 4 : 3);
    const tabs = tree.props.children.props.children;
    assert.deepEqual(Array.from(tabs, (tab) => tab.props.accessibilityLabel), hasTasks
      ? ["Board view", "Activity view", "Calendar view", "Insights view"]
      : ["Board view", "Calendar view", "Insights view"]);
    tabs.forEach((tab) => tab.props.onPress());
    assert.deepEqual(pressed, hasTasks ? ["board", "list", "calendar", "insights"] : ["board", "calendar", "insights"]);
  }
});
