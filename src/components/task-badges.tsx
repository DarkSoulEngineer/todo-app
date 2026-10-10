"use client";

import { Clock } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { getCategory } from "@/lib/categories";
import { PRIORITY_META } from "@/lib/constants";
import { deriveStatus, describeDue, STATUS_META } from "@/lib/status";
import type { Priority, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PriorityPill({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return (
    <Chip className={cn("ring-inset", meta.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Chip>
  );
}

export function CategoryPill({ categoryId }: { categoryId: string }) {
  const category = getCategory(categoryId);
  if (!category) return null;
  return (
    <Chip className={cn("ring-inset", category.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", category.dot)} />
      {category.label}
    </Chip>
  );
}

export function StatusPill({ task, now }: { task: Task; now: Date }) {
  const status = deriveStatus(task, now);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Chip className={cn("ring-inset", meta.chip)}>
      <Icon className="h-3 w-3" strokeWidth={2.6} />
      {meta.label}
    </Chip>
  );
}

export function DueBadge({ task, now }: { task: Task; now: Date }) {
  const info = describeDue(task.dueAt, now);
  if (!info) return null;

  const settled = task.completed || task.canceled;
  const tone = settled
    ? "text-muted-foreground"
    : info.overdue
      ? "text-red-600 dark:text-red-400"
      : info.today
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs font-medium", tone)}
      title={info.title}
    >
      <Clock className="h-3.5 w-3.5" strokeWidth={2.2} />
      <span className="tabular-nums">{info.label}</span>
    </span>
  );
}
