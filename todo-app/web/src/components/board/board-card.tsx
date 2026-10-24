"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { TaskCard } from "@/components/tasks/task-card";
import { useTasksContext } from "@/components/providers/tasks-provider";
import type { Task } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

interface BoardCardProps {
  task: Task;
  now: Date;
  onEdit: (task: Task) => void;
  /** Zero-based position inside the column, set only while reordering is on. */
  reorderIndex?: number;
  /** How many cards the column holds, set only while reordering is on. */
  reorderTotal?: number;
  /** Swaps this card with its neighbour (manual order). */
  onReorder?: (taskId: string, direction: "up" | "down") => void;
  /** When true, renders the card in the minimal (title + category only) layout. */
  compactView?: boolean;
  /** Briefly ring the card when it is the target of an activity navigation. */
  spotlight?: boolean;
}

export interface BoardSelectionContextValue {
  selectMode: boolean;
  coarsePointer?: boolean;
  toggleTask: (id: string, shiftKey?: boolean) => void;
  isSelected: (id: string) => boolean;
  isHighlighted: (id: string) => boolean;
}

const BoardSelectionContext = createContext<BoardSelectionContextValue | null>(null);

export function BoardSelectionProvider({
  value,
  children,
}: {
  value: BoardSelectionContextValue;
  children: ReactNode;
}) {
  return <BoardSelectionContext.Provider value={value}>{children}</BoardSelectionContext.Provider>;
}

export function useBoardSelection(): BoardSelectionContextValue | null {
  return useContext(BoardSelectionContext);
}

/**
 * A task card that can be dragged between board columns.
 *
 * The whole card is the drag surface: `TaskCard` only renders a slot for a grip
 * handle in its non-compact (list) layout, so a grip here would never show. The
 * dnd listeners therefore live on the wrapper that also carries `setNodeRef`,
 * which is dnd-kit's standard whole-node-as-activator pattern. The 6px pointer
 * activation constraint in `board-view.tsx` still lets a plain click through, so
 * the title opens the edit dialog and the card's own buttons still fire.
 */
export function BoardCard({
  task,
  now,
  onEdit,
  reorderIndex,
  reorderTotal,
  onReorder,
  compactView = false,
  spotlight = false,
}: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "card" },
    // Layout-change animations recompute derived transforms inside a layout
    // effect (dnd-kit useDerivedTransform) that can loop on container moves.
    // Disabling them removes that recompute path entirely; the sorting
    // strategy still animates siblings into the gap while dragging.
    animateLayoutChanges: () => false,
  });
  const { sections, assignTaskToSection } = useTasksContext();
  const selection = useBoardSelection();
  const selectionMode = selection?.selectMode ?? false;
  const selected = selection?.isSelected(task.id) ?? false;

  function handleTouchSelection(event: React.MouseEvent<HTMLButtonElement>): void {
    if (!selection) return;
    event.preventDefault();
    event.stopPropagation();
    selection.toggleTask(task.id, event.shiftKey);
  }

  function handleCardSelection(event: React.MouseEvent<HTMLDivElement>): void {
    if (!selection) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("button, input, textarea, select, a, [role='menu']") &&
      !target.closest("[data-card-title]")
    ) {
      return;
    }
    if (!selectionMode && !event.ctrlKey && !event.metaKey && !event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    selection.toggleTask(task.id, event.shiftKey);
  }

  return (
    <div
      ref={setNodeRef}
      {...(selectionMode ? {} : listeners)}
      {...(selectionMode ? {} : attributes)}
      data-task-id={task.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClickCapture={handleCardSelection}
      onDoubleClickCapture={(event) => {
        if (!selectionMode) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      className={cn(
        "relative min-w-0 cursor-grab transition-opacity active:cursor-grabbing",
        selection?.coarsePointer ? "touch-auto" : "touch-none",
        selectionMode && "cursor-pointer",
        isDragging && "opacity-40",
      )}
    >
      {selection?.coarsePointer ? (
        <button
          type="button"
          aria-label={selected ? `Deselect "${task.title}"` : `Select "${task.title}"`}
          aria-pressed={selected}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={handleTouchSelection}
          className="touch-target focus-ring absolute left-2 top-2 z-10 grid h-10 w-10 place-items-center rounded-lg bg-card/90 text-primary shadow-sm ring-1 ring-inset ring-border backdrop-blur-sm"
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid h-5 w-5 place-items-center rounded border-2 transition-colors",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/60 bg-transparent",
            )}
          >
            {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
          </span>
        </button>
      ) : null}
      <TaskCard
        task={task}
        now={now}
        onEdit={onEdit}
        compact
        compactView={compactView}
        spotlight={spotlight}
        sections={sections}
        assignTaskToSection={assignTaskToSection}
        selected={selected}
        highlighted={selection?.isHighlighted(task.id)}
        reorderIndex={reorderIndex}
        reorderTotal={reorderTotal}
        onReorder={onReorder}
      />
    </div>
  );
}
