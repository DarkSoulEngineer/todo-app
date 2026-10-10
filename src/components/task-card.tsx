"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, ArrowDown, Ban, Check, Circle, ChevronDown, ListChecks, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CompleteToggle } from "@/components/complete-toggle";
import { SubtaskList } from "@/components/subtask-list";
import { CategoryPill, DueBadge, PriorityPill, StatusPill } from "@/components/task-badges";
import { TaskTooltip } from "@/components/task-tooltip";
import { useTasksContext } from "@/components/tasks-provider";
import { deriveStatus } from "@/lib/status";
import { isCustomSection } from "@/lib/sections";
import type { Task, BoardSection } from "@/lib/types";
import { cn } from "@/lib/utils";

type AssignTaskToSection = (taskId: string, sectionId: string) => void;

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
  /** Double-click handler for inline rename */
  onRename?: (task: Task) => void;
}

const ICON_BUTTON =
  "focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

/**
 * Determines which board section a task currently belongs to.
 * Returns the section ID or undefined if not found.
 */
function getTaskSectionId(task: Task, sections: BoardSection[], now: Date): string | undefined {
  if (task.sectionId) {
    const customSection = sections.find((s) => s.id === task.sectionId);
    if (customSection && isCustomSection(customSection)) return customSection.id;
  }
  const status = deriveStatus(task, now);
  const statusSection = sections.find((s) => s.status === status);
  return statusSection?.id;
}

/**
 * Gets the previous and next section IDs relative to the task's current section,
 * following the board's section order.
 */
