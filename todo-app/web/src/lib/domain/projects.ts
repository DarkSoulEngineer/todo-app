import { makeId } from "@/lib/utils/id";
import { defaultBoards } from "@/lib/domain/boards";
import {
  LEGACY_BACKUP_KEY,
  LEGACY_PROJECTS_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  PROBE_KEY,
  STORAGE_KEY,
} from "@/lib/domain/constants";
import { defaultSections } from "@/lib/domain/sections";
import { buildWorkspace, loadWorkspace } from "@/lib/data/storage";
import type { Workspace } from "@/lib/domain/types";

/**
 * Boards-as-tenants persistence.
 *
 * A board is an independent project: it owns a full workspace (tasks,
 * sections and boards/categories). The registry (`ProjectsState`) is the
 * persisted source of truth; the app hydrates the active project's
 * workspace into task state and writes changes back into that slot.
 *
 * Migration: apps running before boards existed stored a single workspace
 * under the older single-workspace key. On first load that payload is
 * wrapped into one project ("My board") and the legacy key removed, so a
 * restart never resurrects stale data.
 */

export const PROJECTS_STORAGE_KEY = "janus.projects.v1";

const PROJECTS_VERSION = 1;
const DEFAULT_PROJECT_NAME = "My board";
const NEW_BOARD_NAME = "New board";

export interface JanusProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  workspace: Workspace;
}

export interface ProjectsState {
  version: number;
  /** Id of the currently loaded project. */
  currentId: string;
  projects: JanusProject[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneWorkspace(workspace: Workspace): Workspace {
  return JSON.parse(JSON.stringify(workspace)) as Workspace;
}

export function emptyWorkspace(): Workspace {
  return { tasks: [], sections: defaultSections(), boards: defaultBoards() };
}

/** Creates a fresh empty project (named "New board" unless a name is given). */
export function newProject(name?: string): JanusProject {
  const timestamp = nowIso();
  return {
    id: makeId(),
    name: name?.trim() || NEW_BOARD_NAME,
    createdAt: timestamp,
    updatedAt: timestamp,
    workspace: emptyWorkspace(),
  };
}

/** Deep-copies a project (new id, "… (copy)" name, identical workspace). */
export function cloneProject(source: JanusProject): JanusProject {
  const timestamp = nowIso();
  return {
    id: makeId(),
    name: `${source.name} (copy)`,
    createdAt: timestamp,
    updatedAt: timestamp,
    workspace: cloneWorkspace(source.workspace),
  };
}

/** Wraps an existing workspace into a new project (used by board import). */
export function projectFromWorkspace(name: string, workspace: Workspace): JanusProject {
  const timestamp = nowIso();
  return {
    id: makeId(),
    name: name.trim() || NEW_BOARD_NAME,
    createdAt: timestamp,
    updatedAt: timestamp,
    workspace: cloneWorkspace(workspace),
  };
}

/** Writes a workspace into a project slot and stamps updatedAt. */
export function withWorkspace(
  state: ProjectsState,
  projectId: string,
  workspace: Workspace
): ProjectsState {
  if (!state.projects.some((project) => project.id === projectId)) return state;
  return {
    ...state,
    projects: state.projects.map((project) =>
      project.id === projectId
        ? { ...project, workspace: cloneWorkspace(workspace), updatedAt: nowIso() }
        : project
    ),
  };
}

export function activeProject(state: ProjectsState): JanusProject {
  return state.projects.find((project) => project.id === state.currentId) ?? state.projects[0];
}

/**
 * Validates a parsed registry payload. Anything malformed falls back to the
 * legacy migration path in `loadProjects`, so the app can never boot empty.
 */
function sanitizeRegistry(raw: unknown): ProjectsState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<ProjectsState>;
  if (!Array.isArray(value.projects) || value.projects.length === 0) return null;
  const projects: JanusProject[] = [];
  const seenIds = new Set<string>();
  for (const entry of value.projects) {
    if (!entry || typeof entry !== "object") return null;
    const candidate = entry as Partial<JanusProject>;
    const workspace = buildWorkspace(candidate.workspace);
    if (
      typeof candidate.id !== "string" ||
      !candidate.id ||
      seenIds.has(candidate.id) ||
      typeof candidate.name !== "string" ||
      !candidate.name.trim() ||
      !workspace
    ) {
      return null;
    }
    seenIds.add(candidate.id);
    projects.push({
      id: candidate.id,
      name: candidate.name.trim(),
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : nowIso(),
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : nowIso(),
      workspace,
    });
  }
  const currentId =
    typeof value.currentId === "string" && projects.some((project) => project.id === value.currentId)
      ? value.currentId
      : projects[0].id;
  return { version: PROJECTS_VERSION, currentId, projects };
}

/**
 * Reads the project registry. Order of preference:
 * 1. A valid current registry.
 * 2. A valid registry from an older release.
 * 3. Older single-workspace migration (wrapped into "My board").
 * 3. A fresh empty starter project.
 *
 * Migration persists the new registry BEFORE dropping the legacy key, so a
 * failed write (quota full) can never turn into silent data loss.
 */
export function loadProjects(): ProjectsState {
  if (typeof window === "undefined") {
    return { version: PROJECTS_VERSION, currentId: "", projects: [newProject(DEFAULT_PROJECT_NAME)] };
  }
  try {
    for (const key of [PROJECTS_STORAGE_KEY, LEGACY_PROJECTS_STORAGE_KEY]) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      let parsed: ProjectsState | null;
      try {
        parsed = sanitizeRegistry(JSON.parse(raw));
      } catch {
        continue;
      }
      if (!parsed) continue;
      if (key !== PROJECTS_STORAGE_KEY && saveProjects(parsed)) {
        window.localStorage.removeItem(LEGACY_PROJECTS_STORAGE_KEY);
      }
      return parsed;
    }
  } catch {
    // Unreadable registry: same fallback as a corrupt one.
  }

  const { workspace, hadData } = loadWorkspace();
  const migrated: JanusProject = {
    id: makeId(),
    name: DEFAULT_PROJECT_NAME,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    workspace,
  };
  const registry: ProjectsState = {
    version: PROJECTS_VERSION,
    currentId: migrated.id,
    projects: [migrated],
  };

  // Keep a recoverable copy of the legacy payload while migrating. It is only
  // dropped once the registry is confirmed written.
  if (hadData) {
    try {
      window.localStorage.setItem(
        LEGACY_BACKUP_KEY,
        window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? window.localStorage.getItem(STORAGE_KEY) ?? ""
      );
    } catch {
      // No room for a backup: the legacy key itself is still the fallback.
    }
  }

  // Persist first, then retire the legacy key. If the write fails the old key
  // survives, so the next load retries the migration instead of booting empty.
  if (saveProjects(registry)) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_PROJECTS_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_BACKUP_KEY);
    } catch {
      // Storage unavailable: the registry wins on the next load anyway.
    }
  }
  return registry;
}

/**
 * Persists the registry and reports quota exhaustion the same way the rest of
 * storage does. Returns false when the write failed, so a caller can tell
 * whether it is safe to drop the data the registry was migrated from.
 */
export function saveProjects(state: ProjectsState): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    if (isQuotaExceeded()) {
      window.dispatchEvent(new CustomEvent("janus:storage-full"));
    }
    return false;
  }
}

function isQuotaExceeded(): boolean {
  try {
    window.localStorage.setItem(PROBE_KEY, "1");
    window.localStorage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}
