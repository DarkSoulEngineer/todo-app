"use client";

import { LayoutGrid, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWindowsContext } from "@/components/providers/window-provider";
import { useNow } from "@/hooks/use-now";

/**
 * The minimized view: an empty desktop with a Windows-style taskbar pinned to
 * the bottom. Every open board keeps a button on the taskbar, so minimizing one
 * board never hides the others — it just clears the work surface. The taskbar is
 * deliberately only rendered here, never over a live board.
 */
export function Desktop() {
  const router = useRouter();
  const { openBoards, activateBoard, closeBoard } = useWindowsContext();

  return (
    <div className="flex h-dvh w-full flex-col">
      <div className="min-h-0 flex-1" aria-hidden="true" />

      <div
        role="toolbar"
        aria-label="Open boards"
        className="z-40 flex h-12 shrink-0 items-center gap-1.5 border-t border-border bg-card/85 px-2 backdrop-blur"
      >
        <button
          type="button"
          onClick={() => router.push("/")}
          title="Board manager"
          className="focus-ring inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LayoutGrid className="h-4 w-4" strokeWidth={2.2} />
          Boards
        </button>

        <span className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden="true" />

        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {openBoards.length > 0 ? (
            openBoards.map((board) => (
              <TaskbarButton
                key={board.id}
                name={board.name}
                onActivate={() => activateBoard(board.id)}
                onClose={() => closeBoard(board.id)}
              />
            ))
          ) : (
            <p className="px-2 text-xs text-muted-foreground">No open boards</p>
          )}
        </div>

        <TaskbarClock />
      </div>
    </div>
  );
}

/** One taskbar entry: restore the board, or remove its window. */
function TaskbarButton({
  name,
  onActivate,
  onClose,
}: {
  name: string;
  onActivate: () => void;
  onClose: () => void;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "B";
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={onActivate}
        title={`Restore ${name}`}
        className="focus-ring inline-flex h-9 max-w-[14rem] items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground shadow-xs transition-colors hover:bg-muted"
      >
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded bg-primary text-[10px] font-bold text-primary-foreground"
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="truncate">{name}</span>
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label={`Close ${name}`}
        title="Close board"
        className="focus-ring absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-border bg-popover text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X className="h-2.5 w-2.5" strokeWidth={2.6} />
      </button>
    </div>
  );
}

/** Windows-style tray clock. Blank until the client clock is live. */
function TaskbarClock() {
  const now = useNow();
  const settled = now.getFullYear() > 1970;
  return (
    <div className="shrink-0 px-2 text-right text-[11px] leading-tight text-muted-foreground tabular-nums">
      {settled ? (
        <>
          <p>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          <p>{now.toLocaleDateString([], { month: "short", day: "numeric" })}</p>
        </>
      ) : null}
    </div>
  );
}
