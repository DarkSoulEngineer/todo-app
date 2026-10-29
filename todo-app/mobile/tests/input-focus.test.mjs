import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/ui/input.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const flatten = (style) => Object.assign({}, ...[style].flat().filter(Boolean));

test("input focus uses the active theme, preserves dimensions and forwards callbacks", () => {
  for (const platform of ["web", "ios", "android"]) {
    let focused = false, primary = "#86b840";
    const events = [];
    const mocks = {
      react: { useState: () => [focused, (value) => { focused = value; }] },
      "react-native": { Platform: { OS: platform }, TextInput: "TextInput", StyleSheet: { create: (value) => value } },
      "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: { primary, border: "#555555" }, radius: { lg: 16 } } }) },
    };
    const exports = {};
    vm.runInNewContext(compiled, { exports, require: (id) => id === "react/jsx-runtime" ? require(id) : mocks[id] });
    const render = () => exports.Input({ style: { borderRadius: 6, height: 56 }, autoFocus: true, onFocus: (event) => events.push(["focus", event]), onBlur: (event) => events.push(["blur", event]) });
    let tree = render();
    const original = flatten(tree.props.style);
    assert.equal(tree.props.autoFocus, true);
    assert.equal(original.outlineWidth, platform === "web" ? 0 : undefined);
    const event = {};
    tree.props.onFocus(event);
    tree = render();
    assert.equal(flatten(tree.props.style).borderColor, primary);
    for (const key of ["height", "borderWidth", "borderRadius"]) assert.equal(flatten(tree.props.style)[key], original[key]);
    primary = "#6589e8";
    tree = render();
    assert.equal(flatten(tree.props.style).borderColor, primary, "focused input responds to theme changes");
    assert.equal(tree.props.selectionColor, primary);
    assert.equal(tree.props.cursorColor, primary);
    assert.equal(tree.props.underlineColorAndroid, "transparent");
    tree.props.onBlur(event);
    assert.equal(flatten(render().props.style).borderColor, "#555555");
    assert.deepEqual(events, [["focus", event], ["blur", event]]);
  }
});
