"use client";

import { TaskList } from "@/components/task-list";
import { groupForList } from "@/lib/smart-lists";
import type { SmartList, Task } from "@/lib/types";

interface ListViewProps {
  /** Already filtered and sorted for the active smart list. */
  tasks: Task[];
  list: SmartList;
  now: Date;
  sortable: boolean;
  onEdit: (task: Task) => void;
}

/** Sectioned task rows grouped by due-date bucket. */
export function ListView({ tasks, list, now, sortable, onEdit }: ListViewProps) {
  const groups = groupForList(tasks, list, now);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.id} aria-label={group.label} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
              {group.tasks.length}
            </span>
          </div>
          <TaskList tasks={group.tasks} now={now} sortable={sortable} onEdit={onEdit} />
        </section>
      ))}
    </div>
  );
}
