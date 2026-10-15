"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { useReducedMotion } from "framer-motion";
import {
  Check,
  FileSearch,
  GripVertical,
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
  type ReactNode,
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
  cellId,
  cellIndexFromId,
  padBoardCells,
  placeBoardInLayout,
  reconcileBoardLayout,
  removeBoardFromLayout,
  sanitizeBoardLayout,
  type BoardLayout,
} from "@/lib/features/board-layout";
import { buildWorkspace } from "@/lib/data/storage";
import { cn, pluralize } from "@/lib/utils/utils";

/** Which board dialog is open, so only one can ever show at a time. */
type ManagerDialog = "create" | "remove" | null;

/** Private pin list: a JSON array of board ids, remembered across sessions. */
const PINS_STORAGE_KEY = "stride.board-pins.v1";

/** Legacy linear order (pre-2D), read once to seed the layout on migration. */
const ORDER_STORAGE_KEY = "stride.board-order.v1";

/** Saved layout payload: `{ cols, cells }` — cells row-major, `null` = gap.
 *  `cols` is a legacy hint kept for stored payloads; the grid renders with the
 *  viewport's column count. */
const LAYOUT_STORAGE_KEY = "stride.board-layout.v1";

/** Arrow-key moves during a keyboard drag: across a column, or a whole row. */
const KEYBOARD_CELL_STEPS: Record<string, (cols: number) => number> = {
  ArrowLeft: () => -1,
  ArrowRight: () => 1,
  ArrowUp: (cols) => -cols,
  ArrowDown: (cols) => cols,
};

/**
 * Edit-grid column count per viewport, mobile-first — the same rhythm as the
 * browse grid (1 → 2 → 3) stretched to 4 once the capped container can spare
 * the width. The grid follows the window instead of a manual stepper, so a
 * layout means "this row-major order" and reflows sanely at every size.
 */
const EDIT_GRID_BREAKPOINTS: ReadonlyArray<{ query: string; cols: number }> = [
  { query: "(min-width: 1280px)", cols: 4 },
  { query: "(min-width: 1024px)", cols: 3 },
  { query: "(min-width: 640px)", cols: 2 },
];

/**
 * The edit grid's live column count, tracked from the media queries above.
 * Starts at 1 (the server/narrow-phone value, so hydration agrees) and follows
 * the viewport afterwards. Edit mode is only ever entered by a click, long
 * after this hook has measured, so the first grid render is already correct.
 */
function useResponsiveGridCols(): number {
  const [cols, setCols] = useState(1);
  useEffect(() => {
    const entries = EDIT_GRID_BREAKPOINTS.map((entry) => ({
      entry,
      list: window.matchMedia(entry.query),
    }));
    const update = (): void => {
      const match = entries.find(({ list }) => list.matches);
      setCols(match ? match.entry.cols : 1);
    };
    update();
    for (const { list } of entries) list.addEventListener("change", update);
    return () => {
      for (const { list } of entries) list.removeEventListener("change", update);
    };
  }, []);
  return cols;
}

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
 * Reads the saved 2D layout, migrating the legacy linear order when no layout
 * exists yet. Same hydration-safe pattern as pins: nothing on the server, and a
 * failure falls through to a fresh row-major fill rather than breaking the page.
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
    // Unreadable layout — fall back to a fresh row-major fill.
  }
  return EMPTY_BOARD_LAYOUT;
}

