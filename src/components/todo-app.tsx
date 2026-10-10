"use client";

import { CheckCheck, Plus, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { BoardView } from "@/components/board-view";
import { CalendarView } from "@/components/calendar-view";
import { Celebration } from "@/components/celebration";
import { EmptyState } from "@/components/empty-state";
import { InsightsView } from "@/components/insights-view";
import { ListView } from "@/components/list-view";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { Sidebar, type SidebarCategory } from "@/components/sidebar";
import { TaskDialog } from "@/components/task-dialog";
import { TaskSkeleton } from "@/components/task-skeleton";
import { TopBar } from "@/components/top-bar";
import { useTasksContext } from "@/components/tasks-provider";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useNow } from "@/hooks/use-now";
import { CATEGORIES, getCategory } from "@/lib/categories";
import {
  countBySmartList,
  filterBySmartList,
  smartListLabel,
} from "@/lib/smart-lists";
import { computeStats, matchesQuery, sortTasks } from "@/lib/tasks-selectors";
import type { SmartList, SortKey, Task, TaskDraft, ViewMode } from "@/lib/types";
import { pluralize } from "@/lib/utils";

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
    isLoading,
    isEmpty,
    addTask,
    updateTask,
    clearCompleted,
    snapshot,
    restore,
    loadSample,
  } = useTasksContext();
  const now = useNow();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [smartList, setSmartList] = useState<SmartList>("today");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("manual");
  const [category, setCategory] = useState<string | "all">("all");
  const [focusedSection, setFocusedSection] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [initialDueAt, setInitialDueAt] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => countBySmartList(tasks, now), [tasks, now]);
  const stats = useMemo(() => computeStats(tasks, now), [tasks, now]);

  // The section focus only applies while a section still exists.
  const activeSection = useMemo(
    () => (focusedSection ? (sections.find((section) => section.id === focusedSection) ?? null) : null),
    [focusedSection, sections],
  );

  const sectionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const task of tasks) {
      if (task.sectionId) map[task.sectionId] = (map[task.sectionId] ?? 0) + 1;
    }
    return map;
  }, [tasks]);

  const categoryCounts = useMemo<SidebarCategory[]>(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.category) map.set(task.category, (map.get(task.category) ?? 0) + 1);
    }
    return CATEGORIES.map((item) => ({ id: item.id, count: map.get(item.id) ?? 0 })).filter(
      (item) => item.count > 0,
    );
  }, [tasks]);

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

  const selectList = useCallback((list: SmartList) => {
    setSmartList(list);
    setFocusedSection(null);
    setViewMode("list");
    setMobileNavOpen(false);
  }, []);

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

  const selectSection = useCallback((id: string) => {
    setFocusedSection((current) => (current === id ? null : id));
    setViewMode("board");
    setMobileNavOpen(false);
  }, []);

  useKeyboardShortcuts({
    onNew: () => {
      if (!dialogOpen && !helpOpen) openNew();
    },
    onSearch: () => {
      if (!dialogOpen && !helpOpen) searchRef.current?.focus();
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
        addTask(draft);
        toast.success("Task added", { description: draft.title, duration: 2200 });
      }
    },
    [editing, addTask, updateTask],
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

  const resetFilters = useCallback(() => {
    setQuery("");
    setCategory("all");
  }, []);

  const hasFilters = query.trim() !== "" || category !== "all";

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
          sortable={sort === "manual"}
          onEdit={openEdit}
        />
      </div>
    );
  } else if (viewMode === "board") {
    content = isEmpty ? (
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">{welcomeState}</div>
    ) : filteredAll.length === 0 ? (
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">{noResultsState}</div>
    ) : (
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <BoardView
          tasks={filteredAll}
          now={now}
          sort={sort}
          focusedSectionId={activeSection?.id ?? null}
          onClearFocus={() => setFocusedSection(null)}
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
    viewMode,
    smartList,
    counts,
    stats,
    category,
    categoryCounts,
    sections,
    sectionCounts,
    focusedSection: activeSection?.id ?? null,
    onSelectList: selectList,
    onSelectView: selectView,
    onSelectCategory: selectCategory,
    onSelectSection: selectSection,
    onShowHelp: () => setHelpOpen(true),
    onToggleCollapse: () => setSidebarCollapsed((value) => !value),
  };

  return (
    <>
      <AppShell
        sidebar={
          <Sidebar idPrefix="desktop" collapsed={sidebarCollapsed} {...sidebarBase} />
        }
        mobileSidebar={
          <Sidebar
            {...sidebarBase}
            idPrefix="mobile"
            collapsed={false}
            onClose={() => setMobileNavOpen(false)}
          />
        }
        topBar={
          <TopBar
            title={title}
            subtitle={subtitle}
            viewMode={viewMode}
            onChangeView={selectView}
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
            now={now}
            searchRef={searchRef}
            showSort={viewMode === "list" || viewMode === "board"}
            showQuickAdd={viewMode !== "insights"}
            onNewTask={openNew}
            onShowHelp={() => setHelpOpen(true)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        }
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      >
        {content}
      </AppShell>

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
