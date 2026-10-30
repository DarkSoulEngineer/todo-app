import { isValid, parseISO } from "date-fns";
import { defaultBoards, normalizeBoards } from "@/lib/domain/boards";
import { defaultSections, normalizeSections, reconcileSectionIds } from "@/lib/domain/sections";
import type { ActivityEvent, Attachment, Priority, Subtask, Task, Workspace } from "@/lib/domain/types";
import { makeId } from "@/lib/utils/id";
import { migrateCardTags, normalizeCardTags } from "@/lib/features/special-card-tags";

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && (PRIORITIES as string[]).includes(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Accepts ISO strings only; anything unparseable becomes null. */
function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = parseISO(value);
  return isValid(date) ? date.toISOString() : null;
}

function normalizeSubtask(value: unknown): Subtask | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const title = asString(record.title).trim();
  if (!title) return null;
  return {
    id: asString(record.id) || makeId(8),
    title,
    done: record.done === true,
  };
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeAttachment(value: unknown): Attachment | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const name = optionalString(record, "name");
  const url = optionalString(record, "url");
  if (!name || !url) return null;
  const attachment: Attachment = { id: asString(record.id) || makeId(8), name, url };
  const mimeType = optionalString(record, "mimeType");
  if (mimeType) attachment.mimeType = mimeType;
  if (typeof record.size === "number" && Number.isFinite(record.size) && record.size >= 0) {
    attachment.size = record.size;
  }
  return attachment;
}

function normalizeActivityEvent(value: unknown): ActivityEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const type = optionalString(record, "type");
  const message = optionalString(record, "message");
  const createdAt = normalizeDate(record.createdAt) ?? normalizeDate(record.timestamp);
  if (!type || !message || !createdAt) return null;
  return {
    id: asString(record.id) || makeId(8),
    type,
    message,
    createdAt,
  };
}

function normalizeTags(value: unknown): string[] {
  return normalizeCardTags(Array.isArray(value) ? value : []);
}

/** Turns unknown persisted data into a safe, fully-populated Task. */
function normalizeTask(value: unknown): Task | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;

  const title = asString(record.title).trim();
  if (!title) return null;

  const createdAt = normalizeDate(record.createdAt) ?? new Date().toISOString();
  const completed = record.completed === true;
  const canceled = completed ? false : record.canceled === true;

  const subtasks = Array.isArray(record.subtasks)
    ? record.subtasks.map(normalizeSubtask).filter((item): item is Subtask => item !== null)
    : [];
  const attachments = Array.isArray(record.attachments)
    ? record.attachments
        .map(normalizeAttachment)
        .filter((item): item is Attachment => item !== null)
    : [];
  const activity = Array.isArray(record.activity)
    ? record.activity
        .map(normalizeActivityEvent)
        .filter((item): item is ActivityEvent => item !== null)
        .slice(-50)
    : [];

  return {
    id: asString(record.id) || makeId(10),
    title,
    description: asString(record.description),
    dueAt: normalizeDate(record.dueAt),
    priority: isPriority(record.priority) ? record.priority : "medium",
    category: typeof record.category === "string" && record.category ? record.category : null,
    completed,
    canceled,
    sectionId: typeof record.sectionId === "string" && record.sectionId ? record.sectionId : null,
    subtasks,
    createdAt,
    updatedAt: normalizeDate(record.updatedAt) ?? createdAt,
    completedAt: completed ? normalizeDate(record.completedAt) : null,
    tags: normalizeTags(record.tags),
    specialTagsVersion: record.specialTagsVersion === 1 ? 1 : undefined,
    attachments,
    activity,
  };
}

