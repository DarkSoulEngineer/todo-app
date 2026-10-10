"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { AnimatePresence } from "framer-motion";
import { useCallback, useMemo } from "react";
import { SortableTaskCard } from "@/components/sortable-task-card";
import { useTasksContext } from "@/components/tasks-provider";
import { useTaskSelection } from "@/hooks/use-task-selection";
import type { Task, BoardSection } from "@/lib/types";
import type { TasksApi } from "@/hooks/use-tasks";

type AssignTaskToSection = TasksApi["assignTaskToSection"];

interface TaskListProps {
  tasks: Task[];
  now: Date;
  sortable: boolean;
  onEdit: (task: Task) => void;
  sections: BoardSection[];
  assignTaskToSection: AssignTaskToSection;
  /** Selection state from parent */
  selectedIds?: Set<string>;
  highlightedId?: string | null;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  onSelectTask?: (task: Task, shiftKey: boolean) => void;
  onRenameTask?: (task: Task) => void;
  /** Manual order: cards may be rearranged inside the group with up/down. */
  reorderable: boolean;
  /** Called after a card is moved to another section via the list arrows. */
  onMovedToSection?: (sectionId: string) => void;
}

export function TaskList({
  tasks,
  now,
  sortable,
  onEdit,
  sections,
  assignTaskToSection,
  selectedIds,
  highlightedId,
  onSelectionChange,
  onSelectTask,
  onRenameTask,
  reorderable,
  onMovedToSection,
}: TaskListProps) {
  const { reorderTasks } = useTasksContext();
  const { moveHighlight, selectHighlighted } = useTaskSelection(tasks, onSelectionChange);

  const orderedIds = useMemo(() => tasks.map((task) => task.id), [tasks]);

  /** Swaps a card with its neighbour inside this group (manual order only). */
  const handleReorder = useCallback(
    (taskId: string, direction: "up" | "down") => {
      const from = orderedIds.indexOf(taskId);
      if (from === -1) return;
      const to = from + (direction === "up" ? -1 : 1);
      if (to < 0 || to >= orderedIds.length) return;
      reorderTasks(arrayMove(orderedIds, from, to));
    },
    [orderedIds, reorderTasks],
  );

  // Use parent selection state if provided, otherwise use local
  const effectiveSelectedIds = selectedIds ?? new Set();
  const effectiveHighlightedId = highlightedId ?? undefined;

  const handleSelect = useCallback((task: Task, shiftKey: boolean) => {
    // If parent provides onSelectTask, use it; otherwise use local toggle
    if (onSelectTask) {
      onSelectTask(task, shiftKey);
    }
  }, [onSelectTask]);

  // Handle keyboard navigation for the list
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight("next");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight("prev");
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      selectHighlighted();
    }
  }, [moveHighlight, selectHighlighted]);

  return (
    <ul
      className="flex flex-col gap-2.5"
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label="Tasks"
    >
      <AnimatePresence initial={false}>
        {tasks.map((task, index) => (
          <SortableTaskCard
            key={task.id}
            task={task}
            now={now}
            onEdit={onEdit}
            sortable={sortable}
            sections={sections}
            assignTaskToSection={assignTaskToSection}
            selected={effectiveSelectedIds.has(task.id)}
            highlighted={effectiveHighlightedId === task.id}
            onSelect={handleSelect}
            onRename={onRenameTask}
            onMovedToSection={onMovedToSection}
            reorderIndex={reorderable ? index : undefined}
            reorderTotal={reorderable ? tasks.length : undefined}
            onReorder={reorderable ? handleReorder : undefined}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}