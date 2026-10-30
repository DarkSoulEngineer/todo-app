import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(source, mocks = {}) {
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "exports", compiled)((id) => mocks[id] ?? require(id), exports);
  return exports;
}
const tactile = load(readFileSync(new URL("../src/components/ui/tactile.ts", import.meta.url), "utf8"));
const route = readFileSync(new URL("../app/board/[id].tsx", import.meta.url), "utf8");
const source = `
import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { format, parseISO } from "date-fns";
import { useTheme, deriveStatus, Ionicons, PriorityStars, StatusIcon, STATUS_LABELS } from "mocks";
import { tactileCardSurface } from "@/components/ui/tactile";
const styles = { groupTitle: {} };
export ${route.slice(route.indexOf("function ListView("), route.indexOf("function CalendarView("))}
`;
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];

test("Activity cards have theme-aware depth, pressed feedback and preserved selection and editing", () => {
  for (const scheme of ["light", "dark"]) for (const compact of [false, true]) for (const selected of [false, true]) {
    const colors = { primary: "accent", border: "border", primarySoft: "selected", card: "card" };
    const { ListView } = load(source, {
      react: { useMemo: (fn) => fn() },
      "react-native": { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { hairlineWidth: 0.5 } },
      "@/components/ui/tactile": tactile,
      mocks: { useTheme: () => ({ theme: { scheme, colors } }), deriveStatus: () => "upcoming", Ionicons: "Icon", PriorityStars: "Stars", StatusIcon: "Status", STATUS_LABELS: { upcoming: "Upcoming" } },
    });
    const task = { id: "card", title: "Task", priority: "medium", createdAt: "2026-10-30T12:00:00Z", updatedAt: "2026-10-30T12:00:00Z" };
    const opened = [];
    const tree = ListView({ tasks: [task], boards: [], now: new Date(), compact, selectedTaskId: selected ? task.id : undefined, onTask: (task) => opened.push(task.id) });
    const card = nodes(tree).find((node) => node.props?.accessibilityLabel === "Open Task");
    const style = (pressed) => Object.assign({}, ...card.props.style({ pressed }));
    const raised = style(false), pressed = style(true);
    assert.match(raised.boxShadow, /inset 0 1px 0/);
    assert.match(pressed.boxShadow, /inset 0 1px 3px/);
    assert.match(raised.boxShadow, scheme === "dark" ? /255,255,255,0.10/ : /255,255,255,0.90/);
    assert.equal(raised.borderColor, selected ? colors.primary : colors.border);
    assert.equal(raised.backgroundColor, colors.card, "selection keeps the neutral card background");
    for (const key of ["borderWidth", "padding", "paddingHorizontal", "paddingVertical", "marginBottom", "minHeight"]) assert.equal(raised[key], pressed[key]);
    assert.deepEqual(pressed.transform, [{ translateY: 1 }]);
    assert.equal(card.props.accessibilityState.selected, selected);
    card.props.onPress();
    assert.deepEqual(opened, [task.id]);
  }
});
