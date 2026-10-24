"use client";

import { useMemo, useSyncExternalStore } from "react";

const INTERVAL_MS = 30_000;
const listeners = new Set<() => void>();

let current = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function tick(): void {
  current = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  if (timer === null) {
    // First subscriber starts the clock (this runs in an effect, never in render).
    tick();
    timer = setInterval(tick, INTERVAL_MS);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Stable snapshot; unchanged between ticks so React never loops. */
function getSnapshot(): number {
  return current;
}

/** Prerender/hydration snapshot — a fixed value keeps output deterministic. */
function getServerSnapshot(): number {
  return 0;
}

/**
 * A ticking "now" for due-date labels and status derivation.
 * Reads the clock through an external store so it is never evaluated during
 * prerender (Next.js cacheComponents) and never causes hydration mismatches.
 * Until the client hydrates it reports the epoch; content that depends on the
 * real time only renders after tasks finish loading on the client.
 */
export function useNow(): Date {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => new Date(ms), [ms]);
}
