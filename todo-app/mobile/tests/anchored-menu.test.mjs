import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/ui/anchored-menu.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });

let width = 1200;
const platform = { OS: "web", isPad: false };
const mocks = {
  react: { useState: (initial) => [initial, () => {}] },
  "react-native": {
    Modal: "Modal",
    Platform: platform,
    Pressable: "Pressable",
    ScrollView: "ScrollView",
    StyleSheet: { create: (value) => value, absoluteFill: {}, hairlineWidth: 0.5 },
    Text: "Text",
    View: "View",
    useWindowDimensions: () => ({ width, height: 900 }),
  },
  "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: {} } }) },
  "@expo/vector-icons": { Ionicons: "Icon" },
};
const exports = {};
vm.runInNewContext(outputText, { exports, require: (id) => id === "react/jsx-runtime" ? require(id) : mocks[id] });

test("anchorFromEvent keeps the page-space press point", () => {
  assert.deepEqual({ ...exports.anchorFromEvent({ nativeEvent: { pageX: 210, pageY: 96 } }) }, { x: 210, y: 96 });
});

test("anchored menus are limited to iPad and wide web layouts, never Android phones or tablets", () => {
  width = 1200;
  platform.OS = "web";
  assert.equal(exports.useAnchoredMenus(), true);
  width = 390;
  assert.equal(exports.useAnchoredMenus(), false);

  width = 1024;
  platform.OS = "android";
  assert.equal(exports.useAnchoredMenus(), false);

  platform.OS = "ios";
  platform.isPad = true;
  assert.equal(exports.useAnchoredMenus(), true);
  platform.isPad = false;
  assert.equal(exports.useAnchoredMenus(), false);
  assert.equal(width, 1024);
});

test("menu cards open below the press point when they fit", () => {
  const position = exports.resolveMenuPosition({
    anchor: { x: 100, y: 100 },
    menuWidth: 240,
    menuHeight: 200,
    windowWidth: 1000,
    windowHeight: 800,
  });
  assert.deepEqual({ ...position }, { left: 86, top: 108, width: 240, height: 200 });
});

test("menu cards flip above the press point near the bottom edge", () => {
  const position = exports.resolveMenuPosition({
    anchor: { x: 900, y: 700 },
    menuWidth: 240,
    menuHeight: 200,
    windowWidth: 1000,
    windowHeight: 800,
  });
  assert.equal(position.top, 492);
  assert.equal(position.left, 748);
});

test("menu cards stay inside safe-area edges and shrink to the available height", () => {
  const topLeft = exports.resolveMenuPosition({
    anchor: { x: 2, y: 2 },
    menuWidth: 240,
    menuHeight: 200,
    windowWidth: 1000,
    windowHeight: 800,
    insetTop: 20,
    insetBottom: 20,
  });
  assert.equal(topLeft.left, 12);
  assert.equal(topLeft.top, 32);

  const tight = exports.resolveMenuPosition({
    anchor: { x: 500, y: 300 },
    menuWidth: 240,
    menuHeight: 900,
    windowWidth: 1000,
    windowHeight: 800,
    insetTop: 20,
    insetBottom: 20,
  });
  assert.equal(tight.height, 736);
});

test("board selection menus anchor while task menus keep their bottom sheets", async () => {
  const board = await readFile(new URL("../app/board/[id].tsx", import.meta.url), "utf8");
  const component = (name) => {
    const start = board.indexOf(`function ${name}`);
    const next = board.indexOf("\nfunction ", start + 1);
    return board.slice(start, next === -1 ? undefined : next);
  };

  assert.match(board, /OptionSheet visible=\{sortMenu\}[^\n]+anchor=\{smallMenuAnchor\}/);
  assert.match(board, /OptionSheet visible=\{filterMenu\}[^\n]+anchor=\{smallMenuAnchor\}/);
  assert.match(board, /OptionSheet visible=\{projectSwitcherOpen\}[^\n]+anchor=\{smallMenuAnchor\}/);
  assert.doesNotMatch(component("TaskActions"), /anchor=/);
  assert.doesNotMatch(component("CalendarTaskActions"), /anchor=/);
});

