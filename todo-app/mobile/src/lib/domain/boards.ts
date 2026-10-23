/**
 * Boards: the user-facing grouping for tasks. A board is a tag on a task
 * (`Task.category` holds the board id) rendered through a small palette.
 *
 * The web build expressed this palette as Tailwind classes; here each entry
 * carries concrete colors so React Native styles can use them directly.
 */

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

export interface BoardColor {
  id: BoardColorId;
  label: string;
  /** Solid swatch (dots, progress fills, chart bars). */
  dot: string;
  /** Readable ink tone on a light tinted chip. */
  ink: string;
  /** Soft translucent fill for chips. */
  tint: string;
  /** Translucent border/selection ring. */
  ring: string;
}

const PALETTE: Record<BoardColorId, Omit<BoardColor, "id" | "label">> = {
  slate: { dot: "#6B7280", ink: "#4B5563", tint: "rgba(107,114,128,0.16)", ring: "rgba(107,114,128,0.42)" },
  blue: { dot: "#3B82F6", ink: "#2563EB", tint: "rgba(59,130,246,0.16)", ring: "rgba(59,130,246,0.42)" },
  teal: { dot: "#14B8A6", ink: "#0D9488", tint: "rgba(20,184,166,0.16)", ring: "rgba(20,184,166,0.42)" },
  lime: { dot: "#84CC16", ink: "#4D7C0F", tint: "rgba(132,204,22,0.18)", ring: "rgba(132,204,22,0.42)" },
  amber: { dot: "#F59E0B", ink: "#B45309", tint: "rgba(245,158,11,0.18)", ring: "rgba(245,158,11,0.42)" },
  orange: { dot: "#F97316", ink: "#C2410C", tint: "rgba(249,115,22,0.16)", ring: "rgba(249,115,22,0.42)" },
  pink: { dot: "#EC4899", ink: "#BE185D", tint: "rgba(236,72,153,0.16)", ring: "rgba(236,72,153,0.42)" },
  violet: { dot: "#8B5CF6", ink: "#6D28D9", tint: "rgba(139,92,246,0.16)", ring: "rgba(139,92,246,0.42)" },
};

const LABELS: Record<BoardColorId, string> = {
  slate: "Slate",
  blue: "Blue",
  teal: "Teal",
  lime: "Lime",
  amber: "Amber",
  orange: "Orange",
  pink: "Pink",
  violet: "Violet",
};

/** The palette, ordered for the colour picker (neutral, then around the wheel). */
export const BOARD_COLORS: BoardColor[] = (Object.keys(PALETTE) as BoardColorId[]).map((id) => ({
  id,
  label: LABELS[id],
  ...PALETTE[id],
}));

const COLOR_IDS = new Set<string>(BOARD_COLORS.map((color) => color.id));

/** The colour a board falls back to: a safe, achromatic default. */
export const DEFAULT_BOARD_COLOR: BoardColorId = "slate";

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
