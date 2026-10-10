"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence } from "framer-motion";
import { useCallback, useMemo } from "react";
import { SortableTaskCard } from "@/components/sortable-task-card";
import { useTasksContext } from "@/components/tasks-provider";
import { dismissTooltips } from "@/components/ui/tooltip";
import type { Task } from "@/lib/types";

interface TaskListProps {
  tasks: Task[];
  now: Date;
  sortable: boolean;
  onEdit: (task: Task) => void;
}

export function TaskList({ tasks, now, sortable, onEdit }: TaskListProps) {
  const { reorderTasks } = useTasksContext();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => tasks.map((task) => task.id), [tasks]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      reorderTasks(arrayMove(ids, oldIndex, newIndex));
    },
    [ids, reorderTasks],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => dismissTooltips()}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                now={now}
                onEdit={onEdit}
                sortable={sortable}
              />
            ))}
          </AnimatePresence>
        </ul>
      </SortableContext>
    </DndContext>
  );
}
