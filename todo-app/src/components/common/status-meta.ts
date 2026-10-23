import { Ban, CalendarClock, Check, TriangleAlert, type LucideIcon } from "lucide-react";
import { STATUS_LABELS } from "@/lib/domain/status";
import type { TaskStatus } from "@/lib/domain/types";

/**
 * Presentation metadata for task statuses: labels, copy, icons and the class
 * recipes for text/chips/underlines. Kept out of the pure domain module
 * (`@/lib/domain/status`) so domain logic never pulls in React or icons.
 */
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
    label: STATUS_LABELS.overdue,
    blurb: "Past their deadline and still open.",
    icon: TriangleAlert,
    text: "text-red-600 dark:text-red-400",
    chip: "bg-red-500/12 text-red-700 ring-red-500/25 dark:text-red-300",
    solid: "bg-red-500",
  },
  upcoming: {
    label: STATUS_LABELS.upcoming,
    blurb: "Still open, with time to spare.",
    icon: CalendarClock,
    text: "text-sky-600 dark:text-sky-400",
    chip: "bg-sky-500/12 text-sky-700 ring-sky-500/25 dark:text-sky-300",
    solid: "bg-sky-500",
  },
  completed: {
    label: STATUS_LABELS.completed,
    blurb: "Done and dusted.",
    icon: Check,
    text: "text-emerald-600 dark:text-emerald-400",
    chip: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
    solid: "bg-emerald-500",
  },
  canceled: {
    label: STATUS_LABELS.canceled,
    blurb: "Set aside for now.",
    icon: Ban,
    text: "text-slate-500 dark:text-slate-400",
    chip: "bg-slate-500/12 text-slate-600 ring-slate-500/25 dark:text-slate-300",
    solid: "bg-slate-400",
  },
};
