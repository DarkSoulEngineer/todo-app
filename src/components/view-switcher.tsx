"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Columns3, List, type LucideIcon } from "lucide-react";
import type { ViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ViewOption {
  value: Extract<ViewMode, "list" | "board" | "calendar">;
  label: string;
  icon: LucideIcon;
}

const VIEWS: ViewOption[] = [
  { value: "list", label: "List", icon: List },
  { value: "board", label: "Board", icon: Columns3 },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
];

export function ViewSwitcher({
  active,
  onChange,
}: {
  active: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Switch view"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-card/70 p-0.5 shadow-xs backdrop-blur"
    >
      {VIEWS.map((option) => (
        <ViewTab
          key={option.value}
          option={option}
          active={option.value === active}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}

function ViewTab({
  option,
  active,
  onSelect,
}: {
  option: ViewOption;
  active: boolean;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const Icon = option.icon;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      title={option.label}
      className={cn(
        "focus-ring relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
        active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active ? (
        <motion.span
          layoutId="view-switcher-pill"
          className="absolute inset-0 rounded-lg bg-primary shadow-sm"
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
        />
      ) : null}
      <Icon className="relative h-4 w-4" strokeWidth={2.1} />
      <span className="relative hidden sm:inline">{option.label}</span>
    </button>
  );
}
