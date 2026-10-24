import { differenceInCalendarDays, format, isSameDay, isValid, parseISO, startOfDay, subDays } from "date-fns";
import { deriveStatus } from "@/lib/domain/status";
import type { Task } from "@/lib/domain/types";
import { getFilterSource } from "@/lib/features/insights-filters";

export interface DailyPoint {
  /** Stable "yyyy-MM-dd" key. */
  key: string;
  /** Single-letter weekday label, e.g. "M". */
  label: string;
  count: number;
}

/**
 * The task-level figures shown by the web Insights dashboard. Keeping these
 * in the feature layer lets mobile and web surfaces use the same definitions
 * rather than deriving completion/productivity values in view code.
 */
export interface ProductivityMetrics {
  total: number;
  completed: number;
  canceled: number;
  overdue: number;
  upcoming: number;
  active: number;
  completionRate: number;
  averagePerDay: number;
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
  /** Best completion day in the current window (earliest day wins ties). */
  bestDay: DailyPoint | null;
  /** Task completion/productivity figures for the filtered task set. */
  metrics: ProductivityMetrics;
  /** Same figures for the immediately preceding period. */
  previousMetrics: ProductivityMetrics;
  /** Daily completion points for the immediately preceding period. */
  previousPoints: DailyPoint[];
}

/** Optional populations used when a view has separate filter sets for stats
 * and for the completion trend. The defaults preserve the existing API. */
export interface InsightsOptions {
  /** Complete task population for trend, streak and period comparison. */
  trendTasks?: Task[];
  /** Task population used by completion/productivity tiles. */
  metricsTasks?: Task[];
  /** The clock used for status metrics; defaults to the window end. */
  now?: Date;
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

function isDateInWindow(value: string | null | undefined, windowStart: Date, windowEnd: Date): boolean {
  if (!value) return false;
  const date = parseISO(value);
  if (!isValid(date)) return false;
  const day = startOfDay(date);
  return day >= startOfDay(windowStart) && day <= startOfDay(windowEnd);
}

/**
 * Select the complete task population represented by a historical period.
 * Creation, completion and due dates are all considered because canceled,
 * overdue and upcoming tasks do not necessarily have a completion timestamp.
 */
function tasksRepresentedInWindow(tasks: Task[], windowStart: Date, windowEnd: Date): Task[] {
  return tasks.filter((task) =>
    isDateInWindow(task.createdAt, windowStart, windowEnd)
    || isDateInWindow(task.completedAt, windowStart, windowEnd)
    || isDateInWindow(task.dueAt, windowStart, windowEnd),
  );
}

/** Compute the task counters used by the web StatsDashboard. */
export function computeProductivityMetrics(tasks: Task[], now: Date, days = 1): ProductivityMetrics {
  let completed = 0;
  let canceled = 0;
  let overdue = 0;
  let upcoming = 0;

  for (const task of tasks) {
    const status = deriveStatus(task, now);
    if (status === "completed") completed += 1;
    else if (status === "canceled") canceled += 1;
    else if (status === "overdue") overdue += 1;
    else upcoming += 1;
  }

  const total = tasks.length;
  return {
    total,
    completed,
    canceled,
    overdue,
    upcoming,
    active: upcoming + overdue,
    completionRate: total === 0 ? 0 : completed / total,
    averagePerDay: Math.round(completed / Math.max(1, days)),
  };
}

/** Compute insights for a custom window (used for filtered views). */
export function computeInsightsForWindow(
  tasks: Task[],
  windowStart: Date,
  windowEnd: Date,
  options: InsightsOptions = {},
): Insights {
  const trendTasks = options.trendTasks ?? getFilterSource(tasks) ?? tasks;
  const metricsTasks = options.metricsTasks ?? tasks;
  const completed = completionDates(trendTasks);
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
  const bestDay = best > 0 ? points.find((point) => point.count === best) ?? null : null;
  const metricDays = points.length;
  const metrics = computeProductivityMetrics(metricsTasks, options.now ?? end, metricDays);
  const previousPopulation = options.metricsTasks ?? getFilterSource(tasks) ?? tasks;
  const previousTasks = tasksRepresentedInWindow(previousPopulation, previousWindowStart, previousWindowEnd);
  const previousDays = Math.max(0, differenceInCalendarDays(previousWindowEnd, previousWindowStart) + 1);
  const previousMetrics = computeProductivityMetrics(previousTasks, previousWindowEnd, previousDays);

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
    bestDay,
    metrics,
    previousMetrics,
    previousPoints: getPreviousPeriodPoints(trendTasks, windowStart, windowEnd),
  };
}

/** Get previous period points for overlay chart. */
export function getPreviousPeriodPoints(
  tasks: Task[],
  windowStart: Date,
  windowEnd: Date
): DailyPoint[] {
  const completed = completionDates(getFilterSource(tasks) ?? tasks);
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
