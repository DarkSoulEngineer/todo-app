"use client";

import { TaskList } from "@/components/task-list";
import { groupForList } from "@/lib/smart-lists";
import { useTasksContext } from "@/components/tasks-provider";
import { isCustomSection } from "@/lib/sections";
import { deriveStatus } from "@/lib/status";
import type { SmartList, Task, BoardSection } from "@/lib/types";

interface ListViewProps {
  /** Already filtered and sorted for the active smart list. */
  tasks: Task[];
  list: SmartList;
  now: Date;
  sortable: boolean;
  onEdit: (task: Task) => void;
  /** Board sections for section navigation arrows. */
  sections?: BoardSection[];
  /** Function to move task to a section. */
  assignTaskToSection?: (taskId: string, sectionId: string) => void;
}

/** Sectioned task rows grouped by due-date bucket. */
export function ListView({
  tasks,
  list,
  now,
  sortable,
  onEdit,
  sections: sectionsProp,
  assignTaskToSection: assignTaskToSectionProp,
}: ListViewProps) {
  const { sections: sectionsCtx, assignTaskToSection: assignTaskToSectionCtx } = useTasksContext();
  const sections = sectionsProp ?? sectionsCtx;
  const assignTaskToSection = assignTaskToSectionProp ?? assignTaskToSectionCtx;
  const groups = groupForList(tasks, list, now);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.id} aria-label={group.label} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
              {group.tasks.length}
            </span>
          </div>
          <TaskList
            tasks={group.tasks}
            now={now}
            sortable={sortable}
            onEdit={onEdit}
            sections={sections}
            assignTaskToSection={assignTaskToSection}
          />
        </section>
      ))}
    </div>
  );
}

/**
 * Determines which board section a task currently belongs to.
 * Returns the section ID or undefined if not found.
 */
export function getTaskSectionId(task: Task, sections: BoardSection[], now: Date): string | undefined {
  // If task has a custom sectionId, use that
  if (task.sectionId) {
    const customSection = sections.find((s) => s.id === task.sectionId);
    if (customSection && isCustomSection(customSection)) return customSection.id;
  }
  // Otherwise, find the status section matching the task's derived status
  const status = deriveStatus(task, now);
  const statusSection = sections.find((s) => s.status === status);
  return statusSection?.id;
}

/**
 * Gets the previous and next section IDs relative to the task's current section,
 * following the board's section order.
 */
export function getAdjacentSections(
  task: Task,
  sections: BoardSection[],
  now: Date
): { prev: string | null; next: string | null } {
  const currentSectionId = getTaskSectionId(task, sections, now);
  if (!currentSectionId) return { prev: null, next: null };

  const currentIndex = sections.findIndex((s) => s.id === currentSectionId);
  if (currentIndex === -1) return { prev: null, next: null };

  const prev = currentIndex > 0 ? sections[currentIndex - 1].id : null;
  const next = currentIndex < sections.length - 1 ? sections[currentIndex + 1].id : null;

  return { prev, next };
}
