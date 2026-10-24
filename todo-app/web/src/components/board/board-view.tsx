"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Eye, EyeOff, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BoardCanvas } from "@/components/board/board-canvas";
import { BoardSectionColumn } from "@/components/board/board-section";
import { BoardSelectionProvider } from "@/components/board/board-card";
import { TaskCard } from "@/components/tasks/task-card";
import { SelectionToolbar } from "@/components/tasks/selection-toolbar";
import { dismissTooltips } from "@/components/ui/tooltip";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { STATUS_META } from "@/components/common/status-meta";
import { deriveStatus } from "@/lib/domain/status";
import { sortTasks } from "@/lib/domain/tasks-selectors";
import type { BoardSection, SortKey, Task } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";
import { useTaskSelection } from "@/hooks/use-task-selection";

const UNSORTED_SECTION_ID = "__board_unsorted__";
const UNSORTED_SECTION: BoardSection = { id: UNSORTED_SECTION_ID, title: "Unsorted" };

interface BoardViewProps {
  /** Tasks filtered by search + category (all statuses). */
  tasks: Task[];
  now: Date;
  sort: SortKey;
  /** When true, board cards render in a minimal (title + category only) layout. */
  compactView?: boolean;
  /** Task id to briefly spotlight after an activity navigation. */
  spotlightTaskId?: string | null;
  /**
   * Called when a positional drop forces the board into manual order (only
   * meaningful when another sort was active, whose derived order would
   * otherwise override the arrangement).
   */
  onSortChange?: (value: SortKey) => void;
  onEdit: (task: Task) => void;
}

/**
 * Maps a droppable id to the section whose working list holds it, or null when
 * the id is not tracked (it is a section id or an unknown card).
 */
function findContainer(items: Record<string, string[]>, id: string): string | null {
  if (id in items) return id;
  for (const [sectionId, list] of Object.entries(items)) {
    if (list.includes(id)) return sectionId;
  }
  return null;
}

/** Shallow equality for two id lists (used to keep array identities stable). */
function arrayEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Pure reorder of the working columns for one drag-over sample. Returns the
 * SAME `prev` reference when the move would not change any column, so callers
 * never commit a no-op state update (which would otherwise churn dnd-kit's
 * `SortableContext.items` and re-trigger measuring on every pointer move).
 */
function computeDragOrder(
  prev: Record<string, string[]>,
  activeId: string,
  overId: string,
  overIsSection: boolean,
  isBelow: boolean,
): Record<string, string[]> {
  const from = findContainer(prev, activeId);
  const to = overIsSection ? overId : findContainer(prev, overId);
  if (!from || !to || !(to in prev)) return prev;

  // Working list WITHOUT the dragged card: the exact post-drop column, so the
  // live gap and the drop position always agree (no snap on release).
  const targetWithout = (prev[to] ?? []).filter((id) => id !== activeId);
  const anchorIndex = targetWithout.indexOf(overId);
  const insertAt =
    overIsSection || anchorIndex < 0
      ? targetWithout.length
      : Math.min(anchorIndex + (isBelow ? 1 : 0), targetWithout.length);
  const targetNext = [
    ...targetWithout.slice(0, insertAt),
    activeId,
    ...targetWithout.slice(insertAt),
  ];

  const sourceNext = (prev[from] ?? []).filter((id) => id !== activeId);
  const targetUnchanged = arrayEqual(prev[to] ?? [], targetNext);
  const sourceUnchanged = from === to || arrayEqual(prev[from] ?? [], sourceNext);
  if (targetUnchanged && sourceUnchanged) return prev;

  const next = { ...prev };
  if (from !== to) next[from] = sourceNext;
  next[to] = targetNext;
  return next;
}

/** Idle time after the last pointer sample before the preview is committed. */
const PREVIEW_SETTLE_MS = 120;
/** Upper bound so a long, continuous drag still updates the preview now and then. */
const PREVIEW_MAX_WAIT_MS = 450;

/**
 * Fully user-controlled Kanban board. Sections are stored in order and can be
 * added, renamed, hidden, deleted and reordered; dragging a card reorders it
 * inside its column or moves it to any position in another column by
 * re-mapping it to that section's status or custom `sectionId`.
 */
