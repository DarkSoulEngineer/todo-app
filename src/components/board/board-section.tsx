"use client";

import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  EyeOff,
  GripVertical,
  Hash,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { BoardCard } from "@/components/board/board-card";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { STATUS_META } from "@/components/common/status-meta";
import { getBoardColorByLabel } from "@/lib/domain/boards";
import type { BoardSection, Task } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

interface BoardSectionColumnProps {
  section: BoardSection;
  tasks: Task[];
  /**
   * Live drag order for this column (includes the card being dragged while it
   * hovers here). When omitted the committed `tasks` order is used, so the
   * column renders identically outside a drag.
   */
  dragOrder?: Task[];
  now: Date;
  editing: boolean;
  isDropTarget: boolean;
  /** Manual sort mode: cards may be rearranged inside the column. */
  reorderable: boolean;
  onEdit: (task: Task) => void;
  onStartRename: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onCancelRename: () => void;
  onDelete: (id: string) => void;
  onHide: (id: string) => void;
  onAddCard: (sectionId: string, title: string) => void;
  /** When true, board cards render in the minimal (title + category) layout. */
  compactView?: boolean;
  /** Task id to briefly spotlight after activity navigation. */
  spotlightTaskId?: string | null;
}

export function BoardSectionColumn({
  section,
  tasks,
  dragOrder,
  now,
  editing,
  isDropTarget,
  reorderable,
  onEdit,
  onStartRename,
  onRename,
  onCancelRename,
  onDelete,
  onHide,
  onAddCard,
  compactView = false,
  spotlightTaskId,
}: BoardSectionColumnProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: section.id,
      data: { type: "section" },
      // Same loop-free guard as BoardCard: no derived-transform recompute.
      animateLayoutChanges: () => false,
    });
  const { reorderTasks } = useTasksContext();

  // Cards to render, in order: the live drag order while dragging, otherwise
  // the committed column order.
  const renderTasks = dragOrder ?? tasks;

  const orderedIds = useMemo(() => renderTasks.map((task) => task.id), [renderTasks]);

  /** One card with its FLAT column index, as the manual reorder arrows expect. */
  const renderCard = (task: Task, index: number) => (
    <BoardCard
      key={task.id}
      task={task}
      now={now}
      onEdit={onEdit}
      compactView={compactView}
      spotlight={task.id === spotlightTaskId}
      reorderIndex={reorderable ? index : undefined}
      reorderTotal={reorderable ? renderTasks.length : undefined}
      onReorder={reorderable ? handleReorder : undefined}
    />
  );

  /** Swaps a card with its neighbour inside this column (manual order only). */
  function handleReorder(taskId: string, direction: "up" | "down"): void {
    const from = orderedIds.indexOf(taskId);
    if (from === -1) return;
    const to = from + (direction === "up" ? -1 : 1);
    if (to < 0 || to >= orderedIds.length) return;
    reorderTasks(arrayMove(orderedIds, from, to));
  }

  const meta = section.status ? STATUS_META[section.status] : null;
  const categoryColor = meta ? null : getBoardColorByLabel(section.title);
  const Icon = meta?.icon ?? (categoryColor ? null : Hash);
  const chip = meta?.chip ?? (categoryColor ? categoryColor.pill : "bg-muted text-muted-foreground ring-border");

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={section.title}
      className={cn(
        "flex min-h-[15rem] w-[17rem] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-2.5 transition-colors sm:w-72",
        isDropTarget && "bg-primary/5 ring-2 ring-primary/30",
        isDragging && "opacity-50",
      )}
    >
      <header className="flex flex-col gap-1.5 px-0.5">
        {/* Row 1 — column controls: drag grip, icon chip, count badge, menu. */}
        <div className="flex items-center gap-1.5">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${section.title}`}
            title="Drag to reorder"
            className="focus-ring grid h-7 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Section icons removed from board view. */}

          <span className="ml-auto shrink-0 rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums ring-1 ring-inset ring-border">
            {tasks.length}
          </span>

          <SectionMenu
            section={section}
            onRename={() => onStartRename(section.id)}
            onDelete={() => onDelete(section.id)}
            onHide={() => onHide(section.id)}
          />
        </div>

        {/* Row 2 — the title spans the full column width, so it keeps many more
            letters before truncating; the rename editor takes the same slot. */}
        {editing ? (
          <SectionTitleEditor
            title={section.title}
            onSubmit={(value) => onRename(section.id, value)}
            onCancel={onCancelRename}
          />
        ) : (
          <h2 className="w-full min-w-0 truncate text-sm font-semibold" title={section.title}>
            {section.title}
          </h2>
        )}
      </header>

      <div className="flex min-w-0 flex-col gap-2.5">
        {tasks.length === 0 && renderTasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Drop cards here
          </p>
        ) : null}
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          {renderTasks.map((task, index) => renderCard(task, index))}
        </SortableContext>
      </div>

      <SectionComposer title={section.title} onAdd={(title) => onAddCard(section.id, title)} />
    </section>
  );
}

function SectionTitleEditor({
  title,
  onSubmit,
  onCancel,
}: {
  title: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(title);
  const skipBlur = useRef(false);

  function commit(): void {
    const trimmed = value.trim();
    if (trimmed && trimmed !== title) onSubmit(trimmed);
    else onCancel();
  }

  return (
    <form
      className="w-full min-w-0"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        skipBlur.current = true;
        commit();
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={() => {
          if (skipBlur.current) return;
          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            skipBlur.current = true;
            onCancel();
          }
        }}
        aria-label="Section name"
        className="focus-ring h-7 w-full min-w-0 rounded-md border border-input bg-card px-1.5 text-sm text-foreground"
      />
    </form>
  );
}

function SectionComposer({ title, onAdd }: { title: string; onAdd: (title: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  function submit(): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  }

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="focus-ring flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="h-4 w-4" strokeWidth={2.4} />
        Add card
      </button>
    );
  }

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        submit();
      }}
      className="rounded-xl border border-border bg-card p-1.5 shadow-sm"
    >
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setValue("");
            setAdding(false);
          }
        }}
        placeholder={`Add to ${title}…`}
        aria-label={`Add a card to ${title}`}
        className="focus-ring h-8 w-full min-w-0 rounded-md bg-transparent px-1.5 text-sm text-foreground placeholder:text-muted-foreground/70"
      />
      <div className="mt-1 flex items-center gap-1.5">
        <button
          type="submit"
          disabled={!value.trim()}
          className="focus-ring inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setValue("");
            setAdding(false);
          }}
          className="focus-ring inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SectionMenu({
  section,
  onRename,
  onDelete,
  onHide,
}: {
  section: BoardSection;
  onRename: () => void;
  onDelete: () => void;
  onHide: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const { width, height } = menu.getBoundingClientRect();
    const margin = 8;
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - margin) top = Math.max(margin, rect.top - height - 6);
    const right = Math.max(margin, Math.min(window.innerWidth - rect.right, window.innerWidth - width - margin));
    setPos({ top, right });
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Options for ${section.title}`}
        className="focus-ring grid h-7 w-7 place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {typeof document !== "undefined" && open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={`Options for ${section.title}`}
              style={{
                position: "fixed",
                top: pos?.top ?? -9999,
                right: pos?.right ?? -9999,
                visibility: pos ? "visible" : "hidden",
              }}
              className="z-[110] w-44 rounded-xl border border-border bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
            >
              {section.status === undefined ? (
                <MenuButton icon={Pencil} label="Rename" onClick={onRename} close={setOpen} />
              ) : null}
              {section.status !== undefined ? (
                <MenuButton icon={EyeOff} label="Hide section" onClick={onHide} close={setOpen} />
              ) : null}
              {section.status === undefined ? (
                <>
                  <div className="my-1 h-px bg-border" />
                  <MenuButton icon={Trash2} label="Delete section" onClick={onDelete} close={setOpen} danger />
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  close,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  close: (open: boolean) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        close(false);
        onClick();
      }}
      className={cn(
        "focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors",
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}