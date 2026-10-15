/**
 * Free 2D board placement for the Board Manager.
 *
 * The manager lays boards out on a sparse, row-major grid: cell `i` holds a
 * board id or `null` for an empty slot, which lets a board be dropped anywhere —
 * including leaving deliberate gaps — instead of only reordering a flat list.
 *
 * The grid's *column count is the viewport's*, chosen by responsive breakpoints
 * (1 → 2 → 3 → 4) rather than by the user, so a layout means "this row-major
 * order" and reflows sanely at every width. `cols` is kept on the payload only
 * so existing stored layouts keep loading and keep their shape on wide screens;
 * rendering never reads it.
 *
 * Everything here is a pure function on plain data (no React, no storage) so the
 * reconciliation rules can be reasoned about and tested in isolation. The
 * component owns reading/writing the persisted payload and guards every parse,
 * so a missing or garbage layout can never break the landing page.
 */

/** A sparse, row-major grid of board ids (or `null` slots). */
export interface BoardLayout {
  /** Persisted column hint (see the file note); rendering uses the viewport. */
  cols: number;
  /** Cell at index `i` is read row-major: `i === row * cols + column`. */
  cells: (string | null)[];
}

/** Clamp bounds kept for stored payloads and the padding helper. */
export const MIN_BOARD_COLS = 1;
export const MAX_BOARD_COLS = 8;

/** Default column count for a brand-new layout. */
export const DEFAULT_BOARD_COLS = 4;

/** Prefix shared by every cell's droppable id (`cell:0`, `cell:1`, …). */
export const CELL_ID_PREFIX = "cell:";

/** Fresh, empty layout — reconcile fills it row-major on first use. */
export const EMPTY_BOARD_LAYOUT: BoardLayout = { cols: DEFAULT_BOARD_COLS, cells: [] };

/** `0` → `"cell:0"`; the id a cell registers as a drop target. */
export function cellId(index: number): string {
  return `${CELL_ID_PREFIX}${index}`;
}

/** Inverse of {@link cellId}; `null` for any id that is not a cell. */
export function cellIndexFromId(id: string | number): number | null {
  const text = typeof id === "string" ? id : String(id);
  if (!text.startsWith(CELL_ID_PREFIX)) return null;
  const index = Number(text.slice(CELL_ID_PREFIX.length));
  return Number.isInteger(index) && index >= 0 ? index : null;
}

/** Rounds and clamps a column count into the supported range. */
export function clampBoardCols(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BOARD_COLS;
  return Math.min(MAX_BOARD_COLS, Math.max(MIN_BOARD_COLS, Math.round(value)));
}

/** Drops trailing empty slots so the grid ends on a placed board. */
function trimTrailingEmpty(cells: (string | null)[]): (string | null)[] {
  let end = cells.length;
  while (end > 0 && cells[end - 1] === null) end -= 1;
  return end === cells.length ? cells : cells.slice(0, end);
}

/**
 * Validates an untrusted stored payload. Anything unusable returns `null` so the
 * caller can fall back to a default fill; individual bad cells become gaps.
 */
export function sanitizeBoardLayout(raw: unknown): BoardLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { cols?: unknown; cells?: unknown };
  if (!Array.isArray(record.cells)) return null;
  const cells: (string | null)[] = [];
  for (const cell of record.cells) {
    cells.push(typeof cell === "string" && cell.length > 0 ? cell : null);
  }
  const cols = typeof record.cols === "number" ? record.cols : DEFAULT_BOARD_COLS;
  return { cols: clampBoardCols(cols), cells: trimTrailingEmpty(cells) };
}

/** Seeds a layout from the legacy linear order (first id = top-left). */
export function boardLayoutFromOrder(ids: readonly string[], cols = DEFAULT_BOARD_COLS): BoardLayout {
  return { cols: clampBoardCols(cols), cells: [...ids] };
}

/**
 * The load-time repair pass. Given the stored layout and the boards that
 * actually exist, it drops cells whose ids are gone, de-duplicates, and appends
 * any board that is missing (into the first empty cell, else a trailing cell) —
 * guaranteeing every board appears exactly once. A `null` base falls back to a
 * plain row-major fill, so a garbage payload still renders sensibly.
 */
export function reconcileBoardLayout(
  base: BoardLayout | null,
  boardIds: readonly string[],
): BoardLayout {
  const cols = base ? clampBoardCols(base.cols) : DEFAULT_BOARD_COLS;
  const valid = new Set(boardIds);
  const placed = new Set<string>();
  const cells: (string | null)[] = [];

  if (base) {
    for (const cell of base.cells) {
      if (typeof cell !== "string" || !valid.has(cell) || placed.has(cell)) {
        cells.push(null);
        continue;
      }
      placed.add(cell);
      cells.push(cell);
    }
  }

  for (const id of boardIds) {
    if (placed.has(id)) continue;
    const gap = cells.indexOf(null);
    if (gap === -1) cells.push(id);
    else cells[gap] = id;
    placed.add(id);
  }

  return { cols, cells: trimTrailingEmpty(cells) };
}

/** Board ids in true layout order (row-major), for browse-mode rendering. */
export function boardLayoutOrder(layout: BoardLayout, boardIds: readonly string[]): string[] {
  const valid = new Set(boardIds);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const cell of layout.cells) {
    if (typeof cell !== "string" || !valid.has(cell) || seen.has(cell)) continue;
    seen.add(cell);
    ordered.push(cell);
  }
  // Defence in depth: a board the layout somehow missed still shows up.
  for (const id of boardIds) {
    if (!seen.has(id)) ordered.push(id);
  }
  return ordered;
}

/**
 * Drop semantics. Onto an empty cell the board simply moves (leaving a gap where
 * it was); onto an occupied cell the two swap. Returns the same reference when
 * nothing changes so callers can skip the write.
 */
export function placeBoardInLayout(layout: BoardLayout, boardId: string, toIndex: number): BoardLayout {
  if (toIndex < 0) return layout;
  const cells = layout.cells.slice();
  // Dropping past the last cell grows the grid to reach the target.
  while (cells.length <= toIndex) cells.push(null);

  const from = cells.indexOf(boardId);
  if (from === toIndex) return layout;

  if (from === -1) {
    // Not currently placed: occupy the target without displacing anything else.
    cells[toIndex] = boardId;
    return { cols: layout.cols, cells };
  }

  const occupant = cells[toIndex];
  cells[toIndex] = boardId;
  // Swap when the cell was occupied; clear it (leave a gap) when it was empty.
  cells[from] = occupant;
  return { cols: layout.cols, cells };
}

/** Clears a removed board's cell without compacting anyone else's position. */
export function removeBoardFromLayout(layout: BoardLayout, boardId: string): BoardLayout {
  const index = layout.cells.indexOf(boardId);
  if (index === -1) return layout;
  const cells = layout.cells.slice();
  cells[index] = null;
  return { cols: layout.cols, cells: trimTrailingEmpty(cells) };
}

/**
 * Rendering helper: pads the sparse cells out to a full rectangle for the given
 * column count (the viewport's, at render time) so empty slots show as real grid
 * items — and real drop targets — and the last row is never half-width.
 */
export function padBoardCells(cells: readonly (string | null)[], cols: number): (string | null)[] {
  const width = clampBoardCols(cols);
  const rows = Math.max(1, Math.ceil(cells.length / width));
  const total = rows * width;
  const padded = cells.slice();
  while (padded.length < total) padded.push(null);
  return padded;
}
