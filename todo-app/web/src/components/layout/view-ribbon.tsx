"use client";

import {
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Columns3,
  Home as HomeIcon,
  Keyboard,
  Layers,
  List,
  ListFilter,
  Plus,
  Search,
  Shrink,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Children,
  Fragment,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { WindowControls } from "@/components/layout/window-controls";
import { getCategory } from "@/lib/domain/categories";
import { SORT_OPTIONS } from "@/lib/domain/constants";
import type { SortKey, ViewMode } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

/** A category plus how many tasks currently carry it. */
export interface CategoryCount {
  id: string;
  count: number;
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
 * The ribbon's tabs. The internal `id`s stay stable for wiring: "home" is the
 * default tab and "filter" is the Options tab.
 *
 * Labels name what each tab holds:
 *  - "Home"   : create, tidy up, load sample, board display
 *  - "Options": category filters and ordering
 */
function tabsForView(): RibbonTab[] {
  return [
    { id: "home", label: "Home", icon: HomeIcon },
    { id: "filter", label: "Options", icon: ListFilter },
  ];
}

export interface ViewRibbonProps {
  viewMode: ViewMode;
  /** Which tab is open. Controlled so "/" can open the Filter tab first. */
  tab: string;
  onTabChange: (tab: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  /** Bumped by the "/" shortcut; the field focuses itself as it mounts. */
  searchFocusSignal: number;
  showCreate: boolean;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
  showSort: boolean;
  filterCategories?: RibbonCategories;
  onClearCompleted: () => void;
  showClearCompleted: boolean;
  /** Opens the new-task dialog. */
  onNewTask: () => void;
  /** Switches the active view (List/Board/Calendar). */
  onChangeView: (view: ViewMode) => void;
  /** True while the board fills the screen. Drives the maximize/restore icon. */
  maximized: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  /** Removes the board window and returns to the board manager. */
  onCloseBoard: () => void;
  /** Opens the keyboard-shortcuts dialog. */
  onShowHelp?: () => void;
  /** Loads a few sample tasks. */
  onLoadSample?: () => void;
  /** Board compact-view toggle state (only meaningful on the board view). */
  compactView?: boolean;
  onCompactViewChange?: (value: boolean) => void;
}

/**
 * Desktop-app style ribbon: a tab bar over a strip of grouped tools.
 * The window controls (minimize / maximize / close), the board-manager link,
 * the View switcher (List/Board/Calendar), the theme switcher and the
 * shortcuts button live in the top row, so they're always one click away, and
 * the task search sits centered in that top row (Microsoft Word style).
 * The Home tab holds create / tidy-up / sample / display; the Options tab
 * holds Categories and Sort.
 */
export function ViewRibbon({
  viewMode,
  tab,
  onTabChange,
  query,
  onQueryChange,
  searchRef,
  searchFocusSignal,
  showCreate,
  sort,
  onSortChange,
  showSort,
  filterCategories,
  onClearCompleted,
  showClearCompleted,
  onNewTask,
  onChangeView,
  maximized,
  onMinimize,
  onMaximize,
  onCloseBoard,
  onShowHelp,
  compactView = false,
  onCompactViewChange,
  onLoadSample,
}: ViewRibbonProps) {
  const pathname = usePathname();
  const onBoardManager = pathname === "/";

  const tabs = tabsForView();
  // The active tab falls back to the first one when the requested tab is not
  // offered (e.g. a stale "filter" after the tabs change).
  const activeTab = tabs.some((candidate) => candidate.id === tab) ? tab : tabs[0].id;

  return (
    <section aria-label="Tools" className="relative shrink-0 border-b border-border bg-card/90 shadow-sm backdrop-blur-xl">
      <div className="h-0.5 w-full bg-gradient-to-r from-primary/55 via-secondary/35 to-success/35" aria-hidden="true" />
      {/* Persistent board link + view switcher + theme + shortcuts + window
          controls: always visible, like a desktop title bar. */}
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 border-b border-border/60 bg-muted/30 px-2 py-1 max-[639px]:gap-1 sm:px-3">
        <div className="mr-1 hidden items-center gap-1.5 border-r border-border/70 pr-2 sm:flex">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">J</span>
          <span className="text-xs font-bold tracking-tight text-foreground">Janus</span>
        </div>
        <Link
          href="/"
          title="Board manager"
          aria-current={onBoardManager ? "page" : undefined}
          className={cn(
            "touch-target focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/70 bg-card/80 px-2 py-1 text-xs font-semibold shadow-xs backdrop-blur transition-colors max-[639px]:px-1.5",
            onBoardManager
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers className="h-4 w-4" strokeWidth={2.1} />
          <span className="max-[479px]:hidden">Boards</span>
        </Link>
        <ViewSwitcherRibbon active={viewMode} onChange={onChangeView} />
        {/* Search sits centered in the top bar, Microsoft Word style. */}
        <div className="order-last flex min-w-0 basis-full flex-1 justify-center px-0 sm:order-none sm:basis-auto sm:px-1">
          <RibbonSearch
            value={query}
            onChange={onQueryChange}
            inputRef={searchRef}
            focusSignal={searchFocusSignal}
          />
        </div>
        <ThemeToggle />
        {onShowHelp ? (
          <RibbonIconButton icon={Keyboard} label="Shortcuts" onClick={onShowHelp} />
        ) : null}
        <WindowControls
          maximized={maximized}
          onMinimize={onMinimize}
          onMaximize={onMaximize}
          onClose={onCloseBoard}
        />
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Tool groups"
        className="flex h-8 items-end gap-0.5 overflow-x-auto bg-card/70 px-2"
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
          {showCreate ? (
            <RibbonGroup label="Create">
              <RibbonTool icon={Plus} label="New card" onClick={onNewTask} />
            </RibbonGroup>
          ) : null}
          {onLoadSample ? (
            <RibbonGroup label="Sample">
              <div className="flex flex-col gap-1">
                <RibbonTool icon={Plus} label="Sample" onClick={onLoadSample} size="small" />
                <RibbonTool
                  icon={CheckCheck}
                  label="Clear done"
                  onClick={onClearCompleted}
                  disabled={!showClearCompleted}
                  size="small"
                />
              </div>
            </RibbonGroup>
          ) : null}
          {viewMode === "board" && onCompactViewChange ? (
            <RibbonGroup label="Display">
              <RibbonTool
                icon={Shrink}
                label="Compact view"
                onClick={() => onCompactViewChange(!compactView)}
                active={compactView}
              />
            </RibbonGroup>
          ) : null}
        </RibbonPanel>
      ) : null}

      {activeTab === "filter" ? (
        <RibbonPanel label="Options">
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
                  className="touch-target focus-ring rounded-lg px-2 py-1 text-[11px] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
                >
                  Restore deleted
                </button>
              ) : null}
            </RibbonGroup>
          ) : null}
          {showSort ? (
            <RibbonGroup label="Sort">
              <RibbonSelect value={sort} onChange={onSortChange} />
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
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-card/70 p-0.5 shadow-xs backdrop-blur"
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
            "touch-target focus-ring relative inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
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
        "touch-target focus-ring relative shrink-0 rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors",
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
    // Fixed height so switching tabs (Home / Options) never resizes the ribbon
    // and shifts the content below; groups stretch to fill it.
    <div
      role="tabpanel"
      aria-label={label}
      className="flex h-[3.75rem] items-stretch gap-1 overflow-x-auto px-2 py-1 sm:h-[4.25rem] sm:px-3"
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
    <div className="flex min-h-[3.25rem] shrink-0 flex-col items-center gap-0.5 px-1.5">
      {/* Grows to fill the fixed panel height, centering the tools vertically. */}
      <div className="flex flex-1 flex-wrap items-center justify-center gap-1.5">{children}</div>
      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}

/**
 * Ribbon button. Two sizes, like a Word ribbon:
 *  - "large" (default): icon stacked above a caption.
 *  - "small": compact horizontal button (small icon + inline caption), sized to
 *    stack vertically inside a group.
 */
function RibbonTool({
  icon: Icon,
  label,
  onClick,
  disabled,
  active = false,
  size = "large",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  size?: "large" | "small";
}) {
  const tone = active
    ? "bg-primary/15 text-primary hover:bg-primary/20"
    : "text-muted-foreground hover:bg-muted hover:text-foreground";

  if (size === "small") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={active}
        title={label}
        className={cn(
          "touch-target focus-ring inline-flex w-[5.25rem] shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
          tone,
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2.1} />
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={label}
      className={cn(
        "touch-target focus-ring flex w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-md px-1.5 py-1 transition-colors disabled:pointer-events-none disabled:opacity-40",
        tone,
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      <span className="max-w-full truncate text-[10px] font-medium">{label}</span>
    </button>
  );
}

/**
 * Compact square icon button for the always-visible top row (e.g. Shortcuts).
 * Matches the top row's chrome: bordered, blurred card surface, `focus-ring`.
 */
function RibbonIconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="touch-target focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card/70 text-muted-foreground shadow-xs backdrop-blur transition-colors hover:text-foreground"
    >
      <Icon className="h-4 w-4" strokeWidth={2.1} />
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
        className="touch-target focus-ring h-8 appearance-none rounded-lg border border-input bg-card/70 pr-8 pl-8 text-sm shadow-xs"
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
 * Search field, centered in the ribbon's top bar (Microsoft Word style). The
 * field is always mounted, so the "/" shortcut focuses it by bumping the focus
 * signal rather than by remounting it.
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

  useEffect(() => {
    if (focusSignal !== handledSignal.current) {
      handledSignal.current = focusSignal;
      inputRef.current?.focus();
    }
  }, [focusSignal, inputRef]);

  return (
    <div className="relative flex w-full max-w-[15rem] items-center sm:max-w-xs md:max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search tasks…"
        aria-label="Search tasks"
        className="touch-target focus-ring h-8 w-full rounded-lg border border-input bg-card/70 pr-8 pl-8 text-sm shadow-xs placeholder:text-muted-foreground/70"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="touch-target focus-ring absolute top-1/2 right-1.5 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
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
  active,
  onClick,
  onRemove,
  removeLabel,
}: {
  label: string;
  count?: number;
  /** Category colour, when the row is a category. */
  dot?: string;
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
          "touch-target focus-ring inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          active
            ? "border-primary/50 bg-primary/10 text-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {dot ? <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden="true" /> : null}
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
