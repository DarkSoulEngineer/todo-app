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
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BoardCard } from "@/components/board-card";
import { CategoryPill, DueBadge, PriorityPill } from "@/components/task-badges";
import { useTasksContext } from "@/components/tasks-provider";
import { rescheduleToNextDay } from "@/lib/datetime";
import { deriveStatus, STATUS_META } from "@/lib/status";
import { sortTasks } from "@/lib/tasks-selectors";
import type { SortKey, Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMNS: TaskStatus[] = ["upcoming", "overdue", "completed", "canceled"];

interface BoardViewProps {
  /** Tasks filtered by search + category (all statuses). */
  tasks: Task[];
  now: Date;
  sort: SortKey;
  onEdit: (task: Task) => void;
}

/**
 * Kanban board. Dragging a card between columns changes its status: dropping on
 * Completed marks it done, Canceled cancels it, and an open column restores it
 * (an overdue task dropped on Upcoming is nudged to tomorrow so it lands there).
 */
export function BoardView({ tasks, now, sort, onEdit }: BoardViewProps) {
  const { setTaskStatus, setTaskDueAt } = useTasksContext();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const columns = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      upcoming: [],
      overdue: [],
      completed: [],
      canceled: [],
    };
    for (const task of tasks) map[deriveStatus(task, now)].push(task);
    for (const status of COLUMNS) map[status] = sortTasks(map[status], sort);
    return map;
  }, [tasks, now, sort]);

  const activeTask = activeId ? (tasks.find((task) => task.id === activeId) ?? null) : null;

  function handleDragEnd(event: DragEndEvent): void {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const targetId = String(over.id);
    if (!targetId.startsWith("col:")) return;
    const target = targetId.slice(4) as TaskStatus;

    const taskId = String(active.id);
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const current = deriveStatus(task, now);
    if (current === target) return;

    if (target === "completed") {
      setTaskStatus(taskId, "completed");
      toast.success("Marked completed", {
        duration: 3000,
        action: { label: "Undo", onClick: () => setTaskStatus(taskId, "open") },
      });
    } else if (target === "canceled") {
      setTaskStatus(taskId, "canceled");
      toast("Task canceled", {
        duration: 3000,
        action: { label: "Undo", onClick: () => setTaskStatus(taskId, "open") },
      });
    } else {
      setTaskStatus(taskId, "open");
      if (target === "upcoming" && current === "overdue") {
        setTaskDueAt(taskId, rescheduleToNextDay(task.dueAt, now));
        toast.success("Moved to Upcoming", { description: "Rescheduled to tomorrow." });
      } else {
        toast("Task restored", { duration: 2500 });
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {COLUMNS.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            tasks={columns[status]}
            now={now}
            onEdit={onEdit}
            className="w-[17rem] shrink-0 snap-start sm:w-72 xl:w-auto xl:min-w-0 xl:flex-1"
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <BoardCardPreview task={activeTask} now={now} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

interface BoardColumnProps {
  status: TaskStatus;
  tasks: Task[];
  now: Date;
  onEdit: (task: Task) => void;
  className?: string;
}

function BoardColumn({ status, tasks, now, onEdit, className }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}`, data: { status } });
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <section
      ref={setNodeRef}
      aria-label={meta.label}
      className={cn(
        "flex min-h-[13rem] min-w-0 flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-2.5 transition-colors",
        isOver && "bg-primary/5 ring-2 ring-primary/30",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset", meta.chip)}>
            <Icon className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <h2 className="truncate text-sm font-semibold">{meta.label}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums ring-1 ring-inset ring-border">
          {tasks.length}
        </span>
      </header>

      <div className="flex min-w-0 flex-col gap-2.5">
        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Drop tasks here
          </p>
        ) : null}
        {tasks.map((task) => (
          <BoardCard key={task.id} task={task} now={now} onEdit={onEdit} />
        ))}
      </div>
    </section>
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
