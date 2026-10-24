"use client";

import { useDraggable } from "@dnd-kit/core";
import { PRIORITY_META } from "@/lib/domain/constants";
import { deriveStatus } from "@/lib/domain/status";
import { TaskTooltip } from "@/components/tasks/task-tooltip";
import type { Task } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

interface CalendarTaskChipProps {
  task: Task;
  now: Date;
  onEdit: (task: Task) => void;
}

/** Compact, draggable task chip shown inside a calendar day cell. */
export function CalendarTaskChip({ task, now, onEdit }: CalendarTaskChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: "calendar-chip" },
  });

  const status = deriveStatus(task, now);
  const completed = status === "completed";
  const canceled = status === "canceled";
  const settled = completed || canceled;

  const tone = settled
    ? completed
      ? "bg-success/12 text-success ring-success/25"
      : "bg-muted text-muted-foreground ring-border"
    : status === "overdue"
      ? "bg-destructive/12 text-destructive ring-destructive/25"
      : "bg-card text-foreground ring-border hover:bg-muted";

  const dot = settled
    ? completed
      ? "bg-success"
      : "bg-muted-foreground"
    : status === "overdue"
      ? "bg-destructive"
      : PRIORITY_META[task.priority].dot;

  return (
    <TaskTooltip task={task} now={now}>
      {(triggerProps) => (
        <button
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          {...triggerProps}
          onClick={() => onEdit(task)}
          className={cn(
            "focus-ring flex w-full min-w-0 touch-none items-center gap-1 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium ring-1 ring-inset transition-colors",
            tone,
            isDragging && "opacity-40",
          )}
        >
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
          <span className={cn("min-w-0 flex-1 truncate", settled && "line-through")}>
            {task.title}
          </span>
        </button>
      )}
    </TaskTooltip>
  );
}
