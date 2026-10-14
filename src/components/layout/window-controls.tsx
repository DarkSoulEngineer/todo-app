"use client";

import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/utils";

interface WindowControlsProps {
  /** True while the board fills the screen via the Fullscreen API. */
  maximized: boolean;
  /** True while the board is shown as a small floating window. */
  floating: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

/**
 * Desktop-style window buttons for the board's top bar. They emulate window
 * behaviour inside the app rather than the OS:
 * - Minimize collapses the board into a floating window (and restores it).
 * - Maximize goes full-screen (and restores a floating window to normal).
 * - Close leaves the current board and returns to the board manager.
 */
export function WindowControls({
  maximized,
  floating,
  onMinimize,
  onMaximize,
  onClose,
}: WindowControlsProps) {
  const maximizeLabel = maximized ? "Restore board" : floating ? "Maximize board" : "Maximize board";

  return (
    <div
      role="group"
      aria-label="Window controls"
      className="flex shrink-0 items-center gap-0.5"
    >
      <WindowButton label={floating ? "Restore board" : "Minimize board"} onClick={onMinimize}>
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
      // The title bar doubles as a drag handle while floating, so a click on a
      // window button must never start a window drag.
      onPointerDown={(event) => event.stopPropagation()}
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
