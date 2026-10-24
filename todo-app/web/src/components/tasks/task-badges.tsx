"use client";

import { Clock } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { getCategory } from "@/lib/domain/categories";
import { boardColor } from "@/lib/domain/boards";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { PRIORITY_META } from "@/lib/domain/constants";
import { STATUS_META } from "@/components/common/status-meta";
import { deriveStatus, describeDue } from "@/lib/domain/status";
import type { Priority, Task } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

export function PriorityPill({ priority, hideIcon = false }: { priority: Priority; hideIcon?: boolean }) {
  const meta = PRIORITY_META[priority];
  return (
    <Chip className={cn("gap-1.5 ring-inset", meta.pill)}>
      {!hideIcon ? <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", meta.dot)} /> : null}
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

export function StatusPill({ task, now, hideIcon = false }: { task: Task; now: Date; hideIcon?: boolean }) {
  const status = deriveStatus(task, now);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Chip className={cn("gap-1 ring-inset", meta.chip)}>
      {!hideIcon ? <Icon className="h-3 w-3" strokeWidth={2.6} /> : null}
      {meta.label}
    </Chip>
  );
}

export function DueBadge({ task, now, hideIcon = false }: { task: Task; now: Date; hideIcon?: boolean }) {
  const info = describeDue(task.dueAt, now);
  if (!info) return null;

  const settled = task.completed || task.canceled;
  // Same semantic tint recipe as the status/priority pills so the meta row
  // stays aligned with the active light or warm dark theme.
  const tone = settled
    ? "bg-muted text-muted-foreground ring-border"
    : info.overdue
      ? "bg-destructive/12 text-destructive ring-destructive/25"
      : info.today
        ? "bg-warning/12 text-warning ring-warning/25"
        : "bg-muted text-muted-foreground ring-border";

  return (
    <Chip className={cn("gap-1 ring-inset", tone)} title={info.title}>
      {!hideIcon ? <Clock className="h-3 w-3" strokeWidth={2.4} /> : null}
      <span className="tabular-nums">{info.label}</span>
    </Chip>
  );
}
