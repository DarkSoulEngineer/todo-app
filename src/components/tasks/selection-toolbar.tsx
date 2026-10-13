"use client";

import { Check, ChevronDown, Circle, Minus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useTasksContext } from "@/components/providers/tasks-provider";
import type { BoardSection, Task } from "@/lib/domain/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils/utils";

interface SelectionToolbarProps {
  selectedIds: Set<string>;
  visibleTasks: Task[];
  sections: BoardSection[];
  onClear: () => void;
  children?: ReactNode;
}

export function SelectionToolbar({
  selectedIds,
  visibleTasks,
  sections,
  onClear,
}: SelectionToolbarProps) {
  const { toggleComplete, toggleCancel, deleteTask, updateTask, assignTaskToSection, snapshot, restore } = useTasksContext();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuAnchorRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const count = selectedIds.size;
  const selectedTasks = visibleTasks.filter((t) => selectedIds.has(t.id));

  // Compute available bulk actions based on selection
  const canComplete = selectedTasks.some((t) => !t.completed && !t.canceled);
  const canCancel = selectedTasks.some((t) => !t.canceled);
  const canRestore = selectedTasks.some((t) => t.completed || t.canceled);
  const canDelete = count > 0;

  // Determine applicable sections for "Move to section"
  const applicableSections = sections.filter((s) => {
    if (s.hidden) return false;
    // Only show sections that aren't already the task's current section for ALL selected tasks
    return selectedTasks.every((t) => {
      if (s.status === "completed") return !t.completed;
      if (s.status === "canceled") return !t.canceled;
      if (s.status === "overdue") return !(t.dueAt && new Date(t.dueAt) < new Date());
      if (s.status === "upcoming") return !(t.dueAt && new Date(t.dueAt) >= new Date()) || !t.dueAt;
      return t.sectionId !== s.id;
    });
  });

  function handleBulkAction(action: () => void, label: string) {
    const before = snapshot();
    action();
    toast.success(`${label} (${count})`, {
      duration: 3000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
  }

  function handleBulkComplete() {
    handleBulkAction(() => {
      selectedTasks.forEach((t) => {
        if (!t.completed && !t.canceled) toggleComplete(t.id);
      });
    }, "Completed");
  }

  function handleBulkCancel() {
    handleBulkAction(() => {
      selectedTasks.forEach((t) => {
        if (!t.canceled) toggleCancel(t.id);
      });
    }, "Canceled");
  }

  function handleBulkRestore() {
    handleBulkAction(() => {
      selectedTasks.forEach((t) => {
        if (t.completed) toggleComplete(t.id);
        else if (t.canceled) toggleCancel(t.id);
      });
    }, "Restored");
  }

  function handleBulkDelete() {
    handleBulkAction(() => {
      selectedTasks.forEach((t) => deleteTask(t.id));
    }, "Deleted");
  }

  function handleBulkPriority(priority: "low" | "medium" | "high") {
    const before = snapshot();
    selectedTasks.forEach((t) => {
      updateTask(t.id, { ...t, priority });
    });
    toast.success(`Priority set to ${priority} (${count})`, {
      duration: 3000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
  }

  function handleBulkMoveToSection(sectionId: string) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const before = snapshot();
    selectedTasks.forEach((t) => assignTaskToSection(t.id, sectionId));
    toast.success(`Moved to ${section.title} (${count})`, {
      duration: 3000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
    setOpenMenu(null);
  }

  // Close menu on outside click
  useEffect(() => {
    if (!openMenu) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [openMenu]);

  // Position menu
  useEffect(() => {
    if (!openMenu || !menuAnchorRef.current) return;
    const rect = menuAnchorRef.current.getBoundingClientRect();
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const margin = 8;
    let top = rect.bottom + 4;
    if (top + height > window.innerHeight - margin) top = rect.top - height - 4;
    let left = rect.left;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
    left = Math.max(margin, left);
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = "visible";
  }, [openMenu]);

  return (
    <>
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex w-full max-w-3xl items-center gap-2 px-4 animate-in slide-in-from-bottom-4 duration-200 sm:px-6"
        role="toolbar"
        aria-label="Bulk actions"
      >
        <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur-sm">
          <span className="shrink-0 text-sm font-medium text-foreground">
            {count} {count === 1 ? "task" : "tasks"} selected
          </span>

          <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {canComplete && (
              <Button
                variant="soft"
                size="sm"
                onClick={handleBulkComplete}
                className="whitespace-nowrap"
                aria-label={`Complete ${count} task${count > 1 ? "s" : ""}`}
              >
                <Check className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Complete</span>
              </Button>
            )}
            {canCancel && (
              <Button
                variant="soft"
                size="sm"
                onClick={handleBulkCancel}
                className="whitespace-nowrap"
                aria-label={`Cancel ${count} task${count > 1 ? "s" : ""}`}
              >
                <Minus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            )}
            {canRestore && (
              <Button
                variant="soft"
                size="sm"
                onClick={handleBulkRestore}
                className="whitespace-nowrap"
                aria-label={`Restore ${count} task${count > 1 ? "s" : ""}`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Restore</span>
              </Button>
            )}

            {/* Move to section dropdown */}
            {applicableSections.length > 0 && (
              <div className="relative">
                <button
                  ref={(el) => { menuAnchorRef.current = el; }}
                  type="button"
                  onClick={() => setOpenMenu(openMenu === "move" ? null : "move")}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "move"}
                  aria-label="Move to section"
                  className="focus-ring inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-muted px-3 text-sm font-medium transition-colors hover:bg-muted/80"
                >
                  <Circle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Move to…</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {openMenu === "move" && typeof document !== "undefined" ? (
                  createPortal(
                    <div
                      ref={menuRef}
                      role="menu"
                      aria-label="Move to section"
                      className="z-50 min-w-[160px] rounded-xl border border-border bg-popover p-1 shadow-xl"
                      style={{
                        position: "fixed",
                        top: -9999,
                        left: -9999,
                        visibility: "hidden",
                      }}
                    >
                      {applicableSections.map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          role="menuitem"
                          onClick={() => handleBulkMoveToSection(section.id)}
                          className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted"
                        >
                          <Circle className="h-3.5 w-3.5" />
                          {section.title}
                        </button>
                      ))}
                    </div>,
                    document.body
                  )
                ) : null}
              </div>
            )}

            {/* Set priority dropdown */}
            <div className="relative">
              <button
                ref={(el) => { menuAnchorRef.current = el; }}
                type="button"
                onClick={() => setOpenMenu(openMenu === "priority" ? null : "priority")}
                aria-haspopup="menu"
                aria-expanded={openMenu === "priority"}
                aria-label="Set priority"
                className="focus-ring inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-muted px-3 text-sm font-medium transition-colors hover:bg-muted/80"
              >
                <span className="hidden sm:inline">Priority</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {openMenu === "priority" && typeof document !== "undefined" ? (
                createPortal(
                  <div
                    ref={menuRef}
                    role="menu"
                    aria-label="Set priority"
                    className="z-50 min-w-[140px] rounded-xl border border-border bg-popover p-1 shadow-xl"
                    style={{
                      position: "fixed",
                      top: -9999,
                      left: -9999,
                      visibility: "hidden",
                    }}
                  >
                    {(["low", "medium", "high"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        role="menuitem"
                        onClick={() => handleBulkPriority(p)}
                        className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted"
                      >
                        <span
                          className={cn(
                            "h-3.5 w-3.5 rounded-full",
                            p === "high" && "bg-orange-500",
                            p === "medium" && "bg-amber-500",
                            p === "low" && "bg-sky-500"
                          )}
                        />
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>,
                  document.body
                )
              ) : null}
            </div>

            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkDelete}
                className="whitespace-nowrap"
                aria-label={`Delete ${count} task${count > 1 ? "s" : ""}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="ml-auto whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}