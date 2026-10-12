"use client";

import {
  Check,
  FileSearch,
  LayoutGrid,
  ListChecks,
  Plus,
  Search,
  TriangleAlert,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type JSX,
} from "react";
import { toast } from "sonner";
import { ManagerBoardCard } from "@/components/board-manager-card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel, Input } from "@/components/ui/field";
import { useTasksContext } from "@/components/tasks-provider";
import type { StrideProject } from "@/lib/projects";
import { buildWorkspace } from "@/lib/storage";
import { cn, pluralize } from "@/lib/utils";

/** Which board dialog is open, so only one can ever show at a time. */
type ManagerDialog = "create" | "remove" | null;

/** Private pin list: a JSON array of board ids, remembered across sessions. */
const PINS_STORAGE_KEY = "stride.board-pins.v1";

/** True while the user is typing somewhere, so page-level shortcuts stand down. */
function isEditable(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

/**
 * Landing page: every board the user owns, in one place. It has no shell of its
 * own (the sidebar and top bar belong to the task view), so it carries the
 * Stride wordmark itself and hands off to `/tasks` once a board is opened —
 * creating, importing and loading a board all mean "work in this board now".
 */
export function BoardManager(): JSX.Element {
  const router = useRouter();
  const {
    projects,
    isLoading,
    createProject,
    duplicateProject,
    renameProject,
    switchProject,
    removeProject,
    importProject,
  } = useTasksContext();

  const [dialog, setDialog] = useState<ManagerDialog>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Pins live in their own key, read once at mount. There is no localStorage
  // on the server, and a storage failure must never break the landing page.
  // Safe to read here: the skeleton still covers the very first client render,
  // so the server and hydration output agree.
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(PINS_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((id): id is string => typeof id === "string"));
      }
    } catch {
      // Unreadable pins — start unpinned rather than breaking the landing page.
    }
    return new Set();
  });
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());

  // A single "now" snapshot keeps every card and the overview strip consistent.
  // The server has no clock: stay null there so the prerender output stays
  // deterministic. The client reads it once at first render — safe because the
  // skeleton still covers that render, so server and hydration output agree
  // and cards/tallies paint only once the snapshot is real.
  const [now, setNow] = useState<Date | null>(() =>
    typeof window === "undefined" ? null : new Date(),
  );

  // Deadline stats go stale while the tab stays open, so refresh the snapshot
  // every minute. (setState from an interval callback is lint-safe.)
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  // Boards keep their creation order — oldest first, newest last — so the grid
  // is stable and predictable. Pins only split the list into two groups; they
  // never reorder within a group.
  const sorted = useMemo(
    () => [...projects].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    [projects],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((project) => project.name.toLowerCase().includes(q)) : sorted;
  }, [sorted, query]);

  // The grid renders two transparent groups — pinned first, then the rest —
  // and the combined list drives keyboard nav.
  const pinnedBoards = useMemo(
    () => visible.filter((project) => pinnedIds.has(project.id)),
    [visible, pinnedIds],
  );
  const restBoards = useMemo(
    () => visible.filter((project) => !pinnedIds.has(project.id)),
    [visible, pinnedIds],
  );

  // Overview strip: totals across every board, so the landing page still reads
  // as a dashboard rather than a bare file list.
  const overview = useMemo(() => {
    let open = 0;
    let overdue = 0;
    for (const project of projects) {
      for (const task of project.workspace.tasks) {
        if (task.completed || task.canceled) continue;
        open += 1;
        // Deadline tallies wait for the post-hydration clock snapshot.
        if (!now) continue;
        if (!task.dueAt) continue;
        const due = Date.parse(task.dueAt);
        if (Number.isNaN(due)) continue;
        if (due - now.getTime() < 0) overdue += 1;
      }
    }
    return { boards: projects.length, open, overdue };
  }, [projects, now]);

  const lastBoard = projects.length <= 1;
  const removeTarget = projects.find((project) => project.id === removeId) ?? null;

  // Keyboard nav must not hijack typing: dialogs and any input/textarea/select
  // keep their own key handling.
  const canNavigate = useCallback(
    (element: Element | null): boolean => {
      if (dialog !== null) return false;
      if (!element) return false;
      return !isEditable(element);
    },
    [dialog],
  );

  const loadBoard = useCallback(
    (project: StrideProject): void => {
      switchProject(project.id);
      // Opening a board is a hand-off: the work happens on /tasks.
      router.push("/tasks");
    },
    [router, switchProject],
  );

  function togglePin(id: string): void {
    const next = new Set(pinnedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPinnedIds(next);
    try {
      window.localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Storage blocked — pins keep working for this session.
    }
  }

  const closeDialog = useCallback((): void => {
    setDialog(null);
    setRemoveId(null);
  }, []);

  function handleRemove(project: StrideProject): void {
    const removed = removeProject(project.id);
    // A false return means the last board (or an id that is already gone):
    // close quietly, there is nothing worth reporting.
    closeDialog();
    if (!removed) return;
    // A gone board has no business staying pinned.
    if (pinnedIds.has(project.id)) {
      const next = new Set(pinnedIds);
      next.delete(project.id);
      setPinnedIds(next);
      try {
        window.localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Ignore — the in-memory set already dropped the id.
      }
    }
    toast.success(`Deleted “${project.name}”`, { duration: 2500 });
  }

  /** Downloads one board's workspace as a portable `.json` file. */
  function handleSaveBoard(project: StrideProject): void {
    const payload = {
      app: "Stride",
      kind: "board",
      version: 1,
      exportedAt: new Date().toISOString(),
      name: project.name,
      workspace: project.workspace,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = boardFileName(project.name);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(`Saved “${project.name}” as a file`, { duration: 2500 });
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast.error("That file could not be read as a Stride board.");
      return;
    }

    // The export wraps the workspace, but a bare `{ tasks, sections, boards }`
    // payload (or a bare task array) imports just as well.
    const inner = (parsed as { workspace?: unknown } | null)?.workspace;
    const workspace = buildWorkspace(inner ?? parsed);
    if (!workspace) {
      toast.error("That file could not be read as a Stride board.");
      return;
    }

    const importedName = uniqueBoardName(
      typeof (parsed as { name?: unknown }).name === "string"
        ? ((parsed as { name: string }).name.trim() || "Imported board")
        : "Imported board",
    );
    importProject(importedName, workspace);
    // An import is only useful once you are working in the board, so follow it
    // into the task view instead of leaving the user on the manager.
    router.push("/tasks");
    toast.success(`Imported “${importedName}”`, {
      description: `${pluralize(workspace.tasks.length, "task")} · ${pluralize(workspace.boards.length, "category", "categories")} · ${pluralize(workspace.sections.length, "section")}`,
      duration: 2500,
    });
  }

  /** Appends " (2)", " (3)", … until the name is free among the boards. */
  function uniqueBoardName(name: string): string {
    if (!projects.some((project) => project.name === name)) return name;
    let suffix = 2;
    while (projects.some((project) => project.name === `${name} (${suffix})`)) suffix += 1;
    return `${name} (${suffix})`;
  }

  // Page-level shortcuts: "/" search, "n" new board, Escape clears the search
  // first, arrows roam the grid, Enter/Space opens the focused card. Everything
  // is guarded so typing and open overlays always win.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented) return;

      // "/" focuses the search box when idle.
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (!canNavigate(document.activeElement)) return;
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // "n" opens the New board dialog.
      if (event.key.toLowerCase() === "n" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (!canNavigate(document.activeElement)) return;
        event.preventDefault();
        setDialog("create");
        return;
      }

      // Escape closes an open dialog; otherwise it clears the search first.
      // The search box and the inline title editor cancel/clear on their own.
      if (event.key === "Escape") {
        if (dialog !== null) {
          closeDialog();
          event.preventDefault();
          return;
        }
        if (isEditable(document.activeElement)) return;
        if (query !== "") setQuery("");
        return;
      }

      // Arrow keys move focus between cards (roving tabindex).
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        if (!canNavigate(document.activeElement)) return;
        const count = visible.length;
        if (count === 0) return;
        const currentIndex = visible.findIndex((project) => project.id === focusedId);
        const base = currentIndex === -1 ? 0 : currentIndex;
        const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
        const next = (base + delta + count) % count;
        const target = visible[next];
        setFocusedId(target.id);
        cardEls.current.get(target.id)?.focus();
        event.preventDefault();
        return;
      }

      // Enter / Space opens the focused card (and its own surface only).
      if (event.key === "Enter" || event.key === " ") {
        if (!canNavigate(document.activeElement)) return;
        const element = document.activeElement;
        if (!(element instanceof HTMLElement) || element.dataset.card !== "true") return;
        event.preventDefault();
        const project = visible.find((candidate) => candidate.id === element.dataset.boardId);
        if (!project) return;
        loadBoard(project);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [canNavigate, dialog, query, visible, focusedId, loadBoard, closeDialog]);

  // Keep the roving focus on a card that still exists; otherwise settle on the
  // first visible card. Re-anchoring happens during render, guarded by the
  // last-seen list key — the documented alternative to a setState-in-effect,
  // and the same commit either way.
  const visibleKey = visible.map((project) => project.id).join("|");
  const [knownVisibleKey, setKnownVisibleKey] = useState(visibleKey);
  if (visibleKey !== knownVisibleKey) {
    setKnownVisibleKey(visibleKey);
    if (visible.length === 0) {
      setFocusedId(null);
    } else if (focusedId === null || !visible.some((project) => project.id === focusedId)) {
      setFocusedId(visible[0].id);
    }
  }

  // One card renderer shared by both groups, so they can never drift apart.
  const renderCard = (project: StrideProject) => (
    <ManagerBoardCard
      key={project.id}
      project={project}
      removable={!lastBoard}
      focused={project.id === focusedId}
      isPinned={pinnedIds.has(project.id)}
      now={now}
      onLoad={loadBoard}
      onRename={(id, name) => {
        renameProject(id, name);
        toast.success("Board renamed", { description: name, duration: 2500 });
      }}
      onDuplicate={(target) => {
        const copy = duplicateProject(target.id);
        if (!copy) return;
        // Duplicating activates the copy, so follow it in — the same hand-off
        // as New board, Import and opening a board.
        toast.success(`Duplicated “${target.name}”`, {
          description: "Working in the copy",
          duration: 2500,
        });
        router.push("/tasks");
      }}
      onRemove={(target) => {
        setRemoveId(target.id);
        setDialog("remove");
      }}
      onSave={handleSaveBoard}
      onTogglePin={togglePin}
      cardRef={(element) => {
        if (element) cardEls.current.set(project.id, element);
        else cardEls.current.delete(project.id);
      }}
    />
  );

  return (
    // The manager is now the root route with nothing around it, so it fills the
    // viewport and scrolls the document instead of a task-view content area.
    <div className="mx-auto min-h-dvh w-full max-w-6xl px-3 py-8 sm:px-4 sm:py-10 lg:py-14">
      {/* Wayfinding: the sidebar's wordmark, so a bare landing page still reads
          as Stride's front door rather than a loose card on a blank canvas. */}
      <header>
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15">
            <Check className="h-[18px] w-[18px]" strokeWidth={3} />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="font-display text-xl tracking-tight">Stride</p>
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              Focused task manager
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:mt-8 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight tracking-tight sm:text-3xl">
              Board manager
            </h1>
            <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
              Every board keeps its own tasks, categories and sections — open one to pick up
              where you left off.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" strokeWidth={2.5} />
              Import board
            </Button>
            <Button onClick={() => setDialog("create")}>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New board
            </Button>
          </div>
        </div>
      </header>

      {/* Slim overview strip: the landing page's pulse. */}
      <div className="mt-5 flex overflow-hidden divide-x divide-border rounded-2xl border border-border bg-card/70 shadow-xs">
        <OverviewStat
          icon={LayoutGrid}
          value={overview.boards}
          label={pluralize(overview.boards, "board")}
        />
        <OverviewStat
          icon={ListChecks}
          value={overview.open}
          label={pluralize(overview.open, "open task")}
        />
        <OverviewStat
          icon={TriangleAlert}
          value={overview.overdue}
          label={pluralize(overview.overdue, "overdue task")}
          danger={overview.overdue > 0}
        />
      </div>

      {/* Search toolbar. */}
      <div className="mt-4 flex items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2.2}
          />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                if (query) setQuery("");
                else event.currentTarget.blur();
              }
            }}
            aria-label="Search boards"
            placeholder="Search boards"
            className="h-10 pl-9 pr-9"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              title="Clear search"
              className="focus-ring absolute top-1/2 right-1.5 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
          ) : (
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground"
            >
              /
            </kbd>
          )}
        </div>
        <p role="status" className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {visible.length} of {pluralize(projects.length, "board")}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFile}
      />

      <section aria-label="Boards" className="mt-6 sm:mt-8">
        {/* SSR and the first client render both have no registry yet, so show
            placeholders instead of flashing an empty grid on the landing page. */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((card) => (
              <div
                key={card}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="skeleton h-9 w-9 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="skeleton h-4 w-3/4 rounded-md" />
                      <div className="skeleton h-3 w-1/2 rounded-md" />
                    </div>
                  </div>
                  <div className="skeleton h-8 w-8 shrink-0 rounded-lg" />
                </div>
                <div className="skeleton h-3 w-1/2 rounded-md" />
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div className="skeleton h-1.5 w-2/5 rounded-full" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="skeleton h-3 w-24 rounded-md" />
                  <div className="flex gap-1.5">
                    <div className="skeleton h-2.5 w-2.5 rounded-full" />
                    <div className="skeleton h-2.5 w-2.5 rounded-full" />
                    <div className="skeleton h-2.5 w-2.5 rounded-full" />
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
                  <div className="skeleton h-8 w-14 rounded-lg" />
                  <div className="skeleton h-8 w-20 rounded-lg" />
                  <div className="skeleton ml-auto h-8 w-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length > 0 ? (
          <div className="space-y-8">
            {pinnedBoards.length > 0 ? (
              <section aria-labelledby="boards-pinned-heading">
                <h2
                  id="boards-pinned-heading"
                  className="px-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Pinned
                </h2>
                <div className="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {pinnedBoards.map(renderCard)}
                </div>
              </section>
            ) : null}
            {restBoards.length > 0 ? (
              pinnedBoards.length > 0 ? (
                <section aria-labelledby="boards-all-heading">
                  <h2
                    id="boards-all-heading"
                    className="px-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    All boards
                  </h2>
                  <div className="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {restBoards.map(renderCard)}
                  </div>
                </section>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {restBoards.map(renderCard)}
                </div>
              )
            ) : null}
          </div>
        ) : (
          <NoBoardsPanel
            hasQuery={query.trim().length > 0}
            onClearSearch={() => setQuery("")}
            onCreate={() => setDialog("create")}
          />
        )}
      </section>

      <CreateBoardDialog
        open={dialog === "create"}
        onClose={closeDialog}
        onCreate={(name) => {
          // A blank field falls back to the default "New board" name.
          createProject(name.trim() || undefined);
          closeDialog();
          // The fresh board is already active, so go work in it.
          router.push("/tasks");
        }}
      />

      <RemoveBoardDialog
        open={dialog === "remove"}
        project={removeTarget}
        onClose={closeDialog}
        onConfirm={handleRemove}
      />
    </div>
  );
}

