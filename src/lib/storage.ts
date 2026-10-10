import { isValid, parseISO } from "date-fns";
import { nanoid } from "nanoid";
import { STORAGE_KEY } from "@/lib/constants";
import type { Priority, Subtask, Task } from "@/lib/types";

interface PersistedState {
  version: number;
  tasks: Task[];
}

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
    id: asString(record.id) || nanoid(8),
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
    id: asString(record.id) || nanoid(10),
    title,
    description: asString(record.description),
    dueAt: normalizeDate(record.dueAt),
    priority: isPriority(record.priority) ? record.priority : "medium",
    category: typeof record.category === "string" && record.category ? record.category : null,
    completed,
    canceled,
    subtasks,
    createdAt,
    updatedAt: normalizeDate(record.updatedAt) ?? createdAt,
    completedAt: completed ? normalizeDate(record.completedAt) : null,
  };
}

/** Reads tasks from localStorage. Always safe to call, even on the server. */
export function loadTasks(): { tasks: Task[]; hadData: boolean } {
  if (typeof window === "undefined") return { tasks: [], hadData: false };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tasks: [], hadData: false };

    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as Record<string, unknown>)?.tasks as unknown[] | undefined);

    if (!Array.isArray(list)) return { tasks: [], hadData: false };

    const tasks = list.map(normalizeTask).filter((task): task is Task => task !== null);
    return { tasks, hadData: true };
  } catch {
    return { tasks: [], hadData: false };
  }
}

/**
 * Reads a JSON backup string (either a bare array or a `{ tasks }` payload).
 * Returns null when the text is not a usable task list.
 */
export function parseTasksJson(raw: string): Task[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as Record<string, unknown>)?.tasks as unknown[] | undefined);

    if (!Array.isArray(list)) return null;

    return list.map(normalizeTask).filter((task): task is Task => task !== null);
  } catch {
    return null;
  }
}

/** Persists tasks to localStorage. Fails silently when storage is unavailable. */
export function saveTasks(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedState = { version: 1, tasks };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or blocked (private mode) — the app still works in-memory.
  }
}
