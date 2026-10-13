"use client";

import { defaultAnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  Circle,
  Clock3,
  Columns3,
  Copy,
  Download,
  GripVertical,
  Pencil,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useRef, useState, type JSX } from "react";
import { boardColor, type BoardColorId } from "@/lib/boards";
import { CARD_COLOR_WASHES, NEUTRAL_WASH } from "@/lib/card-themes";
import type { StrideProject } from "@/lib/projects";
import type { Workspace } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** A deadline inside the next seven days counts as "due soon". */
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

/** Shared easing for grid glides — the same curve dnd-kit uses internally. */
const GRID_EASE = "cubic-bezier(0.2, 0, 0, 1)";

/** Reason surfaced on the disabled Remove control of the last board. */
const KEEP_ONE_BOARD = "At least one board must remain";

// The board colour palette (see `boards.ts`) supplies every accent used on a
// tile — its `tile` gradient/ring and `icon` ink — so a board tile's accent and
// a task's board chip are drawn from one source. Literals only, so Tailwind v4
// keeps every class it scans — never build these strings dynamically.

/** Neutral fallback used when a board has no dominant category colour. */
const DEFAULT_TILE_WASH = "from-primary/12 to-primary/5 ring-primary/25";
const DEFAULT_TILE_ICON = "text-primary";

interface BoardStats {
  openCount: number;
  doneCount: number;
  total: number;
  pct: number;
  overdue: number;
  soon: number;
  dominant: BoardColorId | null;
}

/** Live numbers for one board: progress, deadlines and its dominant hue. */
function summarizeWorkspace(workspace: Workspace, now: Date | null): BoardStats {
  let openCount = 0;
  let doneCount = 0;
  let overdue = 0;
  let soon = 0;
  const tally = new Map<BoardColorId, number>();

  for (const task of workspace.tasks) {
    if (task.completed) {
      doneCount += 1;
    } else if (!task.canceled) {
      openCount += 1;
      if (task.dueAt && now) {
        const due = Date.parse(task.dueAt);
        if (!Number.isNaN(due)) {
          const diff = due - now.getTime();
          if (diff < 0) overdue += 1;
          else if (diff <= SEVEN_DAYS) soon += 1;
        }
      }
    }
    if (task.canceled) continue;
    const board = workspace.boards.find((candidate) => candidate.id === task.category);
    if (board) tally.set(board.color, (tally.get(board.color) ?? 0) + 1);
  }

  let dominant: BoardColorId | null = null;
  let best = 0;
  for (const [color, count] of tally) {
    if (count > best) {
      best = count;
      dominant = color;
    }
  }

  const total = openCount + doneCount;
  return {
    openCount,
    doneCount,
    total,
    pct: total === 0 ? 0 : Math.round((doneCount / total) * 100),
    overdue,
    soon,
    dominant,
  };
}

interface ManagerBoardCardProps {
  project: StrideProject;
  /** False on the one remaining board, which can no longer be removed. */
  removable: boolean;
  /** Only the focused card is in the roving tab order (arrow-key nav). */
  focused: boolean;
  isPinned: boolean;
  /** Edit mode: a drag grip appears and the card surface never opens. */
  editMode: boolean;
  /** Shared "now" snapshot so every card reads the same moment. */
  now: Date | null;
  onLoad: (project: StrideProject) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (project: StrideProject) => void;
  onRemove: (project: StrideProject) => void;
  onSave: (project: StrideProject) => void;
  onTogglePin: (id: string) => void;
  cardRef: (element: HTMLElement | null) => void;
}

/**
 * One tile on the Board manager landing page. In browse mode clicking the card
 * opens the board and hands off to /tasks; in edit mode the whole card is the
 * drag surface (the grip is a visual cue only) and the surface never loads.
 * Inner controls stop propagation, carry `data-no-load`, and stay clickable
 * because dnd-kit skips pointerdowns that land on interactive elements.
 */
