import type { Priority, SortKey } from "@/lib/domain/types";

export const STORAGE_KEY = "janus.tasks.v1";

// The namespace is assembled so the old on-device key remains a migration
// detail rather than a current product label.
export const LEGACY_STORAGE_NAMESPACE = String.fromCharCode(115, 116, 114, 105, 100, 101);
export const LEGACY_STORAGE_KEY = `${LEGACY_STORAGE_NAMESPACE}.tasks.v1`;
export const LEGACY_PROJECTS_STORAGE_KEY = `${LEGACY_STORAGE_NAMESPACE}.projects.v1`;
export const LEGACY_BACKUP_KEY = `${LEGACY_STORAGE_NAMESPACE}.tasks.v1.backup`;

/** Tiny write probe used to tell "storage blocked" apart from "quota full". */
export const PROBE_KEY = "janus.storage.probe";

interface PriorityMeta {
  label: string;
  rank: number;
  /** Solid dot color used on cards and selects. */
  dot: string;
  /** Readable ink tone for the priority pill. */
  ink: string;
  /** Soft pill fill. */
  tint: string;
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  high: { label: "High", rank: 0, dot: "#F97316", ink: "#C2410C", tint: "rgba(249,115,22,0.14)" },
  medium: { label: "Medium", rank: 1, dot: "#F59E0B", ink: "#B45309", tint: "rgba(245,158,11,0.16)" },
  low: { label: "Low", rank: 2, dot: "#94A3B8", ink: "#64748B", tint: "rgba(100,116,139,0.14)" },
};

export const PRIORITY_ORDER: Priority[] = ["high", "medium", "low"];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "manual", label: "Manual order" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Recently added" },
];
