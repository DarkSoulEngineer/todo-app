import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import type { Task, TaskStatus } from "@/lib/domain/types";

/**
 * Canonical, presentation-neutral status labels. Held in the pure domain so both
 * domain logic (section titles) and the UI layer share a single source of truth.
 */
export const STATUS_LABELS: Record<TaskStatus, string> = {
  upcoming: "Upcoming",
  overdue: "Overdue",
  completed: "Completed",
  canceled: "Canceled",
};

/**
 * Status priority: an explicit completion or cancellation always wins.
 * Everything else is derived from the due date (no due date counts as upcoming).
 */
export function deriveStatus(task: Task, now: Date): TaskStatus {
  if (task.completed) return "completed";
  if (task.canceled) return "canceled";
  if (task.tags?.some((tag) => tag.trim().toLowerCase() === "overdue")) return "overdue";

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
