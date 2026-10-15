"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDndContext,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  FileSearch,
  GripVertical,
  Plus,
  Search,
  Upload,
  X,
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
import { BoardDragPreview, ManagerBoardCard } from "@/components/board/board-manager-card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel, Input } from "@/components/ui/field";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { useWindowsContext } from "@/components/providers/window-provider";
import type { StrideProject } from "@/lib/domain/projects";
import {
  EMPTY_BOARD_LAYOUT,
  boardLayoutFromOrder,
  boardLayoutOrder,
  moveBoardInLayout,
  reconcileBoardLayout,
  removeBoardFromLayout,
  sanitizeBoardLayout,
  type BoardLayout,
} from "@/lib/features/board-layout";
import { buildWorkspace } from "@/lib/data/storage";
import { pluralize } from "@/lib/utils/utils";

/** Which board dialog is open, so only one can ever show at a time. */
type ManagerDialog = "create" | "remove" | null;

/** Private pin list: a JSON array of board ids, remembered across sessions. */
const PINS_STORAGE_KEY = "stride.board-pins.v1";

/** Legacy linear order (pre-layout), read once to seed the layout on migration. */
const ORDER_STORAGE_KEY = "stride.board-order.v1";

/** Saved layout payload: `{ cols, order }` — boards in display order.
 *  Older payloads stored a sparse `{ cols, cells }` grid instead; both are read
 *  (see `sanitizeBoardLayout`). `cols` is a legacy hint kept for stored payloads;
 *  the grid renders with the viewport's column count. */
const LAYOUT_STORAGE_KEY = "stride.board-layout.v1";

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

/** Pins: a JSON array of board ids, read once at mount (no storage on the server). */
function readPins(): Set<string> {
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
}

/**
 * Reads the saved board order, migrating older payloads as needed: a compact
 * `{ cols, order }` layout is used directly, a legacy sparse `{ cols, cells }`
 * grid has its gaps flattened, and the pre-layout linear order is the last
 * fallback. Same hydration-safe pattern as pins: nothing on the server, and a
 * failure falls through to a fresh fill rather than breaking the page.
 */
function readInitialLayout(): BoardLayout {
  if (typeof window === "undefined") return EMPTY_BOARD_LAYOUT;
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw) {
      const parsed = sanitizeBoardLayout(JSON.parse(raw));
      if (parsed) return parsed;
    }
    const legacy = window.localStorage.getItem(ORDER_STORAGE_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        const ids = parsed.filter((id): id is string => typeof id === "string");
        if (ids.length > 0) return boardLayoutFromOrder(ids);
      }
    }
  } catch {
    // Unreadable layout — fall back to a fresh, board-id-ordered fill.
  }
  return EMPTY_BOARD_LAYOUT;
}

/**
 * Landing page: every board the user owns, in one place. It has no shell of its
 * own (the sidebar and top bar belong to the task view), so it carries the
 * Stride wordmark itself and hands off to `/tasks` once a board is opened —
 * creating, importing and loading a board all mean "work in this board now".
 *
 * In edit mode the boards are one ordered row: dragging a board onto another
 * inserts it there and the rest shift along, so the grid is always compact (row
 * 1 reads 1 2 3, row 2 reads 4 5, never a gap). The edit grid is the very same
 * responsive grid as browse mode, so the cards are the same size in both — one
 * order just reads the same way whether you are arranging or browsing.
 */
