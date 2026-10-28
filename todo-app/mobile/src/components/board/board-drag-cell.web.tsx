import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useTheme } from "@/providers/theme-provider";
import type { BoardDragCellProps } from "./board-drag-cell";

interface PointerSession {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  dragging: boolean;
}

const cursorRules = `.janus-board-drag-cell[data-reorder="true"]{cursor:grab}.janus-board-drag-cell[data-reorder="true"] *{cursor:inherit!important;user-select:none!important}.janus-board-drag-cell[data-dragging="true"]{cursor:grabbing}`;

/** Browser pointer capture + one compositor transform per frame; no RN gesture bridge. */
export function BoardDragCell(props: BoardDragCellProps) {
  const { id, onRegister, enabled, active, target } = props;
  const { theme } = useTheme();
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const session = useRef<PointerSession | null>(null);
  const frame = useRef<number | null>(null);
  const detach = useRef<(() => void) | null>(null);
  const suppressClickUntil = useRef(0);
  useLayoutEffect(() => { latest.current = props; }, [props]);
  useLayoutEffect(() => onRegister(id, (receive) => {
    const rect = root.current?.getBoundingClientRect();
    receive(rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null);
  }), [id, onRegister]);

  const reset = useCallback(() => {
    const pointerId = session.current?.pointerId;
    session.current = null;
    detach.current?.();
    detach.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (content.current) { content.current.style.transform = ""; content.current.style.willChange = ""; }
    if (root.current) {
      root.current.dataset.dragging = "false";
      root.current.style.zIndex = "0";
      if (pointerId !== undefined && root.current.hasPointerCapture(pointerId)) root.current.releasePointerCapture(pointerId);
    }
  }, []);
  useLayoutEffect(() => { if (!enabled || !active && session.current?.dragging) reset(); }, [enabled, active, reset]);
  useEffect(() => () => {
    if (session.current?.dragging) latest.current.onCancel();
    reset();
  }, [reset]);

  const begin = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!latest.current.enabled || event.button !== 0 || event.isPrimary === false || session.current) return;
    session.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragging: false };
    const cancel = () => {
      if (session.current?.dragging) latest.current.onCancel();
      reset();
    };
    const paint = () => {
      frame.current = null;
      const current = session.current;
      if (!current?.dragging) return;
      if (content.current) content.current.style.transform = `translate3d(${current.x - current.startX}px, ${current.y - current.startY}px, 0)`;
      latest.current.onMove(current.x, current.y);
    };
    const move = (pointer: PointerEvent) => {
      const current = session.current;
      if (!current || pointer.pointerId !== current.pointerId) return;
      current.x = pointer.clientX; current.y = pointer.clientY;
      if (!current.dragging) {
        if (Math.hypot(current.x - current.startX, current.y - current.startY) <= 4) return;
        current.dragging = true;
        root.current?.setPointerCapture(current.pointerId);
        if (root.current) { root.current.dataset.dragging = "true"; root.current.style.zIndex = "10"; }
        if (content.current) content.current.style.willChange = "transform";
        latest.current.onStart(latest.current.id, { x: current.startX, y: current.startY });
      }
      pointer.preventDefault(); pointer.stopPropagation();
      if (frame.current === null) frame.current = requestAnimationFrame(paint);
    };
    const release = (pointer: PointerEvent) => {
      const current = session.current;
      if (!current || pointer.pointerId !== current.pointerId) return;
      if (current.dragging) {
        pointer.preventDefault(); pointer.stopPropagation();
        suppressClickUntil.current = performance.now() + 300;
        latest.current.onDrop(pointer.clientX, pointer.clientY);
      }
      reset();
    };
    const pointerCancel = (pointer: PointerEvent) => { if (pointer.pointerId === session.current?.pointerId) cancel(); };
    const escape = (key: KeyboardEvent) => { if (key.key === "Escape") cancel(); };
    const element = root.current;
    const lostCapture = (pointer: PointerEvent) => {
      if (pointer.target === element && pointer.pointerId === session.current?.pointerId) cancel();
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", pointerCancel, true);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", escape);
    element?.addEventListener("lostpointercapture", lostCapture);
    detach.current = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", pointerCancel, true);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", escape);
      element?.removeEventListener("lostpointercapture", lostCapture);
    };
  };

  return <div ref={root} className="janus-board-drag-cell" data-testid={`board-drag-cell-${id}`} data-reorder={enabled ? "true" : "false"} data-dragging={active ? "true" : "false"}
    onPointerDownCapture={begin}
    onDragStartCapture={(event) => { if (enabled) event.preventDefault(); }}
    onClickCapture={(event) => {
      if (event.detail !== 0 && performance.now() < suppressClickUntil.current) {
        event.preventDefault(); event.stopPropagation(); suppressClickUntil.current = 0;
      }
    }}
    style={{ ...styles.cell, width: props.width, zIndex: active ? 10 : 0, touchAction: enabled ? "none" : "auto", userSelect: enabled ? "none" : "auto" }}>
    <style>{cursorRules}</style>
    {active ? <div data-testid={`board-drag-placeholder-${id}`} style={{ ...styles.outline, border: `1px dashed ${theme.colors.borderStrong}`, background: theme.colors.primarySoft }} /> : null}
    <div ref={content} style={styles.content}>{props.children}</div>
    {target ? <div data-testid={`board-drop-target-${id}`} style={{ ...styles.outline, border: `2px solid ${theme.colors.primary}` }} /> : null}
  </div>;
}

const styles: Record<string, CSSProperties> = {
  cell: { position: "relative", display: "flex", flexDirection: "column", flexShrink: 0, minWidth: 0, maxWidth: "100%", boxSizing: "border-box" },
  content: { display: "flex", flexDirection: "column", flexGrow: 1 },
  outline: { position: "absolute", inset: 0, borderRadius: 20, boxSizing: "border-box", pointerEvents: "none" },
};
