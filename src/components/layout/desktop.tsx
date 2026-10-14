"use client";

import { LayoutGrid, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { useWindowsContext } from "@/components/providers/window-provider";
import {
  BOARD_COLORS,
  boardColor,
  getBoardColorByLabel,
  type BoardColor,
} from "@/lib/domain/boards";
import { getTaskSectionId } from "@/lib/domain/sections";
import type { Task, Workspace } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

/**
 * A board's stable identity colour: its palette hue when the name matches a
 * built-in board, otherwise a hue chosen from a hash of the id so a board keeps
 * the same colour for the whole session.
 */
function boardAccent(name: string, id: string): BoardColor {
  const byLabel = getBoardColorByLabel(name);
  if (byLabel) return byLabel;
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return BOARD_COLORS[hash % BOARD_COLORS.length];
}

const MAX_COLUMNS = 5;
const MAX_CARDS = 5;

/**
 * The minimized view: a Windows ALT+TAB-style switcher, with no taskbar.
 *
 * Every open board is a big square "thumbnail" that re-renders its real columns
 * and cards in miniature, with the board name beneath. Exactly one tile is
 * selected and highlighted; Tab / Shift+Tab and the arrow keys cycle the
 * selection with wrap-around, and Enter (or a click, or a hover) switches to the
 * selected board. Esc steps out, leaving the desktop as it is. When nothing is
 * open, a calm empty state links to the board manager.
 */
export function Desktop() {
  const reduceMotion = useReducedMotion();
  const { openBoards, activateBoard, closeBoard } = useWindowsContext();
  const { projects } = useTasksContext();

  // A stable "now" for status-derived columns; the switcher is client-only.
  const [now] = useState(() => new Date());

  const workspaces = useMemo(
    () => new Map(projects.map((project) => [project.id, project.workspace])),
    [projects],
  );

  const tiles = useMemo(
    () =>
      openBoards.map((board) => ({
        ...board,
        workspace: workspaces.get(board.id),
        accent: boardAccent(board.name, board.id),
      })),
    [openBoards, workspaces],
  );

  const count = tiles.length;
  // Start on the most recently opened board, like ALT+TAB starts on the last one.
  const [selected, setSelected] = useState(() => Math.max(0, tiles.length - 1));
  const selectedIndex = count === 0 ? -1 : Math.min(selected, count - 1);

  const tileRefs = useRef<(HTMLLIElement | null)[]>([]);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const initialIndex = useRef(selectedIndex);
  const hadBoards = useRef(count > 0);

  // Focus the switcher on mount so the keyboard works straight away (the board
  // manager link stands in when nothing is open).
  useEffect(() => {
    if (hadBoards.current) tileRefs.current[initialIndex.current]?.focus();
    else linkRef.current?.focus();
  }, []);

  const selectIndex = (index: number) => {
    setSelected(index);
    tileRefs.current[index]?.focus();
  };

  // Move selection — and focus — by one step, wrapping around the open boards.
  const step = (delta: number) => {
    if (count === 0) return;
    selectIndex(((selectedIndex + delta) % count + count) % count);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      // Leave the desktop exactly as it is; just release the switcher.
      event.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    if (count === 0) return;
    if (event.key === "Tab") {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectIndex(count - 1);
    }
  };

  return (
    <div className="flex h-dvh w-full items-center justify-center p-4 sm:p-8">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Switch board"
        onKeyDown={handleKeyDown}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={
          reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 30, mass: 0.7 }
        }
        className="w-full max-w-[99vw]"
      >
        {count > 0 ? (
          <ul
            role="listbox"
            aria-label="Switch board"
            className="grid max-h-[70dvh] w-full grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 overflow-y-auto pr-0.5"
          >
            {tiles.map((board, index) => {
              const isSelected = index === selectedIndex;
              return (
                <li
                  key={board.id}
                  ref={(node) => {
                    tileRefs.current[index] = node;
                  }}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onMouseEnter={() => setSelected(index)}
                  onFocus={() => setSelected(index)}
                  onClick={() => activateBoard(board.id)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      activateBoard(board.id);
                    }
                  }}
                  className={cn(
                    "focus-ring group relative flex cursor-pointer flex-col gap-1.5 rounded-3xl border p-2 transition-all duration-200",
                    isSelected
                      ? "border-primary/60 bg-primary/5 shadow-xl ring-2 ring-primary/40"
                      : "border-border bg-card/50 opacity-70 hover:bg-muted/60 hover:opacity-100",
                  )}
                >
                  <button
                    type="button"
                    aria-label={`Close ${board.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      closeBoard(board.id);
                    }}
                    className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-background hover:text-foreground focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    <X className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                  <BoardThumbnail workspace={board.workspace} accent={board.accent} now={now} />
                  <p
                    className={cn(
                      "truncate px-1 pb-0.5 text-center text-base font-semibold",
                      isSelected ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {board.name}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-6 mb-2 flex flex-col items-center gap-3 px-2 py-8 text-center">
            <span
              className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <LayoutGrid className="h-6 w-6" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Nothing open right now</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pick a board to get going.
              </p>
            </div>
            <Link
              ref={linkRef}
              href="/"
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              <LayoutGrid className="h-4 w-4" strokeWidth={2.2} />
              Open the board manager
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/**
 * A miniature of a board: its real columns as slim vertical strips, each with a
 * couple of cards. Skips re-rendering while only the switcher's selection
 * changes, so hovering stays cheap.
 */
const BoardThumbnail = memo(function BoardThumbnail({
  workspace,
  accent,
  now,
}: {
  workspace?: Workspace;
  accent: BoardColor;
  now: Date;
}) {
  const sections = useMemo(
    () => (workspace?.sections ?? []).filter((section) => !section.hidden),
    [workspace],
  );
  const tasks = workspace?.tasks ?? [];
  const columns = sections.slice(0, MAX_COLUMNS);

  const dotFor = (task: Task): string | undefined => {
    const board = workspace?.boards.find((entry) => entry.id === task.category);
    return board ? boardColor(board.color).dot : undefined;
  };

  const cardsFor = (sectionId: string): Task[] =>
    tasks
      .filter((task) => getTaskSectionId(task, sections, now) === sectionId)
      .slice(0, MAX_CARDS);

  return (
    <div className="flex aspect-square w-full flex-col overflow-hidden rounded-3xl border border-border bg-muted/40">
      {/* Accent titlebar: the board's identity colour at a glance. */}
      <div className={cn("h-1.5 shrink-0 opacity-80", accent.dot)} aria-hidden="true" />

      <div className="flex min-h-0 flex-1 gap-1.5 p-2">
        {columns.length > 0
          ? columns.map((column) => (
              <div key={column.id} className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-1 px-0.5">
                  <span className="h-1 min-w-0 flex-1 rounded-full bg-foreground/20" />
                  <span className="h-1.5 w-2.5 shrink-0 rounded-full bg-foreground/10" />
                </div>
                {cardsFor(column.id).map((task) => (
                  <MiniCard key={task.id} dot={dotFor(task)} />
                ))}
              </div>
            ))
          : Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="h-1 w-3/4 rounded-full bg-foreground/10" />
                <span className="flex-1 rounded-md border border-dashed border-border" />
              </div>
            ))}
      </div>
    </div>
  );
});

/** One miniature card: two text bars and an optional category dot. */
function MiniCard({ dot }: { dot?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-card p-1 shadow-xs">
      <span className="h-1 w-4/5 rounded-full bg-foreground/25" />
      <span className="flex items-center gap-1">
        <span className={cn("h-1 w-1 shrink-0 rounded-full", dot ?? "bg-foreground/20")} />
        <span className="block h-1 w-1/2 rounded-full bg-foreground/15" />
      </span>
    </div>
  );
}
