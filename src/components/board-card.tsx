"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { TaskCard } from "@/components/task-card";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BoardCardProps {
  task: Task;
  now: Date;
  onEdit: (task: Task) => void;
}

/** A task card that can be dragged between board columns. */
export function BoardCard({ task, now, onEdit }: BoardCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  const handle = (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Move "${task.title}"`}
      title="Drag between columns"
      className="focus-ring grid h-8 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} className={cn("min-w-0 transition-opacity", isDragging && "opacity-40")}>
      <TaskCard task={task} now={now} onEdit={onEdit} handle={handle} compact />
    </div>
  );
}
