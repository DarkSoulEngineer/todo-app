import { differenceInCalendarDays, format, isSameDay, parseISO, startOfDay, subDays, isValid } from "date-fns";
import type { Task, Workspace } from "@/lib/domain/types";
import type { Board } from "@/lib/domain/boards";

/** Date range preset options. */
export type DateRangePreset = "7d" | "30d" | "90d" | "custom";

/** Status filter options matching TaskStatus plus "all". */
export type StatusFilterOption = "all" | "completed" | "overdue" | "canceled";

/** Priority filter options. */
export type PriorityFilterOption = "all" | "high" | "medium" | "low";

/** Complete filter state for the Insights page. */
export interface InsightsFilters {
  dateRange: DateRangePreset;
  customStart: Date | null;
  customEnd: Date | null;
  status: StatusFilterOption;
  priority: PriorityFilterOption;
  boardId: string; // "all" or board id
}

/** Default filter values. */
export const DEFAULT_FILTERS: InsightsFilters = {
  dateRange: "7d",
  customStart: null,
  customEnd: null,
  status: "all",
  priority: "all",
  boardId: "all",
};

// Keep the source population alongside a filtered array so Insights can
// reproduce the web contract: filters affect task/stat tiles, while the web
// trend, streak, and period comparison are calculated from all tasks.
const filterSources = new WeakMap<Task[], Task[]>();

function escapeCsvField(value: string | null | undefined): string {
  const text = value ?? "";
  return `"${text.replace(/"/g, '""')}"`;
}

/** Compute the number of days for a given preset. */
export function daysFromPreset(preset: DateRangePreset, customStart: Date | null, customEnd: Date | null): number {
  switch (preset) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "custom":
      if (customStart && customEnd) {
        return Math.max(1, differenceInCalendarDays(customEnd, customStart) + 1);
      }
      return 7;
    default:
      return 7;
  }
}

/** Get the start date for a given preset relative to `now`. */
export function windowStartFromPreset(now: Date, preset: DateRangePreset, customStart: Date | null): Date {
  switch (preset) {
    case "7d":
      return subDays(startOfDay(now), 6);
    case "30d":
      return subDays(startOfDay(now), 29);
    case "90d":
      return subDays(startOfDay(now), 89);
    case "custom":
      return customStart ? startOfDay(customStart) : subDays(startOfDay(now), 6);
    default:
      return subDays(startOfDay(now), 6);
  }
}

/** Get the end date for a given preset. */
export function windowEndFromPreset(now: Date, preset: DateRangePreset, customEnd: Date | null): Date {
  switch (preset) {
    case "custom":
      return customEnd ? startOfDay(customEnd) : startOfDay(now);
    default:
      return startOfDay(now);
  }
}

/** Applies the board, status and priority filters (no date-range window). */
export function filterTasksByFilters(tasks: Task[], filters: InsightsFilters, now: Date): Task[] {
  const filtered = tasks.filter((task) => {
    // Board filter
    if (filters.boardId !== "all" && task.category !== filters.boardId) {
      return false;
    }

    // Status filter
    if (filters.status !== "all") {
      const isCompleted = task.completed;
      const isCanceled = task.canceled;
      const isOverdue = !isCompleted && !isCanceled && task.dueAt && Date.parse(task.dueAt) < now.getTime();

      if (filters.status === "completed" && !isCompleted) return false;
      if (filters.status === "canceled" && !isCanceled) return false;
      if (filters.status === "overdue" && !isOverdue) return false;
    }

    // Priority filter
    if (filters.priority !== "all" && task.priority !== filters.priority) {
      return false;
    }

    return true;
  });
  filterSources.set(filtered, tasks);
  return filtered;
}

/** Return the unfiltered source for a result of filterTasksByFilters. */
export function getFilterSource(tasks: Task[]): Task[] | undefined {
  return filterSources.get(tasks);
}

/** Get completion dates from filtered tasks within the window. */
export function getCompletionDatesInWindow(tasks: Task[], windowStart: Date, windowEnd: Date): Date[] {
  const start = startOfDay(windowStart);
  const end = startOfDay(windowEnd);
  const dates: Date[] = [];
  for (const task of tasks) {
    if (!task.completed || !task.completedAt) continue;
    const date = parseISO(task.completedAt);
    if (isValid(date)) {
      const dayStart = startOfDay(date);
      if (dayStart >= start && dayStart <= end) {
        dates.push(date);
      }
    }
  }
  return dates;
}

/** Compute insights for a specific window (used for current and previous period). */
export interface WindowInsights {
  points: { key: string; label: string; count: number }[];
  total: number;
  best: number;
  streak: number;
}

