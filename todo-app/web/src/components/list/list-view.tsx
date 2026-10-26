"use client";

import { format } from "date-fns";
import { CategoryPill, DueBadge, PriorityPill, StatusPill } from "@/components/tasks/task-badges";
import type { Task } from "@/lib/domain/types";

interface ListViewProps {
  /** Already filtered and sorted for the active smart list. */
  tasks: Task[];
  /** Navigates to where the clicked task lives (its board section). */
  onOpenTask: (task: Task) => void;
  now: Date;
}

/**
 * Read-only activity feed grouped by day. Cards only navigate to where the
 * task lives: the view never adds, edits or deletes any data.
 */
export function ListView({ tasks, onOpenTask, now }: ListViewProps) {
  // The list view is presented as a changelog of board changes, ordered by the
  // most recent update. Each task is one change entry.
  const changelogEntries = [...tasks].sort((a, b) =>
    (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt),
  );
  const groupedByDay = new Map<string, Task[]>();
  for (const task of changelogEntries) {
    const stamp = task.updatedAt ?? task.createdAt;
    const day = format(new Date(stamp), "PP");
    if (!groupedByDay.has(day)) groupedByDay.set(day, []);
    groupedByDay.get(day)!.push(task);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <p className="text-sm text-muted-foreground">
          Recent activity on the board, newest first.
        </p>
      </div>

      {changelogEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          No changes yet.
        </div>
      ) : (
        [...groupedByDay.entries()].map(([day, entries]) => (
          <section key={day} className="flex flex-col gap-2">
            <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {day}
            </h3>
            <ul className="flex flex-col gap-2">
              {entries.map((task) => {
                const eventType = task.completed
                  ? "Completed"
                  : task.canceled
                    ? "Canceled"
                    : task.createdAt === (task.updatedAt ?? task.createdAt)
                      ? "Added"
                      : "Updated";
                const stamp = task.updatedAt ?? task.createdAt;
                return (
                  <li
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open "${task.title}"`}
                    onClick={() => onOpenTask(task)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenTask(task);
                      }
                    }}
                    className="focus-ring flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xs transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium tracking-tight">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {eventType} · {format(new Date(stamp), "p")}
                      </p>
                      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                        <StatusPill task={task} now={now} />
                        <PriorityPill priority={task.priority} />
                        <DueBadge task={task} now={now} />
                        {task.category ? <CategoryPill categoryId={task.category} /> : null}
                        {task.subtasks.length > 0 ? (
                          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                            {task.subtasks.filter((item) => item.done).length}/{task.subtasks.length} checklist
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
