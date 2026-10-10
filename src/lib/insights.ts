import { format, isSameDay, isValid, parseISO, startOfDay, subDays } from "date-fns";
import type { Task } from "@/lib/types";

export interface DailyPoint {
  /** Stable "yyyy-MM-dd" key. */
  key: string;
  /** Single-letter weekday label, e.g. "M". */
  label: string;
  count: number;
}

export interface Insights {
  /** One entry per day, oldest first. */
  points: DailyPoint[];
  /** Consecutive days (ending today or yesterday) with at least one completion. */
  streak: number;
  weekTotal: number;
  /** Highest single-day count in the window. */
  best: number;
}

function completionDates(tasks: Task[]): Date[] {
  const dates: Date[] = [];
  for (const task of tasks) {
    if (!task.completed || !task.completedAt) continue;
    const date = parseISO(task.completedAt);
    if (isValid(date)) dates.push(date);
  }
  return dates;
}

/** Completion trend (default: last 7 days) plus an active-day streak. */
export function computeInsights(tasks: Task[], now: Date, days = 7): Insights {
  const completed = completionDates(tasks);

  const points: DailyPoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = subDays(now, index);
    const count = completed.filter((date) => isSameDay(date, day)).length;
    points.push({ key: format(day, "yyyy-MM-dd"), label: format(day, "EEEEE"), count });
  }

  const dayKeys = new Set(completed.map((date) => format(date, "yyyy-MM-dd")));
  let streak = 0;
  let cursor = startOfDay(now);
  if (!dayKeys.has(format(cursor, "yyyy-MM-dd"))) cursor = subDays(cursor, 1);
  while (dayKeys.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  const weekTotal = points.reduce((sum, point) => sum + point.count, 0);
  const best = points.reduce((max, point) => Math.max(max, point.count), 0);

  return { points, streak, weekTotal, best };
}
