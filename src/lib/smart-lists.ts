import { differenceInCalendarDays, isSameDay, isValid, parseISO } from "date-fns";
import { deriveStatus } from "@/lib/status";
import { getTaskSectionId, isCustomSection } from "@/lib/sections";
import type { SmartList, Task, BoardSection } from "@/lib/types";

export interface SmartListDef {
  id: SmartList;
  label: string;
}

/** Ordered smart lists shown in the sidebar. */
export const SMART_LISTS: SmartListDef[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "thisWeek", label: "This week" },
  { id: "all", label: "All tasks" },
  { id: "completed", label: "Completed" },
  { id: "by-section", label: "By section" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "canceled", label: "Canceled" },
];

/**
 * The time-based smart lists the sidebar collapses under one "Upcoming" group,
 * in display order. Every other list stays a flat top-level row.
 */
export const TIME_GROUP_LISTS: readonly SmartList[] = [
  "today",
  "tomorrow",
  "thisWeek",
  "upcoming",
  "overdue",
];

/** Aggregate badge count for the time group (today + tomorrow + this week + upcoming + overdue). */
export function aggregateTimeCount(counts: SmartListCounts): number {
  return TIME_GROUP_LISTS.reduce((total, id) => total + counts[id], 0);
}

const SMART_LABELS: Record<SmartList, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  thisWeek: "This week",
  upcoming: "Upcoming",
  overdue: "Overdue",
  all: "All tasks",
  completed: "Completed",
  canceled: "Canceled",
  "by-section": "By section",
};

export function smartListLabel(list: SmartList): string {
  return SMART_LABELS[list];
}

function dueOnDay(task: Task, day: Date): boolean {
  if (!task.dueAt) return false;
  const due = parseISO(task.dueAt);
  return isValid(due) && isSameDay(due, day);
}

export function filterBySmartList(tasks: Task[], list: SmartList, now: Date): Task[] {
  switch (list) {
    case "all":
    case "by-section":
      return tasks;
    case "today":
      return tasks.filter((task) => !task.completed && !task.canceled && dueOnDay(task, now));
    case "tomorrow":
      return tasks.filter((task) => !task.completed && !task.canceled && bucketOf(task, now) === "tomorrow");
    case "thisWeek":
      return tasks.filter((task) => !task.completed && !task.canceled && bucketOf(task, now) === "thisWeek");
    case "upcoming":
      return tasks.filter((task) => deriveStatus(task, now) === "upcoming");
    case "overdue":
      return tasks.filter((task) => deriveStatus(task, now) === "overdue");
    case "completed":
      return tasks.filter((task) => task.completed);
    case "canceled":
      return tasks.filter((task) => task.canceled);
    default:
      return tasks;
  }
}

export type SmartListCounts = Record<SmartList, number>;

export function countBySmartList(tasks: Task[], now: Date): SmartListCounts {
  const counts: SmartListCounts = {
    today: 0,
    tomorrow: 0,
    thisWeek: 0,
    upcoming: 0,
    overdue: 0,
    all: tasks.length,
    completed: 0,
    canceled: 0,
    "by-section": 0,
  };

  for (const task of tasks) {
    if (task.completed) {
      counts.completed += 1;
      continue;
    }
    if (task.canceled) {
      counts.canceled += 1;
      continue;
    }
    if (dueOnDay(task, now)) counts.today += 1;
    const bucket = bucketOf(task, now);
    if (bucket === "tomorrow") counts.tomorrow += 1;
    else if (bucket === "thisWeek") counts.thisWeek += 1;
    const status = deriveStatus(task, now);
    if (status === "upcoming" || status === "overdue") counts[status] += 1;
  }

  counts["by-section"] = tasks.length;

  return counts;
}

const BUCKET_LABELS: Record<string, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  thisWeek: "This week",
  later: "Later",
  none: "No due date",
  completed: "Completed",
  canceled: "Canceled",
};

const LIST_BUCKETS: Record<SmartList, string[]> = {
  today: ["overdue", "today"],
  tomorrow: ["tomorrow"],
  thisWeek: ["thisWeek"],
  upcoming: ["today", "tomorrow", "thisWeek", "later", "none"],
  overdue: ["overdue"],
  all: ["overdue", "today", "tomorrow", "thisWeek", "later", "none", "completed", "canceled"],
  completed: ["completed"],
  canceled: ["canceled"],
  "by-section": [],
};

function bucketOf(task: Task, now: Date): string {
  if (task.completed) return "completed";
  if (task.canceled) return "canceled";
  if (!task.dueAt) return "none";
  const due = parseISO(task.dueAt);
  if (!isValid(due)) return "none";
  if (due.getTime() < now.getTime()) return "overdue";
  const diff = differenceInCalendarDays(due, now);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "thisWeek";
  return "later";
}

export interface TaskGroup {
  id: string;
  label: string;
  tasks: Task[];
}

/** Groups an already-filtered/sorted task list into labelled date sections. */
export function groupForList(tasks: Task[], list: SmartList, now: Date): TaskGroup[] {
  const order = LIST_BUCKETS[list];
  const buckets = new Map<string, Task[]>();

  for (const task of tasks) {
    const key = bucketOf(task, now);
    if (!order.includes(key)) continue;
    const existing = buckets.get(key);
    if (existing) existing.push(task);
    else buckets.set(key, [task]);
  }

  const groups: TaskGroup[] = [];
  for (const key of order) {
    const items = buckets.get(key);
    if (items && items.length > 0) {
      groups.push({ id: key, label: BUCKET_LABELS[key] ?? key, tasks: items });
    }
  }
  return groups;
}

/** Groups tasks by their board section (custom or status). */
export function groupForListBySection(
  tasks: Task[],
  sections: BoardSection[],
  now: Date
): TaskGroup[] {
  const sectionMap = new Map<string, BoardSection>();
  for (const section of sections) {
    sectionMap.set(section.id, section);
  }

  const buckets = new Map<string, Task[]>();

  for (const task of tasks) {
    const sectionId = getTaskSectionId(task, sections, now);
    const key = sectionId ?? "none";
    const existing = buckets.get(key);
    if (existing) existing.push(task);
    else buckets.set(key, [task]);
  }

  // Order: custom sections first (in board order), then status sections in board order, then unassigned
  const orderedSectionIds = [
    ...sections.filter(isCustomSection).map((s) => s.id),
    ...sections.filter((s) => s.status).map((s) => s.id),
    "none",
  ];

  const groups: TaskGroup[] = [];
  for (const key of orderedSectionIds) {
    const items = buckets.get(key);
    if (items && items.length > 0) {
      const section = sectionMap.get(key);
      const label = section?.title ?? "No section";
      groups.push({ id: key, label, tasks: items });
    }
  }
  return groups;
}
