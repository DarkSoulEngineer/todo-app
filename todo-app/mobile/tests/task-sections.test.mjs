import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/ui/collapsible-task-section.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function setup(title = "Tags", initialExpanded = true) {
  let expanded = initialExpanded;
  const mocks = {
    react: { useState: (initial) => [expanded, (next) => { expanded = typeof next === "function" ? next(expanded) : next; }] },
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (styles) => styles } },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "@/providers/theme-provider": { useTheme: () => ({ theme: { colors: { mutedForeground: "muted" } } }) },
  };
  const exports = {};
  new Function("require", "exports", code)((id) => mocks[id] ?? require(id), exports);
  const draft = { type: "Input", props: { value: "Unsaved text" } };
  return { draft, render: (summary = "2 selected") => exports.CollapsibleTaskSection({ title, summary, children: draft }) };
}

test("section headings collapse and expand without unmounting or changing draft children", () => {
  const section = setup();
  let tree = section.render();
  const heading = () => tree.props.children[0];
  const content = () => tree.props.children[1];
  assert.equal(heading().props.accessibilityLabel, "Collapse Tags section");
  assert.equal(heading().props.accessibilityState.expanded, true);
  assert.equal(content().props.style, undefined);
  assert.equal(content().props.children, section.draft);
  heading().props.onPress();
  tree = section.render();
  assert.equal(heading().props.accessibilityLabel, "Expand Tags section");
  assert.equal(heading().props["aria-expanded"], false);
  assert.equal(content().props.style.display, "none");
  assert.equal(content().props.accessibilityElementsHidden, true);
  assert.equal(content().props.importantForAccessibility, "no-hide-descendants");
  assert.equal(content().props.children, section.draft, "hidden fields remain mounted with the exact same draft");
  heading().props.onPress();
  tree = section.render();
  assert.equal(content().props.style, undefined);
  assert.equal(content().props.accessibilityElementsHidden, false);
  assert.equal(content().props.importantForAccessibility, "auto");
  assert.equal(content().props.children.props.value, "Unsaved text");
});

test("sections toggle independently and retain a live summary while collapsed", () => {
  const tags = setup("Tags"), checklist = setup("Checklist");
  tags.render().props.children[0].props.onPress();
  const collapsed = tags.render("3 selected");
  assert.equal(collapsed.props.children[0].props.children[2].props.children, "3 selected");
  assert.equal(collapsed.props.children[0].props.accessibilityState.expanded, false);
  assert.equal(checklist.render().props.children[0].props.accessibilityState.expanded, true);
  assert.equal(collapsed.props.children[0].props.style({ pressed: false })[0].minHeight, 44);
});

test("the Schedule section starts collapsed but its header toggles the date and time controls", () => {
  const section = setup("Schedule", false);
  let tree = section.render("Oct 30 · 03:07");
  let heading = tree.props.children[0];
  let content = tree.props.children[1];
  assert.equal(heading.props.accessibilityLabel, "Expand Schedule section");
  assert.equal(heading.props.accessibilityState.expanded, false);
  assert.equal(heading.props.children[2].props.children, "Oct 30 · 03:07");
  assert.equal(content.props.style.display, "none");

  heading.props.onPress();
  tree = section.render("Oct 30 · 03:07");
  heading = tree.props.children[0];
  content = tree.props.children[1];
  assert.equal(heading.props.accessibilityLabel, "Collapse Schedule section");
  assert.equal(content.props.style, undefined);
  assert.equal(content.props.children, section.draft);

  heading.props.onPress();
  tree = section.render("Optional");
  assert.equal(tree.props.children[0].props.accessibilityLabel, "Expand Schedule section");
  assert.equal(tree.props.children[0].props.children[2].props.children, "Optional");
});

test("Task/Create editors and the task inspector expose collapsible sections without hiding their title or actions", () => {
  const cases = [
    ["components/janus-board-ui.tsx", ["List", "Notes", "Priority", "Tags", "Schedule", "Checklist"]],
    ["components/reference/mobile/reference-new-task-screen.tsx", ["Board", "Notes", "Priority", "Tags", "Schedule", "Checklist", "Attachments"]],
    ["components/reference/mobile/reference-task-inspector-screen.tsx", ["Notes", "Tags", "Attachments", "Checklist", "Activity"]],
  ];
  for (const [path, expected] of cases) {
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const titles = [], inside = [];
    function visit(node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "CollapsibleTaskSection") {
        const title = node.openingElement.attributes.properties.find((prop) => prop.name?.getText(ast) === "title");
        const initializer = title.initializer;
        titles.push(ts.isStringLiteral(initializer) ? initializer.text : initializer.expression.whenFalse.text);
        inside.push(node.getText(ast));
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.deepEqual(titles.sort(), expected.sort(), path);
    assert.ok(inside.every((text) => !text.includes('accessibilityLabel="Task title"') && !text.includes('label="Add task"')));
  }
  const editor = readFileSync(new URL("../src/components/janus-board-ui.tsx", import.meta.url), "utf8");
  assert.match(editor, /<CollapsibleTaskSection title=\{calendarDateFixed \? "Time" : "Schedule"\}[^>]*defaultExpanded=\{false\}/);
});

test("status is a top-of-form property, never nested inside the Tags section", () => {
  const path = "components/janus-board-ui.tsx";
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const positions = {};
  const statusSections = [];
  function visit(node) {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(ast);
      const testID = node.openingElement.attributes.properties.find((prop) => prop.name?.getText(ast) === "testID");
      if (testID?.initializer && ts.isStringLiteral(testID.initializer)) positions[testID.initializer.text] = node.getStart(ast);
      if (tag === "CollapsibleTaskSection") {
        const title = node.openingElement.attributes.properties.find((prop) => prop.name?.getText(ast) === "title");
        if (title?.initializer && ts.isStringLiteral(title.initializer) && title.initializer.text === "Tags") statusSections.push(node.getText(ast));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(positions["task-editor-status-field"] > positions["task-editor-title-field"], "status follows the title");
  assert.ok(positions["task-editor-status-field"] < positions["task-editor-tags-list-row"], "status precedes the Tags section");
  assert.equal(statusSections.length, 1);
  assert.equal(statusSections[0].includes("CardStatusPicker"), false, "status picker is not part of Tags");
  const statusField = source.slice(source.indexOf('testID="task-editor-status-field"'), source.indexOf("</View>", source.indexOf('testID="task-editor-status-field"')));
  assert.match(statusField, /<CardStatusPicker/);
  assert.match(statusField, /onChange=\{changeStatusTags\}/, "the Done status action uses the editor completion handler");
  const completionHandler = source.slice(source.indexOf("const changeStatusTags"), source.indexOf("const cancelTask", source.indexOf("const changeStatusTags")));
  assert.match(completionHandler, /markedDone/);
  assert.match(completionHandler, /autoSave\(draft, sectionId\)/, "the latest editor draft is saved before dismissal");
  assert.match(completionHandler, /onClose\(\)/, "marking a task Done closes its editor");
  assert.match(source, /<CollapsibleTaskSection title="Tags"[\s\S]*?<\/CollapsibleTaskSection>/);
});
