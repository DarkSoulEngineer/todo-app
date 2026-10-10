"use client";

import { useDraggable } from "@dnd-kit/core";
import { TaskCard } from "@/components/task-card";
import { useTasksContext } from "@/components/tasks-provider";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BoardCardProps {
  task: Task;
  now: Date;
  onEdit: (task: Task) => void;
  /** Zero-based position inside the column, set only while reordering is on. */
  reorderIndex?: number;
  /** How many cards the column holds, set only while reordering is on. */
  reorderTotal?: number;
  /** Swaps this card with its neighbour (manual order). */
  onReorder?: (taskId: string, direction: "up" | "down") => void;
}

/**
 * A task card that can be dragged between board columns.
 *
 * The whole card is the drag surface: `TaskCard` only renders a slot for a grip
 * handle in its non-compact (list) layout, so a grip here would never show. The
 * dnd listeners therefore live on the wrapper that also carries `setNodeRef`,
 * which is dnd-kit's standard whole-node-as-activator pattern. The 6px pointer
 * activation constraint in `board-view.tsx` still lets a plain click through, so
 * the title opens the edit dialog and the card's own buttons still fire.
 */
export function BoardCard({
  task,
  now,
  onEdit,
  reorderIndex,
  reorderTotal,
  onReorder,
}: BoardCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: "card" },
  });
  const { sections, assignTaskToSection } = useTasksContext();

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "min-w-0 cursor-grab touch-none transition-opacity active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <TaskCard
        task={task}
        now={now}
        onEdit={onEdit}
        compact
        sections={sections}
        assignTaskToSection={assignTaskToSection}
        reorderIndex={reorderIndex}
        reorderTotal={reorderTotal}
        onReorder={onReorder}
      />
    </div>
  );
}
