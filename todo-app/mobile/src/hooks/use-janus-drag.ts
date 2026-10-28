import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardCellMeasure, BoardCellRect, BoardPoint } from "@/lib/features/board-drag";
import { janusDropTarget, sectionDragId, taskDragId, type DragColumn, type JanusDrop } from "@/lib/features/janus-drag";

interface Session { id: string; pointer: BoardPoint; released: boolean; measuring: boolean }
interface Preview { id: string; target: JanusDrop | null }

export function useJanusDrag(enabled: boolean, columns: DragColumn[], layoutKey: string, onDrop: (source: string, target: JanusDrop) => void) {
  const measures = useRef(new Map<string, BoardCellMeasure>());
  const session = useRef<Session | null>(null);
  const [drag, setDrag] = useState<Preview | null>(null);
  const order = JSON.stringify(columns);
  const cancel = useCallback(() => { session.current = null; setDrag(null); }, []);
  useEffect(() => cancel, [enabled, order, layoutKey, cancel]);
  const register = useCallback((id: string, measure: BoardCellMeasure) => {
    measures.current.set(id, measure);
    return () => { if (measures.current.get(id) === measure) measures.current.delete(id); };
  }, []);

  const measure = (current: Session) => {
    if (current.measuring || session.current !== current) return;
    current.measuring = true;
    const measuringRelease = current.released;
    const keys = ["viewport", ...columns.flatMap((column) => [sectionDragId(column.id), ...column.taskIds.map(taskDragId)])];
    const rects = new Map<string, BoardCellRect>();
    let pending = keys.length;
    const complete = () => {
      if (pending || session.current !== current) return;
      current.measuring = false;
      // Native measurements are asynchronous. A release must not commit the
      // geometry captured before the last pointer movement or scroll frame.
      if (current.released && !measuringRelease) { measure(current); return; }
      const target = janusDropTarget(rects, current.id, columns, current.pointer);
      if (current.released) {
        cancel();
        if (enabled && target) onDrop(current.id, target);
      } else {
        setDrag((previous) => previous?.id === current.id && JSON.stringify(previous.target) === JSON.stringify(target) ? previous : { id: current.id, target });
      }
    };
    for (const key of keys) {
      let received = false;
      const receive = (rect: BoardCellRect | null) => {
        if (received || session.current !== current) return;
        received = true;
        if (rect && rect.width > 0 && rect.height > 0) rects.set(key, rect);
        pending--;
        complete();
      };
      try { const read = measures.current.get(key); if (read) read(receive); else receive(null); } catch { receive(null); }
    }
  };
  const start = (id: string, pointer: BoardPoint) => {
    if (!enabled || session.current || !measures.current.has(id) || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return;
    const current: Session = { id, pointer, measuring: false, released: false };
    session.current = current;
    setDrag({ id, target: null });
    measure(current);
  };
  const move = (x: number, y: number) => {
    const current = session.current;
    if (!current || !enabled || !Number.isFinite(x) || !Number.isFinite(y)) return;
    current.pointer = { x, y };
    // Remeasure during motion: nested scrolling changes positions without onLayout.
    measure(current);
  };
  const drop = (x: number, y: number) => {
    const current = session.current;
    if (!current) return;
    if (Number.isFinite(x) && Number.isFinite(y)) current.pointer = { x, y };
    current.released = true;
    measure(current);
  };
  return { drag, register, start, move, drop, cancel };
}
