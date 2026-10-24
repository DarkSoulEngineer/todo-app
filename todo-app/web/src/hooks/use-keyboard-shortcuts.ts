"use client";

import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  onNew?: () => void;
  onSearch?: () => void;
  onHelp?: () => void;
  onEscape?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Global keyboard shortcuts, ignored while the user is typing in a field. */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  const ref = useRef(handlers);

  // Keep the latest handlers reachable from the stable listener below.
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        ref.current.onEscape?.();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        ref.current.onNew?.();
      } else if (event.key === "/") {
        event.preventDefault();
        ref.current.onSearch?.();
      } else if (event.key === "?") {
        event.preventDefault();
        ref.current.onHelp?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