/** One headline number on the overview strip. */
function OverviewStat({
  icon: Icon,
  value,
  label,
  danger = false,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  /** Critical stat (overdue): tints the number and icon like the card rows. */
  danger?: boolean;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-3">
      <Icon
        className={cn("h-4 w-4 shrink-0", danger ? "text-destructive" : "text-muted-foreground")}
        strokeWidth={2.2}
      />
      <div className="min-w-0 leading-tight">
        <p className={cn("text-sm font-semibold tabular-nums", danger && "text-destructive")}>
          {value}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

interface NoBoardsPanelProps {
  hasQuery: boolean;
  onClearSearch: () => void;
  onCreate: () => void;
}

/** Friendly landing spot for an empty search (or an empty registry). */
function NoBoardsPanel({ hasQuery, onClearSearch, onCreate }: NoBoardsPanelProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-muted text-muted-foreground shadow-xs">
        <FileSearch className="h-5 w-5" strokeWidth={2} />
      </div>
      <h2 className="mt-4 font-display text-xl tracking-tight">
        {hasQuery ? "No boards match" : "No boards yet"}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {hasQuery
          ? "Nothing matches that name. Clear the search to see every board."
          : "Create your first board to start organizing tasks by category."}
      </p>
      <div className="mt-5 flex justify-center">
        {hasQuery ? (
          <Button variant="secondary" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        ) : (
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New board
          </Button>
        )}
      </div>
    </div>
  );
}

/** Lowercase, non-alphanumerics collapsed to single dashes. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `stride-board-work-2026-10-11.json` — dated so repeat saves stack up. */
function boardFileName(name: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `stride-board-${slugify(name) || "board"}-${stamp}.json`;
}

interface CreateBoardDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

function CreateBoardDialog({ open, onClose, onCreate }: CreateBoardDialogProps): JSX.Element {
  const [name, setName] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  const fieldId = useId();

  // A cancelled draft must never leak into the next creation. This adjusts
  // state during render (the documented "props changed" pattern) instead of
  // an effect, so opening the dialog never costs an extra cascading render.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName("");
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New board"
      description="An empty board with the default categories and sections."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(name);
        }}
        className="space-y-5"
      >
        <div>
          <FieldLabel htmlFor={fieldId}>Board name</FieldLabel>
          <Input
            id={fieldId}
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Board name"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create board</Button>
        </div>
      </form>
    </Dialog>
  );
}

interface RemoveBoardDialogProps {
  open: boolean;
  /** Board awaiting confirmation, or null while the dialog is closed. */
  project: StrideProject | null;
  onClose: () => void;
  onConfirm: (project: StrideProject) => void;
}

function RemoveBoardDialog({
  open,
  project,
  onClose,
  onConfirm,
}: RemoveBoardDialogProps): JSX.Element {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project ? `Delete ${project.name}?` : "Delete board"}
      description="Its tasks, categories and sections will be deleted. This cannot be undone."
      className="sm:max-w-md"
    >
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (project) onConfirm(project);
          }}
        >
          Delete board
        </Button>
      </div>
    </Dialog>
  );
}