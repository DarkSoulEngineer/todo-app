"use client";

import { useDndContext } from "@dnd-kit/core";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { BoardZoomControls } from "@/components/board/board-zoom-controls";
import {
  BOARD_SCROLL_SELECTOR,
  BOARD_TRASH_RESERVE,
  canScrollBy,
  clamp,
  clampView,
  columnMaxHeight,
  CONTROLS_SELECTOR,
  EMPTY_BOX,
  findBoardScroll,
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
 * starts on the backdrop: never on a card, column or button.
 *
 * Each column also scrolls its own cards (Trello style). The wheel follows a
 * column -> board -> page chain: it scrolls the column while it can, then pans
 * the board once the column hits an edge, and finally falls through to the page
 * once the board is pinned too: so no gesture ever gets trapped.
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
  // Live viewport height, published to the columns as a CSS variable so they
  // can cap their own scroll area without re-rendering on every zoom step.
  const [viewportHeight, setViewportHeight] = useState(0);
  // While a card or a section is being dragged, the canvas holds still so the
  // two gestures never fight over the same pointer.
  const { active: dragActive } = useDndContext();
  // Only a card drag shows the trash dropzone; while it does, the columns give
  // up some height so their bottom edge clears the trash instead of sitting
  // under it. Sections keep their full height (they never show the trash).
  const cardDragActive = dragActive?.data.current?.type === "card";

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
      const h = viewport.clientHeight;
      setViewportHeight((prev) => (prev === h ? prev : h));
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
    const current = viewRef.current;

    // A card scrolled out of sight inside its column would be pointed at while
    // still hidden. Nudge that column's own scroll first (converting the
    // screen-space gap back into content pixels), so the spotlight lands on a
    // card the user can actually see.
    const scroller = el.closest<HTMLElement>(BOARD_SCROLL_SELECTOR);
    if (scroller && current.scale > 0) {
      const sRect = scroller.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const pad = 16;
      if (eRect.top < sRect.top + pad) {
        scroller.scrollTop -= (sRect.top + pad - eRect.top) / current.scale;
      } else if (eRect.bottom > sRect.bottom - pad) {
        scroller.scrollTop += (eRect.bottom - (sRect.bottom - pad)) / current.scale;
      }
    }

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

      // Scroll chain: column -> board -> page.
      //
      // Over a column, a vertical wheel belongs to that column while it can
      // still move that way: we leave the event alone (no preventDefault) so
      // the browser scrolls the column natively.
      //
      // Once the column is pinned at an edge we fall through and pan the board
      // (preventDefault). When the board is ALSO at its clamped edge we return
      // without preventDefault, so the wheel chains on to the page (the
      // app-shell's own scroll area): the board never traps the scroll.
      const scroller = findBoardScroll(event.target);
      if (scroller && canScrollBy(scroller, dy)) return;

      const current = viewRef.current;
      const next = clampView(
        { x: current.x - dx, y: current.y - dy, scale: current.scale },
        boxRef.current,
      );
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
    // Keep the board gesture on genuinely empty canvas. In particular, do not
    // add a card tap to the pointer map: two quick taps on separate cards must
    // never accidentally become a pinch, and a touch action button must never
    // arm the canvas pan or the dnd sensor at the same time.
    const boardObject =
      target instanceof Element &&
      target.closest("[data-task-id], [data-board-scroll]") !== null;
    const onBackdrop = !interactive && !boardObject;
    const startsPan = event.button === 1 || (event.button === 0 && onBackdrop);

    if (!startsPan) return;

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (panRef.current) return;

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
        "relative flex-1 min-h-[16rem] min-w-0 select-none overflow-hidden touch-pan-y",
        panning ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      <div
        ref={contentRef}
        style={
          {
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
            transformOrigin: "0 0",
            // Column cards scroll area cap, in content pixels. Recomputed on
            // zoom/resize via the variable, so columns need no re-render. During
            // a card drag a slice is reserved for the trash dropzone, so the
            // columns shorten and a gap opens above it.
            "--board-col-max":
              viewportHeight > 0
                ? `${columnMaxHeight(
                    viewportHeight,
                    view.scale,
                    cardDragActive ? BOARD_TRASH_RESERVE : 0,
                  )}px`
                : "none",
          } as CSSProperties
        }
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
