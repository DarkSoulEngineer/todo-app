import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { Ban, CalendarClock, Check, TriangleAlert, type LucideIcon } from "lucide-react";
import type { StatusFilter, Task, TaskStatus } from "@/lib/types";

export interface StatusMeta {
  label: string;
  /** Short blurb used in tabs and empty states. */
  blurb: string;
  icon: LucideIcon;
  /** Text + chip styling. */
  text: string;
  chip: string;
  /** Solid color for tab underline and progress accents. */
  solid: string;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  overdue: {
    label: "Overdue",
    blurb: "Past their deadline and still open.",
    icon: TriangleAlert,
    text: "text-red-600 dark:text-red-400",
    chip: "bg-red-500/12 text-red-700 ring-red-500/25 dark:text-red-300",
    solid: "bg-red-500",
  },
  upcoming: {
    label: "Upcoming",
    blurb: "Still open, with time to spare.",
    icon: CalendarClock,
    text: "text-sky-600 dark:text-sky-400",
    chip: "bg-sky-500/12 text-sky-700 ring-sky-500/25 dark:text-sky-300",
    solid: "bg-sky-500",
  },
  completed: {
    label: "Completed",
    blurb: "Done and dusted.",
    icon: Check,
    text: "text-emerald-600 dark:text-emerald-400",
    chip: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
    solid: "bg-emerald-500",
  },
  canceled: {
    label: "Canceled",
    blurb: "Set aside for now.",
    icon: Ban,
    text: "text-slate-500 dark:text-slate-400",
    chip: "bg-slate-500/12 text-slate-600 ring-slate-500/25 dark:text-slate-300",
    solid: "bg-slate-400",
  },
};

export const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
];

/**
 * Status priority: an explicit completion or cancellation always wins.
 * Everything else is derived from the due date (no due date counts as upcoming).
 */
export function deriveStatus(task: Task, now: Date): TaskStatus {
  if (task.completed) return "completed";
  if (task.canceled) return "canceled";

  if (task.dueAt) {
    const due = parseISO(task.dueAt);
    if (isValid(due) && due.getTime() < now.getTime()) return "overdue";
  }

  return "upcoming";
}

export interface DueInfo {
  /** Compact label, e.g. "Today, 5:30 PM", "3h overdue", "Due in 2 days". */
  label: string;
  /** Full timestamp for the tooltip. */
  title: string;
  overdue: boolean;
  /** True when the deadline lands today. */
  today: boolean;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Human, friendly description of a due date. Returns null when unset or invalid. */
export function describeDue(dueAt: string | null, now: Date): DueInfo | null {
  if (!dueAt) return null;
  const due = parseISO(dueAt);
  if (!isValid(due)) return null;

  const title = format(due, "EEEE, MMM d, yyyy 'at' h:mm a");
  const diff = due.getTime() - now.getTime();
  const overdue = diff < 0;
  const abs = Math.abs(diff);

  // Compare calendar days, not raw milliseconds: "due Monday evening, seen
  // Wednesday morning" is day-after-tomorrow, not "tomorrow".
  const days = differenceInCalendarDays(due, now);

  if (days <= 0) {
    if (overdue) {
      const label =
        abs < HOUR
          ? `${Math.max(1, Math.round(abs / MINUTE))}m overdue`
          : abs < DAY
            ? `${Math.round(abs / HOUR)}h overdue`
            : `${Math.round(abs / DAY)}d overdue`;
      return { label, title, overdue: true, today: days === 0 };
    }
    return { label: `Today, ${format(due, "h:mm a")}`, title, overdue: false, today: true };
  }

  if (days === 1) {
    return { label: `Tomorrow, ${format(due, "h:mm a")}`, title, overdue: false, today: false };
  }

  if (days <= 6) {
    return { label: `Due ${format(due, "EEEE")}`, title, overdue: false, today: false };
  }

  return { label: `Due ${format(due, "MMM d")}`, title, overdue: false, today: false };
}
