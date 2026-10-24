"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock, Check, ListTodo, TriangleAlert, TrendingUp } from "lucide-react";
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
  change?: number | null;
}

function StatTile({ icon: Icon, label, value, tone, change }: TileProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
      <div className={cn("mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg", tone)}>
        <Icon className="h-4 w-4" strokeWidth={2.4} />
      </div>
      <p className="font-display text-2xl leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
      {change !== null && change !== undefined && (
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-success">
          <TrendingUp className="h-3 w-3" strokeWidth={2.8} />
          <span className="tabular-nums">{change > 0 ? "+" : ""}{change}%</span>
          <span className="text-muted-foreground">vs prev</span>
        </p>
      )}
    </div>
  );
}

function computeFilteredStats(tasks: Task[], filters: InsightsFilters, now: Date) {
  return computeStats(filterTasksByFilters(tasks, filters, now), now);
}

function computePreviousPeriodStats(tasks: Task[], filters: InsightsFilters, now: Date, days: number) {
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - (days - 1));
  const currentEnd = new Date(now);
  currentEnd.setHours(23, 59, 59, 999);

  const prevEnd = new Date(currentStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  prevStart.setHours(0, 0, 0, 0);

  // Filter tasks completed in previous window
  const prevTasks = tasks.filter((task) => {
    if (!task.completed || !task.completedAt) return false;
    const completedDate = new Date(task.completedAt);
    return completedDate >= prevStart && completedDate <= prevEnd;
  });

  // Also apply board/priority filters
  const filtered = prevTasks.filter((task) => {
    if (filters.boardId !== "all" && task.category !== filters.boardId) return false;
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;
    return true;
  });

  return computeStats(filtered, new Date(prevEnd));
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
  const previousStats = useMemo(() => computePreviousPeriodStats(tasks, filters, now, days), [tasks, filters, now, days]);

  const percent = Math.round(currentStats.completionRate * 100);
  const prevPercent = Math.round(previousStats.completionRate * 100);
  const completionChange = prevPercent === 0 ? (percent > 0 ? 100 : null) : Math.round(((percent - prevPercent) / prevPercent) * 100);

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - currentStats.completionRate);

  // Compute tile values with period comparison
  const overdueChange = previousStats.overdue === 0 ? (currentStats.overdue > 0 ? 100 : null) : Math.round(((currentStats.overdue - previousStats.overdue) / previousStats.overdue) * 100);
  const upcomingChange = previousStats.upcoming === 0 ? (currentStats.upcoming > 0 ? 100 : null) : Math.round(((currentStats.upcoming - previousStats.upcoming) / previousStats.upcoming) * 100);
  const completedChange = previousStats.completed === 0 ? (currentStats.completed > 0 ? 100 : null) : Math.round(((currentStats.completed - previousStats.completed) / previousStats.completed) * 100);
  const totalChange = previousStats.total === 0 ? (currentStats.total > 0 ? 100 : null) : Math.round(((currentStats.total - previousStats.total) / previousStats.total) * 100);

  // Average per day
  const avgPerDay = days > 0 ? Math.round(currentStats.completed / days) : 0;
  const prevAvgPerDay = days > 0 ? Math.round(previousStats.completed / days) : 0;
  const avgChange = prevAvgPerDay === 0 ? (avgPerDay > 0 ? 100 : null) : Math.round(((avgPerDay - prevAvgPerDay) / prevAvgPerDay) * 100);

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
              {completionChange !== null && (
                <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-success">
                  <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.8} />
                  {completionChange > 0 ? "+" : ""}{completionChange}%
                </span>
              )}
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
            change={overdueChange}
          />
          <StatTile
            icon={CalendarClock}
            label="Upcoming"
            value={currentStats.upcoming}
            tone="bg-info/12 text-info"
            change={upcomingChange}
          />
          <StatTile
            icon={Check}
            label="Completed"
            value={currentStats.completed}
            tone="bg-success/12 text-success"
            change={completedChange}
          />
          <StatTile
            icon={ListTodo}
            label="Total tasks"
            value={currentStats.total}
            tone="bg-primary/12 text-primary"
            change={totalChange}
          />
          <StatTile
            icon={CalendarClock}
            label="Avg/day"
            value={avgPerDay}
            tone="bg-accent text-accent-foreground"
            change={avgChange}
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
