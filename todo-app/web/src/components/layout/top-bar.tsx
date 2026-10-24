"use client";

import { Keyboard, Menu, Plus } from "lucide-react";
import { DataMenu } from "@/components/common/data-menu";
import { Button } from "@/components/ui/button";
import { ViewSwitcher } from "@/components/common/view-switcher";
import type { ViewMode } from "@/lib/domain/types";

interface TopBarProps {
  title: string;
  subtitle: string;
  viewMode: ViewMode;
  onChangeView: (view: ViewMode) => void;
  onNewTask: () => void;
  onShowHelp: () => void;
  onOpenMobileNav: () => void;
}

/**
 * Title bar only: the working tools (search, quick add, sort, filters) live in
 * the ribbon below it, so nothing is offered in two places.
 */
export function TopBar({
  title,
  subtitle,
  viewMode,
  onChangeView,
  onNewTask,
  onShowHelp,
  onOpenMobileNav,
}: TopBarProps) {
  return (
    <header className="z-20 shrink-0 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl leading-tight tracking-tight">{title}</h1>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <ViewSwitcher active={viewMode} onChange={onChangeView} />

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
        <Button onClick={onNewTask} className="shrink-0">
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          <span className="hidden sm:inline">New task</span>
        </Button>
      </div>
    </header>
  );
}
