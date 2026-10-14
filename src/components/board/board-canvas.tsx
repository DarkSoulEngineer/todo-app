"use client";

import { useDndContext } from "@dnd-kit/core";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { BoardZoomControls } from "@/components/board/board-zoom-controls";
import {
  clamp,
  clampView,
  CONTROLS_SELECTOR,
  EMPTY_BOX,
  INITIAL_VIEW,
  INTERACTIVE_SELECTOR,
  MAX_WHEEL_DELTA,
  pinchView,
  SCALE_STEP,
  snapScale,
  TEXT_FIELD_SELECTOR,
  WHEEL_SENSITIVITY,
  WHEEL_UNIT,
  zoomAbout,
  type PanState,
  type Point,
  type View,
} from "@/lib/utils/board-viewport";
import { cn } from "@/lib/utils/utils";

/**
 * Canvas wrapper for the Kanban board: it fills the height its parent offers
 * (`flex-1`), so the working space grows with the window. A drag on the empty
 * canvas (or with the middle button) moves the board, the wheel pans it,
 * ctrl/cmd + wheel zooms about the cursor and two fingers pinch-zoom. Card
 * drags and section reordering keep working untouched, because a pan only ever
 * starts on the backdrop — never on a card, column or button.
 */
export function BoardCanvas({
  children,
  revealTaskId,
}: {
  children: ReactNode;
  /** Card to bring into view once (e.g. the target of an activity navigation). */
  revealTaskId?: string | null;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef(EMPTY_BOX);
  const viewRef = useRef<View>(INITIAL_VIEW);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const panRef = useRef<PanState | null>(null);

  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [panning, setPanning] = useState(false);
  // While a card or a section is being dragged, the canvas holds still so the
  // two gestures never fight over the same pointer.
  const { active: dragActive } = useDndContext();

  function apply(next: View): void {
    viewRef.current = next;
    setView(next);
  }

  function zoomByStep(delta: number): void {
    const box = boxRef.current;
    const next = snapScale(viewRef.current.scale + delta);
    apply(zoomAbout(viewRef.current, box.w / 2, box.h / 2, next, box));
  }

  // Re-measure on layout changes so clamping always matches the live board.
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const measure = (): void => {
      boxRef.current = {
        w: viewport.clientWidth,
        h: viewport.clientHeight,
        cw: content.offsetWidth,
        ch: content.offsetHeight,
      };
    };
    measure();
    const observer = new ResizeObserver(() => {
      measure();
      setView((current) => clampView(current, boxRef.current));
    });
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Bring a freshly located card into view. The canvas pans by CSS transform
  // (overflow-hidden), so a plain scrollIntoView would never reach it; only
  // nudges the view when the card is not already comfortably on screen.
  useEffect(() => {
    if (!revealTaskId) return;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const el = content.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(revealTaskId)}"]`);
    if (!el) return;
    const box = boxRef.current;
    const vpRect = viewport.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const margin = 24;
    const inside =
      elRect.top >= vpRect.top + margin &&
      elRect.bottom <= vpRect.bottom - margin &&
      elRect.left >= vpRect.left + margin &&
      elRect.right <= vpRect.right - margin;
    if (inside) return;
    const current = viewRef.current;
    const dx = vpRect.left + box.w / 2 - (elRect.left + elRect.width / 2);
    const dy = vpRect.top + box.h / 2 - (elRect.top + elRect.height / 2);
    apply(clampView({ x: current.x + dx, y: current.y + dy, scale: current.scale }, box));
  }, [revealTaskId]);

  // React's onWheel is passive, so the zoom gesture needs a native listener.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    function onWheel(event: WheelEvent): void {
      if (dragActive) return;
      // The floating cluster is chrome: let the page scroll normally over it.
      if (event.target instanceof Element && event.target.closest(CONTROLS_SELECTOR)) return;
      const viewport = viewportRef.current;
      if (!viewport) return;
      const unit = WHEEL_UNIT[event.deltaMode];
      const dx = clamp(event.deltaX * unit, -MAX_WHEEL_DELTA, MAX_WHEEL_DELTA);
      const dy = clamp(event.deltaY * unit, -MAX_WHEEL_DELTA, MAX_WHEEL_DELTA);

      // ctrl/cmd + wheel always zooms the canvas, never the page.
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = viewport.getBoundingClientRect();
        apply(
          zoomAbout(
            viewRef.current,
            event.clientX - rect.left,
            event.clientY - rect.top,
            snapScale(viewRef.current.scale * Math.exp(-dy * WHEEL_SENSITIVITY)),
            boxRef.current,
          ),
        );
        return;
      }

      const current = viewRef.current;
      const next = clampView(
        { x: current.x - dx, y: current.y - dy, scale: current.scale },
        boxRef.current,
      );
      // Only swallow the gesture while the board can still move; at a clamped
      // edge the wheel scrolls the page, so the board never traps the scroll.
      if (next.x === current.x && next.y === current.y) return;
      event.preventDefault();
      apply(next);
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [dragActive]);

  const handlePointerEnd = useCallback((pointerId: number): void => {
    const pointers = pointersRef.current;
    if (!pointers.has(pointerId)) return;
    pointers.delete(pointerId);

    const viewport = viewportRef.current;
    if (viewport?.hasPointerCapture(pointerId)) viewport.releasePointerCapture(pointerId);

    const pan = panRef.current;
    if (!pan || pointers.size >= 2) return;
    const remaining = pointers.get(pan.pointerId);
    if (!remaining) {
      panRef.current = null;
      setPanning(false);
      return;
    }
    // A pinch just ended: rebase so the surviving pointer keeps moving 1:1.
    panRef.current = {
      pointerId: pan.pointerId,
      startX: remaining.x,
      startY: remaining.y,
      originX: viewRef.current.x,
      originY: viewRef.current.y,
    };
  }, []);

  // Pointers released outside the viewport (or the window) still end the gesture.
  useEffect(() => {
    function onRelease(event: PointerEvent): void {
      handlePointerEnd(event.pointerId);
    }
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    return () => {
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
    };
  }, [handlePointerEnd]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    // Only the primary and middle buttons take part in a gesture.
    if (dragActive || (event.button !== 0 && event.button !== 1)) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const target = event.target;
    const interactive = target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
    const onBackdrop = target === viewport || target === contentRef.current;
    const startsPan = event.button === 1 || (event.button === 0 && onBackdrop && !interactive);

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!startsPan || panRef.current) return;

    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewRef.current.x,
      originY: viewRef.current.y,
    };
    setPanning(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const pointers = pointersRef.current;
    const previous = pointers.get(event.pointerId);
    if (!previous || dragActive) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, current);

    // Two pointers pinch: zoom around the moving midpoint, follow it with a pan.
    if (pointers.size >= 2) {
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId);
      const viewport = viewportRef.current;
      if (!other || !viewport) return;
      const rect = viewport.getBoundingClientRect();
      apply(pinchView(viewRef.current, current, previous, other[1], rect, boxRef.current));
      return;
    }

    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const scale = viewRef.current.scale;
    apply(
      clampView(
        { x: pan.originX + (current.x - pan.startX), y: pan.originY + (current.y - pan.startY), scale },
        boxRef.current,
      ),
    );
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.isContentEditable || target.closest(TEXT_FIELD_SELECTOR) !== null);
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomByStep(SCALE_STEP);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomByStep(-SCALE_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      apply(INITIAL_VIEW);
    }
  }

  return (
    <div
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onLostPointerCapture={(event) => handlePointerEnd(event.pointerId)}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative flex-1 min-h-[16rem] overflow-hidden",
        panning ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      <div
        ref={contentRef}
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          transformOrigin: "0 0",
        }}
        className="w-max cursor-default touch-pan-y will-change-transform"
      >
        {children}
      </div>

      <BoardZoomControls
        scale={view.scale}
        onZoomIn={() => zoomByStep(SCALE_STEP)}
        onZoomOut={() => zoomByStep(-SCALE_STEP)}
        onReset={() => apply(INITIAL_VIEW)}
      />
    </div>
  );
}
