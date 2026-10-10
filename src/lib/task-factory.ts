import { nanoid } from "nanoid";
import type { Task, TaskDraft } from "@/lib/types";
import { detectStatusFromText } from "@/lib/status-keywords";

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
 * Also re-evaluates auto-detected status from title/description. */
export function applyDraft(task: Task, draft: TaskDraft): Task {
  const detectedStatus = detectStatusFromText(draft.title, draft.description);
  
  return {
    ...task,
    title: draft.title.trim(),
    description: draft.description.trim(),
    dueAt: draft.dueAt,
    priority: draft.priority,
    category: draft.category,
    completed: detectedStatus === "completed" ? true : task.completed,
    canceled: detectedStatus === "canceled" ? true : task.canceled,
    completedAt: detectedStatus === "completed" && !task.completed ? new Date().toISOString() : task.completedAt,
    subtasks: draft.subtasks.map((subtask) => ({
      id: subtask.id || nanoid(8),
      title: subtask.title.trim(),
      done: subtask.done,
    })),
    updatedAt: new Date().toISOString(),
  };
}
