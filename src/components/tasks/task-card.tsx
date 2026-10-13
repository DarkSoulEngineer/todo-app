"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Ban,
  ChevronDown,
  ListChecks,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useRef, useState, Fragment, type ReactNode, type RefObject } from "react";
import { toast } from "sonner";
import { CompleteToggle } from "@/components/tasks/complete-toggle";
import { SubtaskList } from "@/components/tasks/subtask-list";
import { CategoryPill, DueBadge, PriorityPill, StatusPill } from "@/components/tasks/task-badges";
import { TaskTooltip } from "@/components/tasks/task-tooltip";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { CARD_COLOR_WASHES, detectCardTheme, PRIORITY_WASHES } from "@/lib/features/card-themes";
import { deriveStatus } from "@/lib/domain/status";
import { getAdjacentSections, getTaskSectionId } from "@/lib/domain/sections";
import type { Task, BoardSection, TaskStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

type AssignTaskToSection = (taskId: string, sectionId: string) => void;

/** Optimistic pulse on the card right after complete/cancel is fired. */
type Pulse = "complete" | "cancel" | null;

interface TaskCardProps {
  task: Task;
  now: Date;
  onEdit: (task: Task) => void;
  /** Optional drag handle rendered in the actions cluster. */
  handle?: ReactNode;
  dragging?: boolean;
  /** Compact layout for dense surfaces (e.g. board columns). */
  compact?: boolean;
  /** Board sections for section navigation arrows. */
  sections?: BoardSection[];
  /** Function to move task to a section. */
  assignTaskToSection?: AssignTaskToSection;
  /** Selection state */
  selected?: boolean;
  /** Highlighted for keyboard navigation */
  highlighted?: boolean;
  /** Click handler for selection */
  onSelect?: (task: Task, shiftKey: boolean) => void;
  /** Called after the card is moved to another section via the arrows. */
  onMovedToSection?: (sectionId: string) => void;
  /** Zero-based position of the card inside its board column. */
  reorderIndex?: number;
  /** How many cards the card's board column holds. */
  reorderTotal?: number;
  /** Moves the card up or down inside its column (board cards only). */
  onReorder?: (taskId: string, direction: "up" | "down") => void;
}

/** The two in-column reorder steps, up before down. */
const REORDER_DIRECTIONS = ["up", "down"] as const;

const ICON_BUTTON =
  "focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

/** Ghost button for the board arrows — present on every card, so it stays quiet. */
const COMPACT_ARROW =
  "focus-ring grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground/80 transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-90";

const MENU_ITEM =
  "focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted";

/** Marks the title block, where a double-click still means "rename". */
const TITLE_SELECTOR = "[data-card-title]";

/** Interactive descendants that own their own double-click behaviour. */
const INTERACTIVE_TARGET = "button, input, textarea, a, select, [role='menu']";

/**
 * Leading accent rail so overdue / completed / canceled read at a glance.
 *
 * CANONICAL RAIL: every rail — status here, theme rails in `card-themes.ts` —
 * uses the same alpha ladder `from-{hue}-500/70 via-{hue}-500/45 to-{hue}-500/10`.
 * Canceled sits on slate-500 so the whole system shares the 500 hue scale.
 */
function statusRail(task: Task, status: TaskStatus): string | null {
  if (task.canceled) return "from-slate-500/70 via-slate-500/45 to-slate-500/10";
  if (task.completed) return "from-emerald-500/70 via-emerald-500/45 to-emerald-500/10";
  if (status === "overdue") return "from-red-500/70 via-red-500/45 to-red-500/10";
  return null;
}

/** A neighbouring column a card can be moved to through the arrows. */
interface MoveTarget {
  id: string;
  title: string;
  direction: "prev" | "next";
}

interface TaskTitleProps {
  task: Task;
  now: Date;
  compact?: boolean;
  settled: boolean;
  renaming: boolean;
  renameValue: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  /** True when selection or rename is wired, so title presses must not select. */
  hasSelectOrRename: boolean;
  onRenameValueChange: (value: string) => void;
  onRenameKeyDown: (event: React.KeyboardEvent) => void;
  onRenameBlur: () => void;
  onOpenEdit: () => void;
}

function TaskTitle({
  task,
  now,
  compact,
  settled,
  renaming,
  renameValue,
  renameInputRef,
  hasSelectOrRename,
  onRenameValueChange,
  onRenameKeyDown,
  onRenameBlur,
  onOpenEdit,
}: TaskTitleProps) {
  return (
    <TaskTooltip task={task} now={now}>
      {(triggerProps) => (
        <div
          {...triggerProps}
          data-card-title
          className="min-w-0"
          onClick={(e) => {
            if (!hasSelectOrRename) return;
            e.stopPropagation();
          }}
        >
          {renaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              onKeyDown={onRenameKeyDown}
              onBlur={onRenameBlur}
              onClick={(e) => e.stopPropagation()}
              className="focus-ring min-w-0 w-full rounded-md border border-input bg-card px-2 py-1 text-sm font-semibold tracking-tight text-foreground"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                onOpenEdit();
              }}
              className="focus-ring -m-1 min-w-0 w-full cursor-pointer rounded-md p-1 text-left"
            >
              <h3
                className={cn(
                  "font-semibold tracking-tight leading-snug",
                  compact ? "truncate text-sm" : "break-words text-[0.95rem]",
                  settled ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground",
                )}
              >
                {task.title}
              </h3>
            </button>
          )}
        </div>
      )}
    </TaskTooltip>
  );
}

