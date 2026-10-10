import { isValid, parseISO } from "date-fns";
import { nanoid } from "nanoid";
import { PROBE_KEY, STORAGE_KEY } from "@/lib/constants";
import { defaultSections, normalizeSections, reconcileSectionIds } from "@/lib/sections";
import type { BoardSection, Priority, Subtask, Task, Workspace } from "@/lib/types";

interface PersistedState {
  version: number;
  tasks: Task[];
  sections: BoardSection[];
}

const CURRENT_VERSION = 2;

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
    sectionId: typeof record.sectionId === "string" && record.sectionId ? record.sectionId : null,
    subtasks,
    createdAt,
    updatedAt: normalizeDate(record.updatedAt) ?? createdAt,
    completedAt: completed ? normalizeDate(record.completedAt) : null,
  };
}

/** Splits a parsed payload into a raw task array and a raw section value. */
function extractParts(parsed: unknown): { tasks: unknown; sections: unknown } {
  if (Array.isArray(parsed)) return { tasks: parsed, sections: undefined };
  const record = (parsed ?? {}) as Record<string, unknown>;
  return { tasks: record.tasks, sections: record.sections };
}

/** Builds a validated workspace from unknown persisted/imported data. */
function buildWorkspace(parsed: unknown): Workspace | null {
  const { tasks: rawTasks, sections: rawSections } = extractParts(parsed);
  if (!Array.isArray(rawTasks)) return null;

  const tasks = rawTasks.map(normalizeTask).filter((task): task is Task => task !== null);
  const sections = normalizeSections(rawSections);
  reconcileSectionIds(tasks, sections);
  return { tasks, sections };
}

/** Reads the workspace from localStorage. Always safe to call, even on the server. */
export function loadWorkspace(): { workspace: Workspace; hadData: boolean } {
  const empty: Workspace = { tasks: [], sections: defaultSections() };
  if (typeof window === "undefined") return { workspace: empty, hadData: false };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { workspace: empty, hadData: false };

    const workspace = buildWorkspace(JSON.parse(raw));
    if (!workspace) return { workspace: empty, hadData: false };
    return { workspace, hadData: true };
  } catch {
    return { workspace: empty, hadData: false };
  }
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

export type StorageState = "ready" | "unavailable" | "full";

/**
 * Distinguishes storage that is blocked entirely (private mode, cookies off)
 * from a usable store. Used to explain save failures to the user.
 */
export function getStorageState(): StorageState {
  if (typeof window === "undefined") return "unavailable";
  try {
    window.localStorage.setItem(PROBE_KEY, "1");
    window.localStorage.removeItem(PROBE_KEY);
    return "ready";
  } catch {
    return "unavailable";
  }
}

/**
 * True when localStorage still accepts writes even though saving the workspace
 * failed — i.e. the write failed because the quota is exhausted.
 */
function isQuotaExceeded(): boolean {
  try {
    window.localStorage.setItem(PROBE_KEY, "1");
    window.localStorage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Persists the workspace to localStorage. */
export function saveWorkspace(workspace: Workspace): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedState = {
      version: CURRENT_VERSION,
      tasks: workspace.tasks,
      sections: workspace.sections,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage blocked or full — the app keeps working from memory. When the
    // quota is the problem, announce it so the UI can warn the user instead
    // of silently dropping every write.
    if (isQuotaExceeded()) {
      window.dispatchEvent(new CustomEvent("stride:storage-full"));
    }
  }
}
