"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import type { InsightsFilters } from "@/lib/insights-filters";
import type { Task } from "@/lib/types";
import { boardColor, DEFAULT_BOARD_COLOR, type Board } from "@/lib/boards";
import { getPriorityCounts, getWeekdayCompletionCounts, getCompletionDatesInWindow } from "@/lib/insights-filters";
import { windowStartFromPreset, windowEndFromPreset } from "@/lib/insights-filters";

type ChartTab = "categories" | "trends" | "priorities" | "weekdays";

interface ProductivityChartsProps {
  tasks: Task[];
  filters: InsightsFilters;
  boards: Board[];
  now: Date;
}

const TABS: { id: ChartTab; label: string }[] = [
  { id: "categories", label: "Categories" },
  { id: "trends", label: "Trends" },
  { id: "priorities", label: "Priorities" },
  { id: "weekdays", label: "Weekdays" },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ProductivityCharts({ tasks, filters, boards, now }: ProductivityChartsProps) {
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<ChartTab>("categories");
  const trendsRef = useRef<HTMLDivElement>(null);
  const [trendsHover, setTrendsHover] = useState<{ index: number; count: number; date: Date } | null>(null);

  const windowStart = windowStartFromPreset(now, filters.dateRange, filters.customStart);
  const windowEnd = windowEndFromPreset(now, filters.dateRange, filters.customEnd);
  const days = Math.ceil((windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Filter tasks based on current filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.boardId !== "all" && task.category !== filters.boardId) return false;
      if (filters.status !== "all") {
        const isCompleted = task.completed;
        const isCanceled = task.canceled;
        const isOverdue = !isCompleted && !isCanceled && task.dueAt && Date.parse(task.dueAt) < now.getTime();
        if (filters.status === "completed" && !isCompleted) return false;
        if (filters.status === "canceled" && !isCanceled) return false;
        if (filters.status === "overdue" && !isOverdue) return false;
      }
      if (filters.priority !== "all" && task.priority !== filters.priority) return false;
      return true;
    });
  }, [tasks, filters, now]);

  // Categories data
  const categoryData = useMemo(() => {
    const boardMap = new Map(boards.map((b) => [b.id, b]));
    const counts = new Map<string, number>();

    for (const task of filteredTasks) {
      if (!task.category) continue;
      counts.set(task.category, (counts.get(task.category) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([id, count]) => {
        const board = boardMap.get(id);
        return { id, label: board?.label || id, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredTasks, boards]);

  // Trends data - completion per day
  const trendsData = useMemo(() => {
    const completed = getCompletionDatesInWindow(filteredTasks, windowStart, windowEnd);
    const points: { date: Date; key: string; label: string; count: number }[] = [];

    for (let i = days - 1; i >= 0; i -= 1) {
      const day = new Date(windowEnd);
      day.setDate(day.getDate() - i);
      const count = completed.filter((d) => d.toDateString() === day.toDateString()).length;
      points.push({
        date: new Date(day),
        key: day.toISOString().split("T")[0],
        label: day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        count,
      });
    }
    return points;
  }, [filteredTasks, windowStart, windowEnd, days]);

  // Priorities data
  const priorityData = useMemo(() => getPriorityCounts(filteredTasks), [filteredTasks]);

  // Weekdays data
  const weekdayData = useMemo(() => getWeekdayCompletionCounts(filteredTasks, windowStart, windowEnd), [filteredTasks, windowStart, windowEnd]);

  const maxCategory = Math.max(1, ...categoryData.map((d) => d.count));
  const maxTrend = Math.max(1, ...trendsData.map((d) => d.count));
  const maxPriority = Math.max(1, ...Object.values(priorityData));

  // Render functions for each tab
  const renderCategories = () => (
    <div className="space-y-3" role="list" aria-label="Tasks by category">
      {categoryData.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No category data for current filters</p>
      ) : (
        categoryData.map(({ id, label, count }, index) => {
          const board = boards.find((b) => b.id === id);
          // Draw the dot from the board palette so chart swatches match the
          // board chips elsewhere. Complete static literals, never concatenated.
          const dot = boardColor(board?.color ?? DEFAULT_BOARD_COLOR).dot;
          const ratio = count / maxCategory;
          return (
            <motion.li
              key={id}
              className="flex items-center gap-3"
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={reduceMotion ? { duration: 0 } : { delay: index * 0.05, duration: 0.3 }}
            >
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dot)} />
              <span className="w-24 shrink-0 truncate text-sm font-medium">{label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <motion.span
                  className={cn("block h-full rounded-full", dot)}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(ratio * 100, 4)}%` }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 28, delay: index * 0.05 }}
                />
              </span>
              <span className="w-6 shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">{count}</span>
            </motion.li>
          );
        })
      )}
    </div>
  );

  const renderTrends = () => {
    if (trendsData.every((d) => d.count === 0)) {
      return (
        <div className="flex items-center justify-center h-48 text-center text-muted-foreground">
          <p className="text-sm">No completions in this period</p>
        </div>
      );
    }

    return (
      <div className="relative h-48" ref={trendsRef}>
        <svg className="w-full h-full" viewBox={`0 0 ${trendsData.length * 40} 100`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area */}
          <motion.path
            className="fill-url(#trendGradient)"
            d={trendsData
              .map((point, i) => {
                const x = i * 40 + 20;
                const y = 100 - (point.count / maxTrend) * 80;
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .concat([
                `L ${(trendsData.length - 1) * 40 + 20} 100`,
                `L ${20} 100`,
                "Z",
              ])
              .join(" ")}
            initial={false}
            animate={{ pathLength: 1 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 20, duration: 1 }}
          />

          {/* Line */}
          <motion.path
            className="stroke-primary stroke-2 fill-none"
            d={trendsData
              .map((point, i) => {
                const x = i * 40 + 20;
                const y = 100 - (point.count / maxTrend) * 80;
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ")}
            initial={false}
            animate={{ pathLength: 1 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 20, duration: 1, delay: 0.2 }}
          />

          {/* Points */}
          {trendsData.map((point, i) => {
            const x = i * 40 + 20;
            const y = 100 - (point.count / maxTrend) * 80;
            const isHovered = trendsHover?.index === i;
            return (
              <motion.circle
                key={point.key}
                cx={x}
                cy={y}
                r={isHovered ? 6 : 4}
                className="fill-primary stroke-background stroke-2 cursor-pointer transition-all"
                onMouseEnter={() => setTrendsHover({ index: i, count: point.count, date: point.date })}
                onMouseLeave={() => setTrendsHover(null)}
                initial={false}
                animate={{ r: isHovered ? 6 : 4 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 20 }}
              />
            );
          })}

          {/* Previous period line */}
          <motion.path
            className="stroke-primary/50 stroke-1.5 fill-none stroke-dasharray 4 4"
            d={trendsData
              .map((point, i) => {
                // We'd need previous period data here - simplified for now
                const x = i * 40 + 20;
                const y = 100 - (point.count / maxTrend) * 80 * 0.7; // approximate
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ")}
            initial={false}
            animate={{ pathLength: 1, opacity: 0.5 }}
            transition={reduceMotion ? { duration: 0 } : { delay: 0.4, duration: 0.8 }}
          />
        </svg>

        {/* Tooltip */}
        {trendsHover && (
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              left: `${(trendsHover.index * 40 + 20) / (trendsData.length * 40) * 100}%`,
              top: `${100 - (trendsHover.count / maxTrend) * 80 - 10}%`,
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="flex items-center gap-1.5 rounded-lg bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-lg ring-1 ring-border whitespace-nowrap">
              <span>{trendsHover.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
              <span className="tabular-nums">{trendsHover.count} completed</span>
            </div>
          </motion.div>
        )}
      </div>
    );
  };

  const renderPriorities = () => {
    const priorities: { key: "high" | "medium" | "low"; label: string; color: string; count: number }[] = [
      { key: "high", label: "High", color: "red", count: priorityData.high },
      { key: "medium", label: "Medium", color: "amber", count: priorityData.medium },
      { key: "low", label: "Low", color: "green", count: priorityData.low },
    ];

    return (
      <div className="space-y-3" role="list" aria-label="Tasks by priority">
        {priorities.every((p) => p.count === 0) ? (
          <p className="text-center text-sm text-muted-foreground py-8">No priority data for current filters</p>
        ) : (
          priorities.map(({ key, label, color, count }, index) => {
            const ratio = count / maxPriority;
            return (
              <motion.li
                key={key}
                className="flex items-center gap-3"
                initial={false}
                animate={{ opacity: 1, x: 0 }}
                transition={reduceMotion ? { duration: 0 } : { delay: index * 0.1, duration: 0.3 }}
              >
                <span className="w-20 shrink-0 text-sm font-medium text-muted-foreground">{label}</span>
                <span className="h-8 flex-1 overflow-hidden rounded-full bg-muted relative">
                  <motion.span
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: `var(--${color})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(ratio * 100, count > 0 ? 8 : 0)}%` }}
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 28, delay: index * 0.1 }}
                  />
                  {count > 0 && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-white">
                      {count}
                    </span>
                  )}
                </span>
                <span className="w-8 shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">{count}</span>
              </motion.li>
            );
          })
        )}
      </div>
    );
  };

  const renderWeekdays = () => {
    const maxWeekdayVal = Math.max(1, ...weekdayData);
    return (
      <div className="flex items-end justify-center gap-2 h-32" role="img" aria-label="Weekday completion distribution">
        {weekdayData.map((count, index) => {
          const ratio = count / maxWeekdayVal;
          return (
            <motion.div
              key={index}
              className="flex flex-1 flex-col items-center gap-1"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { delay: index * 0.05, duration: 0.3 }}
            >
              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{count || ""}</span>
              <div className="flex w-full items-end justify-center">
                <motion.div
                  className="w-full max-w-8 rounded-t-md bg-primary/80"
                  style={{ minHeight: 4 }}
                  initial={{ height: "4px" }}
                  animate={{ height: `${Math.max(ratio * 100, count > 0 ? 12 : 4)}%` }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 28, delay: index * 0.05 }}
                />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase">{WEEKDAY_LABELS[index]}</span>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "categories":
        return renderCategories();
      case "trends":
        return renderTrends();
      case "priorities":
        return renderPriorities();
      case "weekdays":
        return renderWeekdays();
      default:
        return null;
    }
  };

  return (
    <section
      aria-label="Productivity charts"
      className="rounded-2xl border border-border/70 bg-card/70 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg tracking-tight">Productivity</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Breakdown by {TABS.find((t) => t.id === activeTab)?.label.toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Chart type">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4" role="tabpanel" aria-label={`${TABS.find((t) => t.id === activeTab)?.label} chart`}>
        {renderTabContent()}
      </div>
    </section>
  );
}