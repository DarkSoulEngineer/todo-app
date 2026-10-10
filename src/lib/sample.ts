import { subDays, subHours, addHours, addDays } from "date-fns";
import { nanoid } from "nanoid";
import type { Task, TaskDraft } from "@/lib/types";
import { createTask } from "@/lib/task-factory";

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
    category: "work",
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
    category: "shopping",
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
    description: "Every six months — it has been a while.",
    priority: "medium",
    category: "personal",
    offsetHours: -200,
    completed: true,
  },
  {
    title: "Plan the weekend trip",
    description: "Decided to stay local this month instead.",
    priority: "low",
    category: "personal",
    offsetHours: 0,
    canceled: true,
  },
];

export function createSampleTasks(now: Date = new Date()): Task[] {
  return SEEDS.map((seed) => {
    const { offsetHours, completed, canceled, subtasks, ...draft } = seed;
    const base = offsetHours < 0 ? subHours(now, -offsetHours) : addHours(now, offsetHours);

    const task = createTask({
      title: draft.title,
      description: draft.description,
      dueAt: base.toISOString(),
      priority: draft.priority,
      category: draft.category,
      subtasks: (subtasks ?? []).map((item) => ({
        id: nanoid(8),
        title: item.title,
        done: item.done,
      })),
    });

    const createdAt =
      offsetHours < 0 ? subDays(now, 3) : subDays(now, 1);

    return {
      ...task,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      completed: completed ?? false,
      canceled: canceled ?? false,
      completedAt: completed ? addDays(createdAt, 1).toISOString() : null,
    };
  });
}