export function ManagerBoardCard({
  project,
  removable,
  focused,
  isPinned,
  editMode,
  now,
  onLoad,
  onRename,
  onDuplicate,
  onRemove,
  onSave,
  onTogglePin,
  cardRef,
}: ManagerBoardCardProps): JSX.Element {
  const { workspace } = project;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const exitViaKeyRef = useRef(false);
  const titleRef = useRef<HTMLButtonElement>(null);

  // Sortable only while arranging, inert otherwise. Following board-card.tsx's
  // convention, the whole card is the drag surface: dnd-kit ignores pointerdowns
  // on interactive elements (buttons, the rename input), so they all stay
  // clickable while a 6px move from anywhere else starts a drag.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    disabled: !editMode,
    data: { type: "board" },
    // Explicit default: neighbours glide into place while the overlay floats.
    animateLayoutChanges: defaultAnimateLayoutChanges,
  });

  // Trust dnd-kit's per-frame transition when it has an opinion (it briefly
  // disables transitions for a setup frame); otherwise a shared 220ms glide
  // carries hover, drag and settle motion on one buttery curve.
  const cardTransition =
    transition ??
    `transform 220ms ${GRID_EASE}, border-color 200ms ease, box-shadow 200ms ease, opacity 200ms ease`;

  // The dnd-kit node ref and the manager's roving-focus ref share the card.
  function setRefs(element: HTMLElement | null): void {
    setNodeRef(element);
    cardRef(element);
  }

  /** Opens the board: click is an instant hand-off to /tasks. */
  function handleOpen(): void {
    onLoad(project);
  }

  const stats = useMemo(() => summarizeWorkspace(workspace, now), [workspace, now]);
  const accentTile = stats.dominant ? boardColor(stats.dominant).tile : DEFAULT_TILE_WASH;
  const accentIcon = stats.dominant ? boardColor(stats.dominant).icon : DEFAULT_TILE_ICON;
  // Same wash source as task cards (`CARD_COLOR_WASHES`), so a board tile's
  // tint is literally the class a tagged task card carries.
  const accentWash = stats.dominant ? CARD_COLOR_WASHES[stats.dominant] : NEUTRAL_WASH;
  const fillClass = stats.dominant ? boardColor(stats.dominant).dot : "bg-primary";

  function beginEdit(): void {
    setDraft(project.name);
    setEditing(true);
  }

  /** The input blurred: commit the typed name, unless a key already handled it. */
  function commitFromBlur(): void {
    if (exitViaKeyRef.current) {
      exitViaKeyRef.current = false;
      return;
    }
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== project.name) onRename(project.id, trimmed);
  }

  /** Enter: commit the name and hand focus back to the title. */
  function commitFromEnter(): void {
    exitViaKeyRef.current = true;
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== project.name) onRename(project.id, trimmed);
    titleRef.current?.focus();
  }

  /** Escape: drop the draft and hand focus back to the title. */
  function cancelFromEscape(): void {
    exitViaKeyRef.current = true;
    setEditing(false);
    titleRef.current?.focus();
  }

  return (
    <article
      ref={setRefs}
      data-card="true"
      data-board-id={project.id}
      {...(editMode ? attributes : {})}
      {...(editMode ? listeners : {})}
      tabIndex={editMode || focused ? 0 : -1}
      aria-label={editMode ? `Arrange ${project.name}` : `Open ${project.name}`}
      title={editMode ? "Drag to rearrange" : `Open ${project.name}`}
      style={{ transform: CSS.Transform.toString(transform), transition: cardTransition }}
      onClick={(event) => {
        // Edit mode is for arranging, not loading. Otherwise only the bare
        // surface opens the board — the controls below stop their own clicks,
        // and the title keeps the inline-rename intent.
        if (editMode) return;
        const target = event.target as HTMLElement;
        if (target.closest("button, a, input, textarea, [data-no-load]")) return;
        handleOpen();
      }}
      className={cn(
        "group relative flex flex-col gap-3.5 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-xs hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg",
        editMode ? "touch-none cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-40",
      )}
    >
      {/* Full-bleed radial wash — the canonical recipe task cards use
          (`CARD_COLOR_WASHES`), so both card families tint identically. */}
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 rounded-2xl", accentWash)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col gap-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-inset",
                accentTile,
              )}
            >
              <Columns3 className={cn("h-4 w-4", accentIcon)} strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              {editing ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  onBlur={commitFromBlur}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitFromEnter();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      cancelFromEscape();
                    }
                  }}
                  aria-label={`Rename ${project.name}`}
                  className="focus-ring h-8 w-full min-w-0 max-w-[16rem] rounded-lg border border-primary/50 bg-card px-2 text-sm font-semibold text-foreground"
                />
              ) : (
                <button
                  ref={titleRef}
                  type="button"
                  data-no-load
                  onClick={(event) => {
                    event.stopPropagation();
                    beginEdit();
                  }}
                  aria-label={`Rename ${project.name}`}
                  title="Rename board"
                  className="focus-ring group/name -mx-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 text-left"
                >
                  <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                    {project.name}
                  </span>
                  <Pencil
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover/name:opacity-100"
                    strokeWidth={2.2}
                  />
                </button>
              )}
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Created {formatCreated(project.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {editMode ? (
              <span
                aria-hidden="true"
                title="Drag to rearrange"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground/50"
              >
                <GripVertical className="h-4 w-4" strokeWidth={2.2} />
              </span>
            ) : null}
            <button
              type="button"
              data-no-load
              aria-pressed={isPinned}
              aria-label={isPinned ? `Unpin ${project.name}` : `Pin ${project.name}`}
              title={isPinned ? "Unpin board" : "Pin board"}
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin(project.id);
              }}
              className={cn(
                "focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                isPinned
                  ? "text-amber-500 hover:bg-amber-500/15"
                  : "text-muted-foreground/70 hover:bg-muted hover:text-foreground",
              )}
            >
              <Star className={cn("h-4 w-4", isPinned && "fill-current")} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-3 font-medium text-foreground tabular-nums">
            <span className="flex items-center gap-1.5">
              <Circle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.2} />
              {stats.openCount} open
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={2.2} />
              {stats.doneCount} done
            </span>
          </span>
          {stats.total > 0 ? (
            <span className="text-muted-foreground tabular-nums">{stats.pct}%</span>
          ) : null}
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", fillClass)} style={{ width: `${stats.pct}%` }} />
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-3">
            {stats.overdue > 0 ? (
              <span className="flex items-center gap-1 font-medium text-destructive">
                <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.2} />
                {stats.overdue} overdue
              </span>
            ) : null}
            {stats.soon > 0 ? (
              <span className="flex items-center gap-1 font-medium text-info">
                <Clock3 className="h-3.5 w-3.5" strokeWidth={2.2} />
                {stats.soon} due soon
              </span>
            ) : null}
            {stats.overdue === 0 && stats.soon === 0 ? (
              <span className="text-muted-foreground/80">No deadlines coming up</span>
            ) : null}
          </span>
          <CategoryDots boards={workspace.boards} />
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onSave(project);
            }}
            aria-label={`Save ${project.name} as a file`}
            title={`Save ${project.name} as a file`}
          >
            <Download className="h-3.5 w-3.5" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(project);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </Button>
          {removable ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(project);
              }}
              aria-label={`Remove ${project.name}`}
              title={`Remove ${project.name}`}
              className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          ) : (
            // A disabled button swallows pointer events, so the reason lives on
            // a wrapper that stays hoverable.
            <span className="ml-auto" title={KEEP_ONE_BOARD}>
              <Button
                variant="ghost"
                size="sm"
                disabled
                onClick={(event) => event.stopPropagation()}
                aria-label={`Remove ${project.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * The floating ghost shown in the DragOverlay while a board is being dragged:
 * the same visual identity as the live card — accent wash, icon tile, title,
 * created line, stats, progress and category dots — with no interactivity.
 */
export function BoardDragPreview({
  project,
  now,
  pinned,
}: {
  project: StrideProject;
  now: Date | null;
  pinned: boolean;
}): JSX.Element {
  const { workspace } = project;
  const stats = useMemo(() => summarizeWorkspace(workspace, now), [workspace, now]);
  const accentTile = stats.dominant ? boardColor(stats.dominant).tile : DEFAULT_TILE_WASH;
  const accentIcon = stats.dominant ? boardColor(stats.dominant).icon : DEFAULT_TILE_ICON;
  // Same wash source as task cards (`CARD_COLOR_WASHES`), so a board tile's
  // tint is literally the class a tagged task card carries.
  const accentWash = stats.dominant ? CARD_COLOR_WASHES[stats.dominant] : NEUTRAL_WASH;
  const fillClass = stats.dominant ? boardColor(stats.dominant).dot : "bg-primary";

  return (
    <div className="relative flex w-full flex-col gap-3.5 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xl ring-1 ring-primary/20">
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 rounded-2xl", accentWash)}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-inset",
              accentTile,
            )}
          >
            <Columns3 className={cn("h-4 w-4", accentIcon)} strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {project.name}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              Created {formatCreated(project.createdAt)}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center">
          <Star className={cn("h-4 w-4 text-amber-500", pinned && "fill-current")} strokeWidth={2.2} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-3 font-medium text-foreground tabular-nums">
          <span className="flex items-center gap-1.5">
            <Circle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.2} />
            {stats.openCount} open
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={2.2} />
            {stats.doneCount} done
          </span>
        </span>
        {stats.total > 0 ? (
          <span className="text-muted-foreground tabular-nums">{stats.pct}%</span>
        ) : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", fillClass)} style={{ width: `${stats.pct}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-3">
          {stats.overdue > 0 ? (
            <span className="flex items-center gap-1 font-medium text-destructive">
              <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.2} />
              {stats.overdue} overdue
            </span>
          ) : null}
          {stats.soon > 0 ? (
            <span className="flex items-center gap-1 font-medium text-info">
              <Clock3 className="h-3.5 w-3.5" strokeWidth={2.2} />
              {stats.soon} due soon
            </span>
          ) : null}
          {stats.overdue === 0 && stats.soon === 0 ? (
            <span className="text-muted-foreground/80">No deadlines coming up</span>
          ) : null}
        </span>
        <CategoryDots boards={workspace.boards} />
      </div>
    </div>
  );
}

/** The board's category swatches — first four, then a "+N" overflow count. */
function CategoryDots({ boards }: { boards: Workspace["boards"] }): JSX.Element {
  if (boards.length === 0) {
    return <span className="text-[11px] text-muted-foreground/70">No categories</span>;
  }
  const dots = boards.slice(0, 4);
  const extra = boards.length - dots.length;
  return (
    <span
      className="flex shrink-0 items-center"
      role="img"
      aria-label={pluralize(boards.length, "category", "categories")}
    >
      {dots.map((board) => (
        <span
          key={board.id}
          title={board.label}
          className={cn(
            "-ml-1 h-2.5 w-2.5 rounded-full ring-2 first:ml-0 ring-card",
            boardColor(board.color).dot,
          )}
        />
      ))}
      {extra > 0 ? (
        <span className="ml-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

/** Guards `format` against an unusable stamp instead of throwing mid-render. */
function formatCreated(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return "—";
  }
}