import type { Priority, SortKey } from "@/lib/types";

export const STORAGE_KEY = "stride.tasks.v1";

/** Tiny write probe used to tell "storage blocked" apart from "quota full". */
export const PROBE_KEY = "stride.storage.probe";

interface PriorityMeta {
  label: string;
  rank: number;
  /** Solid dot color used on cards and selects. */
  dot: string;
  /** Pill styling used on the card and in menus. */
  pill: string;
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  high: {
    label: "High",
    rank: 0,
    dot: "bg-orange-500",
    pill: "bg-orange-500/12 text-orange-700 ring-orange-500/25 dark:text-orange-300",
  },
  medium: {
    label: "Medium",
    rank: 1,
    dot: "bg-amber-500",
    pill: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  },
  low: {
    label: "Low",
    rank: 2,
    dot: "bg-slate-400",
    pill: "bg-slate-500/12 text-slate-600 ring-slate-500/25 dark:text-slate-300",
  },
};

export const PRIORITY_ORDER: Priority[] = ["high", "medium", "low"];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "manual", label: "Manual order" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Recently added" },
];
