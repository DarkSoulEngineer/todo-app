"use client";

import { useSyncExternalStore } from "react";

const subscribe = (): (() => void) => () => {};

/**
 * True only after the client has hydrated. Uses `useSyncExternalStore` so the
 * server snapshot is `false` and the client snapshot is `true` without a
 * setState-in-effect, keeping SSR and hydration output identical.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