interface TaskMetaProps {
  task: Task;
  now: Date;
  compact?: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
}

/** Meta row: due, priority, category, subtask progress and settled status. */
function TaskMeta({ task, now, compact, expanded, onToggleExpanded }: TaskMetaProps) {
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  const totalSubtasks = task.subtasks.length;
  const allSubtasksDone = totalSubtasks > 0 && doneSubtasks === totalSubtasks;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5",
        compact ? "mt-2.5" : "mt-3",
      )}
    >
      <DueBadge task={task} now={now} />
      <PriorityPill priority={task.priority} />
      {task.category ? <CategoryPill categoryId={task.category} /> : null}
      {totalSubtasks > 0 ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          className={cn(
            "focus-ring inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset transition-colors",
            allSubtasksDone
              ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300"
              : "text-muted-foreground ring-border hover:bg-muted hover:text-foreground",
          )}
        >
          <ListChecks className="h-3.5 w-3.5" />
          <span className="tabular-nums">
            {doneSubtasks}/{totalSubtasks}
          </span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
        </button>
      ) : null}
      {task.completed || task.canceled ? <StatusPill task={task} now={now} /> : null}
    </div>
  );
}

interface CardActionsProps {
  task: Task;
  compact?: boolean;
  pulse: Pulse;
  handle?: ReactNode;
  prevSection: BoardSection | null;
  nextSection: BoardSection | null;
  sections: BoardSection[];
  currentSectionId: string | undefined;
  onMove: (sectionId: string, sectionTitle: string) => void;
  onEdit: (task: Task) => void;
  onCancelTask: () => void;
  onDeleteTask: () => void;
  /** Zero-based position of the card inside its board column. */
  reorderIndex?: number;
  /** How many cards the card's board column holds. */
  reorderTotal?: number;
  /** Moves the card up or down inside its column (compact/board cards only). */
  onReorder?: (taskId: string, direction: "up" | "down") => void;
}

/** One primary action, rendered as an icon on sm+ and a labelled row in the menu. */
interface CardAction {
  key: string;
  label: string;
  ariaLabel: string;
  title?: string;
  icon: LucideIcon;
  tone?: string;
  onClick: () => void;
}

interface SelectionIndicatorProps {
  task: Task;
  selected: boolean;
  onSelect?: (task: Task, shiftKey: boolean) => void;
}

/**
 * Subtle selection indicator — a thin left-edge bar that fills when selected.
 * Clicking it toggles selection. Much quieter than a checkbox button.
 * The card's ring/tint is the primary selection state; this is just an affordance.
 */
function SelectionIndicator({ task, selected, onSelect }: SelectionIndicatorProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(task, e.shiftKey);
      }}
      aria-label={selected ? `Deselect "${task.title}"` : `Select "${task.title}"`}
      aria-pressed={selected}
      className={cn(
        "focus-ring absolute inset-y-0 left-0 w-1.5 rounded-l-xl transition-all duration-200",
        selected
          ? "bg-primary scale-y-100"
          : "bg-transparent hover:bg-primary/20 scale-y-50",
      )}
      style={{ transformOrigin: "bottom" }}
    >
      <span className="sr-only">{selected ? "Selected" : "Not selected"}</span>
    </button>
  );
}

