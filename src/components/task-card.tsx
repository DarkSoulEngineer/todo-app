"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Ban, ChevronDown, ListChecks, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CompleteToggle } from "@/components/complete-toggle";
import { SubtaskList } from "@/components/subtask-list";
import { CategoryPill, DueBadge, PriorityPill, StatusPill } from "@/components/task-badges";
import { TaskTooltip } from "@/components/task-tooltip";
import { useTasksContext } from "@/components/tasks-provider";
import { deriveStatus } from "@/lib/status";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  now: Date;
  onEdit: (task: Task) => void;
  /** Optional drag handle rendered in the actions cluster. */
  handle?: ReactNode;
  dragging?: boolean;
  /** Compact layout for dense surfaces (e.g. board columns). */
  compact?: boolean;
}

const ICON_BUTTON =
  "focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

export function TaskCard({ task, now, onEdit, handle, dragging, compact }: TaskCardProps) {
  const { toggleComplete, toggleCancel, deleteTask, snapshot, restore } = useTasksContext();
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  const status = deriveStatus(task, now);
  const settled = task.completed || task.canceled;
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  const totalSubtasks = task.subtasks.length;

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

  return (
    <div
      className={cn(
        "group relative flex min-w-0 gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3.5 shadow-xs transition-shadow duration-200 hover:shadow-md",
        status === "overdue" && !settled && "border-red-500/30",
        dragging && "shadow-xl ring-2 ring-primary/40",
        task.canceled && "border-dashed",
      )}
    >
      <div className="pt-0.5">
        <CompleteToggle
          completed={task.completed}
          canceled={task.canceled}
          onToggle={handleComplete}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <TaskTooltip task={task} now={now}>
            {(triggerProps) => (
              <button
                type="button"
                onClick={() => onEdit(task)}
                {...triggerProps}
                className="focus-ring -m-1 min-w-0 flex-1 rounded-md p-1 text-left"
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
          </TaskTooltip>

          <div
            className={cn(
              "flex shrink-0 items-center gap-0.5 transition-opacity",
              task.canceled
                ? "opacity-100"
                : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
            )}
          >
            {handle}
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
              onClick={handleCancel}
              aria-label={task.canceled ? `Restore "${task.title}"` : `Cancel "${task.title}"`}
              title={task.canceled ? "Restore task" : "Cancel task"}
              className={ICON_BUTTON}
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
  );
}
