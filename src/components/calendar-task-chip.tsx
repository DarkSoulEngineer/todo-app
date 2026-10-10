"use client";

import { useDraggable } from "@dnd-kit/core";
import { PRIORITY_META } from "@/lib/constants";
import { deriveStatus } from "@/lib/status";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

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
      ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300"
      : "bg-slate-500/12 text-slate-600 ring-slate-500/25 dark:text-slate-300"
    : status === "overdue"
      ? "bg-red-500/12 text-red-700 ring-red-500/25 dark:text-red-300"
      : "bg-card text-foreground ring-border hover:bg-muted";

  const dot = settled
    ? completed
      ? "bg-emerald-500"
      : "bg-slate-400"
    : status === "overdue"
      ? "bg-red-500"
      : PRIORITY_META[task.priority].dot;

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(task)}
      title={task.title}
      className={cn(
        "focus-ring flex w-full min-w-0 touch-none items-center gap-1 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium ring-1 ring-inset transition-colors",
        tone,
        isDragging && "opacity-40",
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      <span className={cn("min-w-0 flex-1 truncate", settled && "line-through")}>{task.title}</span>
    </button>
  );
}
