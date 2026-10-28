import { useCallback, useEffect, useRef, useState } from "react";
import { pointerBoardDropTarget, type BoardCellMeasure, type BoardCellRect, type BoardPoint } from "@/lib/features/board-drag";

interface DragSession {
  id: string;
  pointer: BoardPoint;
  rects: Map<string, BoardCellRect>;
  pending: number;
  released: boolean;
}

export function useBoardGridDrag(enabled: boolean, ids: string[], cardWidth: number, onReorder?: (id: string, targetId: string) => void) {
  const measures = useRef(new Map<string, BoardCellMeasure>());
  const session = useRef<DragSession | null>(null);
  const hovered = useRef<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; target: string | null } | null>(null);
  const order = ids.join("\0");
  const cancel = useCallback(() => { session.current = null; hovered.current = null; setDrag(null); }, []);
  useEffect(() => cancel, [enabled, order, cardWidth, cancel]);
  const register = useCallback((id: string, measure: BoardCellMeasure) => {
    measures.current.set(id, measure);
    return () => { if (measures.current.get(id) === measure) measures.current.delete(id); };
  }, []);

  const targetFor = (current: DragSession) => current.rects.has(current.id) ? pointerBoardDropTarget(current.rects, current.id, current.pointer.x, current.pointer.y) : null;
  const preview = (current: DragSession) => {
    if (current.pending || session.current !== current) return;
    const target = targetFor(current);
    if (target === hovered.current) return;
    hovered.current = target;
    setDrag({ id: current.id, target });
  };
  const finish = (current: DragSession) => {
    if (current.pending || session.current !== current) return;
    const target = targetFor(current);
    cancel();
    if (enabled && target && ids.includes(current.id) && ids.includes(target)) onReorder?.(current.id, target);
  };
  const start = (id: string, pointer: BoardPoint) => {
    if (!enabled || !ids.includes(id) || !measures.current.has(id)) return;
    if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return;
    const entries = ids.flatMap((key) => { const measure = measures.current.get(key); return measure ? [{ key, measure }] : []; });
    const current: DragSession = { id, pointer, rects: new Map(), pending: entries.length, released: false };
    session.current = current;
    hovered.current = null;
    setDrag({ id, target: null });
    // Re-read window positions EVERY drag. Browser onLayout may not fire when
    // equal-sized grid cells change position after reordering or scrolling.
    for (const { key, measure } of entries) {
      let received = false;
      const receive = (rect: BoardCellRect | null) => {
        if (received || session.current !== current) return;
        received = true;
        if (rect && rect.width > 0 && rect.height > 0) current.rects.set(key, rect);
        current.pending--;
        if (current.released) finish(current); else preview(current);
      };
      try { measure(receive); } catch { receive(null); }
    }
  };
  const move = (x: number, y: number) => {
    const current = session.current;
    if (!enabled || !current || !Number.isFinite(x) || !Number.isFinite(y)) return;
    current.pointer = { x, y };
    preview(current);
  };
  const drop = (x: number, y: number) => {
    const current = session.current;
    if (!current) return;
    if (Number.isFinite(x) && Number.isFinite(y)) current.pointer = { x, y };
    current.released = true;
    finish(current);
  };
  return { drag, register, start, move, drop, cancel };
}
