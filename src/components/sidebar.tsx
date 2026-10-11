"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  Ban,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronRight,
  Hash,
  Keyboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { getBoardColorByLabel } from "@/lib/boards";
import { getCategory } from "@/lib/categories";
import { aggregateTimeCount, SMART_LISTS, TIME_GROUP_LISTS, type SmartListCounts } from "@/lib/smart-lists";
import type { TaskStats } from "@/lib/tasks-selectors";
import type { BoardSection, SmartList, ViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const LIST_ICONS: Record<SmartList, LucideIcon> = {
  today: Sun,
  tomorrow: CalendarDays,
  thisWeek: CalendarRange,
  upcoming: CalendarClock,
  overdue: TriangleAlert,
  all: ListChecks,
  completed: Check,
  canceled: Ban,
  "by-section": Hash,
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
  /** Ids of built-in categories the user deleted. */
  deletedCategories: string[];
  /** User-defined board sections (custom ones are surfaced here). */
  sections: BoardSection[];
  sectionCounts: Record<string, number>;
  /** Id of the custom section currently focused on the board, if any. */
  focusedSection: string | null;
  onSelectList: (list: SmartList) => void;
  onSelectView: (view: ViewMode) => void;
  onSelectCategory: (category: string | "all") => void;
  onSelectSection: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  onRestoreCategories: () => void;
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
  deletedCategories,
  sections,
  sectionCounts,
  focusedSection,
  onSelectList,
  onSelectView,
  onSelectCategory,
  onSelectSection,
  onDeleteCategory,
  onRestoreCategories,
  onShowHelp,
  onToggleCollapse,
  onClose,
}: SidebarProps) {
  const onLists = viewMode === "list" || viewMode === "board";

  // The five time-based lists collapse under one "Upcoming" group; the other
  // four stay flat. Both orderings follow SMART_LISTS.
  const timeLists = SMART_LISTS.filter((def) => TIME_GROUP_LISTS.includes(def.id));
  const flatLists = SMART_LISTS.filter((def) => !TIME_GROUP_LISTS.includes(def.id));
  const timeCount = aggregateTimeCount(counts);
  const timeActive = onLists && TIME_GROUP_LISTS.includes(smartList);
  const [timeOpen, setTimeOpen] = useState(timeActive);
  const reduceMotion = useReducedMotion();

  // Auto-open when the active list enters the group. A manual collapse on the
  // chevron is respected until the active list leaves the group and returns.
  useEffect(() => {
    if (timeActive) setTimeOpen(true);
  }, [timeActive]);

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

          {/* Time group — one collapsible parent over the five date lists. */}
          {collapsed ? (
            <NavItem
              icon={CalendarClock}
              label="Upcoming"
              count={counts.upcoming}
              active={onLists && smartList === "upcoming"}
              collapsed
              layoutId={`${idPrefix}-smart-pill`}
              onClick={() => onSelectList("upcoming")}
            />
          ) : (
            <>
              <TimeGroupRow
                label="Upcoming"
                icon={CalendarClock}
                count={timeCount}
                active={timeActive}
                open={timeOpen}
                layoutId={`${idPrefix}-time-pill`}
                controlsId={`${idPrefix}-time-children`}
                onToggle={() => setTimeOpen((open) => !open)}
              />
              <AnimatePresence initial={false}>
                {timeOpen ? (
                  <motion.div
                    key="time-children"
                    id={`${idPrefix}-time-children`}
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 pl-3">
                      {timeLists.map((def) => (
                        <NavItem
                          key={def.id}
                          icon={LIST_ICONS[def.id]}
                          label={def.label}
                          count={counts[def.id]}
                          active={onLists && smartList === def.id}
                          collapsed={false}
                          layoutId={`${idPrefix}-smart-pill`}
                          onClick={() => onSelectList(def.id)}
                        />
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </>
          )}

          {/* Flat lists — always a single click away. */}
          {flatLists.map((def) => (
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

        {sections.some((section) => section.status === undefined) ? (
          <div className="space-y-0.5">
            {!collapsed ? (
              <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Sections
              </p>
            ) : null}
            {sections
              .filter((section) => section.status === undefined)
              .map((section) => {
                const color = getBoardColorByLabel(section.title);
                const Icon = color ? (
                  <span
                    className={cn("h-4 w-4 rounded-full", color.dot)}
                    aria-hidden="true"
                  />
                ) : (
                  <Hash className="h-4 w-4" strokeWidth={2.2} />
                );
                return (
                  <NavItem
                    key={section.id}
                    icon={Icon}
                    label={section.title}
                    count={sectionCounts[section.id] ?? 0}
                    active={focusedSection === section.id}
                    collapsed={collapsed}
                    layoutId={`${idPrefix}-section-pill`}
                    onClick={() => onSelectSection(section.id)}
                  />
                );
              })}
          </div>
        ) : null}

        {viewMode !== "insights" && (categoryCounts.length > 0 || deletedCategories.length > 0) ? (
          <div className="space-y-0.5">
            {!collapsed && categoryCounts.length > 0 ? (
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
                onDelete={() => onDeleteCategory(item.id)}
              />
            ))}
            {!collapsed && deletedCategories.length > 0 ? (
              <button
                type="button"
                onClick={onRestoreCategories}
                className="focus-ring block w-full rounded-lg px-2.5 py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Restore deleted categories
              </button>
            ) : null}
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
  icon: LucideIcon | React.ReactNode;
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
      {React.isValidElement(Icon) ? (
        <span className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-primary")}>
          {Icon}
        </span>
      ) : typeof Icon === "function" || (Icon && typeof Icon === "object" && "$$typeof" in Icon) ? (
        <Icon
          className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-primary")}
          strokeWidth={2.2}
        />
      ) : (
        <span className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-primary")}>
          <span>{Icon}</span>
        </span>
      )}
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

interface TimeGroupRowProps {
  icon: LucideIcon;
  label: string;
  count: number;
  /** True when the current smart list lives inside the group. */
  active: boolean;
  open: boolean;
  layoutId: string;
  controlsId: string;
  onToggle: () => void;
}

/**
 * Collapsible parent row for the time group. Unlike `NavItem` it navigates
 * nowhere — it toggles its child rows and lights up while one of them is the
 * active list. It carries its own pill `layoutId` so it never cross-animates
 * with the child pills.
 */
function TimeGroupRow({
  icon: Icon,
  label,
  count,
  active,
  open,
  layoutId,
  controlsId,
  onToggle,
}: TimeGroupRowProps) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controlsId}
      className={cn(
        "focus-ring relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active ? (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/20"
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
        />
      ) : null}
      <Icon className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-primary")} strokeWidth={2.2} />
      <span className="relative flex-1 truncate text-left">{label}</span>
      {count > 0 ? (
        <span className="relative text-xs text-muted-foreground tabular-nums">{count}</span>
      ) : null}
      <ChevronRight
        className={cn(
          "relative h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
          open && "rotate-90",
        )}
        strokeWidth={2.2}
      />
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
  /** Delete affordance; omitted when there is nowhere sensible to put it. */
  onDelete?: () => void;
}

function CategoryItem({
  id,
  count,
  active,
  collapsed,
  layoutId,
  onClick,
  onDelete,
}: CategoryItemProps) {
  const category = getCategory(id);
  const reduceMotion = useReducedMotion();
  if (!category) return null;

  // The delete button needs room to sit beside the row, so it only exists
  // while the sidebar is expanded.
  const showDelete = !collapsed && onDelete !== undefined;

  return (
    // A wrapper keeps the two buttons siblings: no nested interactive elements.
    <div className="group relative">
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
        {/* The count yields its slot to the delete button. */}
        {!collapsed && !showDelete ? (
          <span className="relative text-xs text-muted-foreground tabular-nums">{count}</span>
        ) : null}
      </button>
      {showDelete ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.();
          }}
          aria-label={`Delete ${category.label}`}
          title="Delete category"
          className="focus-ring absolute top-1/2 right-1 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-70 transition-colors hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}