"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTasksContext } from "@/components/providers/tasks-provider";

/** Persisted window session: which boards are open and which one is in front. */
const STORAGE_KEY = "stride.windows.v1";
const VERSION = 1;

interface WindowsPayload {
  version: number;
  openIds: string[];
  activeId: string | null;
}

/** A board that owns an open window (and so appears on the taskbar). */
export interface OpenBoard {
  id: string;
  name: string;
}

export interface WindowsApi {
  /** False until the persisted session has been read on the client. */
  ready: boolean;
  /** Boards with an open window, in the order they were first opened. */
  openBoards: OpenBoard[];
  /** Board currently in front, or null while the desktop (taskbar) is showing. */
  activeId: string | null;
  /** Convenience for `activeId === null`. */
  minimized: boolean;
  /** Opens (or focuses) a board window and makes it the active one. */
  openBoard: (id: string) => void;
  /** Brings an already-open board back to the foreground. */
  activateBoard: (id: string) => void;
  /** Sends the active board to the taskbar and shows the desktop. */
  minimize: () => void;
  /** Removes a board window entirely (it stays in the board registry). */
  closeBoard: (id: string) => void;
}

function readPayload(): WindowsPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WindowsPayload>;
    if (!Array.isArray(parsed.openIds)) return null;
    return {
      version: VERSION,
      openIds: parsed.openIds.filter((id): id is string => typeof id === "string"),
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
    };
  } catch {
    // Unreadable session — start fresh rather than breaking the app.
    return null;
  }
}

function writePayload(openIds: string[], activeId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: VERSION, openIds, activeId } satisfies WindowsPayload),
    );
  } catch {
    // Storage blocked — the open windows still work for this session.
  }
}

/**
 * Window manager for the boards-as-windows model.
 *
 * Each opened board gets a window; only one is in front at a time and its
 * workspace is the one loaded by the task store (`switchProject`). Minimizing
 * drops `activeId` to null, which reveals the desktop and its taskbar. The
 * session (open ids + active id) is persisted, so a reload keeps the setup.
 */
export function useWindows(): WindowsApi {
  const { projects, currentProjectId, switchProject, isLoading } = useTasksContext();

  const [rawOpenIds, setRawOpenIds] = useState<string[]>([]);
  const [rawActiveId, setRawActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Hydrate once the board registry is loaded — the first-run seed needs the
  // current board id. A deliberate external-store read that must not run during
  // SSR, so the server and first client render agree.
  useEffect(() => {
    if (isLoading || ready) return;
    const stored = readPayload();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (stored) {
      setRawOpenIds(stored.openIds);
      setRawActiveId(stored.activeId);
    } else if (currentProjectId) {
      // No saved session: the current board starts as the single open window.
      setRawOpenIds([currentProjectId]);
      setRawActiveId(currentProjectId);
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isLoading, ready, currentProjectId]);

  // Drop windows whose board no longer exists; the active id must be an open one.
  const openIds = useMemo(() => {
    const known = new Set(projects.map((project) => project.id));
    return rawOpenIds.filter((id) => known.has(id));
  }, [rawOpenIds, projects]);

  const activeId = rawActiveId && openIds.includes(rawActiveId) ? rawActiveId : null;

  useEffect(() => {
    if (!ready) return;
    writePayload(openIds, activeId);
  }, [ready, openIds, activeId]);

  const openBoard = useCallback(
    (id: string) => {
      setRawOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setRawActiveId(id);
      switchProject(id);
    },
    [switchProject],
  );

  const activateBoard = useCallback(
    (id: string) => {
      setRawActiveId(id);
      switchProject(id);
    },
    [switchProject],
  );

  const minimize = useCallback(() => setRawActiveId(null), []);

  const closeBoard = useCallback((id: string) => {
    setRawOpenIds((prev) => prev.filter((openId) => openId !== id));
    setRawActiveId((prev) => (prev === id ? null : prev));
  }, []);

  const openBoards = useMemo(() => {
    const byId = new Map(projects.map((project) => [project.id, project]));
    return openIds.map((id) => ({ id, name: byId.get(id)?.name ?? "Board" }));
  }, [openIds, projects]);

  const minimized = activeId === null;

  return useMemo(
    () => ({
      ready,
      openBoards,
      activeId,
      minimized,
      openBoard,
      activateBoard,
      minimize,
      closeBoard,
    }),
    [ready, openBoards, activeId, minimized, openBoard, activateBoard, minimize, closeBoard],
  );
}
