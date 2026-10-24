"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/utils";

type TooltipSide = "top" | "bottom";

/** Props the trigger element must spread; they wire hover/focus + a11y. */
export interface TooltipTriggerProps {
  "aria-describedby"?: string;
  onMouseEnter: (event: ReactMouseEvent<HTMLElement>) => void;
  onMouseLeave: (event: ReactMouseEvent<HTMLElement>) => void;
  onFocus: (event: ReactFocusEvent<HTMLElement>) => void;
  onBlur: (event: ReactFocusEvent<HTMLElement>) => void;
}

interface RichTooltipProps {
  content: ReactNode;
  /** Render prop receiving the handlers/attributes to spread on the trigger. */
  children: (triggerProps: TooltipTriggerProps) => ReactElement;
  side?: TooltipSide;
  delayMs?: number;
  className?: string;
}

const GAP = 8;
const VIEWPORT_MARGIN = 8;

const dismissers = new Set<() => void>();

/** Hides every open tooltip. Called when a drag starts so overlays never linger. */
export function dismissTooltips(): void {
  for (const fn of dismissers) fn();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function resolveSide(side: TooltipSide, anchor: DOMRect, height: number, viewportH: number): TooltipSide {
  const spaceBelow = viewportH - anchor.bottom - GAP;
  const spaceAbove = anchor.top - GAP;
  if (side === "bottom" && spaceBelow < height && spaceAbove > spaceBelow) return "top";
  if (side === "top" && spaceAbove < height && spaceBelow > spaceAbove) return "bottom";
  return side;
}

/**
 * A styled tooltip/popover that opens on hover and on keyboard focus. It renders
 * in a portal (so it is never clipped by card overflow), flips/clamps to stay
 * inside the viewport, wraps long content, and never captures pointer events.
 */
export function RichTooltip({
  content,
  children,
  side = "bottom",
  delayMs = 140,
  className,
}: RichTooltipProps) {
  const reduceMotion = useReducedMotion();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; side: TooltipSide } | null>(null);

  const anchorRect = useRef<DOMRect | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const openWith = useCallback((node: HTMLElement) => {
    if (!node.isConnected) return;
    anchorRect.current = node.getBoundingClientRect();
    setPos(null);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  const scheduleOpen = useCallback(
    (node: HTMLElement) => {
      clearTimer();
      timer.current = window.setTimeout(() => openWith(node), reduceMotion ? 0 : delayMs);
    },
    [clearTimer, delayMs, openWith, reduceMotion],
  );

  // Clear any pending timer on unmount.
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // Let drag starts close the tooltip.
  useEffect(() => {
    if (!open) return;
    dismissers.add(close);
    return () => {
      dismissers.delete(close);
    };
  }, [open, close]);

  // Dismiss on Escape, scroll, resize, or any pointer press.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") close();
    }
    function onScroll(): void {
      close();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("pointerdown", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("pointerdown", onScroll, true);
    };
  }, [open, close]);

  // Measure the rendered tooltip and place it, flipping/clamping as needed.
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRect.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;

    const { width, height } = tip.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const resolved = resolveSide(side, anchor, height, viewportH);
    const rawTop = resolved === "bottom" ? anchor.bottom + GAP : anchor.top - height - GAP;
    const top = clamp(rawTop, VIEWPORT_MARGIN, viewportH - height - VIEWPORT_MARGIN);
    const rawLeft = anchor.left + anchor.width / 2 - width / 2;
    const left = clamp(rawLeft, VIEWPORT_MARGIN, viewportW - width - VIEWPORT_MARGIN);

    setPos({ top, left, side: resolved });
  }, [open, side]);

  // Only advertise the tooltip while it is actually mounted.
  const triggerProps: TooltipTriggerProps = {
    onMouseEnter: (event) => scheduleOpen(event.currentTarget),
    onMouseLeave: () => close(),
    onFocus: (event) => openWith(event.currentTarget),
    onBlur: () => close(),
  };
  if (open) triggerProps["aria-describedby"] = id;

  // The handlers touch refs only once their events fire, never during render;
  // the lint rule cannot see through the render prop, so it opts out here.
  // eslint-disable-next-line react-hooks/refs
  const trigger = children(triggerProps);

  return (
    <>
      {trigger}
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  ref={tipRef}
                  role="tooltip"
                  id={id}
                  style={{
                    position: "fixed",
                    top: pos?.top ?? -9999,
                    left: pos?.left ?? -9999,
                    visibility: pos ? "visible" : "hidden",
                  }}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.1 } }}
                  transition={{ duration: reduceMotion ? 0 : 0.14, ease: "easeOut" }}
                  className={cn(
                    "pointer-events-none z-[120] w-max max-w-[min(22rem,calc(100vw-1rem))] rounded-xl border border-border bg-popover p-3 text-left shadow-xl ring-1 ring-black/5 dark:ring-white/10",
                    className,
                  )}
                >
                  {content}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
