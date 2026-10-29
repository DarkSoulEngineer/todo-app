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

/** Renders the function components returned by the mocked JSX runtime. */
function render(node) {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(render);
  if (typeof node.type === "function") return render(node.type(node.props));
  return { ...node, props: { ...node.props, children: render(node.props?.children) } };
}

const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const text = (node) => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : "";

let hovered = false;
const themeState = { scheme: "dark", colors: { foreground: "#f5f5f5", background: "#101010" } };
const react = { useState: () => [hovered, (next) => { hovered = typeof next === "function" ? next(hovered) : next; }] };
const reactNative = { View: "View", Text: "Text", StyleSheet: { create: (value) => value } };
const svg = { __esModule: true, default: "Svg", Path: "Path", Circle: "Circle", Line: "Line" };
const constants = await load("../src/lib/domain/constants.ts");
const provider = { useTheme: () => ({ theme: themeState }) };
const hover = await load("../src/components/ui/hover-label.tsx", {
  react,
  "react-native": reactNative,
  "@/providers/theme-provider": provider,
});
const { PriorityStars } = await load("../src/components/ui/priority-stars.tsx", {
  react,
  "react-native": reactNative,
  "react-native-svg": svg,
  "@/components/ui/hover-label": hover,
  "@/lib/domain/constants": constants,
  "@/providers/theme-provider": provider,
});

test("priority renders as an attribution scale of stars", () => {
  for (const [priority, count, size] of [["low", 1, 13], ["medium", 2, 13], ["high", 3, 13], ["critical", 1, 19.5]]) {
    hovered = false;
    const tree = render(PriorityStars({ priority }));
    const glyphs = nodes(tree).filter((node) => node.type === "Svg");
    assert.equal(glyphs.length, count, `${priority} shows ${count} star(s)`);
    for (const glyph of glyphs) {
      assert.equal(glyph.props.width, size);
      assert.equal(glyph.props.height, size);
      const star = Array.isArray(glyph.props.children) ? glyph.props.children[0] : glyph.props.children;
      assert.equal(star.type, "Path");
      assert.equal(star.props.fill, constants.PRIORITY_META[priority].dot, "only the star is tinted");
    }
  }
});

test("priority stars are icon-only until the pointer hovers them", () => {
  hovered = false;
  let tree = render(PriorityStars({ priority: "high" }));
  assert.equal(tree.props.accessibilityLabel, "High priority", "screen readers still get the grade");
  assert.equal(text(tree), "", "no text grade is rendered by default");

  tree.props.onPointerEnter();
  tree = render(PriorityStars({ priority: "high" }));
  assert.ok(text(tree).includes("High priority"), "hover reveals the readable grade");

  tree.props.onPointerLeave();
  tree = render(PriorityStars({ priority: "high" }));
  assert.equal(text(tree), "");
});

test("critical gets its own single larger star", () => {
  hovered = false;
  const tree = render(PriorityStars({ priority: "critical" }));
  const stars = nodes(tree).filter((node) => node.type === "Svg");
  assert.equal(stars.length, 1);
  assert.equal(stars[0].props.width, 19.5);
  assert.equal(tree.props.accessibilityLabel, "Critical priority");
});

test("light themes use the readable ink tone for the stars", () => {
  try {
    themeState.scheme = "light";
    const tree = render(PriorityStars({ priority: "medium" }));
    const glyph = nodes(tree).find((node) => node.type === "Svg");
    const star = Array.isArray(glyph.props.children) ? glyph.props.children[0] : glyph.props.children;
    assert.equal(star.props.fill, constants.PRIORITY_META.medium.ink);
  } finally {
    themeState.scheme = "dark";
  }
});
