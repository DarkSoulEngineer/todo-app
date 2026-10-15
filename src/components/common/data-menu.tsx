"use client";

import { motion } from "framer-motion";
import { Database, Download, Sparkles, Trash2, Upload, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { SAMPLE_BOARDS, createSampleTasks } from "@/lib/data/sample";
import { parseWorkspaceJson } from "@/lib/data/storage";
import { cn } from "@/lib/utils/utils";

interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuItem({ icon: Icon, label, onClick, danger }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "focus-ring flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors",
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

export function DataMenu() {
  const { tasks, sections, boards, snapshot, restore } = useTasksContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
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

  function handleExport(): void {
    setOpen(false);
    const payload = {
      app: "Stride",
      version: 2,
      exportedAt: new Date().toISOString(),
      tasks,
      sections,
      boards,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `stride-backup-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${tasks.length} task${tasks.length === 1 ? "" : "s"}`);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const text = await file.text();
    const imported = parseWorkspaceJson(text);
    if (!imported) {
      toast.error("That file could not be read as a Janus backup.");
      return;
    }

    const before = snapshot();
    restore(imported);
    toast.success(
      `Imported ${imported.tasks.length} task${imported.tasks.length === 1 ? "" : "s"} and ${imported.sections.length} section${imported.sections.length === 1 ? "" : "s"}`,
      {
        duration: 6000,
        action: { label: "Undo", onClick: () => restore(before) },
      },
    );
  }

  function handleLoadSamples(): void {
    setOpen(false);
    const sampleTasks = createSampleTasks();
    const before = snapshot();
    restore({ tasks: sampleTasks, sections: before.sections, boards: SAMPLE_BOARDS });
    toast.success(`Loaded ${sampleTasks.length} sample tasks`, {
      description: "Example tasks with custom categories to explore boards and views.",
      duration: 6000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
  }

  function handleClearAll(): void {
    setOpen(false);
    if (tasks.length === 0) return;
    const before = snapshot();
    restore({ tasks: [], sections: before.sections, boards: before.boards });
    toast(`Cleared ${before.tasks.length} task${before.tasks.length === 1 ? "" : "s"}`, {
      duration: 6000,
      action: { label: "Undo", onClick: () => restore(before) },
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Backup and data options"
        title="Backup & data"
        className="focus-ring grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Database className="h-[18px] w-[18px]" />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFile}
      />

      {open ? (
        <motion.div
          role="menu"
          aria-label="Backup and data options"
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          className="absolute right-0 z-30 mt-2 w-56 origin-top-right rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
        >
          <MenuItem icon={Download} label="Export backup" onClick={handleExport} />
          <MenuItem
            icon={Upload}
            label="Import backup"
            onClick={() => {
              setOpen(false);
              inputRef.current?.click();
            }}
          />
          <div className="my-1 h-px bg-border" />
          <MenuItem icon={Sparkles} label="Load sample tasks" onClick={handleLoadSamples} />
          <MenuItem icon={Trash2} label="Clear all tasks" onClick={handleClearAll} danger />
        </motion.div>
      ) : null}
    </div>
  );
}
