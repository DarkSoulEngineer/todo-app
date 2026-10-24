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
    text: "text-destructive",
    chip: "bg-destructive/12 text-destructive ring-destructive/25",
    solid: "bg-destructive",
  },
  upcoming: {
    label: STATUS_LABELS.upcoming,
    blurb: "Still open, with time to spare.",
    icon: CalendarClock,
    text: "text-info",
    chip: "bg-info/12 text-info ring-info/25",
    solid: "bg-info",
  },
  completed: {
    label: STATUS_LABELS.completed,
    blurb: "Done and dusted.",
    icon: Check,
    text: "text-success",
    chip: "bg-success/12 text-success ring-success/25",
    solid: "bg-success",
  },
  canceled: {
    label: STATUS_LABELS.canceled,
    blurb: "Set aside for now.",
    icon: Ban,
    text: "text-muted-foreground",
    chip: "bg-muted text-muted-foreground ring-border",
    solid: "bg-muted-foreground",
  },
};
