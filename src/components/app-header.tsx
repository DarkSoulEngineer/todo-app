"use client";

import { Check, Keyboard, Plus } from "lucide-react";
import { DataMenu } from "@/components/data-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  onNewTask: () => void;
  onShowHelp: () => void;
}

export function AppHeader({ onNewTask, onShowHelp }: AppHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15">
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
        <div className="leading-tight">
          <h1 className="font-display text-[1.75rem] tracking-tight">Stride</h1>
          <p className="text-xs font-medium text-muted-foreground">Focused task manager</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onShowHelp}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="focus-ring hidden h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:grid"
        >
          <Keyboard className="h-[18px] w-[18px]" />
        </button>
        <DataMenu />
        <ThemeToggle />
        <Button onClick={onNewTask} className="shadow-sm">
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          <span className="hidden xs:inline">New task</span>
          <span className="xs:hidden">New</span>
        </Button>
      </div>
    </header>
  );
}
