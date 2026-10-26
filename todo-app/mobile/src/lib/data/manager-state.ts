import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EMPTY_BOARD_LAYOUT,
  boardLayoutFromOrder,
  sanitizeBoardLayout,
  type BoardLayout,
} from "@/lib/features/board-layout";
import type { JanusProject } from "@/lib/domain/projects";
import type { Task } from "@/lib/domain/types";

/** These keys intentionally match the browser manager's local persistence. */
export const PINS_STORAGE_KEY = "janus.board-pins.v1";
export const ORDER_STORAGE_KEY = "janus.board-order.v1";
export const LAYOUT_STORAGE_KEY = "janus.board-layout.v1";

export interface ManagerState {
  pinnedIds: Set<string>;
  layout: BoardLayout;
}

// Keep preference writes in the order they were requested. AsyncStorage does
// not guarantee that overlapping writes finish in that same order, so a rapid
// sequence of pin/order changes could otherwise leave an older snapshot on
// disk.
let managerWriteQueue: Promise<void> = Promise.resolve();

function enqueueManagerWrite(key: string, value: string): Promise<void> {
  managerWriteQueue = managerWriteQueue.then(async () => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Preferences remain active in memory when storage is unavailable.
    }
  });
  return managerWriteQueue;
}

function parsePins(value: string | null): Set<string> {
  if (!value) return new Set();
  try {
    const parsed: unknown = JSON.parse(value);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [],
    );
  } catch {
    return new Set();
  }
}

/** Loads manager-only preferences without allowing malformed storage to break the landing page. */
export async function loadManagerState(): Promise<ManagerState> {
  let values: readonly [string, string | null][];
  try {
    values = await AsyncStorage.multiGet([
      PINS_STORAGE_KEY,
      LAYOUT_STORAGE_KEY,
      ORDER_STORAGE_KEY,
    ]);
  } catch {
    return { pinnedIds: new Set(), layout: EMPTY_BOARD_LAYOUT };
  }

  const pins = values[0]?.[1] ?? null;
  const layout = values[1]?.[1] ?? null;
  const legacyOrder = values[2]?.[1] ?? null;
  let parsedLayout: BoardLayout | null = null;
  try {
    if (layout) parsedLayout = sanitizeBoardLayout(JSON.parse(layout));
  } catch {
    parsedLayout = null;
  }
  if (!parsedLayout && legacyOrder) {
    try {
      const parsed: unknown = JSON.parse(legacyOrder);
      if (Array.isArray(parsed)) {
        const ids = parsed.filter((id): id is string => typeof id === "string");
        parsedLayout = boardLayoutFromOrder(ids);
      }
    } catch {
      // Ignore a malformed legacy order and use the default fill.
    }
  }
  return { pinnedIds: parsePins(pins), layout: parsedLayout ?? EMPTY_BOARD_LAYOUT };
}

export async function saveManagerPins(pinnedIds: Set<string>): Promise<void> {
  await enqueueManagerWrite(PINS_STORAGE_KEY, JSON.stringify([...pinnedIds]));
}

export async function saveManagerLayout(layout: BoardLayout): Promise<void> {
  await enqueueManagerWrite(
    LAYOUT_STORAGE_KEY,
    JSON.stringify({ cols: layout.cols, order: layout.order }),
  );
}

export interface TaskMetrics {
  total: number;
  open: number;
  done: number;
  canceled: number;
  completionPercent: number;
  overdue: number;
  dueSoon: number;
}

/** Stable task accounting shared by board cards and the workspace overview. */
export function getTaskMetrics(tasks: readonly Task[], now = Date.now()): TaskMetrics {
  let open = 0;
  let done = 0;
  let canceled = 0;
  let overdue = 0;
  let dueSoon = 0;
  const nextWeek = now + 7 * 24 * 60 * 60 * 1000;

  for (const task of tasks) {
    if (task.canceled) {
      canceled += 1;
      continue;
    }
    if (task.completed) {
      done += 1;
      continue;
    }
    open += 1;
    if (!task.dueAt) continue;
    const due = Date.parse(task.dueAt);
    if (!Number.isFinite(due)) continue;
    if (due < now) overdue += 1;
    else if (due <= nextWeek) dueSoon += 1;
  }

  const total = open + done + canceled;
  return {
    total,
    open,
    done,
    canceled,
    completionPercent: total === 0 ? 0 : Math.round((done / total) * 100),
    overdue,
    dueSoon,
  };
}

export function getWorkspaceMetrics(projects: readonly JanusProject[], now = Date.now()): TaskMetrics {
  return getTaskMetrics(
    projects.flatMap((project) => project.workspace.tasks),
    now,
  );
}
