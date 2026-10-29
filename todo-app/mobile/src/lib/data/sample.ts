import { subDays, subHours, addHours, addDays } from "date-fns";
import { makeId } from "@/lib/utils/id";
import { BUILT_IN_BOARDS, type Board } from "@/lib/domain/boards";
import type { BoardSection, Task, TaskDraft } from "@/lib/domain/types";
import { createTask } from "@/lib/domain/task-factory";
import { isCustomSection } from "@/lib/domain/sections";

/** Sample boards: the six built-ins plus four custom boards, so loading the
 * example tasks demonstrates custom categories too. */
export const SAMPLE_BOARDS: Board[] = [
  ...BUILT_IN_BOARDS,
  { id: "design", label: "Design", color: "violet" },
  { id: "errands", label: "Errands", color: "amber" },
  { id: "side-project", label: "Side project", color: "slate" },
  { id: "family", label: "Family", color: "pink" },
];

/**
 * Sample columns. A board no longer starts with the predefined status columns,
 * so the demo ships its own custom ones: which is also the clearest way to
 * show how a board is meant to be built up.
 */
export const SAMPLE_SECTIONS: BoardSection[] = [
  { id: "sample-backlog", title: "Backlog" },
  { id: "sample-progress", title: "In progress" },
  { id: "sample-done", title: "Done" },
];

/** Randomly places samples in real, visible custom lists without changing status. */
export function distributeSampleTasks(tasks: Task[], sections: BoardSection[] = SAMPLE_SECTIONS): Task[] {
  const targets = sections.filter((section) => !section.hidden && isCustomSection(section));
  if (!targets.length) throw new Error("Sample tasks need a visible custom list.");
  return tasks.map((task) => ({
    ...task,
    sectionId: targets[Math.floor(Math.random() * targets.length)].id,
  }));
}

interface SampleSeed extends Omit<TaskDraft, "subtasks" | "dueAt"> {
  offsetHours: number;
  completed?: boolean;
  canceled?: boolean;
  subtasks?: { title: string; done: boolean }[];
}

