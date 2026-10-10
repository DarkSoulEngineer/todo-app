/**
 * Boards: the user-facing grouping formerly known as "categories". A board is a
 * tag on a task (`Task.category` holds the board id) rendered through a small
 * palette, so the labels and colours are user-editable and removable.
 */

const CYAN = {
  dot: "bg-cyan-500",
  pill: "bg-cyan-500/12 text-cyan-700 ring-cyan-500/25 dark:text-cyan-300",
  ring: "ring-cyan-500/40",
};
const PINK = {
  dot: "bg-pink-500",
  pill: "bg-pink-500/12 text-pink-700 ring-pink-500/25 dark:text-pink-300",
  ring: "ring-pink-500/40",
};
const ORANGE = {
  dot: "bg-orange-500",
  pill: "bg-orange-500/12 text-orange-700 ring-orange-500/25 dark:text-orange-300",
  ring: "ring-orange-500/40",
};
const TEAL = {
  dot: "bg-teal-500",
  pill: "bg-teal-500/12 text-teal-700 ring-teal-500/25 dark:text-teal-300",
  ring: "ring-teal-500/40",
};
const LIME = {
  dot: "bg-lime-500",
  pill: "bg-lime-500/12 text-lime-700 ring-lime-500/25 dark:text-lime-300",
  ring: "ring-lime-500/40",
};
const INDIGO = {
  dot: "bg-indigo-500",
  pill: "bg-indigo-500/12 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
  ring: "ring-indigo-500/40",
};
const VIOLET = {
  dot: "bg-violet-500",
  pill: "bg-violet-500/12 text-violet-700 ring-violet-500/25 dark:text-violet-300",
  ring: "ring-violet-500/40",
};
const AMBER = {
  dot: "bg-amber-500",
  pill: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  ring: "ring-amber-500/40",
};

export type BoardColorId = "cyan" | "pink" | "orange" | "teal" | "lime" | "indigo" | "violet" | "amber";

/** One palette entry: dot, chip/ pill and ring treatments derived from a hue. */
export interface BoardColor {
  id: BoardColorId;
  label: string;
  dot: string;
  pill: string;
  ring: string;
}

export const BOARD_COLORS: BoardColor[] = [
  { id: "cyan", label: "Cyan", ...CYAN },
  { id: "pink", label: "Pink", ...PINK },
  { id: "orange", label: "Orange", ...ORANGE },
  { id: "teal", label: "Teal", ...TEAL },
  { id: "lime", label: "Lime", ...LIME },
  { id: "indigo", label: "Indigo", ...INDIGO },
  { id: "violet", label: "Violet", ...VIOLET },
  { id: "amber", label: "Amber", ...AMBER },
];

const COLOR_IDS = new Set<string>(BOARD_COLORS.map((color) => color.id));

/** A board: a named, coloured grouping of tasks. */
export interface Board {
  id: string;
  label: string;
  color: BoardColorId;
}

/** The boards every user starts with, carrying the historical category ids. */
export const BUILT_IN_BOARDS: Board[] = [
  { id: "work", label: "Work", color: "cyan" },
  { id: "personal", label: "Personal", color: "pink" },
  { id: "shopping", label: "Shopping", color: "orange" },
  { id: "health", label: "Health", color: "teal" },
  { id: "learning", label: "Learning", color: "lime" },
  { id: "home", label: "Home", color: "indigo" },
];

export function defaultBoards(): Board[] {
  return BUILT_IN_BOARDS.map((board) => ({ ...board }));
}

export function boardColor(color: BoardColorId): BoardColor {
  return BOARD_COLORS.find((entry) => entry.id === color) ?? BOARD_COLORS[0];
}

export function isBoardColor(value: unknown): value is BoardColorId {
  return typeof value === "string" && COLOR_IDS.has(value);
}

export function isBuiltInBoardId(value: unknown): value is string {
  return typeof value === "string" && BUILT_IN_BOARDS.some((board) => board.id === value);
}

export function getBoard(boards: Board[], id: string | null | undefined): Board | null {
  if (!id) return null;
  return boards.find((board) => board.id === id) ?? null;
}

/** The built-in boards missing from `boards`, in their original order. */
export function missingBuiltInBoards(boards: Board[]): Board[] {
  const present = new Set(boards.map((board) => board.id));
  return BUILT_IN_BOARDS.filter((board) => !present.has(board.id));
}

/** Gets the board color by label (e.g., "Work" -> "cyan"). */
export function getBoardColorByLabel(label: string): BoardColor | null {
  const normalized = label.toLowerCase().trim();
  const board = BUILT_IN_BOARDS.find((b) => b.label.toLowerCase() === normalized);
  return board ? boardColor(board.color) : null;
}

/** Gets the board color by id (e.g., "work" -> "cyan"). */
export function getBoardColorById(id: string): BoardColor | null {
  const board = BUILT_IN_BOARDS.find((b) => b.id === id.toLowerCase());
  return board ? boardColor(board.color) : null;
}

/** Turns one unknown persisted entry into a Board, or null when unusable. */
function normalizeBoard(value: unknown): Board | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id ? record.id : "";
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (!id || !label) return null;
  return { id, label, color: isBoardColor(record.color) ? record.color : "cyan" };
}

/**
 * Builds the board list from unknown persisted data.
 *
 * A missing array is a first run or an upgrade: fall back to the built-ins minus
 * the ids recorded as deleted by the previous version. An empty array is a real
 * state (the user deleted everything) and is kept as-is.
 */
export function normalizeBoards(value: unknown, deletedBuiltIns: readonly string[] = []): Board[] {
  if (!Array.isArray(value)) {
    const removed = new Set(deletedBuiltIns);
    return defaultBoards().filter((board) => !removed.has(board.id));
  }

  const seen = new Set<string>();
  const result: Board[] = [];
  for (const item of value) {
    const board = normalizeBoard(item);
    if (!board || seen.has(board.id)) continue;
    seen.add(board.id);
    result.push(board);
  }
  return result;
}
