"use client";

import { format } from "date-fns";
import { Plus } from "lucide-react";
import { TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { pluralize } from "@/lib/utils/utils";
import type { Task } from "@/lib/domain/types";

interface DayDialogProps {
  /** The selected day, or null when the dialog is closed. */
  date: Date | null;
  tasks: Task[];
  now: Date;
  onEdit: (task: Task) => void;
  onCreate: (date: Date) => void;
  onClose: () => void;
}

/** Every task scheduled on a single day, with an affordance to add another. */
export function DayDialog({ date, tasks, now, onEdit, onCreate, onClose }: DayDialogProps) {
  return (
    <Dialog
      open={date !== null}
      onClose={onClose}
      title={date ? format(date, "EEEE, MMMM d") : "Tasks"}
      description={date ? `${pluralize(tasks.length, "task")} scheduled` : undefined}
    >
      {date ? (
        <div className="flex flex-col gap-4">
          <Button
            variant="secondary"
            onClick={() => {
              const day = date;
              onClose();
              onCreate(day);
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add task on this day
          </Button>

          {tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing scheduled for this day yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {tasks.map((task) => (
                <li key={task.id}>
                  <TaskCard
                    task={task}
                    now={now}
                    onEdit={(item) => {
                      onClose();
                      onEdit(item);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
