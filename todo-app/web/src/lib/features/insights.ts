import {
  differenceInCalendarDays,
  format,
  isSameDay,
  isValid,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import type { Task } from "@/lib/domain/types";

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
  /** Total completions in the current window. */
  windowTotal: number;
  /** Highest single-day count in the window. */
  best: number;
  /** Previous period window total for comparison. */
  previousWindowTotal: number;
  /** Period comparison percentage (vs previous window of same length). */
  periodChange: number | null;
  /** Start of the current window. */
  windowStart: Date;
  /** End of the current window. */
  windowEnd: Date;
  /** Start of the previous window. */
  previousWindowStart: Date;
  /** End of the previous window. */
  previousWindowEnd: Date;
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

function getPreviousWindowBounds(currentStart: Date, currentEnd: Date): { start: Date; end: Date } {
  const length = Math.max(0, differenceInCalendarDays(currentEnd, currentStart) + 1);
  const prevEnd = subDays(currentStart, 1);
  const prevStart = subDays(prevEnd, length - 1);
  return { start: prevStart, end: prevEnd };
}

function computeWindowTotal(completed: Date[], windowStart: Date, windowEnd: Date): number {
  const start = startOfDay(windowStart);
  const end = startOfDay(windowEnd);
  return completed.filter((date) => {
    const dayStart = startOfDay(date);
    return dayStart >= start && dayStart <= end;
  }).length;
}

function computeStreak(completed: Date[], windowEnd: Date): number {
  const dayKeys = new Set(completed.map((date) => format(date, "yyyy-MM-dd")));
  let streak = 0;
  let cursor = startOfDay(windowEnd);
  if (!dayKeys.has(format(cursor, "yyyy-MM-dd"))) cursor = subDays(cursor, 1);
  while (dayKeys.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/** Compute insights for a custom window (used for filtered views). */
export function computeInsightsForWindow(
  tasks: Task[],
  windowStart: Date,
  windowEnd: Date
): Insights {
  const completed = completionDates(tasks);
  const start = startOfDay(windowStart);
  const end = startOfDay(windowEnd);
  const completedInWindow = completed.filter((date) => {
    const day = startOfDay(date);
    return day >= start && day <= end;
  });
  const days = Math.max(0, differenceInCalendarDays(windowEnd, windowStart) + 1);

  const points: DailyPoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = subDays(windowEnd, index);
    const count = completed.filter((date) => isSameDay(date, day)).length;
    points.push({ key: format(day, "yyyy-MM-dd"), label: format(day, "EEEEE"), count });
  }

  const { start: previousWindowStart, end: previousWindowEnd } = getPreviousWindowBounds(windowStart, windowEnd);
  const windowTotal = computeWindowTotal(completed, windowStart, windowEnd);
  const previousWindowTotal = computeWindowTotal(completed, previousWindowStart, previousWindowEnd);
  const periodChange = previousWindowTotal === 0 ? (windowTotal > 0 ? 100 : null) : Math.round(((windowTotal - previousWindowTotal) / previousWindowTotal) * 100);
  const best = points.reduce((max, point) => Math.max(max, point.count), 0);
  const streak = computeStreak(completedInWindow, windowEnd);

  return {
    points,
    streak,
    windowTotal,
    best,
    previousWindowTotal,
    periodChange,
    windowStart,
    windowEnd,
    previousWindowStart,
    previousWindowEnd,
  };
}

/** Get previous period points for overlay chart. */
export function getPreviousPeriodPoints(
  tasks: Task[],
  windowStart: Date,
  windowEnd: Date
): DailyPoint[] {
  const completed = completionDates(tasks);
  const { start: previousWindowStart, end: previousWindowEnd } = getPreviousWindowBounds(windowStart, windowEnd);
  const days = Math.max(0, differenceInCalendarDays(previousWindowEnd, previousWindowStart) + 1);

  const points: DailyPoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = subDays(previousWindowEnd, index);
    const count = completed.filter((date) => isSameDay(date, day)).length;
    points.push({ key: format(day, "yyyy-MM-dd"), label: format(day, "EEEEE"), count });
  }

  return points;
}
