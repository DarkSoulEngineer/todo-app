"use client";

import { motion, useReducedMotion } from "framer-motion";
import { STATUS_TABS } from "@/lib/status";
import type { StatusCounts } from "@/lib/tasks-selectors";
import type { StatusFilter } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusTabsProps {
  active: StatusFilter;
  counts: StatusCounts;
  onChange: (value: StatusFilter) => void;
}

export function StatusTabs({ active, counts, onChange }: StatusTabsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label="Filter tasks by status"
      className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card/70 p-1 shadow-xs backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {STATUS_TABS.map(({ value, label }) => {
        const isActive = value === active;
        const count = counts[value];
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(value)}
            className={cn(
              "focus-ring relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="status-tab-pill"
                className="absolute inset-0 rounded-xl bg-primary shadow-sm"
                transition={
                  reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }
                }
              />
            ) : null}
            <span className="relative">{label}</span>
            <span
              className={cn(
                "relative min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums transition-colors",
                isActive
                  ? "bg-primary-foreground/25 text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
