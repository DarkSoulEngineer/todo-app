import { nanoid } from "nanoid";
import { defaultBoards } from "@/lib/boards";
import { PROBE_KEY, STORAGE_KEY } from "@/lib/constants";
import { defaultSections } from "@/lib/sections";
import { buildWorkspace, loadWorkspace } from "@/lib/storage";
import type { Workspace } from "@/lib/types";

/**
 * Boards-as-tenants persistence.
 *
 * A board is an independent project: it owns a full workspace (tasks,
 * sections and boards/categories). The registry (`ProjectsState`) is the
 * persisted source of truth; the app hydrates the active project's
 * workspace into task state and writes changes back into that slot.
 *
 * Migration: apps running before boards existed stored a single workspace
 * under the legacy `stride.tasks.v1` key. On first load that payload is
 * wrapped into one project ("My board") and the legacy key removed, so a
 * restart never resurrects stale data.
 */

export const PROJECTS_STORAGE_KEY = "stride.projects.v1";

/** Copy of the legacy workspace, kept until the registry is safely written. */
const LEGACY_BACKUP_KEY = "stride.tasks.v1.backup";

const PROJECTS_VERSION = 1;
const DEFAULT_PROJECT_NAME = "My board";
const NEW_BOARD_NAME = "New board";

export interface StrideProject {
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
  projects: StrideProject[];
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
export function newProject(name?: string): StrideProject {
  const timestamp = nowIso();
  return {
    id: nanoid(),
    name: name?.trim() || NEW_BOARD_NAME,
    createdAt: timestamp,
    updatedAt: timestamp,
    workspace: emptyWorkspace(),
  };
}

/** Deep-copies a project (new id, "… (copy)" name, identical workspace). */
export function cloneProject(source: StrideProject): StrideProject {
  const timestamp = nowIso();
  return {
    id: nanoid(),
    name: `${source.name} (copy)`,
    createdAt: timestamp,
    updatedAt: timestamp,
    workspace: cloneWorkspace(source.workspace),
  };
}

/** Wraps an existing workspace into a new project (used by board import). */
export function projectFromWorkspace(name: string, workspace: Workspace): StrideProject {
  const timestamp = nowIso();
  return {
    id: nanoid(),
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

export function activeProject(state: ProjectsState): StrideProject {
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
  const projects: StrideProject[] = [];
  for (const entry of value.projects) {
    if (!entry || typeof entry !== "object") return null;
    const candidate = entry as Partial<StrideProject>;
    const workspace = buildWorkspace(candidate.workspace);
    if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || !workspace) {
      return null;
    }
    projects.push({
      id: candidate.id,
      name: candidate.name,
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
 * 1. A valid `stride.projects.v1` registry.
 * 2. Legacy single-workspace migration (wrapped into "My board").
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
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = sanitizeRegistry(JSON.parse(raw));
      if (parsed) return parsed;
      // Corrupt registry: fall through to migration, which re-seeds from
      // whatever legacy state exists (or a fresh project).
    }
  } catch {
    // Unreadable registry — same fallback as a corrupt one.
  }

  const { workspace, hadData } = loadWorkspace();
  const migrated: StrideProject = {
    id: nanoid(),
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
        window.localStorage.getItem(STORAGE_KEY) ?? ""
      );
    } catch {
      // No room for a backup — the legacy key itself is still the fallback.
    }
  }

  // Persist first, then retire the legacy key. If the write fails the old key
  // survives, so the next load retries the migration instead of booting empty.
  if (saveProjects(registry)) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_BACKUP_KEY);
    } catch {
      // Storage unavailable — the registry wins on the next load anyway.
    }
  }
  return registry;
}

/**
 * Persists the registry, mirroring `saveWorkspace`' quota reporting. Returns
 * false when the write failed, so a caller can tell whether it is safe to drop
 * the data the registry was migrated from.
 */
export function saveProjects(state: ProjectsState): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    if (isQuotaExceeded()) {
      window.dispatchEvent(new CustomEvent("stride:storage-full"));
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
