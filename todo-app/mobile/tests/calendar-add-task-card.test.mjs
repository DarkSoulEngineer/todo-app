import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/calendar/calendar-day-tasks.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];

test("calendar creation uses a trailing dashed grid card on empty and populated days", () => {
  for (const count of [0, 2, 8]) {
    let width = 0, additions = 0;
    const exports = {};
    const mocks = {
      react: { useState: () => [width, (next) => { width = next; }] },
      "react-native": { Pressable: "Pressable", Text: "Text", View: "View", StyleSheet: { create: (styles) => styles } },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: { borderStrong: "border", mutedForeground: "muted", primarySoft: "pressed" } } }) },
    };
    vm.runInNewContext(compiled, { exports, require: (id) => mocks[id] ?? (id.startsWith("@/") ? {} : require(id)) });
    const props = { day: new Date(2026, 9, 29), tasks: Array.from({ length: count }, (_, id) => ({ id, completed: false })), boards: [], onAddTask: () => additions++ };
    const render = () => exports.CalendarDayTasks(props);
    let tree = render();
    const grid = nodes(tree).find((node) => node.props?.testID === "calendar-day-task-grid");
    assert.equal(nodes(tree).some((node) => node.type === "Text" && node.props.children === "Add task"), false);
    for (const [measuredWidth, expectedWidth] of [[500, "50%"], [900, `${100 / 3}%`]]) {
      grid.props.onLayout({ nativeEvent: { layout: { width: measuredWidth } } });
      tree = render();
      const currentGrid = nodes(tree).find((node) => node.props?.testID === "calendar-day-task-grid");
      const cells = currentGrid.props.children.flat();
      assert.equal(cells.length, count + 1);
      assert.equal(cells.at(-1).props.style[1].width, expectedWidth);
      const card = cells.at(-1).props.children;
      assert.equal(card.props.testID, "calendar-add-task-card");
      assert.equal(card.props.accessibilityLabel, "Add task for October 29");
      const style = Object.assign({}, ...card.props.style({ pressed: false }));
      assert.equal(style.borderStyle, "dashed");
      assert.equal(style.backgroundColor, "transparent");
      assert.equal(card.props.children.props.children, "Add new task");
      card.props.onPress();
    }
    assert.equal(additions, 2);
  }
});
