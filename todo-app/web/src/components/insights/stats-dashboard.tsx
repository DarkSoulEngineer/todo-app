"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock, Check, ListTodo, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { computeStats } from "@/lib/domain/tasks-selectors";
import { cn } from "@/lib/utils/utils";
import type { Task } from "@/lib/domain/types";
import type { InsightsFilters } from "@/lib/features/insights-filters";
import { filterTasksByFilters } from "@/lib/features/insights-filters";

interface StatsDashboardProps {
  now: Date;
  filters: InsightsFilters;
}

interface TileProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number;
  tone: string;
}

function StatTile({ icon: Icon, label, value, tone }: TileProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
      <div className={cn("mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg", tone)}>
        <Icon className="h-4 w-4" strokeWidth={2.4} />
      </div>
      <p className="font-display text-2xl leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function computeFilteredStats(tasks: Task[], filters: InsightsFilters, now: Date) {
  return computeStats(filterTasksByFilters(tasks, filters, now), now);
}

export function StatsDashboard({ now, filters }: StatsDashboardProps) {
  const { tasks } = useTasksContext();
  const reduceMotion = useReducedMotion();

  const days = useMemo(() => {
    switch (filters.dateRange) {
      case "7d":
        return 7;
      case "30d":
        return 30;
      case "90d":
        return 90;
      case "custom":
        if (filters.customStart && filters.customEnd) {
          const diff = filters.customEnd.getTime() - filters.customStart.getTime();
          return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
        }
        return 7;
      default:
        return 7;
    }
  }, [filters]);

  const currentStats = useMemo(() => computeFilteredStats(tasks, filters, now), [tasks, filters, now]);

  const percent = Math.round(currentStats.completionRate * 100);

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - currentStats.completionRate);

  // Average per day
  const avgPerDay = days > 0 ? Math.round(currentStats.completed / days) : 0;

  return (
    <section
      aria-label="Progress overview"
      className="rounded-3xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur-sm sm:p-6"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex items-center gap-4">
          <div className="relative grid h-24 w-24 shrink-0 place-items-center">
            <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="fill-none stroke-muted"
                strokeWidth="7"
              />
              <motion.circle
                cx="40"
                cy="40"
                r={radius}
                className="fill-none stroke-primary"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={false}
                animate={{ strokeDashoffset: dashOffset }}
                transition={
                  reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 24 }
                }
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <span className="font-display text-2xl tabular-nums">{percent}%</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Completion
            </p>
            <p className="mt-1 font-display text-2xl leading-tight">
              {currentStats.completed}/{currentStats.total} done
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {currentStats.active} open · {currentStats.canceled} canceled
            </p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            icon={TriangleAlert}
            label="Overdue"
            value={currentStats.overdue}
            tone="bg-destructive/12 text-destructive"
          />
          <StatTile
            icon={CalendarClock}
            label="Upcoming"
            value={currentStats.upcoming}
            tone="bg-info/12 text-info"
          />
          <StatTile
            icon={Check}
            label="Completed"
            value={currentStats.completed}
            tone="bg-success/12 text-success"
          />
          <StatTile
            icon={ListTodo}
            label="Total tasks"
            value={currentStats.total}
            tone="bg-primary/12 text-primary"
          />
          <StatTile
            icon={CalendarClock}
            label="Avg/day"
            value={avgPerDay}
            tone="bg-accent text-accent-foreground"
          />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Overall progress</span>
          <span className="tabular-nums">{percent}% complete</span>
        </div>
        <Progress value={currentStats.completionRate} label="Overall completion" />
      </div>
    </section>
  );
}
