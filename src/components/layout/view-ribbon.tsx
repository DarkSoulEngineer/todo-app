"use client";

import {
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Columns3,
  Eye,
  Hash,
  Home as HomeIcon,
  List,
  ListFilter,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { Children, Fragment, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { motion } from "framer-motion";
import { QuickAdd } from "@/components/tasks/quick-add";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { STATUS_META } from "@/components/common/status-meta";
import { getBoardColorByLabel } from "@/lib/domain/boards";
import { getCategory } from "@/lib/domain/categories";
import { SORT_OPTIONS } from "@/lib/domain/constants";
import type { BoardSection, SortKey, ViewMode } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

/** A category plus how many tasks currently carry it. */
export interface CategoryCount {
  id: string;
  count: number;
}

/** Board column focus: which column is on its own, or null for the whole board. */
export interface RibbonSections {
  activeId: string | null;
  /** Board columns, in board order (hidden ones are filtered out by the caller). */
  items: BoardSection[];
  counts: Record<string, number>;
  onSelect: (id: string | null) => void;
}

/** Category filter: the selected category, its counts, and the deleted ones. */
export interface RibbonCategories {
  activeId: string | "all";
  counts: CategoryCount[];
  /** Built-in categories the user deleted, offered as a restore action. */
  deleted: string[];
  onSelect: (id: string | "all") => void;
  onDelete: (id: string) => void;
  onRestore: () => void;
}

/** A ribbon tab: a labelled set of tools. It never changes the current view. */
interface RibbonTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Tabs are contextual, like Office: the board also exposes a "Sections" group.
 * It appears whenever the board has columns at all — including when they are all
 * hidden, since that is the only way back to them.
 */
function tabsForView(viewMode: ViewMode, hasSections: boolean): RibbonTab[] {
  const tabs: RibbonTab[] = [
    { id: "home", label: "Home", icon: HomeIcon },
    { id: "filter", label: "Filter", icon: ListFilter },
  ];
  if (viewMode === "board" && hasSections) {
    tabs.push({ id: "sections", label: "Sections", icon: Columns3 });
  }
  return tabs;
}

export interface ViewRibbonProps {
  viewMode: ViewMode;
  /** Which tab is open. Controlled so "/" can open the Filter tab first. */
  tab: string;
  onTabChange: (tab: string) => void;
  now: Date;
  query: string;
  onQueryChange: (value: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  /** Bumped by the "/" shortcut; the field focuses itself as it mounts. */
  searchFocusSignal: number;
  showQuickAdd: boolean;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
  showSort: boolean;
  filterCategories?: RibbonCategories;
  filterSections?: RibbonSections;
  onClearCompleted: () => void;
  showClearCompleted: boolean;
  /** Opens the new-task dialog. */
  onNewTask: () => void;
  /** Switches the active view (List/Board/Calendar). */
  onChangeView: (view: ViewMode) => void;
}

/**
 * Desktop-app style ribbon: a tab bar over a strip of grouped tools.
 * The View switcher (List/Board/Calendar) and the New Task button live here
 * permanently so they're always one click away. The Home tab also holds
 * Quick Add, Sort, and Clear done. The Filter tab holds Search and Categories.
 * The Sections tab (board only) holds column focus and hidden columns.
 */
export function ViewRibbon({
  viewMode,
  tab,
  onTabChange,
  now,
  query,
  onQueryChange,
  searchRef,
  searchFocusSignal,
  showQuickAdd,
  sort,
  onSortChange,
  showSort,
  filterCategories,
  filterSections,
  onClearCompleted,
  showClearCompleted,
  onNewTask,
  onChangeView,
}: ViewRibbonProps) {
  const { sections, toggleSectionHidden } = useTasksContext();

  const hasSections = useMemo(() => sections.length > 0, [sections]);
  const tabs = useMemo(() => tabsForView(viewMode, hasSections), [viewMode, hasSections]);
  // The active tab falls back to the first one when the requested tab is not
  // offered by the current view (e.g. Sections after leaving the board).
  const activeTab = tabs.some((candidate) => candidate.id === tab) ? tab : tabs[0].id;

  const hiddenSections = sections.filter((section) => section.hidden);

  return (
    <section aria-label="Tools" className="shrink-0 border-b border-border bg-card/70">
      {/* Persistent view switcher + new task — always visible, like Word's ribbon. */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <ViewSwitcherRibbon active={viewMode} onChange={onChangeView} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={onNewTask}
          aria-label="New task"
          className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Tool groups"
        className="flex items-end gap-0.5 overflow-x-auto px-2 border-t border-border/60"
      >
        {tabs.map((candidate) => (
          <RibbonTabButton
            key={candidate.id}
            tab={candidate}
            active={candidate.id === activeTab}
            onSelect={() => onTabChange(candidate.id)}
          />
        ))}
      </div>

      {activeTab === "home" ? (
        <RibbonPanel label="Home tools">
          {showQuickAdd ? (
            <RibbonGroup label="Create">
              <div className="w-64">
                <QuickAdd now={now} variant="inline" />
              </div>
            </RibbonGroup>
          ) : null}
          {showSort ? (
            <RibbonGroup label="Sort">
              <RibbonSelect value={sort} onChange={onSortChange} />
            </RibbonGroup>
          ) : null}
          <RibbonGroup label="Clean up">
            <RibbonTool
              icon={CheckCheck}
              label="Clear done"
              onClick={onClearCompleted}
              disabled={!showClearCompleted}
            />
          </RibbonGroup>
        </RibbonPanel>
      ) : null}

      {activeTab === "filter" ? (
        <RibbonPanel label="Filters">
          <RibbonGroup label="Find">
            <RibbonSearch
              value={query}
              onChange={onQueryChange}
              inputRef={searchRef}
              focusSignal={searchFocusSignal}
            />
          </RibbonGroup>
          {filterCategories ? (
            <RibbonGroup label="Categories">
              <RibbonChip
                label="All"
                active={filterCategories.activeId === "all"}
                onClick={() => filterCategories.onSelect("all")}
              />
              {filterCategories.counts.map((item) => (
                <RibbonChip
                  key={item.id}
                  label={categoryLabel(item.id)}
                  dot={categoryDot(item.id)}
                  count={item.count}
                  active={filterCategories.activeId === item.id}
                  onClick={() =>
                    filterCategories.onSelect(
                      filterCategories.activeId === item.id ? "all" : item.id,
                    )
                  }
                  onRemove={() => filterCategories.onDelete(item.id)}
                  removeLabel={`Delete ${categoryLabel(item.id)}`}
                />
              ))}
              {filterCategories.deleted.length > 0 ? (
                <button
                  type="button"
                  onClick={filterCategories.onRestore}
                  className="focus-ring rounded-lg px-2 py-1 text-[11px] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
                >
                  Restore deleted
                </button>
              ) : null}
            </RibbonGroup>
          ) : null}
        </RibbonPanel>
      ) : null}

      {activeTab === "sections" && filterSections ? (
        <RibbonPanel label="Board sections">
          <RibbonGroup label="Focus a column">
            <RibbonChip
              label="All sections"
              active={filterSections.activeId === null}
              onClick={() => filterSections.onSelect(null)}
            />
            {filterSections.items.map((section) => (
              <RibbonChip
                key={section.id}
                label={section.title}
                icon={sectionIcon(section)}
                count={filterSections.counts[section.id] ?? 0}
                active={filterSections.activeId === section.id}
                onClick={() =>
                  filterSections.onSelect(
                    filterSections.activeId === section.id ? null : section.id,
                  )
                }
              />
            ))}
          </RibbonGroup>
          {hiddenSections.length > 0 ? (
            <RibbonGroup label="Hidden columns">
              {hiddenSections.map((section) => (
                <RibbonTool
                  key={section.id}
                  icon={Eye}
                  label={section.title}
                  onClick={() => toggleSectionHidden(section.id)}
                />
              ))}
            </RibbonGroup>
          ) : null}
        </RibbonPanel>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ribbon chrome                                                             */
/* -------------------------------------------------------------------------- */

/** Compact view switcher for the ribbon: List / Board / Calendar. */
function ViewSwitcherRibbon({
  active,
  onChange,
}: {
  active: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  const views: { value: ViewMode; icon: LucideIcon; label: string }[] = [
    { value: "list", icon: List, label: "List" },
    { value: "board", icon: Columns3, label: "Board" },
    { value: "calendar", icon: CalendarDays, label: "Calendar" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Switch view"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-card/70 p-0.5 shadow-xs backdrop-blur"
    >
      {views.map((view) => (
        <button
          key={view.value}
          type="button"
          role="tab"
          aria-selected={view.value === active}
          onClick={() => onChange(view.value)}
          title={view.label}
          className={cn(
            "focus-ring relative inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
            view.value === active
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {view.value === active ? (
            <motion.span
              layoutId="view-switcher-ribbon-pill"
              className="absolute inset-0 rounded-lg bg-primary shadow-sm"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          ) : null}
          <view.icon className="relative h-4 w-4" strokeWidth={2.1} />
        </button>
      ))}
    </div>
  );
}

function RibbonTabButton({
  tab,
  active,
  onSelect,
}: {
  tab: RibbonTab;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "focus-ring relative shrink-0 rounded-t-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="relative flex items-center gap-1.5">
        <Icon className="h-4 w-4" strokeWidth={2.1} />
        {tab.label}
      </span>
      {active ? (
        <span
          className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-primary"
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}

/** Tool strip with vertical dividers between the groups, as a ribbon does. */
function RibbonPanel({ label, children }: { label: string; children: ReactNode }) {
  const groups = Children.toArray(children).filter(Boolean);
  return (
    <div
      role="tabpanel"
      aria-label={label}
      className="flex items-stretch gap-1 overflow-x-auto px-2 pt-2 pb-2"
    >
      {groups.map((group, index) => (
        <Fragment key={index}>
          {index > 0 ? <div className="mx-0.5 w-px shrink-0 bg-border" aria-hidden="true" /> : null}
          {group}
        </Fragment>
      ))}
    </div>
  );
}

function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 px-1.5">
      <div className="flex flex-wrap items-center justify-center gap-1.5">{children}</div>
      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}

/** Large icon + caption button: the ribbon's basic unit. */
function RibbonTool({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="focus-ring flex w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-xl px-1.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      <span className="max-w-full truncate text-[10px] font-medium">{label}</span>
    </button>
  );
}

function RibbonSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (value: SortKey) => void;
}) {
  return (
    <div className="relative flex items-center">
      <SlidersHorizontal className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortKey)}
        aria-label="Sort tasks"
        className="focus-ring h-8 appearance-none rounded-xl border border-input bg-card/70 pr-8 pl-8 text-sm shadow-xs"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted-foreground" />
    </div>
  );
}

/**
 * Search field: the top bar's old middle row, now a ribbon tool. The field only
 * exists while the Filter tab is open, so it takes focus itself the moment it
 * mounts — which is how the "/" shortcut can open the tab and focus it.
 */
function RibbonSearch({
  value,
  onChange,
  inputRef,
  focusSignal,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  focusSignal: number;
}) {
  const handledSignal = useRef(focusSignal);

  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground" />
      <input
        ref={(node) => {
          inputRef.current = node;
          if (node && focusSignal !== handledSignal.current) {
            handledSignal.current = focusSignal;
            node.focus();
          }
        }}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search tasks…"
        aria-label="Search tasks"
        className="focus-ring h-8 w-52 rounded-xl border border-input bg-card/70 pr-8 pl-8 text-sm shadow-xs placeholder:text-muted-foreground/70"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="focus-ring absolute right-1.5 grid h-5 w-5 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** Ribbon filter chip: always visible, active state, optional remove button. */
function RibbonChip({
  label,
  count,
  dot,
  icon,
  active,
  onClick,
  onRemove,
  removeLabel,
}: {
  label: string;
  count?: number;
  /** Category colour, when the row is a category. */
  dot?: string;
  /** Column icon, when the row is a board section. */
  icon?: ReactNode;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "focus-ring inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          active
            ? "border-primary/50 bg-primary/10 text-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {dot ? <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden="true" /> : null}
        {icon ? (
          <span className="grid h-4 w-4 shrink-0 place-items-center">{icon}</span>
        ) : null}
        <span className="truncate">{label}</span>
        {count !== undefined && count > 0 ? (
          <span className="shrink-0 text-muted-foreground tabular-nums">{count}</span>
        ) : null}
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${label}`}
          title="Delete"
          className="focus-ring absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-border bg-popover text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  );
}

function categoryLabel(id: string): string {
  return getCategory(id)?.label ?? id;
}

function categoryDot(id: string): string | undefined {
  return getCategory(id)?.dot;
}

/** Icon for a board column: status glyph, board colour dot, or a hash. */
function sectionIcon(section: BoardSection): ReactNode {
  if (section.status) {
    const Icon: LucideIcon = STATUS_META[section.status].icon;
    return <Icon className="h-4 w-4" strokeWidth={2.2} />;
  }
  const color = getBoardColorByLabel(section.title);
  if (color) {
    return <span className={cn("h-2.5 w-2.5 rounded-full", color.dot)} aria-hidden="true" />;
  }
  return <Hash className="h-4 w-4" strokeWidth={2.2} />;
}