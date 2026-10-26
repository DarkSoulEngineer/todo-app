import { makeId } from "@/lib/utils/id";
import { isValid, parseISO } from "date-fns";
import type { ActivityEvent, Attachment, Subtask, Task, TaskDraft } from "@/lib/domain/types";
import { detectStatusFromText } from "@/lib/domain/status-keywords";

export function normalizeTags(tags: readonly unknown[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const value = tag.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
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
  return value === "low" || value === "medium" || value === "high";
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
  if (Array.isArray(record.tags)) next.tags = normalizeTags(record.tags);
  return next;
}

/** Builds a fresh task from a draft, trimming text and stamping timestamps.
 * Auto-detects status from title/description keywords if present. */
export function createTask(draft: TaskDraft): Task {
  const now = new Date().toISOString();
  
  // Auto-detect status from title/description keywords
  const detectedStatus = detectStatusFromText(draft.title, draft.description);
  
  return {
    id: makeId(10),
    title: draft.title.trim(),
    description: draft.description.trim(),
    dueAt: draft.dueAt,
    priority: draft.priority,
    category: draft.category,
    completed: detectedStatus === "completed",
    canceled: detectedStatus === "canceled",
    sectionId: null,
    subtasks: draft.subtasks.map((subtask) => ({
      id: subtask.id || makeId(8),
      title: subtask.title.trim(),
      done: subtask.done,
    })),
    tags: normalizeTags(draft.tags),
    attachments: [],
    activity: [],
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
    tags: draft.tags === undefined ? [...task.tags] : normalizeTags(draft.tags),
    updatedAt: new Date().toISOString(),
  };
}
