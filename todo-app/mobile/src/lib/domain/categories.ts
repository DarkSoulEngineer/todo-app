import { boardColor, BUILT_IN_BOARDS } from "@/lib/domain/boards";

export interface Category {
  id: string;
  label: string;
  /** Solid dot / progress fill. */
  dot: string;
  /** Readable ink tone on the tinted chip. */
  ink: string;
  /** Soft chip fill. */
  tint: string;
  /** Translucent ring tone, used for selected filter chips. */
  ring: string;
}

/**
 * Board colors in the old `Category` shape, derived from the board palette.
 *
 * @deprecated Read from `useTasksContext().boards` plus `boardColor()` instead;
 * this exists only for the few consumers that have not migrated yet.
 */
export const CATEGORIES: Category[] = BUILT_IN_BOARDS.map((board) => {
  const color = boardColor(board.color);
  return { id: board.id, label: board.label, dot: color.dot, ink: color.ink, tint: color.tint, ring: color.ring };
});

const CATEGORY_MAP = new Map(CATEGORIES.map((category) => [category.id, category]));

export function getCategory(id: string | null | undefined): Category | null {
  if (!id) return null;
  return CATEGORY_MAP.get(id) ?? null;
}

/** True when the value is the id of a known built-in category. */
export function isCategoryId(value: unknown): value is string {
  return typeof value === "string" && CATEGORY_MAP.has(value);
}

/** The categories still available to the user, in their original order. */
export function selectCategories(deleted: readonly string[]): Category[] {
  if (deleted.length === 0) return [...CATEGORIES];
  const removed = new Set(deleted);
  return CATEGORIES.filter((category) => !removed.has(category.id));
}