/** Splits a parsed payload into its raw parts. */
function extractParts(parsed: unknown): {
  tasks: unknown;
  sections: unknown;
  boards: unknown;
  deletedCategories: unknown;
} {
  if (Array.isArray(parsed)) {
    return { tasks: parsed, sections: undefined, boards: undefined, deletedCategories: undefined };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { tasks: undefined, sections: undefined, boards: undefined, deletedCategories: undefined };
  }

  const record = parsed as Record<string, unknown>;
  // Board exports from the web app wrap the portable workspace in metadata:
  // `{ workspace: { tasks, sections, boards } }`. Once that property is
  // present, use it as the source of truth rather than falling back to the
  // wrapper; this keeps malformed wrappers from being treated as a different
  // format and accidentally importing partial data.
  if (Object.prototype.hasOwnProperty.call(record, "workspace")) {
    const workspace = record.workspace;
    if (typeof workspace !== "object" || workspace === null || Array.isArray(workspace)) {
      return { tasks: undefined, sections: undefined, boards: undefined, deletedCategories: undefined };
    }
    return extractParts(workspace);
  }

  return {
    tasks: record.tasks,
    sections: record.sections,
    boards: record.boards,
    deletedCategories: record.deletedCategories,
  };
}

/** Builds a validated workspace from unknown persisted/imported data. */
export function buildWorkspace(parsed: unknown): Workspace | null {
  const { tasks: rawTasks, sections: rawSections, boards: rawBoards } =
    extractParts(parsed);
  if (!Array.isArray(rawTasks)) return null;

  const seenTaskIds = new Set<string>();
  const tasks = rawTasks
    .map(normalizeTask)
    .filter((task): task is Task => task !== null)
    .map((task) => {
      // Imported/backed-up data is untrusted. Duplicate ids would make updates
      // affect multiple rows, so retain the first id and regenerate collisions.
      let id = task.id;
      while (seenTaskIds.has(id)) id = makeId(10);
      seenTaskIds.add(id);

      const seenSubtaskIds = new Set<string>();
      const subtasks = task.subtasks.map((subtask) => {
        let subtaskId = subtask.id;
        while (seenSubtaskIds.has(subtaskId)) subtaskId = makeId(8);
        seenSubtaskIds.add(subtaskId);
        return subtaskId === subtask.id ? subtask : { ...subtask, id: subtaskId };
      });

      const seenAttachmentIds = new Set<string>();
      const attachments = task.attachments.map((attachment) => {
        let attachmentId = attachment.id;
        while (seenAttachmentIds.has(attachmentId)) attachmentId = makeId(8);
        seenAttachmentIds.add(attachmentId);
        return attachmentId === attachment.id ? attachment : { ...attachment, id: attachmentId };
      });

      const seenActivityIds = new Set<string>();
      const activity = task.activity.map((event) => {
        let eventId = event.id;
        while (seenActivityIds.has(eventId)) eventId = makeId(8);
        seenActivityIds.add(eventId);
        return eventId === event.id ? event : { ...event, id: eventId };
      });

      const subtasksUnchanged = subtasks.every((subtask, index) => subtask === task.subtasks[index]);
      const attachmentsUnchanged = attachments.every((attachment, index) => attachment === task.attachments[index]);
      const activityUnchanged = activity.every((event, index) => event === task.activity[index]);
      return id === task.id && subtasksUnchanged && attachmentsUnchanged && activityUnchanged
        ? task
        : { ...task, id, subtasks, attachments, activity };
    });
  const sections = normalizeSections(rawSections);
  reconcileSectionIds(tasks, sections);
  // Preserve explicitly saved tags; do not invent presets on load/import.
  const boards = normalizeBoards(rawBoards);
  return { tasks: tasks.map((task) => migrateCardTags(task, sections.find((section) => section.id === task.sectionId)?.title, boards)), sections, boards };
}

/**
 * Reads a JSON backup string (a bare task array or a `{ tasks, sections }`
 * payload). Returns null when the text is not a usable backup.
 */
export function parseWorkspaceJson(raw: string): Workspace | null {
  try {
    return buildWorkspace(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** The workspace a fresh install starts from: no tasks, no custom sections. */
export function emptyWorkspace(): Workspace {
  return { tasks: [], sections: defaultSections(), boards: defaultBoards() };
}
