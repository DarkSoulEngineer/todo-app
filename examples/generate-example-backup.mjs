/**
 * Generates `stride-sample-25-tasks.json` — an importable Stride backup
 * containing the same 25 example tasks as `src/lib/sample.ts` (snapshot).
 *
 * Run:  node examples/generate-example-backup.mjs
 *
 * The output mirrors the app's export format (see `data-menu.tsx` "Export
 * backup") and passes `parseWorkspaceJson` (src/lib/storage.ts): a payload of
 * `{ tasks, sections, boards }` with ISO dates, lenient-normalized fields.
 * Sections/boards are included so the file is a complete, portable backup.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Base "now" so the file is deterministic and dates stay meaningful. */
const NOW = new Date("2026-10-11T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

/** Offsets mirror createSampleTasks: negative = in the past (overdue). */
const SEEDS = [
  { id: "sample-01", title: "Ship the quarterly report", description: "Pull the final numbers, proof the narrative, and send it to the team.", priority: "high", category: "work", offsetHours: -30, subtasks: [
    { title: "Collect metrics from the dashboard", done: true },
    { title: "Write the summary", done: true },
    { title: "Share for review", done: false },
  ] },
  { id: "sample-02", title: "Renew the gym membership", description: "", priority: "medium", category: "health", offsetHours: -5 },
  { id: "sample-03", title: "Draft the design review notes", description: "Summarize feedback from the usability session.", priority: "medium", category: "design", offsetHours: 6, subtasks: [
    { title: "Re-read the session recording", done: false },
    { title: "Group findings by theme", done: false },
  ] },
  { id: "sample-04", title: "Order groceries for the week", description: "Focus on produce and a couple of easy dinners.", priority: "low", category: "errands", offsetHours: 28 },
  { id: "sample-05", title: "Finish the Next.js course module", description: "", priority: "low", category: "learning", offsetHours: 76 },
  { id: "sample-06", title: "Book the dentist appointment", description: "Every six months — it has been a while.", priority: "medium", category: "family", offsetHours: -200, completed: true },
  { id: "sample-07", title: "Plan the weekend trip", description: "Decided to stay local this month instead.", priority: "low", category: "family", offsetHours: 0, canceled: true },
  { id: "sample-08", title: "Urgent: fix the login bug before the demo", description: "Auth fails on Safari after the last deploy.", priority: "high", category: "side-project", offsetHours: 3, subtasks: [
    { title: "Reproduce on Safari", done: true },
    { title: "Patch the session handler", done: false },
    { title: "Smoke-test the demo flow", done: false },
  ] },
  { id: "sample-09", title: "Team standup — prep the agenda", description: "Keep it to five talking points.", priority: "medium", category: "work", offsetHours: 20 },
  { id: "sample-10", title: "Pay the electricity bill", description: "Due in two days, avoid the service fee.", priority: "high", category: null, offsetHours: -50 },
  { id: "sample-11", title: "Send follow-up email to the professor", description: "Thanks for the feedback on the proposal.", priority: "medium", category: "learning", offsetHours: 8 },
  { id: "sample-12", title: "Buy a birthday gift for Ana", description: "She loves coffee — a nice mug, maybe.", priority: "medium", category: "errands", offsetHours: 50 },
  { id: "sample-13", title: "Book flights and hotel for Prague", description: "Check visa requirements before paying.", priority: "high", category: null, offsetHours: 150, subtasks: [
    { title: "Compare flight prices", done: true },
    { title: "Reserve the hotel", done: false },
    { title: "Check visa requirements", done: false },
  ] },
  { id: "sample-14", title: "Clean the apartment and do laundry", description: "Tenant inspection at the end of the month.", priority: "low", category: "home", offsetHours: 12 },
  { id: "sample-15", title: "Gym workout — leg day", description: "Squats, lunges and a light run.", priority: "medium", category: "health", offsetHours: 30 },
  { id: "sample-16", title: "Study for the final exam", description: "Focus on chapters 4–7 and past papers.", priority: "high", category: "learning", offsetHours: 96, subtasks: [
    { title: "Review lecture notes", done: false },
    { title: "Solve the practice set", done: false },
  ] },
  { id: "sample-17", title: "Call the client about the contract", description: "Confirm the delivery schedule for Q4.", priority: "medium", category: "work", offsetHours: 5 },
  { id: "sample-18", title: "Submit the thesis draft to the advisor", description: "Include the updated bibliography.", priority: "high", category: "learning", offsetHours: -75, completed: true },
  { id: "sample-19", title: "Pay the credit card — avoid the late fee", description: "", priority: "high", category: null, offsetHours: 40 },
  { id: "sample-20", title: "Read two chapters of the book", description: "The chapter on distributed systems.", priority: "low", category: "learning", offsetHours: 60 },
  { id: "sample-21", title: "Renew passport for the summer trip", description: "Processing takes up to six weeks.", priority: "low", category: "errands", offsetHours: 200 },
  { id: "sample-22", title: "Fix the leaky kitchen faucet", description: "Replace the cartridge and the seals.", priority: "medium", category: "home", offsetHours: -70 },
  { id: "sample-23", title: "Prepare the slides for the presentation", description: "Nine slides: context, findings, next steps.", priority: "high", category: "design", offsetHours: 24, subtasks: [
    { title: "Sketch the outline", done: true },
    { title: "Add the charts", done: false },
    { title: "Rehearse the talk", done: false },
  ] },
  { id: "sample-24", title: "Refill the prescription at the pharmacy", description: "", priority: "medium", category: "health", offsetHours: 7 },
  { id: "sample-25", title: "Balance the monthly budget", description: "Compare spending against the plan.", priority: "medium", category: "personal", offsetHours: 90 },
];

const DEFAULT_SECTIONS = [
  { id: "status-upcoming", title: "Upcoming", status: "upcoming" },
  { id: "status-overdue", title: "Overdue", status: "overdue" },
  { id: "status-completed", title: "Completed", status: "completed" },
  { id: "status-canceled", title: "Canceled", status: "canceled" },
];

const DEFAULT_BOARDS = [
  { id: "work", label: "Work", color: "cyan" },
  { id: "personal", label: "Personal", color: "pink" },
  { id: "shopping", label: "Shopping", color: "orange" },
  { id: "health", label: "Health", color: "teal" },
  { id: "learning", label: "Learning", color: "lime" },
  { id: "home", label: "Home", color: "indigo" },
  // Custom demo categories.
  { id: "design", label: "Design", color: "violet" },
  { id: "errands", label: "Errands", color: "amber" },
  { id: "side-project", label: "Side project", color: "cyan" },
  { id: "family", label: "Family", color: "pink" },
];

function iso(date) {
  return date.toISOString();
}

function buildTasks() {
  return SEEDS.map((seed) => {
    const { id, offsetHours, completed, canceled, ...rest } = seed;
    const past = offsetHours < 0;
    const dueAt = new Date(NOW.getTime() + offsetHours * 60 * 60 * 1000);
    const createdAt = new Date(NOW.getTime() - (past ? 3 : 1) * DAY);
    const isCompleted = completed === true;
    const isCanceled = !isCompleted && canceled === true;
    return {
      id,
      title: rest.title,
      description: rest.description,
      dueAt: iso(dueAt),
      priority: rest.priority,
      category: rest.category,
      completed: isCompleted,
      canceled: isCanceled,
      sectionId: null,
      subtasks: (rest.subtasks ?? []).map((subtask, index) => ({
        id: `${id}-sub-${String(index + 1).padStart(2, "0")}`,
        title: subtask.title,
        done: subtask.done,
      })),
      createdAt: iso(createdAt),
      updatedAt: iso(createdAt),
      completedAt: isCompleted ? iso(new Date(createdAt.getTime() + DAY)) : null,
    };
  });
}

const payload = {
  app: "Stride",
  version: 2,
  exportedAt: iso(NOW),
  tasks: buildTasks(),
  sections: DEFAULT_SECTIONS,
  boards: DEFAULT_BOARDS,
};

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "stride-sample-25-tasks.json");
mkdirSync(here, { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

console.log(`Wrote ${outPath} with ${payload.tasks.length} tasks.`);