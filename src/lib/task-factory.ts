import { nanoid } from "nanoid";
import type { Task, TaskDraft } from "@/lib/types";

/** Builds a fresh task from a draft, trimming text and stamping timestamps. */
export function createTask(draft: TaskDraft): Task {
  const now = new Date().toISOString();
  return {
    id: nanoid(10),
    title: draft.title.trim(),
    description: draft.description.trim(),
    dueAt: draft.dueAt,
    priority: draft.priority,
    category: draft.category,
    completed: false,
    canceled: false,
    sectionId: null,
    subtasks: draft.subtasks.map((subtask) => ({
      id: subtask.id || nanoid(8),
      title: subtask.title.trim(),
      done: subtask.done,
    })),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

/** Applies editable fields from a draft onto an existing task. */
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
