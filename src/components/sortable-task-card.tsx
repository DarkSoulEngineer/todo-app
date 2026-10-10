"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { TaskCard } from "@/components/task-card";
import type { Task } from "@/lib/types";

interface SortableTaskCardProps {
  task: Task;
  now: Date;
  onEdit: (task: Task) => void;
  /** Drag is only offered in manual sort mode. */
  sortable: boolean;
}

export function SortableTaskCard({ task, now, onEdit, sortable }: SortableTaskCardProps) {
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
      <TaskCard task={task} now={now} onEdit={onEdit} handle={handle} dragging={isDragging} />
    </motion.li>
  );
}
