import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/ui/janus-logo.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const mocks = {
  react: { useId: () => ":logo:" },
  "react-native-svg": { default: "Svg", Circle: "Circle", Rect: "Rect", G: "G", Defs: "Defs", Filter: "Filter", FeDropShadow: "FeDropShadow" },
  "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: { success: "green", destructive: "red", background: "black" } } }) },
  "react/jsx-runtime": require("react/jsx-runtime"),
};
const exports = {};
vm.runInNewContext(compiled, { exports, require: (id) => mocks[id] });

test("logo shadows follow its SVG shapes, not its square viewport", () => {
  const tree = exports.JanusLogo({ shadow: true });
  const [defs, shapes] = tree.props.children;
  const filter = defs.props.children;
  assert.equal(filter.type, "Filter");
  assert.equal(filter.props.children.type, "FeDropShadow");
  assert.equal(shapes.type, "G");
  assert.equal(shapes.props.filter, `url(#${filter.props.id})`);
  assert.equal(shapes.props.children.length, 2);
  assert.ok(shapes.props.children.every((node) => node.type === "Rect" && node.props.rx === 6));
  const normal = exports.JanusLogo({});
  assert.equal(normal.props.children[0], null);
  assert.equal(normal.props.children[1].props.filter, undefined);
});
