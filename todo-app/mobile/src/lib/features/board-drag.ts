export interface BoardCellRect { x: number; y: number; width: number; height: number }
export interface BoardPoint { x: number; y: number }
export type BoardCellMeasure = (receive: (rect: BoardCellRect | null) => void) => void;

/** Mouse/touch coordinates and measured cells must share window coordinates. */
export function pointerBoardDropTarget(rects: ReadonlyMap<string, BoardCellRect>, sourceId: string, x: number, y: number): string | null {
  if (!rects.has(sourceId) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let closest: string | null = null;
  let distance = Infinity;
  for (const [id, rect] of rects) {
    left = Math.min(left, rect.x); top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width); bottom = Math.max(bottom, rect.y + rect.height);
    // Include gutters in the nearest slot, so a release between cards still snaps.
    const offsetX = Math.max(rect.x - x, 0, x - rect.x - rect.width);
    const offsetY = Math.max(rect.y - y, 0, y - rect.y - rect.height);
    const candidate = offsetX * offsetX + offsetY * offsetY;
    if (candidate < distance) { closest = id; distance = candidate; }
  }
  if (x < left || x > right || y < top || y > bottom) return null;
  return closest === sourceId ? null : closest;
}
