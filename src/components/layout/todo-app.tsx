"use client";

import { CheckCheck, Plus, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { BoardView } from "@/components/board/board-view";
import { CalendarView } from "@/components/calendar/calendar-view";
import { Celebration } from "@/components/common/celebration";
import { EmptyState } from "@/components/common/empty-state";
import { InsightsView } from "@/components/insights/insights-view";
import { ListView } from "@/components/list/list-view";
import { ShortcutsHelp } from "@/components/common/shortcuts-help";
import { Sidebar } from "@/components/layout/sidebar";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskSkeleton } from "@/components/tasks/task-skeleton";
import { ViewRibbon, type CategoryCount, type RibbonCategories, type RibbonSections } from "@/components/layout/view-ribbon";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useNow } from "@/hooks/use-now";
import { getCategory, selectCategories } from "@/lib/domain/categories";
import { filterBySmartList, smartListLabel } from "@/lib/domain/smart-lists";
import { computeStats, matchesQuery, sortTasks } from "@/lib/domain/tasks-selectors";
import { getTaskSectionId, isCustomSection } from "@/lib/domain/sections";
import type { SmartList, SortKey, Task, TaskDraft, ViewMode } from "@/lib/domain/types";
import { cn, pluralize } from "@/lib/utils/utils";

/** How the board is presented: filling the viewport, a movable window, or full-screen. */
type WindowMode = "normal" | "floating" | "maximized";

/** Sensible default deadline when a task is created from an empty calendar day. */
function defaultDueForDay(date: Date, now: Date): string {
  const target = new Date(date);
  target.setHours(9, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    const soon = new Date(now);
    soon.setMinutes(0, 0, 0);
    soon.setHours(soon.getHours() + 1);
    return soon.toISOString();
  }
  return target.toISOString();
}