export function BoardView({
  tasks,
  now,
  sort,
  compactView = false,
  spotlightTaskId = null,
  onSortChange,
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
    reorderTasks,
    addTask,
    deleteTask,
    setTaskSectionId,
    snapshot,
    restore,
  } = useTasksContext();

  const [coarsePointer, setCoarsePointer] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarsePointer(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  const selection = useTaskSelection(tasks);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  /**
   * Live per-column card order while a card drag is in flight: `sectionId ->
   * task ids`. Seeded from the committed columns on drag start and updated as
   * the pointer moves, so siblings can shift to reveal the drop gap. Null
   * outside a card drag.
   */
  const [boardItems, setBoardItems] = useState<Record<string, string[]> | null>(null);

  /**
   * The preview shown while a card is dragged is committed on a "settle"
   * schedule instead of on every pointer move. Fast, chaotic movement keeps
   * resetting the timer, so the columns hold still; once the pointer slows and
   * stabilizes the pending order is flushed in a single render. A short
   * max-wait keeps a long, continuous drag from feeling frozen.
   */
  const boardItemsRef = useRef<Record<string, string[]> | null>(null);
  const boardItemsSeedRef = useRef<Record<string, string[]> | null>(null);
  const overIdRef = useRef<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewSinceRef = useRef<number | null>(null);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const boardSections = useMemo(() => [...sections, UNSORTED_SECTION], [sections]);

  const customSectionIds = useMemo(
    () => new Set(sections.filter((section) => section.status === undefined).map((s) => s.id)),
    [sections],
  );

  const sectionIdForTask = useMemo(
    () => (task: Task): string => {
      if (task.sectionId && customSectionIds.has(task.sectionId)) return task.sectionId;
      return sections.find((section) => section.status === deriveStatus(task, now))?.id ?? UNSORTED_SECTION_ID;
    },
    [customSectionIds, sections, now],
  );

  const tasksBySection = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const section of boardSections) map.set(section.id, []);
    for (const task of tasks) {
      const id = sectionIdForTask(task);
      const bucket = id ? map.get(id) : undefined;
      if (bucket) bucket.push(task);
    }
    for (const [id, list] of map) map.set(id, sortTasks(list, sort));
    return map;
  }, [tasks, boardSections, sectionIdForTask, sort]);

  const visibleSections = useMemo(() => {
    return [...sections.filter((section) => !section.hidden), UNSORTED_SECTION];
  }, [sections]);

  const visibleIds = useMemo(() => visibleSections.map((section) => section.id), [visibleSections]);
  const allIds = useMemo(() => sections.map((section) => section.id), [sections]);
  const sectionIds = useMemo(() => new Set(boardSections.map((section) => section.id)), [boardSections]);

  const hiddenSections = sections.filter((section) => section.hidden);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  /**
   * Per-column task lists resolved from the live drag order. Includes the card
   * being dragged while it hovers a column, so that column can render it as a
   * faded placeholder and open the gap. Null when no card drag is active.
   */
  const dragTasksBySection = useMemo(() => {
    if (!boardItems) return null;
    const map = new Map<string, Task[]>();
    for (const section of boardSections) {
      const ids = boardItems[section.id];
      if (!ids) continue;
      const list: Task[] = [];
      for (const id of ids) {
        const task = taskById.get(id);
        if (task) list.push(task);
      }
      map.set(section.id, list);
    }
    return map;
  }, [boardItems, boardSections, taskById]);

  /**
   * Section drags may only land on other sections; card drags may land on any
   * card (for a precise index) or on a section (empty/whitespace → append).
   */
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const draggingSection = args.active.data.current?.type === "section";

      // Trash takes priority whenever the dragged card's pointer is over it,
      // so a card is deleted instead of being dropped into a section beneath.
      if (!draggingSection) {
        const trashContainer = args.droppableContainers.find(
          (container) => container.data.current?.type === "trash",
        );
        const pointer = (args as { pointerCoordinates?: { x: number; y: number } | null }).pointerCoordinates;
        const rect = trashContainer?.rect.current;
        if (trashContainer && rect && pointer) {
          if (pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom) {
            return [{ id: trashContainer.id }];
          }
        }
      }

      const droppableContainers = args.droppableContainers.filter((container) => {
        const type = container.data.current?.type;
        return draggingSection
          ? type === "section"
          : type === "card" || type === "section" || type === "trash";
      });
      return closestCorners({ ...args, droppableContainers });
    },
    [],
  );

  const activeTask = activeTaskId
    ? (tasks.find((task) => task.id === activeTaskId) ?? null)
    : null;
  const activeSection = activeSectionId
    ? (sections.find((section) => section.id === activeSectionId) ?? null)
    : null;

  /** Commits the pending preview (order + drop target) in one render. */
  function flushPreview(): void {
    previewTimerRef.current = null;
    previewSinceRef.current = null;
    // Setters bail out when the reference/value is unchanged, so a flush that
    // resolves to the same columns costs nothing.
    setBoardItems(boardItemsRef.current);
    setOverId(overIdRef.current);
  }

  /**
   * Schedules the preview commit after the pointer settles. Every move resets
   * the idle timer, so a fast, chaotic drag produces no board re-render; the
   * first commit lands once movement slows. `PREVIEW_MAX_WAIT_MS` bounds the
   * lag of a slow, continuous drag.
   */
  function schedulePreview(): void {
    const nowMs = performance.now();
    if (previewSinceRef.current === null) previewSinceRef.current = nowMs;
    const elapsed = nowMs - previewSinceRef.current;
    const wait = elapsed >= PREVIEW_MAX_WAIT_MS ? 0 : PREVIEW_SETTLE_MS;
    if (previewTimerRef.current !== null) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(flushPreview, wait);
  }

  function handleDragStart(event: DragStartEvent): void {
    dismissTooltips();
    if (event.active.data.current?.type === "section") {
      setActiveSectionId(String(event.active.id));
      return;
    }
    setActiveTaskId(String(event.active.id));
    // Seed the live order from the committed columns so every move is a pure
    // splice/arrayMove against a known starting point.
    const seeded: Record<string, string[]> = {};
    for (const section of boardSections) {
      seeded[section.id] = (tasksBySection.get(section.id) ?? []).map((task) => task.id);
    }
    boardItemsRef.current = seeded;
    boardItemsSeedRef.current = seeded;
    overIdRef.current = null;
    previewSinceRef.current = null;
    setBoardItems(seeded);
    setOverId(null);
  }

  function handleDragOver(event: DragOverEvent): void {
    if (event.active.data.current?.type === "section") return;
    const { active, over } = event;
    if (!over) return;

    // Hovering the trash (or its bottom range) must not publish a "next
    // position" preview: the card is being deleted, so keep the (seeded)
    // original arrangement instead.
    const overIsTrash = over.data.current?.type === "trash" || String(over.id) === "board-trash";
    const translated = event.active.rect.current?.translated;
    const centerY = translated ? translated.top + translated.height / 2 : null;
    const inTrashRange =
      overIsTrash || (centerY !== null && typeof window !== "undefined" && centerY > window.innerHeight - 150);
    if (inTrashRange) {
      overIdRef.current = "board-trash";
      const seeded = boardItemsSeedRef.current;
      if (seeded) {
        boardItemsRef.current = seeded;
        setBoardItems(seeded);
      }
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    // The ref is the source of truth for the drop; the state preview is only
    // published on the settle schedule below.
    overIdRef.current = overId;

    if (activeId !== overId) {
      const prev = boardItemsRef.current;
      if (prev) {
        const translated = active.rect.current.translated;
        const isBelow = Boolean(translated && translated.top > over.rect.top + over.rect.height);
        const overIsSection = over.data.current?.type === "section" || sectionIds.has(overId);
        boardItemsRef.current = computeDragOrder(prev, activeId, overId, overIsSection, isBelow);
      }
    }

    schedulePreview();
  }

  function resetDrag(): void {
    if (previewTimerRef.current !== null) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    previewSinceRef.current = null;
    boardItemsRef.current = null;
    boardItemsSeedRef.current = null;
    overIdRef.current = null;
    setActiveTaskId(null);
    setActiveSectionId(null);
    setOverId(null);
    setBoardItems(null);
  }

  // A drag that unmounts mid-flight (view switch, navigation) must not fire a
  // stale preview commit.
  useEffect(
    () => () => {
      if (previewTimerRef.current !== null) clearTimeout(previewTimerRef.current);
    },
    [],
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    // The ref always holds the exact drop position, even if the settle timer
    // never got a chance to publish it before release.
    const workingItems = boardItemsRef.current;
    resetDrag();
    if (!over) return;

    // Reordering sections.
    if (active.data.current?.type === "section") {
      const from = allIds.indexOf(String(active.id));
      const to = allIds.indexOf(String(over.id));
      if (from !== -1 && to !== -1 && from !== to) reorderSections(arrayMove(allIds, from, to));
      return;
    }

    // Placing a card: within its column or at an index in another column.
    const taskId = String(active.id);
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    // Dropping a card onto the trash removes it.
    if (over.data?.current?.type === "trash" || String(over.id) === "board-trash") {
      const before = snapshot();
      deleteTask(taskId);
      toast.success("Card removed", {
        duration: 4000,
        action: { label: "Undo", onClick: () => restore(before) },
      });
      return;
    }

    const committed: Record<string, string[]> = {};
    for (const section of boardSections) {
      committed[section.id] = (tasksBySection.get(section.id) ?? []).map((item) => item.id);
    }
    // Live cross-column moves from the drag, else the committed columns.
    const base: Record<string, string[]> = {};
    for (const section of boardSections) {
      base[section.id] = [...(workingItems?.[section.id] ?? committed[section.id] ?? [])];
    }

    const overId = String(over.id);
    const droppedOnSelf = overId === taskId;
    const overIsSection =
      !droppedOnSelf && (over.data.current?.type === "section" || sectionIds.has(overId));
    const targetSectionId = droppedOnSelf
      ? findContainer(base, taskId)
      : overIsSection
        ? overId
        : findContainer(base, overId);
    if (!targetSectionId || !(targetSectionId in base)) return;

    // Apply the exact drop position to the working order.
    let next: Record<string, string[]>;
    if (droppedOnSelf) {
      // Landed back on the card itself: keep the position it reached during
      // the drag (e.g. a cross-column move already committed by dragOver).
      next = base;
    } else {
      next = {};
      for (const section of boardSections) {
        next[section.id] = (base[section.id] ?? []).filter((id) => id !== taskId);
      }
      const targetList = next[targetSectionId] ?? [];
      let insertAt = targetList.length;
      if (!overIsSection) {
        const overIndex = targetList.indexOf(overId);
        if (overIndex >= 0) {
          const translated = active.rect.current.translated;
          const isBelow = Boolean(translated && translated.top > over.rect.top + over.rect.height);
          insertAt = Math.min(overIndex + (isBelow ? 1 : 0), targetList.length);
        }
      }
      next[targetSectionId] = [...targetList.slice(0, insertAt), taskId, ...targetList.slice(insertAt)];
    }

    // Column-major over the visible columns, so reorderTasks (which reuses the
    // slots those ids already occupy) leaves filtered-out tasks untouched.
    const originalColumnMajor: string[] = [];
    const nextColumnMajor: string[] = [];
    for (const section of visibleSections) {
      originalColumnMajor.push(...(committed[section.id] ?? []));
      nextColumnMajor.push(...(next[section.id] ?? []));
    }

    const sectionChanged = sectionIdForTask(task) !== targetSectionId;
    const orderChanged =
      originalColumnMajor.length !== nextColumnMajor.length ||
      originalColumnMajor.some((id, index) => id !== nextColumnMajor[index]);
    if (!sectionChanged && !orderChanged) return;

    const wasManual = sort === "manual";
    const before = snapshot();
    if (sectionChanged) {
      if (targetSectionId === UNSORTED_SECTION_ID) setTaskSectionId(taskId, null);
      else assignTaskToSection(taskId, targetSectionId);
    }
    reorderTasks(nextColumnMajor);

    const targetTitle =
      boardSections.find((section) => section.id === targetSectionId)?.title ?? "section";
    toast.success(sectionChanged ? `Moved to ${targetTitle}` : `Reordered in ${targetTitle}`, {
      duration: 3000,
      action: {
        label: "Undo",
        onClick: () => {
          restore(before);
          if (!wasManual) onSortChange?.(sort);
        },
      },
    });

    // A derived sort would snap right back, so a positional drop pins the board
    // to manual order (with a brief, non-silent notice).
    if (!wasManual) {
      onSortChange?.("manual");
      toast("Switched to manual order", {
        description: "Your arrangement is now kept as the manual order.",
        duration: 3000,
      });
    }
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
    if (sectionId !== UNSORTED_SECTION_ID) assignTaskToSection(task.id, sectionId);
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
      description: "Its cards are no longer in a section.",
      duration: 5000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
  }

  function handleHideSection(id: string): void {
    const target = sections.find((section) => section.id === id);
    toggleSectionHidden(id);
    if (target) {
      toast(`Hid “${target.title}”`, {
        description: "It's tucked into “Hidden columns” above the board.",
        duration: 3500,
      });
    }
  }

  const selectionValue = {
    selectMode: selection.selectMode,
    coarsePointer,
    toggleTask: selection.toggleTask,
    isSelected: selection.isSelected,
    isHighlighted: selection.isHighlighted,
  };

  const columns = (
    <div className="-mx-1 flex items-start gap-3 px-1 pb-2">
      {visibleSections.map((section) => (
        <BoardSectionColumn
          key={section.id}
          section={section}
          tasks={tasksBySection.get(section.id) ?? []}
          dragOrder={dragTasksBySection?.get(section.id)}
          now={now}
          editing={editingId === section.id}
          isDropTarget={overId === section.id}
          reorderable={sort === "manual"}
          onEdit={onEdit}
          onStartRename={section.id === UNSORTED_SECTION_ID ? () => undefined : setEditingId}
          onRename={renameSection}
          onCancelRename={() => setEditingId(null)}
          onDelete={section.id === UNSORTED_SECTION_ID ? () => undefined : handleDeleteSection}
          onHide={section.id === UNSORTED_SECTION_ID ? () => undefined : handleHideSection}
           onAddCard={handleAddCard}
           compactView={compactView}
           spotlightTaskId={spotlightTaskId}
         />
      ))}

      <button
        type="button"
        onClick={handleAddSection}
        className="focus-ring flex w-[18rem] shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-4 py-8 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-card hover:text-foreground sm:w-[18.5rem]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.4} />
        Add section
      </button>
    </div>
  );

  return (
    <BoardSelectionProvider value={selectionValue}>
       <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-background/35 shadow-sm">
       {hiddenSections.length > 0 ? (
        <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-2.5 py-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5" strokeWidth={2.1} />
            Hidden columns
          </span>
          {hiddenSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => toggleSectionHidden(section.id)}
              aria-label={`Show ${section.title}`}
              title={`Show “${section.title}”`}
              className="focus-ring inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Eye className="h-3.5 w-3.5 shrink-0" strokeWidth={2.1} />
              <span className="truncate">{section.title}</span>
            </button>
          ))}
        </div>
      ) : null}
        <DndContext
          key={coarsePointer ? "touch" : "pointer"}
          sensors={coarsePointer ? [] : sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={resetDrag}
        >
        <SortableContext items={visibleIds} strategy={horizontalListSortingStrategy}>
          {coarsePointer ? (
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain">
              <div className="w-max min-w-full">{columns}</div>
            </div>
          ) : (
            <BoardCanvas revealTaskId={spotlightTaskId}>{columns}</BoardCanvas>
          )}
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div
              aria-hidden="true"
              className="pointer-events-none w-[16rem] rotate-2 cursor-grabbing rounded-2xl border border-border bg-card p-3 shadow-2xl ring-1 ring-primary/20"
            >
              {/* Minimized version of the dragged card, tilted like the classic
                  ghost. Renders the static task once per drag — no live
                  status/color emulation on hover, so pointer moves stay cheap. */}
              <div className="scale-[0.92]">
                <TaskCard
                  task={activeTask}
                  now={now}
                  onEdit={onEdit}
                  compact
                  compactView={compactView}
                  sections={sections}
                  assignTaskToSection={assignTaskToSection}
                />
              </div>
            </div>
          ) : null}
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

        {activeTaskId ? <BoardTrashDropzone /> : null}
        </DndContext>

         {selection.selectMode ? (
          <SelectionToolbar
            selectedIds={selection.selectedIds}
            visibleTasks={tasks}
            sections={sections}
            onClear={selection.clearSelection}
            onSelectAll={selection.selectAll}
          />
         ) : null}
       </div>
    </BoardSelectionProvider>
  );
}

function BoardTrashDropzone() {
  const { setNodeRef, isOver } = useDroppable({ id: "board-trash", data: { type: "trash" } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "pointer-events-auto absolute bottom-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200",
        isOver ? "h-24" : "h-16",
        isOver
          ? "bg-gradient-to-t from-destructive/55 via-destructive/20 to-transparent"
          : "bg-gradient-to-t from-destructive/25 via-destructive/8 to-transparent",
      )}
      aria-label="Drop card here to delete"
    >
    </div>
  );
}