export function computeWindowInsights(
  tasks: Task[],
  windowStart: Date,
  windowEnd: Date
): WindowInsights {
  const days = Math.max(0, differenceInCalendarDays(windowEnd, windowStart) + 1);
  const completed = getCompletionDatesInWindow(tasks, windowStart, windowEnd);

  const points: { key: string; label: string; count: number }[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = subDays(windowEnd, index);
    const count = completed.filter((date) => isSameDay(date, day)).length;
    points.push({ key: format(day, "yyyy-MM-dd"), label: format(day, "EEEEE"), count });
  }

  const dayKeys = new Set(completed.map((date) => format(date, "yyyy-MM-dd")));
  let streak = 0;
  let cursor = startOfDay(windowEnd);
  if (!dayKeys.has(format(cursor, "yyyy-MM-dd"))) cursor = subDays(cursor, 1);
  while (dayKeys.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  const total = points.reduce((sum, point) => sum + point.count, 0);
  const best = points.reduce((max, point) => Math.max(max, point.count), 0);

  return { points, total, best, streak };
}

/** Compute previous period window (same length, immediately preceding current window). */
export function computePreviousWindow(
  now: Date,
  dateRange: DateRangePreset,
  customStart: Date | null,
  customEnd: Date | null
): { start: Date; end: Date } {
  const currentStart = windowStartFromPreset(now, dateRange, customStart);
  const currentEnd = windowEndFromPreset(now, dateRange, customEnd);
  const length = Math.max(0, differenceInCalendarDays(currentEnd, currentStart) + 1);

  const prevEnd = subDays(currentStart, 1);
  const prevStart = subDays(prevEnd, length - 1);

  return { start: prevStart, end: prevEnd };
}

/** Compute period comparison percentage. */
export function computePeriodComparison(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Format percentage change for display. */
export function formatPeriodChange(change: number | null): string | null {
  if (change === null) return null;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change}%`;
}

/** Get priority counts from tasks. */
export function getPriorityCounts(tasks: Task[]): Record<"high" | "medium" | "low", number> {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const task of tasks) {
    if (task.priority in counts) {
      counts[task.priority]++;
    }
  }
  return counts;
}

/** Get weekday completion aggregation (0 = Sunday, 6 = Saturday). */
export function getWeekdayCompletionCounts(tasks: Task[], windowStart: Date, windowEnd: Date): number[] {
  const counts = new Array(7).fill(0);
  const completed = getCompletionDatesInWindow(tasks, windowStart, windowEnd);

  for (const date of completed) {
    const day = date.getDay(); // 0-6
    counts[day]++;
  }

  // Reorder to Mon-Sun (1-0)
  return [counts[1], counts[2], counts[3], counts[4], counts[5], counts[6], counts[0]];
}

/** Export filtered tasks to CSV string. */
export function exportTasksToCSV(tasks: Task[], boards: Board[]): string {
  const headers = ["id", "title", "status", "priority", "board", "completedAt", "createdAt"];
  const rows = tasks.map((task) => {
    const board = boards.find((b) => b.id === task.category);
    return [
      task.id,
      task.title,
      csvStatus(task),
      task.priority,
      board?.label || "",
      task.completedAt || "",
      task.createdAt,
    ].map(escapeCsvField).join(",");
  });

  return [headers.map(escapeCsvField).join(","), ...rows].join("\n");
}

/** Export every task across a set of boards, with the owning board as a column. */
export function exportProjectsToCSV(projects: { name: string; workspace: Workspace }[]): string {
  const headers = ["project", "id", "title", "status", "priority", "board", "completedAt", "createdAt"];
  const rows = projects.flatMap((project) =>
    project.workspace.tasks.map((task) => {
      const board = project.workspace.boards.find((item) => item.id === task.category);
      return [
        project.name,
        task.id,
        task.title,
        csvStatus(task),
        task.priority,
        board?.label || "",
        task.completedAt || "",
        task.createdAt,
      ].map(escapeCsvField).join(",");
    }),
  );

  return [headers.map(escapeCsvField).join(","), ...rows].join("\n");
}

function csvStatus(task: Task): string {
  return task.completed
    ? "completed"
    : task.canceled
      ? "canceled"
      : task.dueAt && Date.parse(task.dueAt) < Date.now()
        ? "overdue"
        : "upcoming";
}

/** Check if any filter is non-default. */
export function hasActiveFilters(filters: InsightsFilters): boolean {
  return (
    filters.dateRange !== "7d" ||
    filters.customStart !== null ||
    filters.customEnd !== null ||
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.boardId !== "all"
  );
}

/** Reset filters to defaults. */
export function resetFilters(): InsightsFilters {
  return { ...DEFAULT_FILTERS };
}
