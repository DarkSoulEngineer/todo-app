import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/lib/features/task-completion-celebration.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require, setTimeout });

const task = (changes = {}) => ({ completed: false, canceled: false, title: "Finish the project", priority: "medium", subtasks: [], ...changes });

test("completion celebrations fire only when a task transitions into completed", () => {
  const received = [];
  const unsubscribe = exports.subscribeToTaskCompletionCelebrations((event) => received.push(event));
  exports.celebrateTaskCompletion(task(), task({ completed: true }));
  exports.celebrateTaskCompletion(task({ completed: true }), task({ completed: true }));
  exports.celebrateTaskCompletion(task(), task({ canceled: true }));
  exports.celebrateTaskCompletion(task(), task({ completed: true, canceled: true }));
  assert.equal(received.length, 1);
  assert.equal(received[0].title, "Finish the project");
  assert.equal(received[0].priority, "medium");
  assert.equal(received[0].completedChecklistItems, 0);
  assert.equal(received[0].origin, null);
  assert.ok(received[0].id > 0);
  unsubscribe();
  exports.celebrateTaskCompletion(task(), task({ completed: true }));
  assert.equal(received.length, 1, "unsubscribed listeners are not notified");
});

test("celebrations use the registered task card center and unregister safely", () => {
  const received = [];
  const unsubscribe = exports.subscribeToTaskCompletionCelebrations((event) => received.push(event));
  const unregister = exports.registerTaskCompletionOrigin("card-id", (callback) => callback({ x: 120, y: 240 }));
  exports.celebrateTaskCompletion(task(), task({ completed: true }), "card-id");
  assert.equal(received[0].origin.x, 120);
  assert.equal(received[0].origin.y, 240);

  unregister();
  exports.celebrateTaskCompletion(task(), task({ completed: true }), "card-id");
  assert.equal(received[1].origin, null);
  unsubscribe();
});

test("edit-screen completion celebrations wait for the inspector dismissal", async () => {
  const received = [];
  const unsubscribe = exports.subscribeToTaskCompletionCelebrations((event) => received.push(event));
  exports.deferTaskCompletionCelebration("edit-task", 20);
  exports.celebrateTaskCompletion(task(), task({ completed: true }), "edit-task");
  assert.equal(received.length, 0, "celebration does not start over the open inspector");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(received.length, 1, "celebration starts after the dismissal delay");
  unsubscribe();
});

test("higher priority tasks generate progressively more celebration particles", () => {
  const counts = ["low", "medium", "high", "critical"].map((priority) => exports.celebrationParticleCount(priority));
  assert.deepEqual(counts, [16, 28, 44, 64]);
  assert.ok(counts.every((count, index) => index === 0 || count > counts[index - 1]));
});

test("completed checklist items add weighted particles while retaining a base effect", () => {
  const taskWithChecklist = task({
    completed: true,
    priority: "high",
    subtasks: [
      { id: "one", title: "One", done: true },
      { id: "two", title: "Two", done: false },
      { id: "three", title: "Three", done: true },
    ],
  });
  const received = [];
  const unsubscribe = exports.subscribeToTaskCompletionCelebrations((event) => received.push(event));
  exports.celebrateTaskCompletion(task(), taskWithChecklist);
  unsubscribe();

  assert.equal(received[0].completedChecklistItems, 2);
  assert.equal(exports.celebrationParticleCount("high"), 44);
  assert.equal(exports.celebrationParticleCount("high", received[0].completedChecklistItems), 66);
});

test("celebration particle count is capped for large checklists", () => {
  assert.equal(exports.celebrationParticleCount("critical", 10_000), 120);
  assert.equal(exports.celebrationParticleCount("low", -5), 16);
});
