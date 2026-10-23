/**
 * Boards: the user-facing grouping formerly known as "categories". A board is a
 * tag on a task (`Task.category` holds the board id) rendered through a small
 * palette, so the labels and colours are user-editable and removable.
 *
 * COLOUR SYSTEM
 * The eight hues are spread around the wheel so no two read as the same colour,
 * and each is held near one perceived lightness (see the `--board-*` tokens in
 * `globals.css`) so no board is quieter than another. Every entry carries:
 *   dot   → the solid swatch (dots, progress fills, chart bars)
 *   pill  → the tinted board chip: fill, readable ink text and ring
 *   ring  → the selection ring drawn over a muted row
 *   tile  / icon → the board-manager icon chip
 * `slate` is deliberately achromatic, so a board can be told apart without
 * leaning on hue alone, and every swatch in the UI sits beside the board's name.
 *
 * Every class is a complete static Tailwind literal that originates from the
 * `--color-board-*` tokens (see `@theme inline` in `globals.css`); none is built
 * by concatenation, so Tailwind v4 keeps all of them when it scans.
 */

const SLATE = {
  dot: "bg-board-slate",
  pill: "bg-board-slate/16 text-board-slate-ink ring-board-slate/40",
  ring: "ring-board-slate/55",
  tile: "from-board-slate/18 to-board-slate/5 ring-board-slate/30",
  icon: "text-board-slate-ink",
};
const BLUE = {
  dot: "bg-board-blue",
  pill: "bg-board-blue/16 text-board-blue-ink ring-board-blue/40",
  ring: "ring-board-blue/55",
  tile: "from-board-blue/18 to-board-blue/5 ring-board-blue/30",
  icon: "text-board-blue-ink",
};
const TEAL = {
  dot: "bg-board-teal",
  pill: "bg-board-teal/16 text-board-teal-ink ring-board-teal/40",
  ring: "ring-board-teal/55",
  tile: "from-board-teal/18 to-board-teal/5 ring-board-teal/30",
  icon: "text-board-teal-ink",
};
const LIME = {
  dot: "bg-board-lime",
  pill: "bg-board-lime/16 text-board-lime-ink ring-board-lime/40",
  ring: "ring-board-lime/55",
  tile: "from-board-lime/18 to-board-lime/5 ring-board-lime/30",
  icon: "text-board-lime-ink",
};
const AMBER = {
  dot: "bg-board-amber",
  pill: "bg-board-amber/16 text-board-amber-ink ring-board-amber/40",
  ring: "ring-board-amber/55",
  tile: "from-board-amber/18 to-board-amber/5 ring-board-amber/30",
  icon: "text-board-amber-ink",
};
const ORANGE = {
  dot: "bg-board-orange",
  pill: "bg-board-orange/16 text-board-orange-ink ring-board-orange/40",
  ring: "ring-board-orange/55",
  tile: "from-board-orange/18 to-board-orange/5 ring-board-orange/30",
  icon: "text-board-orange-ink",
};
const PINK = {
  dot: "bg-board-pink",
  pill: "bg-board-pink/16 text-board-pink-ink ring-board-pink/40",
  ring: "ring-board-pink/55",
  tile: "from-board-pink/18 to-board-pink/5 ring-board-pink/30",
  icon: "text-board-pink-ink",
};
const VIOLET = {
  dot: "bg-board-violet",
  pill: "bg-board-violet/16 text-board-violet-ink ring-board-violet/40",
  ring: "ring-board-violet/55",
  tile: "from-board-violet/18 to-board-violet/5 ring-board-violet/30",
  icon: "text-board-violet-ink",
};

export type BoardColorId =
  | "slate"
  | "blue"
  | "teal"
  | "lime"
  | "amber"
  | "orange"
  | "pink"
  | "violet";

/** Colour ids shipped before the redesign. Kept so persisted boards still load. */
export type LegacyBoardColorId = "cyan" | "indigo";

