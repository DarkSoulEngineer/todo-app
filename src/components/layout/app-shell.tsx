"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface AppShellProps {
  /** Persistent sidebar (desktop) — now hover-triggered. */
  sidebar: ReactNode;
  /** Sidebar rendered inside the mobile drawer (separate instance so layout animations stay unique). */
  mobileSidebar: ReactNode;
  /** Tool ribbon — the only header now. */
  ribbon?: ReactNode;
  children: ReactNode;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

/**
 * Application frame: a hover-triggered sidebar plus a main column whose content
 * area scrolls on its own. On small screens the sidebar becomes a drawer. It
 * fills its parent, so the caller can either give it the viewport (docked) or a
 * floating window box.
 */
export function AppShell({
  sidebar,
  mobileSidebar,
  ribbon,
  children,
  mobileOpen,
  onCloseMobile,
}: AppShellProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="hidden shrink-0 lg:block">{sidebar}</div>

      <AnimatePresence>
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.button
              type="button"
              aria-label="Close navigation"
              onClick={onCloseMobile}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: reduceMotion ? 0 : -320 }}
              animate={{ x: 0 }}
              exit={{ x: reduceMotion ? 0 : -320 }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className="absolute inset-y-0 left-0 w-[16rem] max-w-[84vw] shadow-2xl"
            >
              {mobileSidebar}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {ribbon}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}