/**
 * Landing page: every board the user owns, in one place. It has no shell of its
 * own (the sidebar and top bar belong to the task view), so it carries the
 * Stride wordmark itself and hands off to `/tasks` once a board is opened —
 * creating, importing and loading a board all mean "work in this board now".
 *
 * In edit mode the grid is a true 2D board: a board can be dropped onto any
 * cell, leaving gaps or swapping with whatever is already there. Its column
 * count follows the viewport (1 → 2 → 3 → 4), so one arrangement reads the same
 * way at every size. Browse mode just walks the same layout row-major,
 * collapsing the gaps.
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

  // The edit grid follows the viewport: 1 column on phones, up to 4 wide.
  const visibleCols = useResponsiveGridCols();

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

  // True layout order (row-major, gaps collapsed) — the browse-mode sequence and
  // the flattened list that drives keyboard nav.
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

  // Edit mode renders one sparse grid: every slot, empty or not, in place.
  // Padding follows the viewport's column count, so the last row is always a
  // full rectangle of real cells (and drop targets) at every size.
  const editCells = useMemo(() => {
    if (!editMode) return [] as Array<{ index: number; project: StrideProject | null }>;
    return padBoardCells(resolvedLayout.cells, visibleCols).map((id, index) => ({
      index,
      project: id ? byId.get(id) ?? null : null,
    }));
  }, [editMode, resolvedLayout, byId, visibleCols]);

  // The grid renders two transparent groups — pinned first, then the rest — in
  // true layout order; the combined list drives keyboard nav.
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

  // Arrow-key placement during a keyboard drag: hop to the neighbour cell. A
  // fresh closure each render is fine — the sensor reads its options at drag
  // start, and the grid geometry only changes between drags. "Across" and
  // "down" are measured in the viewport's current column count.
  const gridCols = visibleCols;
  const gridCellCount = editCells.length;
  const keyboardCellCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
    const step = KEYBOARD_CELL_STEPS[event.code];
    if (!step) return;
    const { droppableRects, collisionRect } = context;
    if (!collisionRect) return;
    if (gridCellCount <= 0) return;

    // The cell we are currently over is the one whose centre is nearest the
    // dragged card's centre.
    let currentIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    droppableRects.forEach((rect, id) => {
      const index = cellIndexFromId(id);
      if (index === null) return;
      const dx = rect.left + rect.width / 2 - (collisionRect.left + collisionRect.width / 2);
      const dy = rect.top + rect.height / 2 - (collisionRect.top + collisionRect.height / 2);
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        currentIndex = index;
      }
    });
    if (currentIndex === -1) return;

    const target = currentIndex + step(gridCols);
    if (target < 0 || target >= gridCellCount) return;
    const targetRect = droppableRects.get(cellId(target));
    if (!targetRect) return;

    const moveX =
      targetRect.left + targetRect.width / 2 - (collisionRect.left + collisionRect.width / 2);
    const moveY =
      targetRect.top + targetRect.height / 2 - (collisionRect.top + collisionRect.height / 2);
    return { x: currentCoordinates.x + moveX, y: currentCoordinates.y + moveY };
  };

  // Same sensors as the board view: a 6px pointer constraint lets plain clicks
  // through, and arrow-key drags move a focused card cell by cell.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCellCoordinates }),
  );

  // Pointer drags only resolve while inside the grid, so letting go outside
  // cancels the drop (over === null). Keyboard drags have no pointer, so they
  // always snap to the nearest cell centre.
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
        JSON.stringify({ cols: next.cols, cells: next.cells }),
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

  /** Drop: place the dragged board in the target cell (move or swap). */
  function handleDragEnd(event: DragEndEvent): void {
    keyboardDragRef.current = false;
    const { active, over } = event;
    if (!over) return;
    const overData = over.data.current as { type?: unknown; index?: unknown } | undefined;
    if (overData?.type !== "cell" || typeof overData.index !== "number") return;
    const next = placeBoardInLayout(resolvedLayout, String(active.id), overData.index);
    if (next === resolvedLayout) return;
    setLayout(next);
    persistLayout(next);
  }

  /** Leaves edit mode; the layout is already persisted on every change. */
  const finishEditing = useCallback((): void => {
    setEditMode(false);
    // Record any boards reconciliation appended since the last explicit edit.
    persistLayout(resolvedLayout);
    // Hand focus back to the Edit grid button, so keyboard users land on the
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
    // A gone board has no business staying pinned or keeping a grid slot.
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
  // never drift apart. `className` lets the 2D grid stretch a card to its cell.
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

      {/* Toolbar: search, the result count and the grid-editing toggle share one
          row, so the page's controls read as a single strip under the header.
          While arranging, the row becomes the edit bar instead — one mode, one
          place to look. */}
      {editMode ? (
        <EditGridBar onDone={() => finishEditing()} />
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="relative w-full sm:max-w-xs">
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
            <p role="status" className="text-xs tabular-nums text-muted-foreground">
              {visible.length} of {pluralize(projects.length, "board")}
            </p>
            {!isLoading && query.trim() === "" && projects.length > 0 ? (
              <Button
                ref={editToggleRef}
                variant="secondary"
                title="Arrange boards on a grid"
                onClick={() => setEditMode(true)}
              >
                <GripVertical className="h-4 w-4" strokeWidth={2.5} />
                Edit grid
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
            {/* The grid lays its cells out row-major in the viewport's current
                column count (1 → 2 → 3 → 4), so the same arrangement reflows
                instead of scrolling sideways. */}
            <div className="grid-scroll overflow-x-auto overscroll-x-contain pb-2">
              <div
                ref={gridRef}
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${visibleCols}, minmax(15rem, 1fr))`,
                }}
              >
                {editCells.map((cell) => (
                  <BoardCell key={cell.index} index={cell.index}>
                    {cell.project ? renderCard(cell.project, "h-full") : <EmptyCellSlot />}
                  </BoardCell>
                ))}
              </div>
            </div>
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
 * Sticky toolbar shown while arranging: it names the mode, states what the
 * gesture does, and keeps Done (with its Esc shortcut) one click away even
 * when the grid is long enough to scroll.
 */
function EditGridBar({ onDone }: { onDone: () => void }): JSX.Element {
  return (
    <div className="sticky top-2 z-30 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-primary/25 bg-card/90 px-3.5 py-2.5 shadow-xs backdrop-blur-sm sm:px-4">
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
        >
          <GripVertical className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <p id="edit-grid-hint" className="min-w-0 text-xs leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">Arrange boards.</span> Drag a board onto
          any cell — drop it on another board to swap. Empty cells stay as gaps.
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <kbd
          aria-hidden="true"
          title="Press Esc to finish"
          className="pointer-events-none hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground sm:inline-block"
        >
          Esc
        </kbd>
        <Button onClick={onDone} title="Finish arranging (Esc)">
          <Check className="h-4 w-4" strokeWidth={2.5} />
          Done
        </Button>
      </div>
    </div>
  );
}

/**
 * One cell of the edit grid: a drop target that wraps either a board card or an
 * empty slot, and paints the hover highlight over whichever it holds.
 */
function BoardCell({ index, children }: { index: number; children: ReactNode }): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: cellId(index), data: { type: "cell", index } });
  return (
    <div ref={setNodeRef} className="relative flex">
      <div className="min-w-0 flex-1">{children}</div>
      {isOver ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/[0.08] ring-2 ring-inset ring-primary/60"
        />
      ) : null}
    </div>
  );
}

/**
 * An empty grid slot: a faint dashed outline with a plus, so a free cell reads
 * as somewhere a board can land, not as a hole in the grid.
 */
function EmptyCellSlot(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="grid h-full min-h-[10rem] place-items-center rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03]"
    >
      <Plus className="h-5 w-5 text-primary/40" strokeWidth={2.2} />
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
    <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-3 sm:px-4">
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
