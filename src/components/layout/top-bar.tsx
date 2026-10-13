"use client";

import { ChevronDown, Keyboard, Menu, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { RefObject } from "react";
import { DataMenu } from "@/components/common/data-menu";
import { QuickAdd } from "@/components/tasks/quick-add";
import { Button } from "@/components/ui/button";
import { ViewSwitcher } from "@/components/common/view-switcher";
import { SORT_OPTIONS } from "@/lib/domain/constants";
import type { SortKey, ViewMode } from "@/lib/domain/types";

interface TopBarProps {
  title: string;
  subtitle: string;
  viewMode: ViewMode;
  onChangeView: (view: ViewMode) => void;
  query: string;
  onQueryChange: (value: string) => void;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
  now: Date;
  searchRef: RefObject<HTMLInputElement | null>;
  showSort: boolean;
  showQuickAdd: boolean;
  onNewTask: () => void;
  onShowHelp: () => void;
  onOpenMobileNav: () => void;
}

export function TopBar({
  title,
  subtitle,
  viewMode,
  onChangeView,
  query,
  onQueryChange,
  sort,
  onSortChange,
  now,
  searchRef,
  showSort,
  showQuickAdd,
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

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2 sm:px-4">
        {showQuickAdd ? (
          <div className="min-w-[13rem] flex-1">
            <QuickAdd now={now} variant="inline" />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="relative flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="focus-ring h-10 w-full rounded-xl border border-input bg-card/70 pr-9 pl-9 text-sm shadow-xs transition-colors placeholder:text-muted-foreground/70 hover:border-ring/50 sm:w-56"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {showSort ? (
          <div className="relative shrink-0">
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as SortKey)}
              aria-label="Sort tasks"
              className="focus-ring h-10 appearance-none rounded-xl border border-input bg-card/70 pr-8 pl-9 text-sm shadow-xs"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        ) : null}
      </div>
    </header>
  );
}
