"use client";

import { useMemo } from "react";
import { InsightsPanel } from "@/components/insights-panel";
import { StatsDashboard } from "@/components/stats-dashboard";
import { useTasksContext } from "@/components/tasks-provider";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

/** Dedicated dashboard: headline stats, the 7-day trend and a category breakdown. */
export function InsightsView({ now }: { now: Date }) {
  const { tasks } = useTasksContext();

  const rows = useMemo(() => {
    const total = tasks.length || 1;
    return CATEGORIES.map((category) => {
      const count = tasks.filter((task) => task.category === category.id).length;
      return { category, count, ratio: count / total };
    })
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [tasks]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <StatsDashboard now={now} />
        <InsightsPanel now={now} />
      </div>

      {rows.length > 0 ? (
        <section
          aria-label="Tasks by category"
          className="rounded-2xl border border-border/70 bg-card/70 p-5"
        >
          <h2 className="font-display text-lg tracking-tight">By category</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Where your tasks live right now.</p>
          <ul className="mt-4 space-y-3">
            {rows.map(({ category, count, ratio }) => (
              <li key={category.id} className="flex items-center gap-3">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", category.dot)} />
                <span className="w-24 shrink-0 truncate text-sm font-medium">{category.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn("block h-full rounded-full", category.dot)}
                    style={{ width: `${Math.max(ratio * 100, 4)}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
