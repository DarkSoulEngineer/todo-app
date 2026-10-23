"use client";

import { Check, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Progress } from "@/components/ui/progress";
import { useTasksContext } from "@/components/providers/tasks-provider";
import type { Task } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

export function SubtaskList({ task }: { task: Task }) {
  const { toggleSubtask, addSubtask, removeSubtask } = useTasksContext();
  const [draft, setDraft] = useState("");

  const total = task.subtasks.length;
  const done = task.subtasks.filter((subtask) => subtask.done).length;
  const rate = total === 0 ? 0 : done / total;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    addSubtask(task.id, draft);
    setDraft("");
  }

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-3">
      {total > 0 ? (
        <div className="mb-2.5 flex items-center gap-2">
          <Progress
            value={rate}
            tone={rate === 1 ? "bg-emerald-500" : "bg-primary"}
            label="Subtask progress"
          />
          <span className="shrink-0 font-mono text-[11px] font-semibold text-muted-foreground tabular-nums">
            {done}/{total}
          </span>
        </div>
      ) : null}

      <ul className="space-y-1">
        {task.subtasks.map((subtask) => (
          <li key={subtask.id} className="group/sub flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggleSubtask(task.id, subtask.id)}
              aria-pressed={subtask.done}
              aria-label={subtask.done ? `Mark "${subtask.title}" as not done` : `Mark "${subtask.title}" as done`}
              className={cn(
                "focus-ring grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border-2 transition-colors",
                // Matches the card's complete toggle: success green when done.
                subtask.done
                  ? "border-success bg-success text-white"
                  : "border-border hover:border-primary",
              )}
            >
              {subtask.done ? <Check className="h-2.5 w-2.5" strokeWidth={4} /> : null}
            </button>
            <span
              className={cn(
                "flex-1 text-sm",
                subtask.done ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground",
              )}
            >
              {subtask.title}
            </span>
            <button
              type="button"
              onClick={() => removeSubtask(task.id, subtask.id)}
              aria-label={`Remove subtask "${subtask.title}"`}
              className="focus-ring grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground/60 opacity-0 transition-[opacity,background-color,color] group-hover/sub:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-2 flex items-center gap-2">
        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a step…"
          aria-label="Add a subtask"
          className="focus-ring h-7 min-w-0 flex-1 rounded-md bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70"
        />
        {draft.trim() ? (
          <button type="submit" className="focus-ring rounded-md px-2 py-1 text-xs font-semibold text-primary">
            Add
          </button>
        ) : null}
      </form>
    </div>
  );
}
