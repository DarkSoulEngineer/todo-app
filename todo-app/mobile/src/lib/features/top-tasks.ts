import type { BoardTaskEntry } from "@/hooks/use-all-board-tasks";
import type { Priority } from "@/lib/domain/types";

export type TopTasksLimit = 3 | 10;
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function timestamp(value: string | null, fallback: number): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Priority first; within a priority, overdue/earlier deadlines precede undated work. */
export function rankTopTasks(entries: BoardTaskEntry[]): BoardTaskEntry[] {
  return entries.filter(({ task }) => !task.completed && !task.canceled).sort((a, b) => {
    const priority = PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
    if (priority) return priority;
    const aDue = timestamp(a.task.dueAt, Number.POSITIVE_INFINITY);
    const bDue = timestamp(b.task.dueAt, Number.POSITIVE_INFINITY);
    if (aDue !== bDue) return aDue < bDue ? -1 : 1;
    const created = timestamp(a.task.createdAt, 0) - timestamp(b.task.createdAt, 0);
    if (created) return created;
    return a.projectId.localeCompare(b.projectId) || a.task.id.localeCompare(b.task.id);
  });
}

export function getTopTasks(entries: BoardTaskEntry[], limit: TopTasksLimit): BoardTaskEntry[] {
  return rankTopTasks(entries).slice(0, limit);
}
