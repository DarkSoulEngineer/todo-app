import { nanoid } from "nanoid";
import type { Task, TaskDraft } from "@/lib/domain/types";
import { detectStatusFromText } from "@/lib/domain/status-keywords";

/** Builds a fresh task from a draft, trimming text and stamping timestamps.
 * Auto-detects status from title/description keywords if present. */
export function createTask(draft: TaskDraft): Task {
  const now = new Date().toISOString();
  
  // Auto-detect status from title/description keywords
  const detectedStatus = detectStatusFromText(draft.title, draft.description);
  
  return {
    id: nanoid(10),
    title: draft.title.trim(),
    description: draft.description.trim(),
    dueAt: draft.dueAt,
    priority: draft.priority,
    category: draft.category,
    completed: detectedStatus === "completed",
    canceled: detectedStatus === "canceled",
    sectionId: null,
    subtasks: draft.subtasks.map((subtask) => ({
      id: subtask.id || nanoid(8),
      title: subtask.title.trim(),
      done: subtask.done,
    })),
    createdAt: now,
    updatedAt: now,
    completedAt: detectedStatus === "completed" ? now : null,
  };
}

/** Applies editable fields from a draft onto an existing task.
 *
 * Status is NOT re-derived from keywords here: editing any field (title,
 * description, due date, …) must never silently set or clear `completed`,
 * `canceled` or `completedAt`. Those only change through explicit user
 * actions elsewhere. Keyword auto-detection remains a create-time feature.
 */
export function applyDraft(task: Task, draft: TaskDraft): Task {
  return {
    ...task,
    title: draft.title.trim(),
    description: draft.description.trim(),
    dueAt: draft.dueAt,
    priority: draft.priority,
    category: draft.category,
    subtasks: draft.subtasks.map((subtask) => ({
      id: subtask.id || nanoid(8),
      title: subtask.title.trim(),
      done: subtask.done,
    })),
    updatedAt: new Date().toISOString(),
  };
}
