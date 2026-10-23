import { isValid, parseISO } from "date-fns";
import { defaultBoards, normalizeBoards } from "@/lib/domain/boards";
import { isCategoryId } from "@/lib/domain/categories";
import { defaultSections, normalizeSections, reconcileSectionIds } from "@/lib/domain/sections";
import type { Priority, Subtask, Task, Workspace } from "@/lib/domain/types";
import { makeId } from "@/lib/utils/id";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

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
  const record = (parsed ?? {}) as Record<string, unknown>;
  return {
    tasks: record.tasks,
    sections: record.sections,
    boards: record.boards,
    deletedCategories: record.deletedCategories,
  };
}

/** Keeps known category ids only, de-duplicated, in the order they appear. */
function normalizeDeletedCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (!isCategoryId(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

/** Builds a validated workspace from unknown persisted/imported data. */
export function buildWorkspace(parsed: unknown): Workspace | null {
  const { tasks: rawTasks, sections: rawSections, boards: rawBoards, deletedCategories: rawDeleted } =
    extractParts(parsed);
  if (!Array.isArray(rawTasks)) return null;

  const tasks = rawTasks.map(normalizeTask).filter((task): task is Task => task !== null);
  const sections = normalizeSections(rawSections);
  reconcileSectionIds(tasks, sections);
  // Older payloads have no boards: start from the built-ins minus whatever the
  // user had deleted as a category.
  const boards = normalizeBoards(rawBoards, normalizeDeletedCategories(rawDeleted));
  return { tasks, sections, boards };
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
