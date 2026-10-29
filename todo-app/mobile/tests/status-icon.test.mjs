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
  vm.runInNewContext(outputText, { exports, require: (id) => mocks[id] ?? (id === "react/jsx-runtime" ? require(id) : undefined) });
  return exports;
}

function render(node) {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(render);
  if (typeof node.type === "function") return render(node.type(node.props));
  return { ...node, props: { ...node.props, children: render(node.props?.children) } };
}

const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const text = (node) => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : "";

let hovered = false;
const themeState = {
  scheme: "dark",
  colors: { foreground: "#f5f5f5", background: "#101010", success: "#22c55e", mutedForeground: "#94a3b8", destructive: "#ef4444" },
};
const react = { useState: () => [hovered, (next) => { hovered = typeof next === "function" ? next(hovered) : next; }] };
const reactNative = { View: "View", Text: "Text", StyleSheet: { create: (value) => value } };
const svg = { __esModule: true, default: "Svg", Path: "Path", Circle: "Circle", Line: "Line" };
const provider = { useTheme: () => ({ theme: themeState }) };
const hover = await load("../src/components/ui/hover-label.tsx", {
  react,
  "react-native": reactNative,
  "@/providers/theme-provider": provider,
});
const { StatusIcon } = await load("../src/components/ui/status-icon.tsx", {
  react,
  "react-native": reactNative,
  "react-native-svg": svg,
  "@/components/ui/hover-label": hover,
  "@/providers/theme-provider": provider,
});

const shapes = (tree) => nodes(tree).filter((node) => ["Svg", "Path", "Circle", "Line"].includes(node.type));

test("each status becomes a single icon-only glyph", () => {
  const expected = {
    completed: { type: "Path", color: themeState.colors.success },
    canceled: { type: "Circle", color: themeState.colors.mutedForeground },
    overdue: { type: "Line", color: themeState.colors.destructive },
  };
  for (const [status, spec] of Object.entries(expected)) {
    hovered = false;
    const tree = render(StatusIcon({ status }));
    assert.equal(nodes(tree).filter((node) => node.type === "Svg").length, 1, `${status} renders one glyph`);
    const glyph = shapes(tree).find((node) => node.type === spec.type);
    assert.ok(glyph, `${status} uses the ${spec.type} shape`);
    assert.equal(glyph.props.stroke ?? glyph.props.fill, spec.color);
    assert.equal(text(tree), "", `${status} has no text or pill`);
    assert.equal(tree.props.accessibilityLabel, { completed: "Done", canceled: "Canceled", overdue: "Overdue" }[status]);
  }
});

test("upcoming tasks have no status glyph", () => {
  assert.equal(StatusIcon({ status: "upcoming" }), null);
  assert.equal(StatusIcon({ status: null }), null);
});

test("hover reveals the readable status label", () => {
  hovered = false;
  let tree = render(StatusIcon({ status: "canceled" }));
  assert.equal(text(tree), "");
  tree.props.onPointerEnter();
  tree = render(StatusIcon({ status: "canceled" }));
  assert.ok(text(tree).includes("Canceled"));
  tree.props.onPointerLeave();
  tree = render(StatusIcon({ status: "canceled" }));
  assert.equal(text(tree), "");
});

test("overdue detail enriches both the hover and accessibility labels", () => {
  hovered = false;
  let tree = render(StatusIcon({ status: "overdue", detail: "Overdue by 6d" }));
  assert.equal(tree.props.accessibilityLabel, "Overdue by 6d");
  tree.props.onPointerEnter();
  tree = render(StatusIcon({ status: "overdue", detail: "Overdue by 6d" }));
  assert.ok(text(tree).includes("Overdue by 6d"));
  assert.equal(text(tree).includes("Overdue"), true);
});

test("glyphs scale with card zoom", () => {
  const tree = render(StatusIcon({ status: "completed", size: 13, zoom: 1.5 }));
  const glyph = nodes(tree).find((node) => node.type === "Svg");
  assert.equal(glyph.props.width, 19.5);
  assert.equal(glyph.props.height, 19.5);
});
