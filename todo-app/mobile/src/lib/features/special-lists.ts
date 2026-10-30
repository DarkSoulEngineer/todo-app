import type { Task } from "@/lib/domain/types";

export interface SpecialListRule {
  id: "completed" | "canceled" | "open";
  names: readonly string[];
  label: string;
  symbol: string;
}

export const SPECIAL_LIST_RULES: readonly SpecialListRule[] = [
  { id: "completed", names: ["done", "complete", "completed", "finished", "resolved", "delivered", "shipped"], label: "On entry · Mark complete", symbol: "✓" },
  { id: "canceled", names: ["canceled", "cancelled", "cancel", "dropped", "abandoned"], label: "On entry · Cancel task", symbol: "×" },
  { id: "open", names: ["to do", "to-do", "todo", "backlog", "in progress", "in-progress", "doing", "active", "open", "pending"], label: "On entry · Reopen task", symbol: "↻" },
];

/** Exact names only: “Not done” and “Completed research” are ordinary lists. */
export function getSpecialListRule(title: string): SpecialListRule | null {
  const name = title.normalize("NFKC").toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  return SPECIAL_LIST_RULES.find((rule) => rule.names.includes(name)) ?? null;
}

/** Run only on explicit placement, never on rename, load, or rendering. */
export function specialListTaskPatch(task: Task, title: string, stamp: string): Partial<Task> {
  switch (getSpecialListRule(title)?.id) {
    case "completed": return { completed: true, canceled: false, completedAt: task.completed && task.completedAt ? task.completedAt : stamp };
    case "canceled": return { completed: false, canceled: true, completedAt: null };
    case "open": return { completed: false, canceled: false, completedAt: null };
    default: return {};
  }
}
