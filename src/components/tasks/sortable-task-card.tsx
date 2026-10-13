"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { TaskCard } from "@/components/tasks/task-card";
import type { Task, BoardSection } from "@/lib/domain/types";
import type { TasksApi } from "@/hooks/use-tasks";

type AssignTaskToSection = TasksApi["assignTaskToSection"];

interface SortableTaskCardProps {
  task: Task;
  now: Date;
  onEdit: (task: Task) => void;
  /** Drag is only offered in manual sort mode. */
  sortable: boolean;
  sections: BoardSection[];
  assignTaskToSection: AssignTaskToSection;
  /** Selection state */
  selected?: boolean;
  /** Highlighted for keyboard navigation */
  highlighted?: boolean;
  /** Click handler for selection */
  onSelect?: (task: Task, shiftKey: boolean) => void;
  /** Double-click handler for inline rename */
  onRename?: (task: Task) => void;
  /** Called after the card is moved to another section via the arrows. */
  onMovedToSection?: (sectionId: string) => void;
  /** Zero-based position inside the list group / board column. */
  reorderIndex?: number;
  /** How many cards the list group / board column holds. */
  reorderTotal?: number;
  /** Moves the card up or down inside its list group / board column. */
  onReorder?: (taskId: string, direction: "up" | "down") => void;
}

export function SortableTaskCard({
  task,
  now,
  onEdit,
  sortable,
  sections,
  assignTaskToSection,
  selected,
  highlighted,
  onSelect,
  onRename,
  onMovedToSection,
  reorderIndex,
  reorderTotal,
  onReorder,
}: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !sortable });
  const reduceMotion = useReducedMotion();

  const handle = sortable ? (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder "${task.title}"`}
      title="Drag to reorder"
      className="focus-ring grid h-8 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  ) : undefined;

  return (
    <motion.li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      className="list-none"
    >
      <TaskCard
        task={task}
        now={now}
        onEdit={onEdit}
        handle={handle}
        dragging={isDragging}
        sections={sections}
        assignTaskToSection={assignTaskToSection}
        selected={selected}
        highlighted={highlighted}
        onSelect={onSelect}
        onRename={onRename}
        onMovedToSection={onMovedToSection}
        reorderIndex={reorderIndex}
        reorderTotal={reorderTotal}
        onReorder={onReorder}
      />
    </motion.li>
  );
}