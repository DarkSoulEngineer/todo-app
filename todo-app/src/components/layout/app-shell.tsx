"use client";

import type { ReactNode } from "react";

interface AppShellProps {
  /** Tool ribbon — the only header now. */
  ribbon?: ReactNode;
  children: ReactNode;
}

/**
 * Application frame: the ribbon sits above a content area that scrolls on its
 * own. It fills its parent, so the caller can either give it the viewport
 * (docked) or a floating window box.
 */
export function AppShell({ ribbon, children }: AppShellProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {ribbon}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
