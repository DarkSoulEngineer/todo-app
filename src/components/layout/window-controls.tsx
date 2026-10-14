"use client";

import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/utils";

interface WindowControlsProps {
  /** True while the board fills the screen via the Fullscreen API. */
  maximized: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

/**
 * Desktop-style window buttons for the board's top bar. They emulate window
 * behaviour inside the app rather than the OS:
 * - Minimize hides the board and drops it onto the taskbar (restorable).
 * - Maximize goes full-screen (and restores again).
 * - Close removes the board window and returns to the board manager.
 */
export function WindowControls({
  maximized,
  onMinimize,
  onMaximize,
  onClose,
}: WindowControlsProps) {
  const maximizeLabel = maximized ? "Restore board" : "Maximize board";

  return (
    <div
      role="group"
      aria-label="Window controls"
      className="flex shrink-0 items-center gap-0.5"
    >
      <WindowButton label="Minimize board" onClick={onMinimize}>
        <Minus className="h-4 w-4" strokeWidth={2.4} />
      </WindowButton>
      <WindowButton label={maximizeLabel} onClick={onMaximize}>
        {maximized ? (
          <Minimize2 className="h-4 w-4" strokeWidth={2.4} />
        ) : (
          <Maximize2 className="h-4 w-4" strokeWidth={2.4} />
        )}
      </WindowButton>
      <WindowButton label="Close board" onClick={onClose} danger>
        <X className="h-4 w-4" strokeWidth={2.4} />
      </WindowButton>
    </div>
  );
}

function WindowButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors",
        danger
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
