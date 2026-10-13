"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarRange, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarGrid, type CalendarMode } from "@/components/calendar/calendar-grid";
import { CalendarTaskChip } from "@/components/calendar/calendar-task-chip";
import { DayDialog } from "@/components/calendar/day-dialog";
import { Button } from "@/components/ui/button";
import { dismissTooltips } from "@/components/ui/tooltip";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { rescheduleToDay } from "@/lib/utils/datetime";
import { sortTasks } from "@/lib/domain/tasks-selectors";
import type { Task } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

interface CalendarViewProps {
  /** Tasks filtered by search + category. */
  tasks: Task[];
  now: Date;
  onEdit: (task: Task) => void;
  onCreateOn: (date: Date) => void;
}

export function CalendarView({ tasks, now, onEdit, onCreateOn }: CalendarViewProps) {
  const { setTaskDueAt } = useTasksContext();
  const [cursor, setCursor] = useState<Date>(() => new Date(now));
  const [mode, setMode] = useState<CalendarMode>("month");
  const [dayDialogDate, setDayDialogDate] = useState<Date | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const days = useMemo(() => {
    if (mode === "week") {
      return eachDayOfInterval({
        start: startOfWeek(cursor, { weekStartsOn: 1 }),
        end: endOfWeek(cursor, { weekStartsOn: 1 }),
      });
    }
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
    });
  }, [cursor, mode]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueAt) continue;
      const due = parseISO(task.dueAt);
      if (Number.isNaN(due.getTime())) continue;
      const key = format(due, "yyyy-MM-dd");
      const list = map.get(key);
      if (list) list.push(task);
      else map.set(key, [task]);
    }
    for (const [key, list] of map) map.set(key, sortTasks(list, "due"));
    return map;
  }, [tasks]);

  const title =
    mode === "week"
      ? `${format(days[0], "MMM d")} – ${format(days[days.length - 1], "MMM d, yyyy")}`
      : format(cursor, "MMMM yyyy");

  const shift = (delta: number): void => {
    setCursor((prev) => (mode === "week" ? addWeeks(prev, delta) : addMonths(prev, delta)));
  };

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const targetId = String(over.id);

    if (targetId === "tray") {
      if (task.dueAt) {
        setTaskDueAt(taskId, null);
        toast("Due date removed", { description: task.title, duration: 2500 });
      }
      return;
    }

    if (targetId.startsWith("day:")) {
      const day = parseISO(targetId.slice(4));
      if (Number.isNaN(day.getTime())) return;
      setTaskDueAt(taskId, rescheduleToDay(day, task.dueAt));
      toast.success("Rescheduled", { description: format(day, "EEE, MMM d"), duration: 2000 });
    }
  }

  const dayTasks = dayDialogDate
    ? (tasksByDay.get(format(dayDialogDate, "yyyy-MM-dd")) ?? [])
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={mode === "week" ? "Previous week" : "Previous month"}
            className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-border bg-card/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={mode === "week" ? "Next week" : "Next month"}
            className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-border bg-card/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(now))}>
            Today
          </Button>
          <h2 className="ml-1.5 inline-flex items-center gap-2 font-display text-lg tracking-tight">
            <CalendarRange className="h-4 w-4 text-primary" />
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <Legend />
          <div
            role="tablist"
            aria-label="Calendar range"
            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card/70 p-0.5"
          >
            {(["month", "week"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "focus-ring rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors",
                  mode === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={() => dismissTooltips()}
        onDragEnd={handleDragEnd}
      >
        <CalendarGrid
          days={days}
          cursor={cursor}
          mode={mode}
          tasksByDay={tasksByDay}
          now={now}
          onEdit={onEdit}
          onCreateOn={onCreateOn}
          onOpenDay={setDayDialogDate}
        />
        <UnscheduledTray tasks={tasks} now={now} onEdit={onEdit} />
        <DragOverlay dropAnimation={null}>
          <DragChipPreview />
        </DragOverlay>
      </DndContext>

      <DayDialog
        date={dayDialogDate}
        tasks={dayTasks}
        now={now}
        onEdit={onEdit}
        onCreate={onCreateOn}
        onClose={() => setDayDialogDate(null)}
      />
    </div>
  );
}

function Legend() {
  const items = [
    { label: "Overdue", dot: "bg-red-500" },
    { label: "High", dot: "bg-orange-500" },
    { label: "Done", dot: "bg-emerald-500" },
    { label: "Canceled", dot: "bg-slate-400" },
  ];
  return (
    <ul className="hidden items-center gap-2.5 lg:flex" aria-label="Calendar legend">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", item.dot)} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function UnscheduledTray({ tasks, now, onEdit }: { tasks: Task[]; now: Date; onEdit: (task: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "tray" });
  const unscheduled = tasks.filter((task) => !task.dueAt);

  return (
    <section
      ref={setNodeRef}
      aria-label="Unscheduled tasks"
      className={cn(
        "mt-4 rounded-2xl border border-dashed border-border bg-muted/20 p-3 transition-colors",
        isOver && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Inbox className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Unscheduled</h2>
        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums ring-1 ring-inset ring-border">
          {unscheduled.length}
        </span>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          Drag onto a day to set a due date
        </span>
      </div>

      {unscheduled.length === 0 ? (
        <p className="text-xs text-muted-foreground">Every task has a due date. 🎈</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {unscheduled.map((task) => (
            <div key={task.id} className="w-40">
              <CalendarTaskChip task={task} now={now} onEdit={onEdit} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DragChipPreview() {
  return (
    <div className="flex w-40 items-center gap-1 rounded-md bg-card px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-lg ring-1 ring-primary/20">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      Moving…
    </div>
  );
}