export function BoardManager(): JSX.Element {
  const router = useRouter();
  const {
    projects,
    isLoading,
    createProject,
    duplicateProject,
    renameProject,
    removeProject,
    importProject,
  } = useTasksContext();
  const { openBoard } = useWindowsContext();

  const [dialog, setDialog] = useState<ManagerDialog>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Pins and the grid layout live in their own keys, read once at mount. There
  // is no localStorage on the server, and a storage failure must never break the
  // landing page. Safe to read here: the skeleton still covers the very first
  // client render, so the server and hydration output agree.
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => readPins());
  const [layout, setLayout] = useState<BoardLayout>(() => readInitialLayout());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editToggleRef = useRef<HTMLButtonElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());
  const gridRef = useRef<HTMLDivElement>(null);
  // True while the active drag came from the keyboard (no meaningful pointer).
  const keyboardDragRef = useRef(false);

  // A single "now" snapshot keeps every card and the overview strip consistent.
  // The server has no clock: stay null there so the prerender output stays
  // deterministic. The client reads it once at first render — safe because the
  // skeleton still covers that render.
  const [now, setNow] = useState<Date | null>(() =>
    typeof window === "undefined" ? null : new Date(),
  );

  // Deadline stats go stale while the tab stays open, so refresh the snapshot
  // every minute. (setState from an interval callback is lint-safe.)
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const boardIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const byId = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  // The load-time repair: drop cells whose board is gone, de-dupe, and append
  // any board the layout missed. Everything below renders from this, so the page
  // is correct even with a missing or garbage stored layout.
  const resolvedLayout = useMemo(
    () => reconcileBoardLayout(layout, boardIds),
    [layout, boardIds],
  );

  // Boards in display order — the browse-mode sequence and the list the edit
  // grid renders (and reorders) directly.
  const orderedIds = useMemo(
    () => boardLayoutOrder(resolvedLayout, boardIds),
    [resolvedLayout, boardIds],
  );
  const ordered = useMemo(
    () =>
      orderedIds
        .map((id) => byId.get(id))
        .filter((project): project is StrideProject => project !== undefined),
    [orderedIds, byId],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ordered.filter((project) => project.name.toLowerCase().includes(q)) : ordered;
  }, [ordered, query]);

  // The grid renders two transparent groups — pinned first, then the rest — in
  // true display order; the combined list drives keyboard nav.
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

  // Same sensors as the board view: a 6px pointer constraint lets plain clicks
  // through, and arrow-key drags walk the sortable grid card by card (dnd-kit's
  // own coordinate getter handles the wrapping rows).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Pointer drags only resolve while inside the grid, so letting go outside
  // cancels the drop (over === null). Keyboard drags have no pointer, so they
  // always snap to the nearest card.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    if (!keyboardDragRef.current) {
      const pointer = args.pointerCoordinates;
      const grid = gridRef.current?.getBoundingClientRect();
      if (pointer && grid) {
        const inside =
          pointer.x >= grid.left &&
          pointer.x <= grid.right &&
          pointer.y >= grid.top &&
          pointer.y <= grid.bottom;
        if (!inside) return [];
      }
    }
    return closestCenter(args);
  }, []);

  function handleDragStart(event: DragStartEvent): void {
    // KeyboardSensor activations arrive as KeyboardEvents; pointer drags do not.
    keyboardDragRef.current = event.activatorEvent instanceof KeyboardEvent;
  }

  // Keyboard nav must not hijack typing: dialogs, edit mode and any
  // input/textarea/select keep their own key handling. While editing, cards
  // are moved with the grip (and its arrow-key drag), never the card-nav keys.
  const canNavigate = useCallback(
    (element: Element | null): boolean => {
      if (dialog !== null || editMode) return false;
      if (!element) return false;
      return !isEditable(element);
    },
    [dialog, editMode],
  );

  const loadBoard = useCallback(
    (project: StrideProject): void => {
      // Opening a board is a hand-off: it becomes an open window and the work
      // happens on /tasks.
      openBoard(project.id);
      router.push("/tasks");
    },
    [router, openBoard],
  );

  function writePins(next: Set<string>): void {
    try {
      window.localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Storage blocked — pins keep working for this session.
    }
  }

  const persistLayout = useCallback((next: BoardLayout): void => {
    try {
      window.localStorage.setItem(
        LAYOUT_STORAGE_KEY,
        JSON.stringify({ cols: next.cols, order: next.order }),
      );
    } catch {
      // Storage blocked — the in-memory layout still applies this session.
    }
  }, []);

  function togglePin(id: string): void {
    const next = new Set(pinnedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPinnedIds(next);
    writePins(next);
  }

  /** Drop: insert the dragged board at the target's position; the rest shift. */
  function handleDragEnd(event: DragEndEvent): void {
    keyboardDragRef.current = false;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = resolvedLayout.order.indexOf(String(active.id));
    const to = resolvedLayout.order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const next = moveBoardInLayout(resolvedLayout, from, to);
    if (next === resolvedLayout) return;
    setLayout(next);
    persistLayout(next);
  }

  /** Leaves edit mode; the layout is already persisted on every change. */
  const finishEditing = useCallback((): void => {
    setEditMode(false);
    // Record any boards reconciliation appended since the last explicit edit.
    persistLayout(resolvedLayout);
    // Hand focus back to the Rearrange button, so keyboard users land on the
    // control that just changed (Done, Esc, or the toggle itself).
    requestAnimationFrame(() => editToggleRef.current?.focus());
  }, [resolvedLayout, persistLayout]);

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
    // A gone board has no business staying pinned or keeping a place in the
    // order.
    if (pinnedIds.has(project.id)) {
      const next = new Set(pinnedIds);
      next.delete(project.id);
      setPinnedIds(next);
      writePins(next);
    }
    const nextLayout = removeBoardFromLayout(resolvedLayout, project.id);
    if (nextLayout !== resolvedLayout) {
      setLayout(nextLayout);
      persistLayout(nextLayout);
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
    // An import is only useful once you are working in the board, so open it
    // as a window and follow it into the task view.
    const imported = importProject(importedName, workspace);
    if (imported) openBoard(imported);
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

      // Escape closes an open dialog, then exits edit mode, then clears the
      // search. The search box and the inline title editor cancel/clear on
      // their own.
      if (event.key === "Escape") {
        if (dialog !== null) {
          closeDialog();
          event.preventDefault();
          return;
        }
        if (editMode) {
          finishEditing();
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
  }, [canNavigate, dialog, query, visible, focusedId, loadBoard, closeDialog, editMode, finishEditing]);

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

  // One card renderer shared by both groups and the edit grid, so they can
  // never drift apart. `className` lets the edit grid stretch a card to its row.
  const renderCard = (project: StrideProject, className?: string) => (
    <ManagerBoardCard
      key={project.id}
      project={project}
      removable={!lastBoard}
      focused={project.id === focusedId}
      isPinned={pinnedIds.has(project.id)}
      editMode={editMode}
      now={now}
      className={className}
      onLoad={loadBoard}
      onRename={(id, name) => {
        renameProject(id, name);
        toast.success("Board renamed", { description: name, duration: 2500 });
      }}
      onDuplicate={(target) => {
        const copy = duplicateProject(target.id);
        if (!copy) return;
        // Duplicating activates the copy, so open it as a window and follow it
        // in — the same hand-off as New board, Import and opening a board.
        openBoard(copy);
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
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="font-display text-lg tracking-tight">Stride</p>
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              Focused task manager
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-5 sm:mt-9 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-[1.1] tracking-tight text-balance sm:text-4xl">
              Board manager
            </h1>
            <p className="mt-2.5 max-w-prose text-sm text-pretty text-muted-foreground">
              Open a board to pick up right where you left off.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
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



      {/* Toolbar: the board search and the arranging toggle share one row, so the
          page's controls read as a single strip under the header. While
          arranging, the row becomes the edit bar instead — one mode, one place
          to look. */}
      {editMode ? (
        <EditGridBar onDone={() => finishEditing()} />
      ) : (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="relative w-full sm:max-w-sm">
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

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {!isLoading && query.trim() === "" && projects.length > 0 ? (
              <Button
                ref={editToggleRef}
                variant="secondary"
                aria-label="Rearrange boards"
                title="Rearrange boards"
                onClick={() => setEditMode(true)}
              >
                <GripVertical className="h-4 w-4" strokeWidth={2.5} />
                Rearrange
              </Button>
            ) : null}
          </div>
        </div>
      )}

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
        {editMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* The same responsive grid as browse mode (`sm:grid-cols-2
                xl:grid-cols-3`), so an edit-mode card — and the card you drag —
                is exactly the real card's size at every breakpoint. One ordered
                sequence wraps into it, so dropping a card in a new place shifts
                the rest along instead of leaving a gap. */}
            <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
              <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {ordered.map((project) => renderCard(project, "h-full"))}
              </div>
            </SortableContext>
            <GridDragOverlay projects={projects} now={now} pinnedIds={pinnedIds} />
          </DndContext>
        ) : isLoading ? (
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
                  {pinnedBoards.map((project) => renderCard(project))}
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
                    {restBoards.map((project) => renderCard(project))}
                  </div>
                </section>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {restBoards.map((project) => renderCard(project))}
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

      <div className="mt-10">
        <BoardStatsChart
          boards={overview.boards}
          open={overview.open}
          overdue={overview.overdue}
        />
      </div>

      <CreateBoardDialog
        open={dialog === "create"}
        onClose={closeDialog}
        onCreate={(name) => {
          // A blank field falls back to the default "New board" name.
          const created = createProject(name.trim() || undefined);
          closeDialog();
          // The fresh board is already active, so open it and go work in it.
          if (created) openBoard(created);
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

/**
 * Sticky toolbar shown while arranging: a grip cue on the left names the mode
 * without a sentence, and Done (with its Esc shortcut) stays one click away even
 * when the grid is long enough to scroll.
 */
function EditGridBar({ onDone }: { onDone: () => void }): JSX.Element {
  return (
    <div className="sticky top-2 z-30 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-primary/25 bg-card/90 px-3.5 py-2.5 shadow-xs backdrop-blur-sm sm:px-4">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
      >
        <GripVertical className="h-4 w-4" strokeWidth={2.4} />
      </span>
      <div className="ml-auto flex items-center gap-2.5">
        <kbd
          aria-hidden="true"
          title="Press Esc to finish"
          className="pointer-events-none hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground sm:inline-block"
        >
          Esc
        </kbd>
        <Button onClick={onDone} title="Finish rearranging (Esc)">
          <Check className="h-4 w-4" strokeWidth={2.5} />
          Done
        </Button>
      </div>
    </div>
  );
}

/**
 * The floating ghost that follows the pointer during an edit-mode drag: a
 * lightweight material copy of the dragged board, sized to the source card and
 * lifted/rotated so it reads as "in hand" above the gliding grid.
 */
function GridDragOverlay({
  projects,
  now,
  pinnedIds,
}: {
  projects: StrideProject[];
  now: Date | null;
  pinnedIds: Set<string>;
}): JSX.Element {
  const { active } = useDndContext();
  const reduceMotion = useReducedMotion();
  if (!active) return <></>;
  const project = projects.find((candidate) => candidate.id === String(active.id));
  if (!project) return <></>;
  return (
    // Size the overlay from the source card's own rect (dnd-kit's default). Do
    // NOT set an explicit width from `active.rect.current.initial`: while the
    // overlay is mounted that value is `draggingNodeRect`, which dnd-kit derives
    // from the overlay's *measured* child (`dragOverlay.rect`). The preview here
    // is `w-full`, so sizing the wrapper from that measurement fed straight back
    // into the observer and grew the ghost's width forever. Letting dnd-kit use
    // the draggable node's initial rect keeps the ghost at the card's size.
    // The drop settles with a quick fade instead of blinking out of existence;
    // the tilt is dropped entirely when motion is reduced.
    <DragOverlay dropAnimation={reduceMotion ? null : { duration: 160, easing: "ease-out" }}>
      <div
        className="pointer-events-none"
        // A second wrapper keeps the scale/rotate from fighting DragOverlay's
        // own positioning transform — one inline transform, nothing stacked.
        style={reduceMotion ? undefined : { transform: "scale(1.03) rotate(1.5deg)" }}
      >
        <BoardDragPreview project={project} now={now} pinned={pinnedIds.has(project.id)} />
      </div>
    </DragOverlay>
  );
}



/** Donut chart summarizing board statistics at the bottom of the page. */
function BoardStatsChart({
  boards,
  open,
  overdue,
}: {
  boards: number;
  open: number;
  overdue: number;
}): JSX.Element {
  const reduceMotion = useReducedMotion();
  const slices = [
    { label: "Boards", value: boards, color: "var(--primary)" },
    { label: "Open tasks", value: open, color: "var(--success)" },
    { label: "Overdue tasks", value: overdue, color: "var(--destructive)" },
  ];
  const total = boards + open + overdue;

  const radius = 60;
  const strokeWidth = 13;
  const size = (radius + strokeWidth) * 2;
  const center = size / 2;
  // Each segment is trimmed at both ends by half a cap plus a sliver of air, so
  // the round caps leave a crisp notch between neighbours instead of overlapping.
  const circumference = 2 * Math.PI * radius;
  const endTrim = (strokeWidth / 2 + 2.25) / circumference;

  // Two compact figures derived from the same props, so the wide row reads as a
  // deliberate stat strip instead of a lone circle floating in empty space.
  const overdueRate = open > 0 ? `${Math.round((overdue / open) * 100)}%` : "—";
  const openPerBoard = boards > 0 ? (open / boards).toFixed(1) : "—";

  let elapsed = 0;
  const arcs = slices
    .filter((slice) => slice.value > 0)
    .map((slice, index) => {
      const sweep = slice.value / Math.max(total, 1);
      const start = elapsed;
      elapsed += sweep;
      return {
        ...slice,
        index,
        rotation: start * 360,
        pathLength: Math.max(sweep - endTrim * 2, 0.008),
        percentage: Math.round(sweep * 100),
      };
    });

  return (
    <div>
      <h2 className="font-display text-sm font-semibold tracking-tight">Board stats</h2>
      {/* One wide row: the circle anchors the left, a thin rule separates it from
          the breakdown on the right, and the two columns below spread to the far
          edge — so the section fills the container instead of hugging the centre. */}
      <div className="mt-5 flex flex-col gap-8 sm:flex-row sm:items-center sm:gap-10 lg:gap-14">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="mx-auto h-auto w-40 shrink-0 sm:mx-0 sm:w-44 lg:w-52"
          role="img"
          aria-label={`Board statistics: ${boards} ${pluralize(boards, "board")}, ${open} open ${pluralize(open, "task")}, ${overdue} overdue ${pluralize(overdue, "task")}`}
        >
          {/* Soft full-ring track behind the slices. */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={strokeWidth}
          />
          <g transform={`rotate(-90 ${center} ${center})`}>
            {arcs.map((arc) => (
              <motion.circle
                key={arc.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: arc.pathLength }}
                transform={`rotate(${arc.rotation} ${center} ${center})`}
                transition={{
                  duration: reduceMotion ? 0 : 0.9,
                  delay: reduceMotion ? 0 : 0.15 + arc.index * 0.12,
                  ease: "easeOut",
                }}
              >
                <title>{`${arc.label}: ${arc.value} (${arc.percentage}%)`}</title>
              </motion.circle>
            ))}
          </g>
          <text
            x={center}
            y={center - 4}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-foreground"
            fontSize="22"
            fontWeight="700"
          >
            {total}
          </text>
          <text
            x={center}
            y={center + 16}
            textAnchor="middle"
            className="fill-muted-foreground uppercase"
            fontSize="8"
            fontWeight="600"
            letterSpacing="0.08em"
          >
            Total
          </text>
        </svg>

        <div aria-hidden="true" className="hidden w-px self-stretch bg-border sm:block" />

        {/* Breakdown (left) and the two derived figures (right); both stretch to
            the container edge, and the whole thing stacks on narrow screens. */}
        <div className="grid w-full min-w-0 flex-1 gap-x-10 gap-y-7 md:grid-cols-2">
          <dl className="flex flex-col justify-center gap-4">
            {slices.map((slice) => {
              const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
              return (
                <div key={slice.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="flex min-w-0 items-center gap-2.5 text-sm text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-foreground/10"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="truncate">{slice.label}</span>
                    </dt>
                    <dd className="flex shrink-0 items-baseline gap-2">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {slice.value}
                      </span>
                      {total > 0 ? (
                        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                          {pct}%
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                      style={{ width: `${pct}%`, backgroundColor: slice.color }}
                    />
                  </div>
                </div>
              );
            })}
          </dl>

          <div className="flex flex-col justify-center gap-6">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Overdue rate
              </p>
              <p className="mt-1.5 font-display text-2xl leading-none tabular-nums text-foreground">
                {overdueRate}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">of open tasks</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Open per board
              </p>
              <p className="mt-1.5 font-display text-2xl leading-none tabular-nums text-foreground">
                {openPerBoard}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">average</p>
            </div>
          </div>
        </div>
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
      description="An empty board. Add your own sections and columns."
      className="sm:max-w-md"
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
      title={project ? `Delete “${project.name}”?` : "Delete board"}
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
