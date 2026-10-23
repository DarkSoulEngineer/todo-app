/**
 * Ordered board arrangement for the Board Manager.
 *
 * Boards live in ONE sequence, not a sparse 2D grid: `order[i]` is the board
 * that fills position `i`. The grid just wraps that sequence into the viewport's
 * current column count (1 → 2 → 3 → 4), so the list is always compact — row 1
 * reads 1 2 3, row 2 reads 4 5, and there is never an empty cell. Dragging a
 * board onto another means "put me here", so every board after it shifts along.
 *
 * `cols` is kept on the payload only so an older stored layout keeps loading;
 * rendering never reads it (the responsive grid chooses the real column count).
 *
 * Everything here is a pure function on plain data (no React, no storage) so the
 * reconciliation rules can be reasoned about and tested in isolation. The
 * component owns reading/writing the persisted payload and guards every parse,
 * so a missing or garbage layout can never break the landing page.
 */

/** A compact, ordered list of board ids (index 0 = top-left, filled row-major). */
export interface BoardLayout {
  /** Persisted column hint (see the file note); rendering uses the viewport. */
  cols: number;
  /** Board ids in display order; every board appears exactly once, no gaps. */
  order: string[];
}

/** Clamp bounds kept for stored payloads. */
export const MIN_BOARD_COLS = 1;
export const MAX_BOARD_COLS = 8;

/** Default column count for a brand-new layout. */
export const DEFAULT_BOARD_COLS = 4;

/** Fresh, empty layout — reconcile fills it on first use. */
export const EMPTY_BOARD_LAYOUT: BoardLayout = { cols: DEFAULT_BOARD_COLS, order: [] };

/** Rounds and clamps a column count into the supported range. */
export function clampBoardCols(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BOARD_COLS;
  return Math.min(MAX_BOARD_COLS, Math.max(MIN_BOARD_COLS, Math.round(value)));
}

/**
 * Keeps readable, de-duplicated ids in the order they appear. Anything that is
 * not a non-empty string — including the `null` gaps of a legacy payload — is
 * skipped, which is exactly what collapses an old sparse grid into a compact
 * list without ever losing or reordering a board.
 */
function compactIds(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0 || seen.has(value)) continue;
    seen.add(value);
    order.push(value);
  }
  return order;
}

/**
 * Validates an untrusted stored payload. Accepts both the current `{ cols,
 * order }` shape and the legacy `{ cols, cells }` sparse grid (whose `null` gaps
 * are flattened away). Anything unusable returns `null` so the caller can fall
 * back to a default fill.
 */
export function sanitizeBoardLayout(raw: unknown): BoardLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { cols?: unknown; order?: unknown; cells?: unknown };
  const cols = typeof record.cols === "number" ? record.cols : DEFAULT_BOARD_COLS;

  if (Array.isArray(record.order)) {
    return { cols: clampBoardCols(cols), order: compactIds(record.order) };
  }
  // Legacy shape: row-major cells where `null` marked an empty slot.
  if (Array.isArray(record.cells)) {
    return { cols: clampBoardCols(cols), order: compactIds(record.cells) };
  }
  return null;
}

/** Seeds a layout from the legacy linear order (first id = first position). */
export function boardLayoutFromOrder(ids: readonly string[], cols = DEFAULT_BOARD_COLS): BoardLayout {
  return { cols: clampBoardCols(cols), order: compactIds(ids) };
}

/**
 * The load-time repair pass. Given the stored layout and the boards that
 * actually exist, it drops ids whose board is gone, de-duplicates, and appends
 * any board that is missing — guaranteeing every board appears exactly once, in
 * order, with no gaps. A `null` base falls back to a plain board-id fill, so a
 * garbage payload still renders sensibly.
 */
export function reconcileBoardLayout(
  base: BoardLayout | null,
  boardIds: readonly string[],
): BoardLayout {
  const cols = base ? clampBoardCols(base.cols) : DEFAULT_BOARD_COLS;
  const valid = new Set(boardIds);
  const seen = new Set<string>();
  const order: string[] = [];

  if (base) {
    for (const id of base.order) {
      if (!valid.has(id) || seen.has(id)) continue;
      seen.add(id);
      order.push(id);
    }
  }

  // Defence in depth: a board the layout somehow missed still shows up, last.
  for (const id of boardIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }

  return { cols, order };
}

/** Board ids in true display order, for browse-mode rendering. */
export function boardLayoutOrder(layout: BoardLayout, boardIds: readonly string[]): string[] {
  const valid = new Set(boardIds);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of layout.order) {
    if (!valid.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  // Defence in depth: a board the layout somehow missed still shows up.
  for (const id of boardIds) {
    if (!seen.has(id)) ordered.push(id);
  }
  return ordered;
}

/**
 * Reorder semantics. Moves the board at `fromIndex` to `toIndex` and shifts
 * everything between, so the list stays compact (an insert, never a swap with a
 * gap). Returns the same reference when nothing moves so callers can skip the
 * write.
 */
export function moveBoardInLayout(layout: BoardLayout, fromIndex: number, toIndex: number): BoardLayout {
  const count = layout.order.length;
  if (fromIndex < 0 || fromIndex >= count) return layout;
  const to = Math.min(Math.max(toIndex, 0), count - 1);
  if (to === fromIndex) return layout;

  const order = layout.order.slice();
  const [moved] = order.splice(fromIndex, 1);
  order.splice(to, 0, moved);
  return { cols: layout.cols, order };
}

/** Drops a removed board and closes the gap behind it. */
export function removeBoardFromLayout(layout: BoardLayout, boardId: string): BoardLayout {
  const index = layout.order.indexOf(boardId);
  if (index === -1) return layout;
  const order = layout.order.slice();
  order.splice(index, 1);
  return { cols: layout.cols, order };
}
