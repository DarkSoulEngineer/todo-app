"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Flame, TrendingUp } from "lucide-react";
import { useMemo, useRef, useState, useEffect } from "react";
import { useTasksContext } from "@/components/tasks-provider";
import { computeInsightsForWindow, getPreviousPeriodPoints } from "@/lib/insights";
import { cn } from "@/lib/utils";
import type { InsightsFilters } from "@/lib/insights-filters";

interface InsightsPanelProps {
  now: Date;
  filters: InsightsFilters;
}

interface TooltipData {
  point: { key: string; label: string; count: number };
  x: number;
  y: number;
  isPrevious: boolean;
}

export function InsightsPanel({ now, filters }: InsightsPanelProps) {
  const { tasks } = useTasksContext();
  const reduceMotion = useReducedMotion();
  const [hoveredPoint, setHoveredPoint] = useState<TooltipData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute window bounds from filters
  const { windowStart, windowEnd } = useMemo(() => {
    let start: Date;
    let end: Date;
    switch (filters.dateRange) {
      case "7d":
        end = new Date(now);
        start = new Date(now);
        start.setDate(start.getDate() - 6);
        break;
      case "30d":
        end = new Date(now);
        start = new Date(now);
        start.setDate(start.getDate() - 29);
        break;
      case "90d":
        end = new Date(now);
        start = new Date(now);
        start.setDate(start.getDate() - 89);
        break;
      case "custom":
        start = filters.customStart ? new Date(filters.customStart) : new Date(now);
        end = filters.customEnd ? new Date(filters.customEnd) : new Date(now);
        break;
      default:
        end = new Date(now);
        start = new Date(now);
        start.setDate(start.getDate() - 6);
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { windowStart: start, windowEnd: end };
  }, [now, filters]);

  const insights = useMemo(() => computeInsightsForWindow(tasks, windowStart, windowEnd), [tasks, windowStart, windowEnd]);
  const previousPoints = useMemo(() => getPreviousPeriodPoints(tasks, windowStart, windowEnd), [tasks, windowStart, windowEnd]);
  const max = Math.max(1, insights.best, Math.max(...previousPoints.map((p) => p.count)));

  // Get bar positions for tooltip
  const [barPositions, setBarPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    const bars = containerRef.current.querySelectorAll('[data-bar-key]');
    const positions = new Map<string, { x: number; y: number }>();
    bars.forEach((bar) => {
      const key = bar.getAttribute('data-bar-key');
      if (key) {
        const rect = bar.getBoundingClientRect();
        const containerRect = containerRef.current!.getBoundingClientRect();
        positions.set(key, {
          x: rect.left + rect.width / 2 - containerRect.left,
          y: rect.top - containerRect.top,
        });
      }
    });
    setBarPositions(positions);
  }, [insights.points.length]);

  const handleBarMouseEnter = (point: { key: string; label: string; count: number }, isPrevious = false) => {
    const pos = barPositions.get(point.key);
    if (pos) {
      setHoveredPoint({ point, x: pos.x, y: pos.y, isPrevious });
    }
  };

  const handleBarMouseLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <section
      ref={containerRef}
      aria-label="Completion insights"
      className="relative flex flex-col rounded-3xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur-sm sm:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg tracking-tight">Insights</h2>
          <p className="text-xs text-muted-foreground">
            {filters.dateRange === "custom"
              ? `Custom range (${filters.customStart?.toLocaleDateString()} - ${filters.customEnd?.toLocaleDateString()})`
              : `Completed over the last ${filters.dateRange === "7d" ? 7 : filters.dateRange === "30d" ? 30 : 90} days`}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
          <Flame className="h-3.5 w-3.5" strokeWidth={2.4} />
          <span className="text-xs font-semibold tabular-nums">
            {insights.streak} day{insights.streak === 1 ? "" : "s"}
          </span>
        </span>
      </div>

      <div className="relative mt-auto flex items-end gap-2 sm:gap-3 pb-8">
        {/* Current period bars */}
        {insights.points.map((point) => {
          const ratio = point.count / max;
          const height = point.count > 0 ? `${Math.max(ratio * 100, 12)}%` : "6%";
          return (
            <div
              key={point.key}
              className="relative flex flex-1 flex-col items-center gap-2"
              onMouseEnter={() => handleBarMouseEnter(point, false)}
              onMouseLeave={handleBarMouseLeave}
            >
              <span className="h-3 text-[10px] font-semibold text-muted-foreground tabular-nums">
                {point.count > 0 ? point.count : ""}
              </span>
              <div className="flex h-24 w-full items-end justify-center sm:h-32 md:h-40 lg:h-48">
                <motion.div
                  data-bar-key={point.key}
                  className={cn(
                    "w-full max-w-9 rounded-t-md relative",
                    point.count > 0 ? "bg-primary" : "bg-muted",
                  )}
                  style={{ minHeight: 4 }}
                  title={`${point.count} completed on ${point.label}`}
                  initial={false}
                  animate={{ height: height }}
                  transition={
                    reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 28 }
                  }
                />
                {/* Previous period overlay */}
                {previousPoints.length > 0 && (
                  <motion.div
                    className="absolute bottom-0 w-full max-w-9 border-t-2 border-dashed border-primary/50 opacity-50 rounded-t-md pointer-events-none"
                    style={{
                      height: `${Math.max((previousPoints.find((p) => p.key === point.key)?.count || 0) / max * 100, 4)}%`,
                    }}
                    initial={false}
                    animate={{ opacity: 0.5 }}
                    transition={reduceMotion ? { duration: 0 } : { delay: 0.2, duration: 0.3 }}
                  />
                )}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase">{point.label}</span>
            </div>
          );
        })}

        {/* Tooltip */}
        {hoveredPoint && (
          <motion.div
            className="absolute z-10 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{ top: hoveredPoint.y - 48 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
          >
            <div
              className="flex items-center gap-1.5 rounded-lg bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-lg ring-1 ring-border"
            >
              <span className="flex items-center gap-1">
                {hoveredPoint.isPrevious ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full border-2 border-dashed border-primary/50" />
                    Previous
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Current
                  </>
                )}
              </span>
              <span>{hoveredPoint.point.label} {hoveredPoint.point.key.slice(5)}</span>
              <span className="tabular-nums">{hoveredPoint.point.count} completed</span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="font-medium">
          {insights.windowTotal} completed this period
          {insights.periodChange !== null && (
            <span className="ml-2 inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.8} />
              {insights.periodChange > 0 ? "+" : ""}{insights.periodChange}% vs prev
            </span>
          )}
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" />
          Best day {insights.best}
        </span>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Current period
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-6 border-t-2 border-dashed border-primary/50" />
          Previous period
        </span>
      </div>
    </section>
  );
}