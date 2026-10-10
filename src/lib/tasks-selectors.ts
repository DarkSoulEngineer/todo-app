import { PRIORITY_META } from "@/lib/constants";
import { deriveStatus } from "@/lib/status";
import type { SortKey, StatusFilter, Task, TaskStatus } from "@/lib/types";

export type StatusCounts = Record<StatusFilter, number>;

export interface TaskStats {
  total: number;
  completed: number;
  canceled: number;
  overdue: number;
  upcoming: number;
  /** Open tasks (not completed and not canceled). */
  active: number;
  /** Completed / total, 0..1. */
  completionRate: number;
}

export function countByStatus(tasks: Task[], now: Date): StatusCounts {
  const counts: StatusCounts = {
    all: tasks.length,
    upcoming: 0,
    overdue: 0,
    completed: 0,
    canceled: 0,
  };

  for (const task of tasks) {
    counts[deriveStatus(task, now)] += 1;
  }

  return counts;
}

export function computeStats(tasks: Task[], now: Date): TaskStats {
  const counts = countByStatus(tasks, now);
  const total = counts.all;
  return {
    total,
    completed: counts.completed,
    canceled: counts.canceled,
    overdue: counts.overdue,
    upcoming: counts.upcoming,
    active: counts.upcoming + counts.overdue,
    completionRate: total === 0 ? 0 : counts.completed / total,
  };
}

export interface TaskQuery {
  status: StatusFilter;
  query: string;
  category: string | "all";
}

export function matchesQuery(task: Task, needle: string): boolean {
  if (!needle) return true;
  if (task.title.toLowerCase().includes(needle)) return true;
  if (task.description.toLowerCase().includes(needle)) return true;
  return task.subtasks.some((subtask) => subtask.title.toLowerCase().includes(needle));
}

function dueValue(task: Task): number {
  if (!task.dueAt) return Number.POSITIVE_INFINITY;
  const time = Date.parse(task.dueAt);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function createdValue(task: Task): number {
  const time = Date.parse(task.createdAt);
  return Number.isNaN(time) ? 0 : time;
}

export function sortTasks(tasks: Task[], sort: SortKey): Task[] {
  const list = [...tasks];

  switch (sort) {
    case "due":
      list.sort((a, b) => {
        const diff = dueValue(a) - dueValue(b);
        return diff !== 0 ? diff : createdValue(b) - createdValue(a);
      });
      break;
    case "priority":
      list.sort((a, b) => {
        const diff = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
        return diff !== 0 ? diff : dueValue(a) - dueValue(b);
      });
      break;
    case "created":
      list.sort((a, b) => createdValue(b) - createdValue(a));
      break;
    case "manual":
    default:
      // Keep the stored (drag-and-drop) order.
      break;
  }

  return list;
}

export function selectVisibleTasks(tasks: Task[], query: TaskQuery, sort: SortKey, now: Date): Task[] {
  const needle = query.query.trim().toLowerCase();

  const filtered = tasks.filter((task) => {
    if (query.status !== "all" && deriveStatus(task, now) !== (query.status as TaskStatus)) {
      return false;
    }
    if (query.category !== "all" && task.category !== query.category) return false;
    return matchesQuery(task, needle);
  });

  return sortTasks(filtered, sort);
}
