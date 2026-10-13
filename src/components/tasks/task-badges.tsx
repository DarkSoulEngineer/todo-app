"use client";

import { Clock } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { getCategory } from "@/lib/domain/categories";
import { boardColor } from "@/lib/domain/boards";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { PRIORITY_META } from "@/lib/domain/constants";
import { deriveStatus, describeDue, STATUS_META } from "@/lib/domain/status";
import type { Priority, Task } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

export function PriorityPill({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return (
    <Chip className={cn("gap-1.5 ring-inset", meta.pill)}>
      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", meta.dot)} />
      {meta.label}
    </Chip>
  );
}

export function CategoryPill({ categoryId }: { categoryId: string }) {
  const { boards } = useTasksContext();
  // Resolve from the user's boards first (includes custom boards); fall back
  // to the built-in category map for safety when a board is missing.
  const board = boards.find((entry) => entry.id === categoryId) ?? null;
  const builtIn = board ? null : getCategory(categoryId);
  const pill = board ? boardColor(board.color).pill : builtIn?.pill;
  const dot = board ? boardColor(board.color).dot : builtIn?.dot;
  const label = board?.label ?? builtIn?.label;
  if (!pill || !dot || !label) return null;
  return (
    <Chip className={cn("gap-1.5 ring-inset", pill)}>
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
      {label}
    </Chip>
  );
}

export function StatusPill({ task, now }: { task: Task; now: Date }) {
  const status = deriveStatus(task, now);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Chip className={cn("gap-1 ring-inset", meta.chip)}>
      <Icon className="h-3 w-3" strokeWidth={2.6} />
      {meta.label}
    </Chip>
  );
}

export function DueBadge({ task, now }: { task: Task; now: Date }) {
  const info = describeDue(task.dueAt, now);
  if (!info) return null;

  const settled = task.completed || task.canceled;
  // Same tint recipe as the status/priority pills so the meta row reads as one
  // language: neutral by default, amber when due today, red once overdue.
  const tone = settled
    ? "bg-muted text-muted-foreground ring-border"
    : info.overdue
      ? "bg-red-500/12 text-red-700 ring-red-500/25 dark:text-red-300"
      : info.today
        ? "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300"
        : "bg-muted text-muted-foreground ring-border";

  return (
    <Chip className={cn("gap-1 ring-inset", tone)} title={info.title}>
      <Clock className="h-3 w-3" strokeWidth={2.4} />
      <span className="tabular-nums">{info.label}</span>
    </Chip>
  );
}
