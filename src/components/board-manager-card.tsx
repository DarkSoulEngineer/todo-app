"use client";

import { useSortable } from "@dnd-kit/sortable";
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
import type { StrideProject } from "@/lib/projects";
import type { Workspace } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** A deadline inside the next seven days counts as "due soon". */
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

/** Reason surfaced on the disabled Remove control of the last board. */
const KEEP_ONE_BOARD = "At least one board must remain";

// Static accent maps keyed by palette id. Literals only, so Tailwind v4 keeps
// every class it scans here — never build these strings dynamically.
const TILE_WASH: Record<BoardColorId, string> = {
  cyan: "from-cyan-500/25 to-cyan-500/5",
  pink: "from-pink-500/25 to-pink-500/5",
  orange: "from-orange-500/25 to-orange-500/5",
  teal: "from-teal-500/25 to-teal-500/5",
  lime: "from-lime-500/25 to-lime-500/5",
  indigo: "from-indigo-500/25 to-indigo-500/5",
  violet: "from-violet-500/25 to-violet-500/5",
  amber: "from-amber-500/25 to-amber-500/5",
};

const TILE_ICON: Record<BoardColorId, string> = {
  cyan: "text-cyan-700 dark:text-cyan-300",
  pink: "text-pink-700 dark:text-pink-300",
  orange: "text-orange-700 dark:text-orange-300",
  teal: "text-teal-700 dark:text-teal-300",
  lime: "text-lime-700 dark:text-lime-300",
  indigo: "text-indigo-700 dark:text-indigo-300",
  violet: "text-violet-700 dark:text-violet-300",
  amber: "text-amber-700 dark:text-amber-300",
};

const CARD_WASH: Record<BoardColorId, string> = {
  cyan: "from-cyan-500/10",
  pink: "from-pink-500/10",
  orange: "from-orange-500/10",
  teal: "from-teal-500/10",
  lime: "from-lime-500/10",
  indigo: "from-indigo-500/10",
  violet: "from-violet-500/10",
  amber: "from-amber-500/10",
};

/** Violet-neutral fallbacks used when a board has no dominant category colour. */
const DEFAULT_TILE_WASH = "from-primary/20 to-primary/5";
const DEFAULT_TILE_ICON = "text-primary";
const DEFAULT_CARD_WASH = "from-primary/10";

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
 * opens the board and hands off to /tasks; in edit mode a grip drags it to a
 * new grid slot and the surface never loads. Inner controls stop propagation
 * and carry `data-no-load` as a second guard.
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

  // Sortable only while arranging, inert otherwise — the same hook (and
  // grip-activator pattern) the board view uses for its cards.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: project.id,
      disabled: !editMode,
      data: { type: "board" },
    });

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
  const accentTile = stats.dominant ? TILE_WASH[stats.dominant] : DEFAULT_TILE_WASH;
  const accentIcon = stats.dominant ? TILE_ICON[stats.dominant] : DEFAULT_TILE_ICON;
  const accentWash = stats.dominant ? CARD_WASH[stats.dominant] : DEFAULT_CARD_WASH;
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
      tabIndex={focused ? 0 : -1}
      data-card="true"
      data-board-id={project.id}
      aria-label={editMode ? `Arrange ${project.name}` : `Open ${project.name}`}
      title={editMode ? undefined : `Open ${project.name}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
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
        "group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg",
        isDragging && "z-10 scale-[1.02] border-primary/40 shadow-2xl ring-2 ring-primary/45",
      )}
    >
      {/* Faint accent wash echoing the board's dominant category hue. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          accentWash,
        )}
      />

      <div className="relative flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-inset ring-black/5 dark:ring-white/10",
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
              <button
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                type="button"
                data-no-load
                aria-label={`Drag to rearrange ${project.name}`}
                title="Drag to rearrange"
                className="focus-ring grid h-8 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" strokeWidth={2.2} />
              </button>
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