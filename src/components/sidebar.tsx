"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Ban,
  BarChart3,
  CalendarClock,
  CalendarDays,
  Check,
  Keyboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCategory } from "@/lib/categories";
import { SMART_LISTS, type SmartListCounts } from "@/lib/smart-lists";
import type { TaskStats } from "@/lib/tasks-selectors";
import type { SmartList, ViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const LIST_ICONS: Record<SmartList, LucideIcon> = {
  today: Sun,
  upcoming: CalendarClock,
  overdue: TriangleAlert,
  all: ListChecks,
  completed: Check,
  canceled: Ban,
};

export interface SidebarCategory {
  id: string;
  count: number;
}

interface SidebarProps {
  /** Keeps layout animations unique between the desktop and mobile instances. */
  idPrefix: string;
  collapsed: boolean;
  viewMode: ViewMode;
  smartList: SmartList;
  counts: SmartListCounts;
  stats: TaskStats;
  category: string | "all";
  categoryCounts: SidebarCategory[];
  onSelectList: (list: SmartList) => void;
  onSelectView: (view: ViewMode) => void;
  onSelectCategory: (category: string | "all") => void;
  onShowHelp: () => void;
  onToggleCollapse: () => void;
  onClose?: () => void;
}

export function Sidebar({
  idPrefix,
  collapsed,
  viewMode,
  smartList,
  counts,
  stats,
  category,
  categoryCounts,
  onSelectList,
  onSelectView,
  onSelectCategory,
  onShowHelp,
  onToggleCollapse,
  onClose,
}: SidebarProps) {
  const onLists = viewMode === "list" || viewMode === "board";

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-card/70 backdrop-blur-sm transition-[width] duration-200",
        collapsed ? "w-[4.75rem]" : "w-[16rem]",
      )}
    >
      <div className="flex items-center gap-2.5 px-3 py-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15">
          <Check className="h-[18px] w-[18px]" strokeWidth={3} />
        </span>
        {!collapsed ? (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-display text-xl tracking-tight">Stride</p>
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              Focused task manager
            </p>
          </div>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="focus-ring ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-4 overflow-y-auto px-2 pb-3">
        <div className="space-y-0.5">
          {!collapsed ? (
            <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Lists
            </p>
          ) : null}
          {SMART_LISTS.map((def) => (
            <NavItem
              key={def.id}
              icon={LIST_ICONS[def.id]}
              label={def.label}
              count={counts[def.id]}
              active={onLists && smartList === def.id}
              collapsed={collapsed}
              layoutId={`${idPrefix}-smart-pill`}
              onClick={() => onSelectList(def.id)}
            />
          ))}
        </div>

        <div className="space-y-0.5">
          {!collapsed ? (
            <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Views
            </p>
          ) : null}
          <NavItem
            icon={CalendarDays}
            label="Calendar"
            active={viewMode === "calendar"}
            collapsed={collapsed}
            layoutId={`${idPrefix}-view-pill`}
            onClick={() => onSelectView("calendar")}
          />
          <NavItem
            icon={BarChart3}
            label="Insights"
            active={viewMode === "insights"}
            collapsed={collapsed}
            layoutId={`${idPrefix}-view-pill`}
            onClick={() => onSelectView("insights")}
          />
        </div>

        {categoryCounts.length > 0 ? (
          <div className="space-y-0.5">
            {!collapsed ? (
              <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Categories
              </p>
            ) : null}
            {categoryCounts.map((item) => (
              <CategoryItem
                key={item.id}
                id={item.id}
                count={item.count}
                active={category === item.id}
                collapsed={collapsed}
                layoutId={`${idPrefix}-category-pill`}
                onClick={() => onSelectCategory(category === item.id ? "all" : item.id)}
              />
            ))}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-border px-3 py-3">
        {!collapsed ? (
          <>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Progress</span>
              <span className="font-semibold text-foreground tabular-nums">
                {Math.round(stats.completionRate * 100)}%
              </span>
            </div>
            <Progress value={stats.completionRate} label="Overall completion" />
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {stats.completed}/{stats.total} done · {stats.active} open
            </p>
          </>
        ) : (
          <div className="flex justify-center py-1">
            <Progress value={stats.completionRate} label="Overall completion" className="w-8" />
          </div>
        )}

        <div className={cn("mt-3 flex items-center", collapsed ? "flex-col gap-2" : "justify-between")}>
          {!collapsed ? <ThemeToggle /> : null}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onShowHelp}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Keyboard className="h-4 w-4" />
            </button>
            {!onClose ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  count?: number;
  active: boolean;
  collapsed: boolean;
  layoutId?: string;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, count, active, collapsed, layoutId, onClick }: NavItemProps) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "focus-ring relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0 py-2.5",
        active ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active && layoutId ? (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/20"
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
        />
      ) : null}
      <Icon
        className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-primary")}
        strokeWidth={2.2}
      />
      {!collapsed ? <span className="relative flex-1 truncate text-left">{label}</span> : null}
      {!collapsed && count !== undefined && count > 0 ? (
        <span className="relative text-xs text-muted-foreground tabular-nums">{count}</span>
      ) : null}
      {collapsed && count !== undefined && count > 0 ? (
        <span className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
      ) : null}
    </button>
  );
}

interface CategoryItemProps {
  id: string;
  count: number;
  active: boolean;
  collapsed: boolean;
  layoutId?: string;
  onClick: () => void;
}

function CategoryItem({ id, count, active, collapsed, layoutId, onClick }: CategoryItemProps) {
  const category = getCategory(id);
  const reduceMotion = useReducedMotion();
  if (!category) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={collapsed ? category.label : undefined}
      className={cn(
        "focus-ring relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0 py-2.5",
        active ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active && layoutId ? (
        <motion.span
          layoutId={layoutId}
          className={cn("absolute inset-0 rounded-xl bg-muted ring-1 ring-inset", category.ring)}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
        />
      ) : null}
      <span className={cn("relative h-2.5 w-2.5 shrink-0 rounded-full", category.dot)} />
      {!collapsed ? <span className="relative flex-1 truncate text-left">{category.label}</span> : null}
      {!collapsed ? (
        <span className="relative text-xs text-muted-foreground tabular-nums">{count}</span>
      ) : null}
    </button>
  );
}