const SEEDS: SampleSeed[] = [
  {
    title: "Ship the quarterly report",
    description: "Pull the final numbers, proof the narrative, and send it to the team.",
    priority: "high",
    category: "work",
    offsetHours: -30,
    subtasks: [
      { title: "Collect metrics from the dashboard", done: true },
      { title: "Write the summary", done: true },
      { title: "Share for review", done: false },
    ],
  },
  {
    title: "Renew the gym membership",
    description: "",
    priority: "medium",
    category: "health",
    offsetHours: -5,
  },
  {
    title: "Draft the design review notes",
    description: "Summarize feedback from the usability session.",
    priority: "medium",
    category: "design",
    offsetHours: 6,
    subtasks: [
      { title: "Re-read the session recording", done: false },
      { title: "Group findings by theme", done: false },
    ],
  },
  {
    title: "Order groceries for the week",
    description: "Focus on produce and a couple of easy dinners.",
    priority: "low",
    category: "errands",
    offsetHours: 28,
  },
  {
    title: "Finish the Next.js course module",
    description: "",
    priority: "low",
    category: "learning",
    offsetHours: 76,
  },
  {
    title: "Book the dentist appointment",
    description: "Every six months: it has been a while.",
    priority: "medium",
    category: "family",
    offsetHours: -200,
    completed: true,
  },
  {
    title: "Plan the weekend trip",
    description: "Decided to stay local this month instead.",
    priority: "low",
    category: "family",
    offsetHours: 0,
    canceled: true,
  },
  {
    title: "Urgent: fix the login bug before the demo",
    description: "Auth fails on Safari after the last deploy.",
    priority: "high",
    category: "side-project",
    offsetHours: 3,
    subtasks: [
      { title: "Reproduce on Safari", done: true },
      { title: "Patch the session handler", done: false },
      { title: "Smoke-test the demo flow", done: false },
    ],
  },
  {
    title: "Team standup: prep the agenda",
    description: "Keep it to five talking points.",
    priority: "medium",
    category: "work",
    offsetHours: 20,
  },
  {
    title: "Pay the electricity bill",
    description: "Due in two days, avoid the service fee.",
    priority: "high",
    category: null,
    offsetHours: -50,
  },
  {
    title: "Send follow-up email to the professor",
    description: "Thanks for the feedback on the proposal.",
    priority: "medium",
    category: "learning",
    offsetHours: 8,
  },
  {
    title: "Buy a birthday gift for Ana",
    description: "She loves coffee: a nice mug, maybe.",
    priority: "medium",
    category: "errands",
    offsetHours: 50,
  },
  {
    title: "Book flights and hotel for Prague",
    description: "Check visa requirements before paying.",
    priority: "high",
    category: null,
    offsetHours: 150,
    subtasks: [
      { title: "Compare flight prices", done: true },
      { title: "Reserve the hotel", done: false },
      { title: "Check visa requirements", done: false },
    ],
  },
  {
    title: "Clean the apartment and do laundry",
    description: "Tenant inspection at the end of the month.",
    priority: "low",
    category: "home",
    offsetHours: 12,
  },
  {
    title: "Gym workout: leg day",
    description: "Squats, lunges and a light run.",
    priority: "medium",
    category: "health",
    offsetHours: 30,
  },
  {
    title: "Study for the final exam",
    description: "Focus on chapters 4-7 and past papers.",
    priority: "high",
    category: "learning",
    offsetHours: 96,
    subtasks: [
      { title: "Review lecture notes", done: false },
      { title: "Solve the practice set", done: false },
    ],
  },
  {
    title: "Call the client about the contract",
    description: "Confirm the delivery schedule for Q4.",
    priority: "medium",
    category: "work",
    offsetHours: 5,
  },
  {
    title: "Submit the thesis draft to the advisor",
    description: "Include the updated bibliography.",
    priority: "high",
    category: "learning",
    offsetHours: -75,
    completed: true,
  },
  {
    title: "Pay the credit card: avoid the late fee",
    description: "",
    priority: "high",
    category: null,
    offsetHours: 40,
  },
  {
    title: "Read two chapters of the book",
    description: "The chapter on distributed systems.",
    priority: "low",
    category: "learning",
    offsetHours: 60,
  },
  {
    title: "Renew passport for the summer trip",
    description: "Processing takes up to six weeks.",
    priority: "low",
    category: "errands",
    offsetHours: 200,
  },
  {
    title: "Fix the leaky kitchen faucet",
    description: "Replace the cartridge and the seals.",
    priority: "medium",
    category: "home",
    offsetHours: -70,
  },
  {
    title: "Prepare the slides for the presentation",
    description: "Nine slides: context, findings, next steps.",
    priority: "high",
    category: "design",
    offsetHours: 24,
    subtasks: [
      { title: "Sketch the outline", done: true },
      { title: "Add the charts", done: false },
      { title: "Rehearse the talk", done: false },
    ],
  },
  {
    title: "Refill the prescription at the pharmacy",
    description: "",
    priority: "medium",
    category: "health",
    offsetHours: 7,
  },
  {
    title: "Balance the monthly budget",
    description: "Compare spending against the plan.",
    priority: "medium",
    category: "personal",
    offsetHours: 90,
  },
  {
    title: "Fix the production outage",
    description: "Service is down for customers; coordinate the hotfix and comms.",
    priority: "critical",
    category: "work",
    offsetHours: -2,
    subtasks: [
      { title: "Page on-call engineer", done: true },
      { title: "Post status update", done: false },
    ],
  },
  {
    title: "Respond to security disclosure",
    description: "Triage the report and ship a patch before the deadline.",
    priority: "critical",
    category: "work",
    offsetHours: 4,
  },
];

export function createSampleTasks(now: Date = new Date()): Task[] {
  // Shuffle the seeds on every call so each sample is a fresh, random set.
  const shuffledSeeds = [...SEEDS].sort(() => Math.random() - 0.5);
  // Evenly distribute tasks across every sample category (shuffled too).
  const categoryPool = SAMPLE_BOARDS.map((board) => board.id).sort(() => Math.random() - 0.5);

  return shuffledSeeds.map((seed, index) => {
    const { offsetHours, subtasks, ...draft } = seed;
    // Spread statuses evenly: completed, canceled, overdue, upcoming.
    const bucket = index % 4;
    const isCompleted = bucket === 0;
    const isCanceled = bucket === 1;
    const isOverdue = bucket === 2;
    const magnitude = Math.max(1, Math.abs(offsetHours));
    const effectiveOffset = isOverdue ? -magnitude : magnitude;
    const base = effectiveOffset < 0 ? subHours(now, -effectiveOffset) : addHours(now, effectiveOffset);

    const task = createTask({
      title: draft.title,
      description: draft.description,
      dueAt: base.toISOString(),
      priority: draft.priority === "high" && Math.random() < 0.12 ? "critical" : draft.priority,
      category: categoryPool[index % categoryPool.length],
      subtasks: (subtasks ?? []).map((item) => ({
        id: makeId(8),
        title: item.title,
        done: item.done,
      })),
    });

    const createdAt = effectiveOffset < 0 ? subDays(now, 3) : subDays(now, 1);

    return {
      ...task,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      completed: isCompleted,
      canceled: isCanceled,
      completedAt: isCompleted ? addDays(createdAt, 1).toISOString() : null,
    };
  });
}