/** One palette entry: the swatch, chip and ring treatments derived from a hue. */
export interface BoardColor {
  id: BoardColorId;
  label: string;
  /** Solid swatch (dots, progress fills, chart bars). */
  dot: string;
  /** Tinted board chip: fill, readable ink text and ring. */
  pill: string;
  /** Translucent selection ring, drawn over a muted row. */
  ring: string;
  /** Gradient tile background + ring for the board-manager icon chip. */
  tile: string;
  /** Ink tone for an icon drawn on the tile. */
  icon: string;
}

/** The palette, ordered for the colour picker (neutral, then around the wheel). */
export const BOARD_COLORS: BoardColor[] = [
  { id: "slate", label: "Slate", ...SLATE },
  { id: "blue", label: "Blue", ...BLUE },
  { id: "teal", label: "Teal", ...TEAL },
  { id: "lime", label: "Lime", ...LIME },
  { id: "amber", label: "Amber", ...AMBER },
  { id: "orange", label: "Orange", ...ORANGE },
  { id: "pink", label: "Pink", ...PINK },
  { id: "violet", label: "Violet", ...VIOLET },
];

const COLOR_IDS = new Set<string>(BOARD_COLORS.map((color) => color.id));

/** The colour a board falls back to: a safe, achromatic default. */
export const DEFAULT_BOARD_COLOR: BoardColorId = "slate";

/**
 * Old ids mapped onto the nearest new hue, so a board saved as "cyan" or
 * "indigo" keeps a sensible colour instead of snapping to the default.
 */
const LEGACY_BOARD_COLORS: Record<LegacyBoardColorId, BoardColorId> = {
  cyan: "teal",
  indigo: "blue",
};

function hasOwn(value: string, table: object): boolean {
  return Object.prototype.hasOwnProperty.call(table, value);
}

/** A board: a named, coloured grouping of tasks. */
export interface Board {
  id: string;
  label: string;
  color: BoardColorId;
}

/** The boards every user starts with, carrying the historical category ids. */
export const BUILT_IN_BOARDS: Board[] = [
  { id: "work", label: "Work", color: "blue" },
  { id: "personal", label: "Personal", color: "pink" },
  { id: "shopping", label: "Shopping", color: "orange" },
  { id: "health", label: "Health", color: "teal" },
  { id: "learning", label: "Learning", color: "lime" },
  { id: "home", label: "Home", color: "violet" },
];

export function defaultBoards(): Board[] {
  return BUILT_IN_BOARDS.map((board) => ({ ...board }));
}

export function boardColor(color: BoardColorId | LegacyBoardColorId): BoardColor {
  const id = isBoardColor(color) ? color : normalizeBoardColor(color);
  return BOARD_COLORS.find((entry) => entry.id === id) ?? BOARD_COLORS[0];
}

/** True for a current palette id. */
export function isBoardColor(value: unknown): value is BoardColorId {
  return typeof value === "string" && COLOR_IDS.has(value);
}

/** True for a colour id shipped before the redesign. */
export function isLegacyBoardColor(value: unknown): value is LegacyBoardColorId {
  return typeof value === "string" && hasOwn(value, LEGACY_BOARD_COLORS);
}

/**
 * Resolves any stored colour id to a current one: a known id passes through, a
 * legacy id maps onto its nearest hue, and anything unusable becomes the default.
 */
export function normalizeBoardColor(value: unknown): BoardColorId {
  if (isBoardColor(value)) return value;
  if (isLegacyBoardColor(value)) return LEGACY_BOARD_COLORS[value];
  return DEFAULT_BOARD_COLOR;
}

/** The built-in boards missing from `boards`, in their original order. */
export function missingBuiltInBoards(boards: Board[]): Board[] {
  const present = new Set(boards.map((board) => board.id));
  return BUILT_IN_BOARDS.filter((board) => !present.has(board.id));
}

/** Gets the board color by label (e.g., "Work" -> a palette entry). */
export function getBoardColorByLabel(label: string): BoardColor | null {
  const normalized = label.toLowerCase().trim();
  const board = BUILT_IN_BOARDS.find((b) => b.label.toLowerCase() === normalized);
  return board ? boardColor(board.color) : null;
}

/** Turns one unknown persisted entry into a Board, or null when unusable. */
function normalizeBoard(value: unknown): Board | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id ? record.id : "";
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (!id || !label) return null;
  return { id, label, color: normalizeBoardColor(record.color) };
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