export function TodoApp() {
  const {
    tasks,
    sections,
    deletedCategories,
    isLoading,
    isEmpty,
    addTask,
    updateTask,
    clearCompleted,
    deleteCategory,
    restoreCategories,
    snapshot,
    restore,
    loadSample,
    assignTaskToSection,
    currentProjectName,
  } = useTasksContext();
  const now = useNow();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [smartList, setSmartList] = useState<SmartList>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("manual");
  const [category, setCategory] = useState<string | "all">("all");
  const [focusedSection, setFocusedSection] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [initialDueAt, setInitialDueAt] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // The ribbon's open tab, and a counter that asks the ribbon's search field
  // for focus (raised by the "/" shortcut, which also opens the Filter tab).
  const [ribbonTab, setRibbonTab] = useState("home");
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);

  // Board window behaviour (docked / floating / maximized). Ephemeral chrome,
  // so it lives in the task view rather than in the persisted tasks store.
  const [windowMode, setWindowMode] = useState<WindowMode>("normal");
  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const floatDrag = useRef<{ dx: number; dy: number } | null>(null);

  const router = useRouter();

  const searchRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => computeStats(tasks, now), [tasks, now]);

  // The section focus only applies while a section still exists.
  const activeSection = useMemo(
    () => (focusedSection ? (sections.find((section) => section.id === focusedSection) ?? null) : null),
    [focusedSection, sections],
  );

  // Task count per board column (custom and status alike), for the filter menu.
  const sectionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const task of tasks) {
      const id = getTaskSectionId(task, sections, now);
      if (id) map[id] = (map[id] ?? 0) + 1;
    }
    return map;
  }, [tasks, sections, now]);

  // Deleted categories drop out of the filter list along with their counts.
  const categoryCounts = useMemo<CategoryCount[]>(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.category) map.set(task.category, (map.get(task.category) ?? 0) + 1);
    }
    return selectCategories(deletedCategories)
      .map((item) => ({ id: item.id, count: map.get(item.id) ?? 0 }))
      .filter((item) => item.count > 0);
  }, [tasks, deletedCategories]);

  // Tasks for the current smart list (search + category applied, then sorted).
  const listTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = filterBySmartList(tasks, smartList, now).filter(
      (task) => (category === "all" || task.category === category) && matchesQuery(task, needle),
    );
    return sortTasks(filtered, sort);
  }, [tasks, smartList, category, query, sort, now]);

  // All tasks (search + category only) for the board and calendar.
  const filteredAll = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter(
      (task) => (category === "all" || task.category === category) && matchesQuery(task, needle),
    );
  }, [tasks, category, query]);

  // Celebrate when everything is finished (with at least one completed task).
  const allDone = stats.total > 0 && stats.active === 0 && stats.completed > 0;
  const previousAllDone = useRef<boolean | null>(null);
  useEffect(() => {
    if (previousAllDone.current === null) {
      previousAllDone.current = allDone;
      return;
    }
    if (!previousAllDone.current && allDone) {
      setCelebrating(true);
      toast.success("All clear — nice work!", {
        description: "Every task is done or set aside.",
        duration: 4000,
      });
    }
    previousAllDone.current = allDone;
  }, [allDone]);

  const openNew = useCallback(() => {
    setEditing(null);
    setInitialDueAt(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((task: Task) => {
    setEditing(task);
    setInitialDueAt(null);
    setDialogOpen(true);
  }, []);

  const openCreateOn = useCallback(
    (date: Date) => {
      setEditing(null);
      setInitialDueAt(defaultDueForDay(date, now));
      setDialogOpen(true);
    },
    [now],
  );

  const selectView = useCallback((view: ViewMode) => {
    setViewMode(view);
    // Section focus only makes sense on the board.
    if (view !== "board") setFocusedSection(null);
    setMobileNavOpen(false);
  }, []);

  const selectCategory = useCallback((next: string | "all") => {
    setCategory(next);
    setMobileNavOpen(false);
  }, []);

  // Leaving fullscreen (e.g. via Esc) must return the maximize icon to normal.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        setWindowMode((mode) => (mode === "maximized" ? "normal" : mode));
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Minimize: collapse the board into a movable floating window, or restore it.
  const handleMinimize = useCallback(() => {
    setFloatPos(null);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setWindowMode((mode) => (mode === "floating" ? "normal" : "floating"));
  }, []);

  // Maximize: full-screen, or bring a floating window back up. Toggling again
  // restores. requestFullscreen must run inside the click gesture.
  const handleMaximize = useCallback(() => {
    if (windowMode === "maximized") {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      setWindowMode("normal");
      return;
    }
    setFloatPos(null);
    setWindowMode("maximized");
    void document.documentElement.requestFullscreen?.().catch(() => {
      // Fullscreen can be blocked by the browser; the layout still maximizes.
    });
  }, [windowMode]);

  // Close: leave the current board and return to the board manager landing page.
  const handleCloseBoard = useCallback(() => {
    router.push("/");
  }, [router]);

  // Dragging the floating window by its title bar. Buttons opt out on pointer
  // down, so clicks on the view switcher and window controls still work.
  const handleTitlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (windowMode !== "floating") return;
      const target = event.target as HTMLElement;
      if (target.closest("button, a, input, select, textarea, [role='tab']")) return;
      const rect = floatRef.current?.getBoundingClientRect();
      if (!rect) return;
      floatDrag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [windowMode],
  );

  const handleTitlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = floatDrag.current;
    if (!drag) return;
    const rect = floatRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 320;
    const height = rect?.height ?? 240;
    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - height - 8);
    setFloatPos({
      x: Math.min(Math.max(8, event.clientX - drag.dx), maxX),
      y: Math.min(Math.max(8, event.clientY - drag.dy), maxY),
    });
  }, []);

  const handleTitlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!floatDrag.current) return;
    floatDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  // Follow a task moved via the list's section arrows to where it now lives.
  const handleMovedToSection = useCallback(
    (sectionId: string) => {
      const section = sections.find((item) => item.id === sectionId);
      if (!section) return;
      setMobileNavOpen(false);
      if (section.status) {
        // Status sections feed a smart list (completed, canceled, overdue, upcoming).
        setSmartList(section.status);
      } else {
        // Custom sections live on the board — focus that section.
        setFocusedSection(sectionId);
        setViewMode("board");
      }
    },
    [sections],
  );

  useKeyboardShortcuts({
    onNew: () => {
      if (!dialogOpen && !helpOpen) openNew();
    },
    onSearch: () => {
      if (dialogOpen || helpOpen) return;
      // Search lives on the ribbon's Filter tab: open that tab and bump the
      // focus signal, which the field picks up as it mounts.
      setRibbonTab("filter");
      setSearchFocusSignal((value) => value + 1);
    },
    onHelp: () => {
      if (!dialogOpen) setHelpOpen(true);
    },
    onEscape: () => {
      if (mobileNavOpen) setMobileNavOpen(false);
      else if (helpOpen) setHelpOpen(false);
      else if (dialogOpen) setDialogOpen(false);
    },
  });

  const handleSubmit = useCallback(
    (draft: TaskDraft) => {
      if (editing) {
        updateTask(editing.id, draft);
        toast.success("Task updated", { duration: 2200 });
      } else {
        const task = addTask(draft);
        // A card created while a custom section is focused belongs to it,
        // instead of falling into the status column its due date implies.
        if (activeSection && isCustomSection(activeSection)) {
          assignTaskToSection(task.id, activeSection.id);
        }
        toast.success("Task added", { description: draft.title, duration: 2200 });
      }
    },
    [editing, addTask, updateTask, activeSection, assignTaskToSection],
  );

  const handleClearCompleted = useCallback(() => {
    const before = snapshot();
    const removed = clearCompleted();
    if (removed === 0) return;
    toast(`Cleared ${pluralize(removed, "completed task")}`, {
      duration: 6000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
  }, [clearCompleted, snapshot, restore]);

  const handleLoadSample = useCallback(() => {
    const before = snapshot();
    loadSample();
    toast.success("Sample tasks loaded", {
      duration: 6000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
  }, [loadSample, snapshot, restore]);

  const handleDeleteCategory = useCallback(
    (id: string) => {
      const before = snapshot();
      const info = deleteCategory(id);
      if (!info) return;
      // Never leave a filter pointing at a category that no longer exists.
      if (category === id) setCategory("all");
      toast(`Deleted “${info.label}”`, {
        description:
          info.affected > 0 ? `${pluralize(info.affected, "task")} no longer tagged` : undefined,
        duration: 6000,
        action: { label: "Undo", onClick: () => restore(before) },
      });
    },
    [category, deleteCategory, snapshot, restore],
  );

  const resetFilters = useCallback(() => {
    setQuery("");
    setCategory("all");
  }, []);

  const hasFilters = query.trim() !== "" || category !== "all";

  // On-screen ribbon inputs. The board gets sections + categories; the list
  // and calendar get categories only.
  const nonHiddenSections = useMemo(() => sections.filter((section) => !section.hidden), [sections]);
  const showCategoryFilter = categoryCounts.length > 0 || deletedCategories.length > 0;
  const filterCategories: RibbonCategories | undefined = showCategoryFilter
    ? {
        activeId: category,
        counts: categoryCounts,
        deleted: deletedCategories,
        onSelect: selectCategory,
        onDelete: handleDeleteCategory,
        onRestore: restoreCategories,
      }
    : undefined;
  const filterSections: RibbonSections = {
    activeId: activeSection?.id ?? null,
    items: nonHiddenSections,
    counts: sectionCounts,
    onSelect: (id: string | null) => setFocusedSection(id),
  };

  let welcomeState: ReactNode = null;
  let noResultsState: ReactNode = null;
  if (!isLoading) {
    welcomeState = (
      <EmptyState
        icon={Sparkles}
        title="Start your first task"
        message="Add a task and it will show up here. New here? Load a few sample tasks to look around."
        action={{ label: "New task", onClick: openNew, icon: Plus }}
        secondaryAction={{ label: "Load sample tasks", onClick: handleLoadSample }}
      />
    );
    noResultsState = (
      <EmptyState
        icon={Search}
        title="Nothing here"
        message={emptyMessage(smartList, query, category)}
        action={hasFilters ? { label: "Clear filters", onClick: resetFilters } : undefined}
      />
    );
  }

  const title =
    viewMode === "list"
      ? smartListLabel(smartList)
      : viewMode === "board"
        ? (activeSection?.title ?? "Board")
        : viewMode === "calendar"
          ? "Calendar"
          : "Insights";
  const subtitle =
    viewMode === "list"
      ? pluralize(listTasks.length, "task")
      : viewMode === "board"
        ? activeSection
          ? "Custom board section"
          : "Drag cards between sections to change status"
        : viewMode === "calendar"
          ? "Plan your month by due date"
          : "Your progress at a glance";

  let content: ReactNode;
  if (isLoading) {
    content = (
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <TaskSkeleton />
      </div>
    );
  } else if (viewMode === "list") {
    content = isEmpty ? (
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">{welcomeState}</div>
    ) : listTasks.length === 0 ? (
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">{noResultsState}</div>
    ) : (
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        {smartList === "completed" ? (
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <p className="text-sm text-muted-foreground">
              {pluralize(listTasks.length, "completed task")}
            </p>
            <button
              type="button"
              onClick={handleClearCompleted}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CheckCheck className="h-4 w-4" />
              Clear completed
            </button>
          </div>
        ) : null}
        <ListView
          tasks={listTasks}
          list={smartList}
          now={now}
          // The list has no drag and drop: reordering happens on the board.
          sortable={false}
          // Manual order still gets up/down arrows inside each group.
          reorderable={sort === "manual"}
          onEdit={openEdit}
          sections={sections}
          assignTaskToSection={assignTaskToSection}
          onMovedToSection={handleMovedToSection}
        />
      </div>
    );
  } else if (viewMode === "board") {
    content = isEmpty ? (
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">{welcomeState}</div>
    ) : filteredAll.length === 0 ? (
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">{noResultsState}</div>
    ) : (
      <div className="flex h-full min-h-0 w-full flex-col px-3 py-3 sm:px-4 sm:py-4">
        <BoardView
          tasks={filteredAll}
          now={now}
          sort={sort}
          focusedSectionId={activeSection?.id ?? null}
          onSortChange={setSort}
          onEdit={openEdit}
        />
      </div>
    );
  } else if (viewMode === "calendar") {
    content = isEmpty ? (
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">{welcomeState}</div>
    ) : (
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <CalendarView tasks={filteredAll} now={now} onEdit={openEdit} onCreateOn={openCreateOn} />
      </div>
    );
  } else {
    content = (
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
        <InsightsView now={now} />
      </div>
    );
  }

  const sidebarBase = {
    stats,
    currentBoardName: currentProjectName,
    pinned: sidebarPinned,
    onTogglePin: () => setSidebarPinned((value) => !value),
    onShowHelp: () => setHelpOpen(true),
  };

  const floating = windowMode === "floating";

  return (
    <>
      <div
        ref={floatRef}
        style={floating && floatPos ? { left: floatPos.x, top: floatPos.y } : undefined}
        className={cn(
          floating
            ? cn(
                "fixed z-40 flex h-[min(36rem,82dvh)] w-[min(34rem,92vw)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
                floatPos ? null : "right-6 bottom-6",
              )
            : "h-dvh w-full",
        )}
      >
        <AppShell
          sidebar={floating ? null : <Sidebar idPrefix="desktop" {...sidebarBase} />}
          mobileSidebar={
            <Sidebar
              {...sidebarBase}
              idPrefix="mobile"
              onClose={() => setMobileNavOpen(false)}
            />
          }
          ribbon={
            <ViewRibbon
              viewMode={viewMode}
              tab={ribbonTab}
              onTabChange={setRibbonTab}
              query={query}
              onQueryChange={setQuery}
              searchRef={searchRef}
              searchFocusSignal={searchFocusSignal}
              showCreate={viewMode !== "insights"}
              sort={sort}
              onSortChange={setSort}
              showSort={viewMode === "list" || viewMode === "board"}
              filterCategories={filterCategories}
              filterSections={filterSections}
              onClearCompleted={handleClearCompleted}
              showClearCompleted={viewMode === "list" && stats.completed > 0}
              onNewTask={openNew}
              onChangeView={selectView}
              floating={floating}
              maximized={windowMode === "maximized"}
              onMinimize={handleMinimize}
              onMaximize={handleMaximize}
              onCloseBoard={handleCloseBoard}
              onTitlePointerDown={handleTitlePointerDown}
              onTitlePointerMove={handleTitlePointerMove}
              onTitlePointerUp={handleTitlePointerUp}
            />
          }
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        >
          {content}
        </AppShell>
      </div>

      <p aria-live="polite" className="sr-only">
        {isLoading ? "Loading tasks" : title}
      </p>

      <TaskDialog
        open={dialogOpen}
        task={editing}
        initialDueAt={initialDueAt}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Celebration show={celebrating} onDone={() => setCelebrating(false)} />
    </>
  );
}

function emptyMessage(list: SmartList, query: string, category: string | "all"): string {
  if (query.trim()) return `No tasks match "${query.trim()}".`;
  if (category !== "all") {
    const info = getCategory(category);
    return `No tasks tagged ${info?.label ?? category}.`;
  }
  if (list === "all") return "There is nothing to show here yet.";
  return `You have no ${smartListLabel(list).toLowerCase()} tasks right now.`;
}

