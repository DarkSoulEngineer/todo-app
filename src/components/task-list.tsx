"use client";

import { AnimatePresence } from "framer-motion";
import { SortableTaskCard } from "@/components/sortable-task-card";
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
}

export function TaskList({ tasks, now, sortable, onEdit, sections, assignTaskToSection }: TaskListProps) {
  return (
    <ul className="flex flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {tasks.map((task) => (
          <SortableTaskCard
            key={task.id}
            task={task}
            now={now}
            onEdit={onEdit}
            sortable={sortable}
            sections={sections}
            assignTaskToSection={assignTaskToSection}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}
