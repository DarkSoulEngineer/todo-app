"use client";

import { useMemo } from "react";
import { TaskList } from "@/components/task-list";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { groupForList, groupForListBySection } from "@/lib/smart-lists";
import { useTasksContext } from "@/components/tasks-provider";
import { isCustomSection } from "@/lib/sections";
import { deriveStatus } from "@/lib/status";
import { getBoardColorByLabel } from "@/lib/boards";
import type { SmartList, Task, BoardSection } from "@/lib/types";
import { useTaskSelection } from "@/hooks/use-task-selection";
import { cn } from "@/lib/utils";

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
  /** Manual order: cards may be rearranged inside each group with up/down. */
  reorderable?: boolean;
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
  reorderable = false,
  onMovedToSection,
}: ListViewProps) {
  const { sections: sectionsCtx, assignTaskToSection: assignTaskToSectionCtx } = useTasksContext();
  const sections = sectionsProp ?? sectionsCtx;
  const assignTaskToSection = assignTaskToSectionProp ?? assignTaskToSectionCtx;
  const groups = list === "by-section" 
    ? groupForListBySection(tasks, sections, now)
    : groupForList(tasks, list, now);

  // Flatten all tasks for selection management
  const allTasks = useMemo(() => groups.flatMap((g) => g.tasks), [groups]);

  const {
    selectedIds,
    highlightedId,
    selectMode,
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

      {groups.map((group) => {
        // Check if all tasks in THIS group are selected
        const allSelectedInGroup = group.tasks.length > 0 && group.tasks.every((t) => selectedIds.has(t.id));

        const handleGroupSelectAll = () => {
          if (allSelectedInGroup) {
            // Deselect all in this group
            group.tasks.forEach((t) => {
              if (selectedIds.has(t.id)) toggleTask(t.id, false);
            });
          } else {
            // Select all in this group
            group.tasks.forEach((t) => {
              if (!selectedIds.has(t.id)) toggleTask(t.id, false);
            });
          }
        };

        return (
          <section key={group.id} aria-label={group.label} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 px-1">
              {selectMode && group.tasks.length > 0 && (
                <button
                  type="button"
                  onClick={handleGroupSelectAll}
                  aria-label={allSelectedInGroup ? `Deselect all in ${group.label}` : `Select all in ${group.label}`}
                  aria-pressed={allSelectedInGroup}
                  className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {allSelectedInGroup ? (
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
              <div className="flex items-center gap-2">
                {(() => {
                  const color = getBoardColorByLabel(group.label);
                  return color ? (
                    <span
                      className={cn(
                        "h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-inset ring-black/[0.08] dark:ring-white/10",
                        color.dot,
                      )}
                      aria-hidden="true"
                    />
                  ) : null;
                })()}
                <h2 className="text-sm font-semibold text-muted-foreground flex-1">{group.label}</h2>
              </div>
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
              reorderable={reorderable}
            />
          </section>
        );
      })}
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