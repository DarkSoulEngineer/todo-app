"use client";

import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { ReactNode } from "react";
import { MAX_SCALE, MIN_SCALE } from "@/lib/utils/board-viewport";

interface BoardZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

/** Floating zoom cluster, pinned to the bottom-right of the board canvas. */
export function BoardZoomControls({ scale, onZoomIn, onZoomOut, onReset }: BoardZoomControlsProps) {
  return (
    <div
      data-board-controls
      className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-xl border border-border bg-card/95 p-0.5 shadow-lg backdrop-blur"
    >
      <ControlButton label="Zoom out" onClick={onZoomOut} disabled={scale <= MIN_SCALE + 0.001}>
        <ZoomOut className="h-4 w-4" />
      </ControlButton>
      <span
        aria-live="polite"
        className="w-14 text-center text-[11px] font-semibold tabular-nums text-muted-foreground"
      >
        {Math.round(scale * 100)}%
      </span>
      <ControlButton label="Zoom in" onClick={onZoomIn} disabled={scale >= MAX_SCALE - 0.001}>
        <ZoomIn className="h-4 w-4" />
      </ControlButton>
      <ControlButton label="Reset zoom and position" onClick={onReset}>
        <Maximize2 className="h-4 w-4" />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="focus-ring grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
