"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock, Check, ListTodo, TriangleAlert, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { useTasksContext } from "@/components/tasks-provider";
import { computeStats } from "@/lib/tasks-selectors";
import { cn } from "@/lib/utils";

interface StatsDashboardProps {
  now: Date;
}

interface TileProps {
  icon: LucideIcon;
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

export function StatsDashboard({ now }: StatsDashboardProps) {
  const { tasks } = useTasksContext();
  const reduceMotion = useReducedMotion();
  const stats = useMemo(() => computeStats(tasks, now), [tasks, now]);

  const percent = Math.round(stats.completionRate * 100);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - stats.completionRate);

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
              {stats.completed}/{stats.total} done
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {stats.active} open · {stats.canceled} canceled
            </p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            icon={TriangleAlert}
            label="Overdue"
            value={stats.overdue}
            tone="bg-red-500/12 text-red-600 dark:text-red-400"
          />
          <StatTile
            icon={CalendarClock}
            label="Upcoming"
            value={stats.upcoming}
            tone="bg-sky-500/12 text-sky-600 dark:text-sky-400"
          />
          <StatTile
            icon={Check}
            label="Completed"
            value={stats.completed}
            tone="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
          />
          <StatTile
            icon={ListTodo}
            label="Total tasks"
            value={stats.total}
            tone="bg-primary/12 text-primary"
          />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Overall progress</span>
          <span className="tabular-nums">{percent}% complete</span>
        </div>
        <Progress value={stats.completionRate} label="Overall completion" />
      </div>
    </section>
  );
}
