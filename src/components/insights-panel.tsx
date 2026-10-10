"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Flame, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useTasksContext } from "@/components/tasks-provider";
import { computeInsights } from "@/lib/insights";
import { cn } from "@/lib/utils";

export function InsightsPanel({ now }: { now: Date }) {
  const { tasks } = useTasksContext();
  const reduceMotion = useReducedMotion();
  const insights = useMemo(() => computeInsights(tasks, now), [tasks, now]);
  const max = Math.max(1, insights.best);

  return (
    <section
      aria-label="Completion insights"
      className="flex flex-col rounded-3xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur-sm sm:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg tracking-tight">Insights</h2>
          <p className="text-xs text-muted-foreground">Completed over the last 7 days</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
          <Flame className="h-3.5 w-3.5" strokeWidth={2.4} />
          <span className="text-xs font-semibold tabular-nums">
            {insights.streak} day{insights.streak === 1 ? "" : "s"}
          </span>
        </span>
      </div>

      <div className="mt-auto flex items-end gap-2 sm:gap-3">
        {insights.points.map((point) => {
          const ratio = point.count / max;
          return (
            <div key={point.key} className="flex flex-1 flex-col items-center gap-2">
              <span className="h-3 text-[10px] font-semibold text-muted-foreground tabular-nums">
                {point.count || ""}
              </span>
              <div className="flex h-24 w-full items-end justify-center">
                <motion.div
                  className={cn(
                    "w-full max-w-9 rounded-t-md",
                    point.count > 0 ? "bg-primary" : "bg-muted",
                  )}
                  style={{ minHeight: 4 }}
                  title={`${point.count} completed`}
                  initial={false}
                  animate={{ height: point.count > 0 ? `${Math.max(ratio * 100, 12)}%` : "6%" }}
                  transition={
                    reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 28 }
                  }
                />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="font-medium">
          {insights.weekTotal} completed this week
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" />
          Best day {insights.best}
        </span>
      </div>
    </section>
  );
}
