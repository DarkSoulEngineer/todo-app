"use client";

import { useDroppable } from "@dnd-kit/core";
import { format, isSameDay, isSameMonth } from "date-fns";
import { CalendarTaskChip } from "@/components/calendar-task-chip";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type CalendarMode = "month" | "week";

interface CalendarGridProps {
  days: Date[];
  cursor: Date;
  mode: CalendarMode;
  /** Keyed by "yyyy-MM-dd". */
  tasksByDay: Map<string, Task[]>;
  now: Date;
  onEdit: (task: Task) => void;
  onCreateOn: (date: Date) => void;
  onOpenDay: (date: Date) => void;
}

export function CalendarGrid({
  days,
  cursor,
  mode,
  tasksByDay,
  now,
  onEdit,
  onCreateOn,
  onOpenDay,
}: CalendarGridProps) {
  return (
    <div
      role="grid"
      aria-label={mode === "week" ? "Week view" : "Month view"}
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div role="row" className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="px-2 py-2 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => (
          <DayCell
            key={format(day, "yyyy-MM-dd")}
            day={day}
            mode={mode}
            inMonth={mode === "week" || isSameMonth(day, cursor)}
            isToday={isSameDay(day, now)}
            tasks={tasksByDay.get(format(day, "yyyy-MM-dd")) ?? []}
            now={now}
            onEdit={onEdit}
            onCreateOn={onCreateOn}
            onOpenDay={onOpenDay}
          />
        ))}
      </div>
    </div>
  );
}

interface DayCellProps {
  day: Date;
  mode: CalendarMode;
  inMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  now: Date;
  onEdit: (task: Task) => void;
  onCreateOn: (date: Date) => void;
  onOpenDay: (date: Date) => void;
}

function DayCell({
  day,
  mode,
  inMonth,
  isToday,
  tasks,
  now,
  onEdit,
  onCreateOn,
  onOpenDay,
}: DayCellProps) {
  const key = format(day, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: `day:${key}`, data: { date: day } });

  // Reserve a row for the "+N more" affordance so the cell never overflows.
  const slots = mode === "week" ? 6 : 3;
  const hasOverflow = tasks.length > slots;
  const visible = tasks.slice(0, hasOverflow ? slots - 1 : slots);
  const overflow = tasks.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      className={cn(
        "relative flex min-w-0 flex-col gap-1 overflow-hidden border-r border-b border-border p-1.5 transition-colors [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0",
        mode === "week" ? "h-[15rem]" : "h-[8.5rem]",
        !inMonth && "bg-muted/30",
        isToday && "bg-primary/[0.06]",
        isOver && "bg-primary/[0.09] ring-2 ring-inset ring-primary/40",
      )}
    >
      {/* Fills the cell so a click on empty space opens the create dialog. */}
      <button
        type="button"
        onClick={() => onCreateOn(day)}
        aria-label={`Add task on ${format(day, "EEEE, MMMM d")}`}
        className="focus-ring absolute inset-0 z-0 rounded-sm"
      />

      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-semibold tabular-nums",
              isToday
                ? "bg-primary text-primary-foreground"
                : inMonth
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {format(day, "d")}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
          {visible.map((task) => (
            <CalendarTaskChip key={task.id} task={task} now={now} onEdit={onEdit} />
          ))}

          {overflow > 0 ? (
            <button
              type="button"
              onClick={() => onOpenDay(day)}
              className="focus-ring pointer-events-auto w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              +{overflow} more
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
