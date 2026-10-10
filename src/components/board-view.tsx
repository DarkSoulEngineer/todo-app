"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Eye, LayoutGrid, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BoardCanvas } from "@/components/board-canvas";
import { BoardSectionColumn } from "@/components/board-section";
import { CategoryPill, DueBadge, PriorityPill } from "@/components/task-badges";
import { dismissTooltips } from "@/components/ui/tooltip";
import { useTasksContext } from "@/components/tasks-provider";
import { deriveStatus, STATUS_META } from "@/lib/status";
import { sortTasks } from "@/lib/tasks-selectors";
import type { SortKey, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BoardViewProps {
  /** Tasks filtered by search + category (all statuses). */
  tasks: Task[];
  now: Date;
  sort: SortKey;
  /** When set, only that section is shown (driven by the sidebar). */
  focusedSectionId?: string | null;
  onClearFocus?: () => void;
  onEdit: (task: Task) => void;
}

/**
 * Fully user-controlled Kanban board. Sections are stored in order and can be
 * added, renamed, hidden, deleted and reordered; dragging a card between columns
 * re-maps it to that section's status or custom `sectionId`.
 */
export function BoardView({
  tasks,
  now,
  sort,
  focusedSectionId = null,
  onClearFocus,
  onEdit,
}: BoardViewProps) {
  const {
    sections,
    assignTaskToSection,
    addSection,
    renameSection,
    deleteSection,
    toggleSectionHidden,
    reorderSections,
    addTask,
    snapshot,
    restore,
  } = useTasksContext();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const customSectionIds = useMemo(
    () => new Set(sections.filter((section) => section.status === undefined).map((s) => s.id)),
    [sections],
  );

  const sectionIdForTask = useMemo(
    () => (task: Task): string | undefined => {
      if (task.sectionId && customSectionIds.has(task.sectionId)) return task.sectionId;
      return sections.find((section) => section.status === deriveStatus(task, now))?.id;
    },
    [customSectionIds, sections, now],
  );

  const tasksBySection = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const section of sections) map.set(section.id, []);
    for (const task of tasks) {
      const id = sectionIdForTask(task);
      const bucket = id ? map.get(id) : undefined;
      if (bucket) bucket.push(task);
    }
    for (const [id, list] of map) map.set(id, sortTasks(list, sort));
    return map;
  }, [tasks, sections, sectionIdForTask, sort]);

  const visibleSections = useMemo(() => {
    if (focusedSectionId) {
      const focused = sections.find((section) => section.id === focusedSectionId);
      if (focused && !focused.hidden) return [focused];
    }
    return sections.filter((section) => !section.hidden);
  }, [sections, focusedSectionId]);

  const hiddenSections = useMemo(() => sections.filter((section) => section.hidden), [sections]);

  const visibleIds = useMemo(() => visibleSections.map((section) => section.id), [visibleSections]);
  const allIds = useMemo(() => sections.map((section) => section.id), [sections]);

  const activeTask = activeTaskId
    ? (tasks.find((task) => task.id === activeTaskId) ?? null)
    : null;
  const activeSection = activeSectionId
    ? (sections.find((section) => section.id === activeSectionId) ?? null)
    : null;

  function handleDragStart(event: DragStartEvent): void {
    dismissTooltips();
    if (event.active.data.current?.type === "section") {
      setActiveSectionId(String(event.active.id));
    } else {
      setActiveTaskId(String(event.active.id));
    }
  }

  function handleDragOver(event: DragOverEvent): void {
    if (event.active.data.current?.type === "section") return;
    setOverId(event.over ? String(event.over.id) : null);
  }

  function resetDrag(): void {
    setActiveTaskId(null);
    setActiveSectionId(null);
    setOverId(null);
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    resetDrag();
    if (!over) return;

    // Reordering sections.
    if (active.data.current?.type === "section") {
      const from = allIds.indexOf(String(active.id));
      const to = allIds.indexOf(String(over.id));
      if (from !== -1 && to !== -1 && from !== to) reorderSections(arrayMove(allIds, from, to));
      return;
    }

    // Moving a card between sections.
    const taskId = String(active.id);
    const targetSectionId = String(over.id);
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (sectionIdForTask(task) === targetSectionId) return;

    const before = snapshot();
    assignTaskToSection(taskId, targetSectionId);
    const target = sections.find((section) => section.id === targetSectionId);
    toast.success(`Moved to ${target?.title ?? "section"}`, {
      duration: 3000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
  }

  function handleAddCard(sectionId: string, title: string): void {
    const before = snapshot();
    const task = addTask({
      title,
      description: "",
      dueAt: null,
      priority: "medium",
      category: null,
      subtasks: [],
    });
    assignTaskToSection(task.id, sectionId);
    toast.success("Card added", {
      description: title,
      duration: 4000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
  }

  function handleAddSection(): void {
    const section = addSection("New section");
    setEditingId(section.id);
  }

  function handleDeleteSection(id: string): void {
    const target = sections.find((section) => section.id === id);
    if (!target) return;
    const before = snapshot();
    deleteSection(id);
    toast(`Deleted “${target.title}”`, {
      description: "Its cards returned to their status columns.",
      duration: 5000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
  }

  function handleHideSection(id: string): void {
    const target = sections.find((section) => section.id === id);
    toggleSectionHidden(id);
    if (target) {
      toast(`Hid “${target.title}”`, {
        description: "Reveal it from the bar above the board.",
        duration: 3500,
      });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {focusedSectionId || hiddenSections.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {focusedSectionId ? (
            <button
              type="button"
              onClick={onClearFocus}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-muted"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Show all sections
            </button>
          ) : null}
          {hiddenSections.length > 0 ? (
            <>
              <span className="text-muted-foreground">Hidden sections:</span>
              {hiddenSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => toggleSectionHidden(section.id)}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {section.title}
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={resetDrag}
      >
        <SortableContext items={visibleIds} strategy={horizontalListSortingStrategy}>
          <BoardCanvas>
            <div className="-mx-1 flex items-start gap-3 px-1 pb-2">
              {visibleSections.map((section) => (
                <BoardSectionColumn
                  key={section.id}
                  section={section}
                  tasks={tasksBySection.get(section.id) ?? []}
                  now={now}
                  editing={editingId === section.id}
                  isDropTarget={overId === section.id}
                  // Rearranging a column only makes sense in manual sort mode;
                  // every other sort derives its order from the task itself.
                  reorderable={sort === "manual"}
                  onEdit={onEdit}
                  onStartRename={setEditingId}
                  onRename={renameSection}
                  onCancelRename={() => setEditingId(null)}
                  onDelete={handleDeleteSection}
                  onHide={handleHideSection}
                  onAddCard={handleAddCard}
                />
              ))}

              {!focusedSectionId ? (
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="focus-ring flex w-[17rem] shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-card hover:text-foreground sm:w-72"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.4} />
                  Add section
                </button>
              ) : null}
            </div>
          </BoardCanvas>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeTask ? <BoardCardPreview task={activeTask} now={now} /> : null}
          {activeSection ? (
            <div className="w-[17rem] rotate-2 cursor-grabbing rounded-2xl border border-border bg-card p-2.5 shadow-2xl ring-1 ring-primary/20 sm:w-72">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                    activeSection.status ? STATUS_META[activeSection.status].chip : "bg-muted",
                  )}
                >
                  {activeSection.status
                    ? (() => {
                        const Icon = STATUS_META[activeSection.status].icon;
                        return <Icon className="h-4 w-4" strokeWidth={2.4} />;
                      })()
                    : null}
                </span>
                <p className="truncate text-sm font-semibold">{activeSection.title}</p>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function BoardCardPreview({ task, now }: { task: Task; now: Date }) {
  return (
    <div className="w-[16rem] rotate-2 cursor-grabbing rounded-2xl border border-border bg-card p-3 shadow-2xl ring-1 ring-primary/20">
      <p className="line-clamp-2 text-sm font-semibold break-words">{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DueBadge task={task} now={now} />
        <PriorityPill priority={task.priority} />
        {task.category ? <CategoryPill categoryId={task.category} /> : null}
      </div>
    </div>
  );
}
