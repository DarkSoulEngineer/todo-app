import type { BoardCellRect, BoardPoint } from "./board-drag";

export interface DragColumn { id: string; taskIds: string[] }
export type JanusDrop = { kind: "section"; sectionId: string } | { kind: "task"; sectionId: string; beforeTaskId: string | null };
export const sectionDragId = (id: string) => `section:${id}`;
export const taskDragId = (id: string) => `task:${id}`;

/** Hit testing uses viewport coordinates, including freshly measured scroll offsets. */
export function janusDropTarget(rects: ReadonlyMap<string, BoardCellRect>, source: string, columns: DragColumn[], pointer: BoardPoint): JanusDrop | null {
  const viewport = rects.get("viewport");
  const { x, y } = pointer;
  if (!viewport || !rects.has(source) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < viewport.x || x > viewport.x + viewport.width || y < viewport.y || y > viewport.y + viewport.height) return null;
  let column: DragColumn | undefined;
  let distance = Infinity;
  for (const candidate of columns) {
    const rect = rects.get(sectionDragId(candidate.id));
    if (!rect || y < rect.y || y > rect.y + rect.height) continue;
    const dx = Math.max(rect.x - x, 0, x - rect.x - rect.width);
    // Small gutters snap to the adjacent list, but blank space is not a target.
    if (dx <= 10 && dx < distance) { column = candidate; distance = dx; }
  }
  if (!column) return null;
  if (source.startsWith("section:")) return source === sectionDragId(column.id) ? null : { kind: "section", sectionId: column.id };
  const beforeTaskId = column.taskIds.find((id) => {
    if (taskDragId(id) === source) return false;
    const rect = rects.get(taskDragId(id));
    return rect && y < rect.y + rect.height / 2;
  }) ?? null;
  return { kind: "task", sectionId: column.id, beforeTaskId };
}

/** Only destination siblings plus the source occupy new manual-order slots. */
export function taskDropOrder(taskId: string, siblings: string[], beforeTaskId: string | null): string[] | null {
  const next = siblings.filter((id) => id !== taskId);
  const index = beforeTaskId === null ? next.length : next.indexOf(beforeTaskId);
  if (index < 0) return null;
  next.splice(index, 0, taskId);
  return next;
}

/** Reorder visible lists without disturbing hidden lists in their saved slots. */
export function sectionDropOrder(sections: { id: string; hidden?: boolean }[], id: string, targetId: string): string[] | null {
  const visible = sections.filter((section) => !section.hidden).map((section) => section.id);
  const from = visible.indexOf(id);
  const to = visible.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return null;
  visible.splice(from, 1);
  visible.splice(to, 0, id);
  let index = 0;
  return sections.map((section) => section.hidden ? section.id : visible[index++]);
}
