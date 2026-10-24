"use client";

import { CheckCheck, Plus, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { BoardView } from "@/components/board/board-view";
import { CalendarView } from "@/components/calendar/calendar-view";
import { Celebration } from "@/components/common/celebration";
import { Desktop } from "@/components/layout/desktop";
import { EmptyState } from "@/components/common/empty-state";
import { InsightsView } from "@/components/insights/insights-view";
import { ListView } from "@/components/list/list-view";
import { ShortcutsHelp } from "@/components/common/shortcuts-help";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskSkeleton } from "@/components/tasks/task-skeleton";
import { ViewRibbon, type CategoryCount, type RibbonCategories } from "@/components/layout/view-ribbon";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { useWindowsContext } from "@/components/providers/window-provider";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useNow } from "@/hooks/use-now";
import { getCategory, selectCategories } from "@/lib/domain/categories";
import { filterBySmartList, smartListLabel } from "@/lib/domain/smart-lists";
import { computeStats, matchesQuery, sortTasks } from "@/lib/domain/tasks-selectors";
import type { SmartList, SortKey, Task, TaskDraft, ViewMode, Workspace } from "@/lib/domain/types";
import { pluralize } from "@/lib/utils/utils";

/** How the board is presented: filling the viewport, or full-screen. */
type WindowMode = "normal" | "maximized";

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
    boards,
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
    currentProjectId,
  } = useTasksContext();
  const { ready: windowsReady, activeId, minimize, closeBoard } = useWindowsContext();
  const now = useNow();

  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [smartList] = useState<SmartList>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("manual");
  const [category, setCategory] = useState<string | "all">("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [initialDueAt, setInitialDueAt] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // The ribbon's open tab, and a counter that asks the ribbon's search field
  // for focus (raised by the "/" shortcut, which also opens the Filter tab).
  const [ribbonTab, setRibbonTab] = useState("home");
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

  // The task the activity feed just navigated to: ringed briefly so the user
  // can spot it among the board's cards.
  const [spotlightTaskId, setSpotlightTaskId] = useState<string | null>(null);
  const spotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Board window behaviour: docked or full-screen. Minimizing is a window-
  // manager concern (the board becomes an open window on the taskbar), so it
  // lives in the window store, not here.
  const [windowMode, setWindowMode] = useState<WindowMode>("normal");
  const [compactView, setCompactView] = useState(false);

  interface StoredVersion {
    id: string;
    label: string;
    createdAt: string;
    taskCount: number;
    workspace: Workspace;
  }
  const [versions, setVersions] = useState<StoredVersion[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("janus.versions.v1");
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as StoredVersion[];
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("janus.versions.v1", JSON.stringify(versions));
    } catch {}
  }, [versions]);

  const router = useRouter();

  const searchRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => computeStats(tasks, now), [tasks, now]);

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
  }, []);

  const selectCategory = useCallback((next: string | "all") => {
    setCategory(next);
  }, []);

  // Follow an activity entry to where the task lives: switch to the board and
  // briefly spotlight the located card. The board keeps every column visible so
  // the task is seen in context, and the canvas pans the highlighted card in.
  const openTaskLocation = useCallback((task: Task) => {
    setViewMode("board");
    // Ring the located card briefly so it is easy to spot.
    setSpotlightTaskId(task.id);
    if (spotlightTimerRef.current !== null) clearTimeout(spotlightTimerRef.current);
    spotlightTimerRef.current = setTimeout(() => setSpotlightTaskId(null), 1000);
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

  // Drop the pending spotlight timer if the app unmounts mid-countdown.
  useEffect(
    () => () => {
      if (spotlightTimerRef.current !== null) clearTimeout(spotlightTimerRef.current);
    },
    [],
  );

  // Minimize: hide the board completely and reveal the desktop + taskbar. The
  // board stays open (and its data persists) so it can be restored later.
  const handleMinimize = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    minimize();
  }, [minimize]);

  // Maximize: full-screen, or bring a floating board back up. Toggling again
  // restores. requestFullscreen must run inside the click gesture.
  const handleMaximize = useCallback(() => {
    if (windowMode === "maximized") {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      setWindowMode("normal");
      return;
    }
    setWindowMode("maximized");
    void document.documentElement.requestFullscreen?.().catch(() => {
      // Fullscreen can be blocked by the browser; the layout still maximizes.
    });
  }, [windowMode]);

  // Close: remove this board's window and return to the board manager, where
  // the user can open another board.
  const handleCloseBoard = useCallback(() => {
    closeBoard(currentProjectId);
    router.push("/");
  }, [closeBoard, currentProjectId, router]);

  useKeyboardShortcuts({
    onNew: () => {
      if (!dialogOpen && !helpOpen) openNew();
    },
    onSearch: () => {
      if (dialogOpen || helpOpen) return;
      // Search sits in the ribbon's top bar; bump the focus signal so it takes
      // focus from wherever the user is.
      setSearchFocusSignal((value) => value + 1);
    },
    onHelp: () => {
      if (!dialogOpen) setHelpOpen(true);
    },
    onEscape: () => {
      if (helpOpen) setHelpOpen(false);
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

  const createVersion = useCallback(() => {
    const version: StoredVersion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: `Version ${versions.length + 1}`,
      createdAt: new Date().toISOString(),
      taskCount: tasks.length,
      workspace: { tasks, sections, boards },
    };
    setVersions((prev) => [version, ...prev]);
    toast.success("Version saved", { duration: 2200 });
  }, [tasks, sections, boards, versions.length]);

  const restoreVersion = useCallback(
    (id: string) => {
      const version = versions.find((item) => item.id === id);
      if (!version) return;
      restore(version.workspace);
      toast.success("Version restored", { duration: 2200 });
    },
    [versions, restore],
  );

  const deleteVersion = useCallback((id: string) => {
    setVersions((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const resetFilters = useCallback(() => {
    setQuery("");
    setCategory("all");
  }, []);

  const hasFilters = query.trim() !== "" || category !== "all";

  // On-screen ribbon inputs: categories for the Options tab.
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
        ? "Board"
        : viewMode === "calendar"
          ? "Calendar"
          : "Insights";
  const subtitle =
    viewMode === "list"
      ? pluralize(listTasks.length, "task")
      : viewMode === "board"
        ? "Drag cards between sections to change status"
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
        {/* Read-only activity feed: cards navigate to where the task lives. */}
        <ListView tasks={listTasks} onOpenTask={openTaskLocation} now={now} />
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
          onSortChange={setSort}
          onEdit={openEdit}
          compactView={compactView}
          spotlightTaskId={spotlightTaskId}
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

  // Minimized: the window store reports no active board, so the work surface
  // gives way to the desktop and its taskbar. Waiting for hydration first means
  // a board restored from a saved session never flashes the desktop.
  if (windowsReady && activeId === null) {
    return <Desktop />;
  }

  return (
    <>
      <div className="h-dvh w-full">
        <AppShell
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
              compactView={compactView}
              onCompactViewChange={setCompactView}
              onLoadSample={handleLoadSample}
              filterCategories={filterCategories}
              onClearCompleted={handleClearCompleted}
              showClearCompleted={viewMode === "list" && stats.completed > 0}
              onNewTask={openNew}
              onChangeView={selectView}
              maximized={windowMode === "maximized"}
              onMinimize={handleMinimize}
              onMaximize={handleMaximize}
              onCloseBoard={handleCloseBoard}
              onShowHelp={() => setHelpOpen(true)}
            />
          }
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

