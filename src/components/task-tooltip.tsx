"use client";

import type { ReactElement } from "react";
import { CategoryPill, DueBadge, PriorityPill, StatusPill } from "@/components/task-badges";
import { RichTooltip, type TooltipTriggerProps } from "@/components/ui/tooltip";
import type { Task } from "@/lib/types";

interface TaskTooltipProps {
  task: Task;
  now: Date;
  /** Render prop receiving the handlers/attributes to spread on the trigger. */
  children: (triggerProps: TooltipTriggerProps) => ReactElement;
  side?: "top" | "bottom";
}

/** Rich hover/focus tooltip revealing a task's full details. */
export function TaskTooltip({ task, now, children, side }: TaskTooltipProps) {
  return (
    <RichTooltip side={side} content={<TaskTooltipPanel task={task} now={now} />}>
      {children}
    </RichTooltip>
  );
}

export function TaskTooltipPanel({ task, now }: { task: Task; now: Date }) {
  const totalSubtasks = task.subtasks.length;
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold tracking-tight break-words text-foreground">{task.title}</p>

      {task.description ? (
        <p className="text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
          {task.description}
        </p>
      ) : null}

      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <StatusPill task={task} now={now} />
        <PriorityPill priority={task.priority} />
        {task.category ? <CategoryPill categoryId={task.category} /> : null}
        <DueBadge task={task} now={now} />
      </div>

      {totalSubtasks > 0 ? (
        <p className="font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
          {doneSubtasks}/{totalSubtasks} checklist items done
        </p>
      ) : null}
    </div>
  );
}
