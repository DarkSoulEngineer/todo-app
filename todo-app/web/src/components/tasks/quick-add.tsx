"use client";

import { Plus, Sparkles } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CategoryPill, PriorityPill } from "@/components/tasks/task-badges";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { Button } from "@/components/ui/button";
import { parseQuickAdd, quickAddToDraft } from "@/lib/features/quick-add";
import { describeDue } from "@/lib/domain/status";
import { cn } from "@/lib/utils/utils";

/** Natural-language quick add: "Buy milk tomorrow 5pm !high #home". */
export function QuickAdd({ now, variant = "card" }: { now: Date; variant?: "card" | "inline" }) {
  const { addTask } = useTasksContext();
  const [value, setValue] = useState("");

  const parsed = useMemo(() => parseQuickAdd(value, now), [value, now]);
  const trimmed = value.trim();
  const inline = variant === "inline";

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!trimmed) return;
    const task = addTask(quickAddToDraft(parsed));
    setValue("");
    toast.success("Task added", { description: task.title, duration: 2500 });
  }

  const due = describeDue(parsed.dueAt, now);

  return (
    <form
      onSubmit={submit}
      className={cn(
        "min-w-0",
        inline
          ? "rounded-xl"
          : "rounded-2xl border border-border bg-card/80 p-2 shadow-sm backdrop-blur-sm",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-lg bg-primary/10 text-primary",
            inline ? "h-8 w-8" : "h-9 w-9 rounded-xl",
          )}
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder='Add a task… try "Pay rent tomorrow 5pm !high #home"'
          aria-label="Quick add a task"
          className={cn(
            "focus-ring min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70",
            inline ? "h-8" : "h-9",
          )}
        />
        <Button type="submit" size="sm" disabled={!trimmed} className="shrink-0">
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add
        </Button>
      </div>

      {trimmed ? (
        <div
          className={cn(
            "mt-2 flex flex-wrap items-center gap-2 px-1",
            !inline && "border-t border-border/60 pt-2",
          )}
        >
          <span className="text-xs text-muted-foreground">Adding:</span>
          <span className="text-xs font-semibold text-foreground">{parsed.title}</span>
          <PriorityPill priority={parsed.priority} />
          {parsed.category ? <CategoryPill categoryId={parsed.category} /> : null}
          {due ? <span className="text-xs font-medium text-muted-foreground">{due.label}</span> : null}
        </div>
      ) : inline ? null : (
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">
          Add details as you type:{" "}
          <span className="font-mono text-foreground/80">!high</span> ·{" "}
          <span className="font-mono text-foreground/80">#home</span> ·{" "}
          <span className="font-mono text-foreground/80">tomorrow 5pm</span>
        </p>
      )}
    </form>
  );
}
