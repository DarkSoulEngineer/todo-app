import { makeId } from "@/lib/utils/id";
import { isValid, parseISO } from "date-fns";
import type { ActivityEvent, Attachment, Subtask, Task, TaskDraft } from "@/lib/domain/types";
import { applyCardTags, normalizeCardTags } from "@/lib/features/special-card-tags";

export function normalizeTags(tags: readonly unknown[] | undefined): string[] {
  return normalizeCardTags(tags);
}

export function normalizeAttachment(value: unknown): Attachment | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string" || !record.name.trim()) return null;
  if (typeof record.url !== "string" || !record.url.trim()) return null;
  const attachment: Attachment = {
    id: typeof record.id === "string" && record.id ? record.id : makeId(8),
    name: record.name,
    url: record.url,
  };
  if (typeof record.mimeType === "string") attachment.mimeType = record.mimeType;
  if (typeof record.size === "number" && Number.isFinite(record.size) && record.size >= 0) {
    attachment.size = record.size;
  }
  return attachment;
}

export function cloneAttachment(attachment: Attachment): Attachment | null {
  return normalizeAttachment(attachment);
}

export function normalizeActivityEvent(value: unknown): ActivityEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.type !== "string" ||
    !record.type.trim() ||
    typeof record.message !== "string" ||
    !record.message.trim() ||
    typeof record.createdAt !== "string" ||
    !record.createdAt.trim()
  ) {
    return null;
  }
  if (!isValid(parseISO(record.createdAt))) return null;
  return {
    id: record.id,
    type: record.type,
    message: record.message,
    createdAt: record.createdAt,
  };
}

export function cloneActivityEvent(event: ActivityEvent): ActivityEvent | null {
  return normalizeActivityEvent(event);
}

export function cloneTask(task: Task): Task {
  return {
    ...task,
    subtasks: (task.subtasks ?? []).map((subtask: Subtask) => ({ ...subtask })),
    tags: [...(task.tags ?? [])],
    attachments: (task.attachments ?? [])
      .map(cloneAttachment)
      .filter((attachment): attachment is Attachment => attachment !== null),
    activity: (task.activity ?? [])
      .map(cloneActivityEvent)
      .filter((event): event is ActivityEvent => event !== null)
      .slice(-50),
  };
}

function isPriority(value: unknown): value is Task["priority"] {
  return value === "critical" || value === "high" || value === "medium" || value === "low";
}

/** Applies only supported task fields; metadata containers remain append-only. */
export function applyTaskPatch(task: Task, patch: unknown): Task {
  if (typeof patch !== "object" || patch === null) return cloneTask(task);
  const record = patch as Record<string, unknown>;
  const next = cloneTask(task);
  if (typeof record.title === "string") next.title = record.title;
  if (typeof record.description === "string") next.description = record.description;
  if (record.dueAt === null || typeof record.dueAt === "string") next.dueAt = record.dueAt;
  if (isPriority(record.priority)) next.priority = record.priority;
  if (record.category === null || typeof record.category === "string") next.category = record.category;
  if (record.sectionId === null || typeof record.sectionId === "string") next.sectionId = record.sectionId;
  if (Array.isArray(record.subtasks)) {
    next.subtasks = record.subtasks
      .filter((subtask): subtask is Record<string, unknown> => typeof subtask === "object" && subtask !== null)
      .filter((subtask) => typeof subtask.title === "string" && typeof subtask.done === "boolean")
      .map((subtask) => ({
        id: typeof subtask.id === "string" ? subtask.id : makeId(8),
        title: subtask.title as string,
        done: subtask.done as boolean,
      }));
  }
  return Array.isArray(record.tags) ? applyCardTags(next, record.tags) : next;
}

/** Builds a fresh task; only explicit status tags change its initial state. */
export function createTask(draft: TaskDraft): Task {
  const now = new Date().toISOString();
  
  const task: Task = {
    id: makeId(10),
    title: draft.title.trim(),
    description: draft.description.trim(),
    dueAt: draft.dueAt,
    priority: draft.priority,
    category: draft.category,
    completed: false,
    canceled: false,
    sectionId: null,
    subtasks: draft.subtasks.map((subtask) => ({
      id: subtask.id || makeId(8),
      title: subtask.title.trim(),
      done: subtask.done,
    })),
    tags: [],
    specialTagsVersion: 1,
    attachments: [],
    activity: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  return applyCardTags(task, draft.tags ?? [], now);
}

/** Applies editable fields from a draft onto an existing task.
 *
 * Status is NOT re-derived from keywords here: editing any field (title,
 * description, due date, …) must never silently set or clear `completed`,
 * `canceled` or `completedAt`. Explicit status-tag edits are the exception;
 * titles and holder names never drive state.
 */
export function applyDraft(task: Task, draft: TaskDraft): Task {
  const next = {
    ...cloneTask(task),
    title: draft.title.trim(),
    description: draft.description.trim(),
    dueAt: draft.dueAt,
    priority: draft.priority,
    category: draft.category,
    subtasks: draft.subtasks.map((subtask) => ({
      id: subtask.id || makeId(8),
      title: subtask.title.trim(),
      done: subtask.done,
    })),
    updatedAt: new Date().toISOString(),
  };
  return draft.tags === undefined ? next : applyCardTags(next, draft.tags, next.updatedAt);
}