function getAdjacentSections(
  task: Task,
  sections: BoardSection[],
  now: Date
): { prev: string | null; next: string | null } {
  const currentSectionId = getTaskSectionId(task, sections, now);
  if (!currentSectionId) return { prev: null, next: null };

  const currentIndex = sections.findIndex((s) => s.id === currentSectionId);
  if (currentIndex === -1) return { prev: null, next: null };

  const prev = currentIndex > 0 ? sections[currentIndex - 1].id : null;
  const next = currentIndex < sections.length - 1 ? sections[currentIndex + 1].id : null;

  return { prev, next };
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
  onRename,
}: TaskCardProps) {
  const { toggleComplete, toggleCancel, deleteTask, snapshot, restore } = useTasksContext();
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(task.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const status = deriveStatus(task, now);
  const settled = task.completed || task.canceled;
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  const totalSubtasks = task.subtasks.length;

  // Section navigation (only in list view, not compact/board)
  const showSectionArrows = !compact && sections && sections.length > 0 && assignTaskToSection;
  const prevSectionId = showSectionArrows ? getAdjacentSections(task, sections!, now).prev : null;
  const nextSectionId = showSectionArrows ? getAdjacentSections(task, sections!, now).next : null;
  const prevSection = prevSectionId ? sections!.find((s) => s.id === prevSectionId) : null;
  const nextSection = nextSectionId ? sections!.find((s) => s.id === nextSectionId) : null;
  const assignFn = showSectionArrows ? assignTaskToSection! : null;

  function handleDelete(): void {
    const before = snapshot();
    deleteTask(task.id);
    toast("Task deleted", {
      description: task.title,
      duration: 6000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
    setMenuOpen(false);
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
    setMenuOpen(false);
  }

  function handleCancel(): void {
    const canceling = !task.canceled;
    toggleCancel(task.id);
    toast(canceling ? "Task canceled" : "Task restored", {
      duration: 3000,
      action: { label: "Undo", onClick: () => toggleCancel(task.id) },
    });
    setMenuOpen(false);
  }

  function handleMoveToSection(sectionId: string, sectionTitle: string): void {
    const before = snapshot();
    assignFn?.(task.id, sectionId);
    toast.success(`Moved to ${sectionTitle}`, {
      duration: 3000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
    setMenuOpen(false);
  }

  function handleRenameCommit() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== task.title) {
      // The actual update will happen through the dialog
      setRenaming(false);
    } else {
      setRenaming(false);
    }
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
    // Small delay to allow click on save button
    setTimeout(handleRenameCommit, 0);
  }

  function handleTitleClick(e: React.MouseEvent) {
    if (e.detail === 2 && onRename && !compact) {
      e.preventDefault();
      setRenameValue(task.title);
      setRenaming(true);
      // Focus the input on next tick
      setTimeout(() => renameInputRef.current?.focus(), 0);
    }
  }

  function handleSelectionClick(e: React.MouseEvent) {
    if (onSelect) {
      onSelect(task, e.shiftKey);
    }
  }

  // Optimistic feedback for complete/cancel - pulse animation
  const [pulse, setPulse] = useState<"complete" | "cancel" | null>(null);

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

  const cardClassName = cn(
    "group relative flex min-w-0 gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3.5 shadow-xs transition-shadow duration-200 hover:shadow-md",
    status === "overdue" && !settled && "border-red-500/30",
    dragging && "shadow-xl ring-2 ring-primary/40",
    task.canceled && "border-dashed",
    selected && "ring-2 ring-primary ring-offset-2 ring-offset-card",
    highlighted && "ring-2 ring-primary ring-offset-2 ring-offset-card bg-primary/5",
    pulse === "complete" && "animate-pulse ring-2 ring-emerald-500/50",
    pulse === "cancel" && "animate-pulse ring-2 ring-slate-500/50",
    !compact && "cursor-pointer",
  );

  // Build the list of actions for the overflow menu (below sm)
  const hasArrows = showSectionArrows && (prevSectionId || nextSectionId);
  const showOverflowMenu = !compact && (hasArrows || true); // always show menu for edit/cancel/delete

  return (
    <motion.li
      layout
      className="list-none"
      tabIndex={highlighted ? 0 : -1}
      onClick={handleSelectionClick}
      onDoubleClick={handleTitleClick}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onSelect?.(task, e.shiftKey);
        }
      }}
    >
      <div className={cardClassName}>
        <div className="pt-0.5">
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
              <TaskTooltip task={task} now={now}>
                {(triggerProps) => (
                  <div
                    {...triggerProps}
                    className="min-w-0"
                    onClick={(e) => {
                      // Don't trigger onEdit if we're selecting or renaming
                      if (!onSelect && !onRename) return;
                      e.stopPropagation();
                    }}
                  >
                    {renaming ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={handleRenameBlur}
                        onClick={(e) => e.stopPropagation()}
                        className="focus-ring min-w-0 w-full rounded-md border border-input bg-card px-2 py-1 text-sm font-semibold text-foreground"
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEdit(task)}
                        className="focus-ring -m-1 min-w-0 w-full rounded-md p-1 text-left"
                      >
                        <h3
                          className={cn(
                            "text-[0.95rem] leading-snug font-semibold",
                            compact ? "truncate" : "break-words",
                            settled ? "text-muted-foreground line-through" : "text-foreground",
                          )}
                        >
                          {task.title}
                        </h3>
                      </button>
                    )}
                  </div>
                )}
              </TaskTooltip>
            </div>

            {/* Actions column - never shrinks, always on the right */}
            <div
              className={cn(
                "flex shrink-0 items-start gap-0.5 transition-opacity",
                task.canceled
                  ? "opacity-100"
                  : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
              )}
            >
              {/* Selection checkbox - appears on hover/focus or when selected */}
              {!compact && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(task, e.shiftKey);
                  }}
                  aria-label={selected ? `Deselect "${task.title}"` : `Select "${task.title}"`}
                  aria-pressed={selected}
                  className={cn(
                    "focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    selected && "text-primary",
                  )}
                >
                  {selected ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                </button>
              )}

              {/* Drag handle - hidden below sm and on pointer-coarse */}
              {handle && !compact && (
                <div className="hidden sm:block">
                  {handle}
                </div>
              )}

              {/* Section navigation arrows - only in list view, hidden below sm */}
              {!compact && showSectionArrows && prevSectionId && (
                <button
                  type="button"
                  className="hidden sm:grid"
                  onClick={() => handleMoveToSection(prevSectionId, prevSection!.title)}
                  aria-label={`Move "${task.title}" to ${prevSection!.title}`}
                  title={`Move to ${prevSection!.title}`}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
              {!compact && showSectionArrows && nextSectionId && (
                <button
                  type="button"
                  className="hidden sm:grid"
                  onClick={() => handleMoveToSection(nextSectionId, nextSection!.title)}
                  aria-label={`Move "${task.title}" to ${nextSection!.title}`}
                  title={`Move to ${nextSection!.title}`}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              )}

              {/* Primary actions - visible on sm+, collapsed into menu below sm */}
              <div className="hidden sm:flex sm:flex-col sm:gap-0.5">
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  aria-label={`Edit "${task.title}"`}
                  className={ICON_BUTTON}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelWithPulse}
                  aria-label={task.canceled ? `Restore "${task.title}"` : `Cancel "${task.title}"`}
                  title={task.canceled ? "Restore task" : "Cancel task"}
                  className={cn(ICON_BUTTON, pulse === "cancel" && "animate-pulse")}
                >
                  {task.canceled ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  aria-label={`Delete "${task.title}"`}
                  className={cn(ICON_BUTTON, "hover:text-destructive")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Overflow menu button - visible below sm */}
              {!compact && showOverflowMenu && (
                <div className="relative sm:hidden">
                  <button
                    ref={menuButtonRef}
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="More actions"
                    className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {menuOpen && typeof document !== "undefined" ? (
                    <>
                      {/* Backdrop for closing */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpen(false)}
                        aria-hidden="true"
                      />
                      <div
                        ref={menuRef}
                        role="menu"
                        aria-label={`Actions for "${task.title}"`}
                        className="fixed z-50 right-0 mt-1 min-w-[160px] rounded-xl border border-border bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
                      >
                        {/* Section navigation in menu */}
                        {showSectionArrows && prevSectionId && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleMoveToSection(prevSectionId, prevSection!.title)}
                            className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted"
                          >
                            <ArrowUp className="h-4 w-4" />
                            Move to {prevSection!.title}
                          </button>
                        )}
                        {showSectionArrows && nextSectionId && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleMoveToSection(nextSectionId, nextSection!.title)}
                            className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted"
                          >
                            <ArrowDown className="h-4 w-4" />
                            Move to {nextSection!.title}
                          </button>
                        )}
                        {(showSectionArrows && (prevSectionId || nextSectionId)) && (
                          <div className="my-1 h-px bg-border" />
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { onEdit(task); setMenuOpen(false); }}
                          className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { handleCancelWithPulse(); setMenuOpen(false); }}
                          className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted"
                        >
                          {task.canceled ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          {task.canceled ? "Restore" : "Cancel"}
                        </button>
                        <div className="my-1 h-px bg-border" />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { handleDelete(); }}
                          className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {task.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
          ) : null}

          <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 overflow-hidden">
            <DueBadge task={task} now={now} />
            <PriorityPill priority={task.priority} />
            {task.category ? <CategoryPill categoryId={task.category} /> : null}
            {totalSubtasks > 0 ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                className="focus-ring inline-flex items-center gap-1 rounded-full text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ListChecks className="h-3.5 w-3.5" />
                <span className="tabular-nums">
                  {doneSubtasks}/{totalSubtasks}
                </span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
              </button>
            ) : null}
            {settled ? <StatusPill task={task} now={now} /> : null}
          </div>

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
    </motion.li>
  );
}