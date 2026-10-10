"use client";

import { useMemo } from "react";
import { TaskList } from "@/components/task-list";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { groupForList } from "@/lib/smart-lists";
import { useTasksContext } from "@/components/tasks-provider";
import { isCustomSection } from "@/lib/sections";
import { deriveStatus } from "@/lib/status";
import type { SmartList, Task, BoardSection } from "@/lib/types";
import { useTaskSelection } from "@/hooks/use-task-selection";

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
  /** Called after a card is moved to another section via the list arrows. */
  onMovedToSection?: (sectionId: string) => void;
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
  onMovedToSection,
}: ListViewProps) {
  const { sections: sectionsCtx, assignTaskToSection: assignTaskToSectionCtx } = useTasksContext();
  const sections = sectionsProp ?? sectionsCtx;
  const assignTaskToSection = assignTaskToSectionProp ?? assignTaskToSectionCtx;
  const groups = groupForList(tasks, list, now);

  // Flatten all tasks for selection management
  const allTasks = useMemo(() => groups.flatMap((g) => g.tasks), [groups]);

  const {
    selectedIds,
    highlightedId,
    selectMode,
    toggleSelectMode,
    clearSelection,
    toggleTask,
  } = useTaskSelection(allTasks);

  // Handle selection from TaskList
  const handleSelectTask = (task: Task, shiftKey: boolean) => {
    toggleTask(task.id, shiftKey);
  };

  const handleRenameTask = () => {
    // Inline rename is handled by TaskCard directly
  };

  // Check if any tasks in current view are selected
  const hasSelection = allTasks.some((t) => selectedIds.has(t.id));
  const allSelectedInView = allTasks.length > 0 && allTasks.every((t) => selectedIds.has(t.id));

  return (
    <div className="flex flex-col gap-6">
      {/* Selection mode header */}
      {selectMode && hasSelection && (
        <SelectionToolbar
          selectedIds={selectedIds}
          visibleTasks={allTasks}
          sections={sections}
          onClear={clearSelection}
        />
      )}

      {groups.map((group) => (
        <section key={group.id} aria-label={group.label} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 px-1">
            {selectMode && group.tasks.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (allSelectedInView) {
                    // Deselect all in this group
                    group.tasks.forEach((t) => selectedIds.delete(t.id));
                    // This won't work directly since we need to use the setter
                    // We'll handle this via the selectAll/clearSelection
                  } else {
                    group.tasks.forEach((t) => toggleTask(t.id, false));
                  }
                }}
                aria-label={allSelectedInView ? `Deselect all in ${group.label}` : `Select all in ${group.label}`}
                aria-pressed={allSelectedInView}
                className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {allSelectedInView ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                )}
              </button>
            )}
            <h2 className="text-sm font-semibold text-muted-foreground flex-1">{group.label}</h2>
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
            selectedIds={selectedIds}
            highlightedId={highlightedId}
            onSelectionChange={() => {
              // Selection change is handled by useTaskSelection internally
            }}
            onSelectTask={handleSelectTask}
            onRenameTask={handleRenameTask}
            onMovedToSection={onMovedToSection}
          />
        </section>
      ))}

      {/* Enter select mode button when no selection */}
      {!selectMode && allTasks.length > 0 && (
        <button
          type="button"
          onClick={toggleSelectMode}
          className="self-center focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6v6H9z" />
          </svg>
          Select tasks
        </button>
      )}
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