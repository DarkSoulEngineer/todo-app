import { useCallback, useEffect, useRef, type ComponentRef, type RefObject } from "react";
import { Platform, ScrollView } from "react-native";
import type { BoardPoint } from "@/lib/features/board-drag";

type Scroller = ComponentRef<typeof ScrollView>;
interface List { node: Scroller | null; offset: number }

function speed(point: number, start: number, end: number) {
  const edge = Math.min(40, (end - start) / 3);
  if (point < start || point > end) return 0;
  if (point < start + edge) return -Math.ceil(12 * (1 - (point - start) / edge));
  if (point > end - edge) return Math.ceil(12 * (1 - (end - point) / edge));
  return 0;
}

/** Native counterpart to the browser preview's edge-scrolling animation loop. */
export function useNativeJanusAutoScroll(dragging: boolean, carousel: RefObject<Scroller | null>, onMove: (x: number, y: number) => void) {
  const pointer = useRef<BoardPoint | null>(null);
  const horizontalOffset = useRef(0);
  const lists = useRef(new Map<string, List>());
  const latest = useRef(onMove);
  useEffect(() => { latest.current = onMove; }, [onMove]);
  const trackPointer = useCallback((x: number, y: number) => { pointer.current = { x, y }; }, []);
  const trackCarousel = useCallback((x: number) => { horizontalOffset.current = x; }, []);
  const registerList = useCallback((id: string, node: Scroller | null) => {
    const list = lists.current.get(id);
    if (list) list.node = node;
    else if (node) lists.current.set(id, { node, offset: 0 });
  }, []);
  const trackList = useCallback((id: string, offset: number) => { const list = lists.current.get(id); if (list) list.offset = offset; }, []);
  const listOffset = useCallback((id: string) => lists.current.get(id)?.offset ?? 0, []);
  useEffect(() => {
    if (Platform.OS === "web" || !dragging) return;
    let alive = true;
    let measuring = false;
    let frame = 0;
    const tick = () => {
      if (!alive) return;
      frame = requestAnimationFrame(tick);
      const point = pointer.current;
      const scroll = carousel.current;
      if (!point || !scroll || measuring) return;
      measuring = true;
      scroll.getNativeScrollRef()?.measureInWindow((x: number, y: number, width: number, height: number) => {
        measuring = false;
        if (!alive || point.y < y || point.y > y + height) return;
        const dx = speed(point.x, x, x + width);
        if (dx) scroll.scrollTo({ x: Math.max(0, horizontalOffset.current + dx), animated: false });
        for (const list of lists.current.values()) list.node?.getNativeScrollRef()?.measureInWindow((left: number, top: number, listWidth: number, listHeight: number) => {
          if (!alive || point.x < left || point.x > left + listWidth || point.y > top + listHeight + 44) return;
          const dy = speed(Math.min(point.y, top + listHeight), top, top + listHeight);
          if (dy) list.node?.scrollTo({ y: Math.max(0, list.offset + dy), animated: false });
        });
        latest.current(point.x, point.y);
      });
    };
    frame = requestAnimationFrame(tick);
    return () => { alive = false; pointer.current = null; cancelAnimationFrame(frame); };
  }, [dragging, carousel]);
  return { trackPointer, trackCarousel, registerList, trackList, listOffset };
}