/**
 * The actions cluster. Order is deliberate and stable:
 * Select → Handle → Reorder↑↓ → Section←→ → Primary (in overflow) → Menu
 *
 * On list (non-compact): Select always visible. Handle on sm+. Reorder arrows always.
 * Section arrows in overflow menu. Primary actions (edit/cancel/delete) in overflow menu.
 * On board (compact): Select hidden. Handle hidden. Reorder arrows hidden (drag handles reorder).
 * Section arrows always visible. Primary actions in overflow menu.
 */
function CardActions({
  task,
  compact,
  pulse,
  handle,
  prevSection,
  nextSection,
  sections,
  currentSectionId,
  onMove,
  onEdit,
  onCancelTask,
  onDeleteTask,
  reorderIndex,
  reorderTotal,
  onReorder,
}: CardActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  function closeMenu(): void {
    setMenuOpen(false);
  }

  function handleArrowPointerDown(e: React.PointerEvent<HTMLButtonElement>): void {
    if (compact) e.stopPropagation();
  }

  const reorderEnabled = Boolean(onReorder);
  const canMoveUp = reorderEnabled && reorderIndex !== 0;
  const canMoveDown =
    reorderEnabled && reorderTotal !== undefined && reorderIndex !== undefined
      ? reorderIndex < reorderTotal - 1
      : false;

  const moveTargets: MoveTarget[] = [];
  if (prevSection) {
    moveTargets.push({ id: prevSection.id, title: prevSection.title, direction: "prev" });
  }
  if (nextSection) {
    moveTargets.push({ id: nextSection.id, title: nextSection.title, direction: "next" });
  }

  const primaryActions: CardAction[] = [
    {
      key: "edit",
      label: "Edit",
      ariaLabel: `Edit "${task.title}"`,
      icon: Pencil,
      onClick: () => {
        onEdit(task);
        closeMenu();
      },
    },
    {
      key: "cancel",
      label: task.canceled ? "Restore" : "Cancel",
      ariaLabel: task.canceled ? `Restore "${task.title}"` : `Cancel "${task.title}"`,
      title: task.canceled ? "Restore task" : "Cancel task",
      icon: task.canceled ? RotateCcw : Ban,
      tone: pulse === "cancel" ? "animate-pulse" : undefined,
      onClick: () => {
        onCancelTask();
        closeMenu();
      },
    },
    {
      key: "delete",
      label: "Delete",
      ariaLabel: `Delete "${task.title}"`,
      icon: Trash2,
      tone: "hover:text-destructive",
      onClick: () => {
        onDeleteTask();
        closeMenu();
      },
    },
  ];

  // On list view (non-compact): reveal section arrows on hover/focus
  // On board (compact): section arrows always visible
  const revealOnHover = !compact && !task.canceled;

  return (
    <div className="flex shrink-0 items-start gap-1">
      <div
        className={cn(
          "flex shrink-0 items-start gap-1",
          !compact && "transition-[opacity,transform] duration-200",
          revealOnHover &&
            "sm:translate-x-1 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100 sm:group-focus-within:translate-x-0 sm:group-focus-within:opacity-100",
        )}
      >
        {/* 2. Drag handle — hidden below sm and on pointer-coarse */}
        {handle && !compact && (
          <div className="hidden sm:block">{handle}</div>
        )}

        {/* 3. Section move — dropdown to move card to any section (list only, compact uses arrows) */}
        {!compact && sections && sections.length > 0 && (
          <select
            className="focus-ring h-6 w-auto min-w-[80px] max-w-[140px] text-xs rounded-md border border-input/50 bg-card px-2 py-0.5 pr-7 text-foreground appearance-none cursor-pointer transition-[border-color,background-color] duration-150 hover:border-primary/50 hover:bg-muted/30"
            aria-label={`Move "${task.title}" to section`}
            value={currentSectionId ?? ""}
            onChange={(e) => {
              e.stopPropagation();
              const targetId = e.target.value;
              const targetSection = sections.find((s) => s.id === targetId);
              if (targetSection) onMove(targetId, targetSection.title);
            }}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 6px center",
              backgroundSize: "12px 12px",
            }}
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id} className="py-1.5 px-2">
                {section.title}
              </option>
            ))}
          </select>
        )}

        {/* 4. In-column reorder arrows (up/down) — on list and board when enabled */}
        {reorderEnabled &&
          REORDER_DIRECTIONS.map((direction) => {
            const isUp = direction === "up";
            const enabled = isUp ? canMoveUp : canMoveDown;
            const label = isUp
              ? `Move “${task.title}” up`
              : `Move “${task.title}” down`;
            return (
              <button
                key={direction}
                type="button"
                disabled={!enabled}
                className={cn(
                  compact ? COMPACT_ARROW : ICON_BUTTON,
                  "disabled:pointer-events-none disabled:opacity-40"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onReorder?.(task.id, direction);
                }}
                aria-label={label}
                title={label}
              >
                {isUp ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              </button>
            );
          })}

        {/* 5. Section navigation arrows (left/right) — always visible on both list and board */}
        {compact && moveTargets.map((target) => {
          const Icon = target.direction === "prev" ? ArrowLeft : ArrowRight;
          return (
            <button
              key={target.direction}
              type="button"
              className={COMPACT_ARROW}
              onPointerDown={handleArrowPointerDown}
              onClick={(e) => {
                e.stopPropagation();
                onMove(target.id, target.title);
              }}
              aria-label={`Move "${task.title}" to ${target.title}`}
              title={`Move to ${target.title}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}

        {/* 5. Edit button — visible in action column on list (non-compact), in menu on board (compact) */}
        {!compact && (
          <button
            type="button"
            onClick={() => {
              onEdit(task);
              closeMenu();
            }}
            aria-label={`Edit "${task.title}"`}
            title="Edit"
            className={cn(ICON_BUTTON, "hidden sm:grid")}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}

        {/* 6. Primary actions (Cancel, Delete) — in overflow menu */}
        {/* 7. Overflow menu button */}
        <div className="relative">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="More actions"
            className={cn(ICON_BUTTON, menuOpen && "bg-muted text-foreground")}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && typeof document !== "undefined" ? (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={closeMenu}
                aria-hidden="true"
              />
              <div
                role="menu"
                aria-label={`Actions for "${task.title}"`}
                className="fixed right-0 z-50 mt-1.5 min-w-[11rem] origin-top-right rounded-xl border border-border bg-popover/95 p-1 shadow-2xl ring-1 ring-black/5 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-150 dark:ring-white/10"
              >
                {/* Primary actions in menu (on list, Edit is already in column, so skip it) */}
                {primaryActions
                  .filter((action) => compact || action.key !== "edit")
                  .map((action) => (
                    <Fragment key={action.key}>
                      {action.key === "delete" && <div className="my-1 h-px bg-border" />}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={action.onClick}
                        className={cn(
                          MENU_ITEM,
                          action.key === "delete" && "text-destructive hover:bg-destructive/10",
                        )}
                      >
                        <action.icon className="h-4 w-4" />
                        {action.label}
                      </button>
                    </Fragment>
                  ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TaskCard({
  task,
  now,
  onEdit,
  handle,
  dragging,
  compact,
  sections,
  assignTaskToSection,
  selected = false,
  highlighted = false,
  onSelect,
  onMovedToSection,
  reorderIndex,
  reorderTotal,
  onReorder,
}: TaskCardProps) {
  const { toggleComplete, toggleCancel, deleteTask, snapshot, restore, boards, patchTask } =
    useTasksContext();
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(task.title);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  // Optimistic feedback for complete/cancel - pulse animation
  const [pulse, setPulse] = useState<Pulse>(null);

  function handleDelete(): void {
    const before = snapshot();
    deleteTask(task.id);
    toast("Task deleted", {
      description: task.title,
      duration: 6000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
  }

  function handleComplete(): void {
    const completing = !task.completed;
    toggleComplete(task.id);
    if (completing) {
      toast.success("Nice work — task completed", {
        duration: 2500,
        action: { label: "Undo", onClick: () => toggleComplete(task.id) },
      });
    }
  }

  function handleCancel(): void {
    const canceling = !task.canceled;
    toggleCancel(task.id);
    toast(canceling ? "Task canceled" : "Task restored", {
      duration: 3000,
      action: { label: "Undo", onClick: () => toggleCancel(task.id) },
    });
  }

  function handleMoveToSection(sectionId: string, sectionTitle: string): void {
    const before = snapshot();
    assignFn?.(task.id, sectionId);
    toast.success(`Moved to ${sectionTitle}`, {
      duration: 3000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
    if (assignFn) onMovedToSection?.(sectionId);
  }

  function handleRenameCommit() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== task.title) {
      patchTask(task.id, { title: trimmed });
    } else {
      setRenameValue(task.title);
    }
    setRenaming(false);
  }

  function handleRenameCancel() {
    setRenameValue(task.title);
    setRenaming(false);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleRenameCancel();
    }
  }

  function handleRenameBlur() {
    setTimeout(handleRenameCommit, 0);
  }

  /**
   * A plain click must never select — it was far too easy to trigger by
   * accident. Selection needs a deliberate gesture: ctrl/cmd+click (shift
   * extends a range), a double-click, the row's checkbox, or the keyboard.
   */
  function handleSelectionClick(e: React.MouseEvent) {
    if (!onSelect) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) onSelect(task, e.shiftKey);
  }

  /**
   * Double-click keeps two meanings, split by target: on the task title it
   * renames (the long-standing gesture), anywhere else on the card it selects.
   */
  function handleCardDoubleClick(e: React.MouseEvent) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest(TITLE_SELECTOR) !== null) {
      // Inline rename is a self-contained, non-compact list feature: the card
      // commits it itself through `patchTask`. The select handler is the
      // signal that this card lives on the selectable list surface.
      if (onSelect && !compact) {
        e.preventDefault();
        setRenameValue(task.title);
        setRenaming(true);
        setTimeout(() => renameInputRef.current?.focus(), 0);
      }
      return;
    }
    if (target.closest(INTERACTIVE_TARGET) !== null) return;
    onSelect?.(task, false);
  }

  function handleCompleteWithPulse() {
    setPulse("complete");
    handleComplete();
    setTimeout(() => setPulse(null), 300);
  }

  function handleCancelWithPulse() {
    setPulse("cancel");
    handleCancel();
    setTimeout(() => setPulse(null), 300);
  }

  const status = deriveStatus(task, now);
  const settled = task.completed || task.canceled;
  const totalSubtasks = task.subtasks.length;

  // Keyword theme (additive, secondary to status). Memoized so the cheap scan
  // only reruns when the text it reads actually changes.
  const theme = useMemo(
    () => detectCardTheme(task.title, task.description),
    [task.title, task.description],
  );

  // The board behind task.category, when that board still exists.
  const board = boards?.find((entry) => entry.id === task.category) ?? null;

  // Wash precedence — a card is tinted ONLY by its board category:
  //   board category → that board's wash
  //   no category    → no tint at all; an uncategorized card stays neutral
  //                    (no board, keyword-theme or default blue wash)
  //   canceled       → neutral ambient wash (set aside never reads as happy)
  const wash = !task.canceled && board ? CARD_COLOR_WASHES[board.color] : null;

  // Precedence: a status rail (overdue/completed/canceled) always wins. The
  // keyword-theme rail is secondary AND category-gated — it only decorates a
  // categorized card, so an uncategorized card is never colorized.
  const rail = statusRail(task, status) ?? (board ? theme?.accent : null) ?? null;

  // Priority cue: a calm bottom-right corner glow in the priority hue. It is
  // additive and independent of category and status colour, so it shows on
  // EVERY card — categorized or not. Canceled cards are the one exception: they
  // read as set aside, so the warm priority glow is muted rather than inviting
  // attention back to a discarded task (completed cards keep it — the alphas
  // are quiet enough to sit beside the emerald completion cue).
  const priorityWash = task.canceled ? null : PRIORITY_WASHES[task.priority];

  // Section navigation (list and board surfaces; needs sections + assignment).
  const navigableSections = useMemo(
    () => (sections ? sections.filter((section) => !section.hidden) : sections),
    [sections],
  );
  const showSectionArrows = Boolean(
    navigableSections && navigableSections.length > 0 && assignTaskToSection,
  );
  const adjacent = showSectionArrows
    ? getAdjacentSections(task, navigableSections!, now)
    : { prev: null, next: null };
  // Use all sections (not just navigable) to determine current section,
  // so the dropdown correctly reflects the task's section even if hidden.
  const currentSectionId = getTaskSectionId(task, sections!, now);
  const prevSection = adjacent.prev ? (navigableSections!.find((s) => s.id === adjacent.prev) ?? null) : null;
  const nextSection = adjacent.next ? (navigableSections!.find((s) => s.id === adjacent.next) ?? null) : null;
  const assignFn = showSectionArrows ? assignTaskToSection! : null;

  const cardClassName = cn(
    "group relative flex min-w-0 overflow-hidden rounded-2xl border bg-card shadow-xs transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out",
    compact
      ? "gap-3 p-3 hover:border-primary/25 hover:shadow-md"
      : "gap-3.5 p-4 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg",
    // Theme border is secondary: it only tints plain (upcoming) cards, and sits
    // before the status / selection / drag states so those still win in cn().
    board && theme && !settled && status !== "overdue" && theme.border,
    status === "overdue" && !settled && "border-red-500/35 hover:border-red-500/50",
    task.completed && "border-emerald-500/35 hover:border-emerald-500/50",
    dragging && "scale-[1.02] border-primary/40 shadow-2xl ring-2 ring-primary/45",
    task.canceled && "border-dashed border-slate-500/35 bg-muted/40 hover:border-slate-500/50",
    selected && "border-primary/40 bg-primary/[0.04] shadow-md ring-2 ring-primary ring-offset-2 ring-offset-card",
    highlighted && "border-primary/40 bg-primary/[0.05]",
    pulse === "complete" && "animate-pulse ring-2 ring-emerald-500/50",
    pulse === "cancel" && "animate-pulse ring-2 ring-slate-500/50",
  );

  return (
    <motion.div
      layout={!compact}
      className="focus-ring list-none rounded-2xl"
      tabIndex={highlighted ? 0 : -1}
      onClick={handleSelectionClick}
      onDoubleClick={handleCardDoubleClick}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onSelect?.(task, e.shiftKey);
        }
      }}
    >
      {/* Subtle selection indicator on left edge — fills when selected, click to toggle */}
      {!compact && (
        <SelectionIndicator task={task} selected={selected} onSelect={onSelect} />
      )}
      <div className={cardClassName}>
        {/* Ambient depth: a soft wash layer under the content, sourced only from
            the card's board category. An uncategorized card gets no tint at all;
            only canceled cards keep the neutral ambient wash. */}
        {wash ? (
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute inset-0 rounded-2xl", wash)}
          />
        ) : task.canceled ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(115%_95%_at_0%_0%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_62%)]"
          />
        ) : null}
        {/* Priority cue: a soft bottom-right corner glow (see PRIORITY_WASHES).
            Sits above the category wash and below the rail so the left status
            signal still paints on top. */}
        {priorityWash ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 rounded-2xl",
              priorityWash,
            )}
          />
        ) : null}
        {rail ? (
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b", rail)}
          />
        ) : null}

        <div className={cn("shrink-0", compact ? "pt-0" : "pt-0.5")}>
          <CompleteToggle
            completed={task.completed}
            canceled={task.canceled}
            onToggle={handleCompleteWithPulse}
            className={cn(pulse === "complete" && "animate-pulse")}
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* Title row: title takes all space, actions are a separate non-shrinking sibling */}
          <div className="flex items-start gap-2">
            {/* Title column - gets all remaining space, never shares with actions */}
            <div className="min-w-0 flex-1">
              <TaskTitle
                task={task}
                now={now}
                compact={compact}
                settled={settled}
                renaming={renaming}
                renameValue={renameValue}
                renameInputRef={renameInputRef}
                hasSelectOrRename={Boolean(onSelect)}
                onRenameValueChange={setRenameValue}
                onRenameKeyDown={handleRenameKeyDown}
                onRenameBlur={handleRenameBlur}
                onOpenEdit={() => onEdit(task)}
              />
            </div>

            {/* Actions column - never shrinks, always on the right */}
            <CardActions
              task={task}
              compact={compact}
              pulse={pulse}
              handle={handle}
              prevSection={prevSection}
              nextSection={nextSection}
              sections={sections ?? []}
              currentSectionId={currentSectionId}
              onMove={handleMoveToSection}
              onEdit={onEdit}
              onCancelTask={handleCancelWithPulse}
              onDeleteTask={handleDelete}
              reorderIndex={reorderIndex}
              reorderTotal={reorderTotal}
              onReorder={onReorder}
            />
          </div>

          {task.description ? (
            <p
              className={cn(
                "mt-1.5 line-clamp-2 leading-relaxed text-muted-foreground",
                compact ? "text-[0.8125rem]" : "text-sm",
              )}
            >
              {task.description}
            </p>
          ) : null}

          <TaskMeta
            task={task}
            now={now}
            compact={compact}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((value) => !value)}
          />

          <AnimatePresence initial={false}>
            {expanded && totalSubtasks > 0 ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
                className="overflow-hidden"
              >
                <SubtaskList task={task} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

