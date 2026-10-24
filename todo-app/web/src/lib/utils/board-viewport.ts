/** Pan/zoom transform of the board, measured from the viewport's top-left corner. */
export interface View {
  x: number;
  y: number;
  scale: number;
}

/** Live viewport + content sizes, used to keep the board within reach. */
interface Box {
  w: number;
  h: number;
  cw: number;
  ch: number;
}

export interface Point {
  x: number;
  y: number;
}

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2;
export const SCALE_STEP = 0.1;
export const WHEEL_SENSITIVITY = 0.0015;
export const MAX_WHEEL_DELTA = 100;
export const WHEEL_UNIT: Record<number, number> = { 0: 1, 1: 16, 2: 400 };
export const INITIAL_VIEW: View = { x: 0, y: 0, scale: 1 };
export const EMPTY_BOX: Box = { w: 0, h: 0, cw: 0, ch: 0 };
export const CONTROLS_SELECTOR = "[data-board-controls]";
/** Elements that own their own pointer gesture: a pan never starts on them. */
export const INTERACTIVE_SELECTOR = "button, input, textarea, select, a, [data-dnd]";
export const TEXT_FIELD_SELECTOR = "input, textarea, select";
/** A column's inner card list, which scrolls on its own inside the board. */
export const BOARD_SCROLL_SELECTOR = "[data-board-scroll]";
/** Bottom breathing room kept under a column so it never kisses the viewport. */
export const BOARD_COLUMN_GUTTER = 8;
/** Floor for a column's scroll height, so it stays usable on tiny viewports. */
export const BOARD_COLUMN_MIN_HEIGHT = 200;
/**
 * Screen-space room reserved above the trash dropzone while a card is dragged,
 * so the columns' bottom edge rises and leaves a clear gap instead of sitting
 * under the trash. Roughly the resting trash height (h-16) plus a small margin.
 */
export const BOARD_TRASH_RESERVE = 72;

/**
 * The maximum height (in board/content pixels) a column may take so that, once
 * the canvas scale is applied, it still fits inside the visible viewport. The
 * board is scaled with a CSS transform, so a screen-space budget is divided by
 * the scale to land back in the content's own coordinate space. `reserve` is a
 * screen-space slice to keep clear (e.g. the trash dropzone during a drag).
 */
export function columnMaxHeight(
  viewportHeight: number,
  scale: number,
  reserve = 0,
): number {
  if (viewportHeight <= 0 || scale <= 0) return BOARD_COLUMN_MIN_HEIGHT;
  return Math.max(
    BOARD_COLUMN_MIN_HEIGHT,
    (viewportHeight - reserve) / scale - BOARD_COLUMN_GUTTER,
  );
}

/** True while `el` can still scroll vertically in the wheel's direction. */
export function canScrollBy(el: HTMLElement, dy: number): boolean {
  if (dy === 0) return false;
  const max = el.scrollHeight - el.clientHeight;
  if (max <= 1) return false;
  return dy < 0 ? el.scrollTop > 1 : el.scrollTop < max - 1;
}

/** Nearest scrollable column under an event target, if any. */
export function findBoardScroll(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(BOARD_SCROLL_SELECTOR);
}

/** Bookkeeping for a pointer that is currently dragging the board. */
export interface PanState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampScale(scale: number): number {
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

/** Zoom lands on a 0.1 grid so the label, the buttons and the wheel stay in sync. */
export function snapScale(scale: number): number {
  return Math.round(clampScale(scale) * 10) / 10;
}

/** Keep the board reachable: an axis that still fits is pinned to its origin. */
export function clampView(view: View, box: Box): View {
  return {
    scale: view.scale,
    x: clamp(view.x, Math.min(0, box.w - box.cw * view.scale), 0),
    y: clamp(view.y, Math.min(0, box.h - box.ch * view.scale), 0),
  };
}

/** Scale around a point in viewport coordinates, then shift the result. */
export function zoomAbout(
  view: View,
  cx: number,
  cy: number,
  next: number,
  box: Box,
  dx = 0,
  dy = 0,
): View {
  const scale = clampScale(next);
  const ratio = scale / view.scale;
  return clampView(
    { scale, x: cx - (cx - view.x) * ratio - dx, y: cy - (cy - view.y) * ratio - dy },
    box,
  );
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Two-pointer pinch: zoom around the moving midpoint and follow it around. */
export function pinchView(
  view: View,
  current: Point,
  previous: Point,
  other: Point,
  origin: { left: number; top: number },
  box: Box,
): View {
  const spread = distance(current, other);
  const before = distance(previous, other);
  if (spread <= 0 || before <= 0) return view;
  const focus = midpoint(current, other);
  const from = midpoint(previous, other);
  return zoomAbout(
    view,
    focus.x - origin.left,
    focus.y - origin.top,
    view.scale * (spread / before),
    box,
    focus.x - from.x,
    focus.y - from.y,
  );
}
