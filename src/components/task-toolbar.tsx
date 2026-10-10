"use client";

import { CheckCheck, ChevronDown, Search, X } from "lucide-react";
import type { RefObject } from "react";
import { SORT_OPTIONS } from "@/lib/constants";
import { getCategory } from "@/lib/categories";
import type { SortKey } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TaskToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
  category: string | "all";
  onCategoryChange: (value: string | "all") => void;
  categoriesInUse: string[];
  completedCount: number;
  onClearCompleted: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

export function TaskToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  category,
  onCategoryChange,
  categoriesInUse,
  completedCount,
  onClearCompleted,
  searchRef,
}: TaskToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="focus-ring h-10 w-full rounded-xl border border-input bg-card/70 pr-16 pl-9 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground/70 hover:border-ring/50 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="focus-ring absolute top-1/2 right-2.5 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
              /
            </kbd>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as SortKey)}
              aria-label="Sort tasks"
              className="focus-ring h-10 cursor-pointer appearance-none rounded-xl border border-input bg-card/70 pr-9 pl-3 text-sm text-foreground shadow-xs transition-colors hover:border-ring/50"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {completedCount > 0 ? (
            <button
              type="button"
              onClick={onClearCompleted}
              className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card/70 px-3 text-sm font-medium text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
              title="Remove all completed tasks"
            >
              <CheckCheck className="h-4 w-4" />
              <span className="hidden lg:inline">Clear completed</span>
              <span className="tabular-nums">({completedCount})</span>
            </button>
          ) : null}
        </div>
      </div>

      {categoriesInUse.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Tags</span>
          <button
            type="button"
            onClick={() => onCategoryChange("all")}
            aria-pressed={category === "all"}
            className={cn(
              "focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              category === "all"
                ? "border-transparent bg-foreground text-background"
                : "border-border bg-card/70 text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {categoriesInUse.map((id) => {
            const info = getCategory(id);
            if (!info) return null;
            const isActive = category === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onCategoryChange(isActive ? "all" : id)}
                aria-pressed={isActive}
                className={cn(
                  "focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  isActive
                    ? cn("border-transparent bg-card text-foreground ring-1 ring-inset", info.ring)
                    : "border-border bg-card/70 text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", info.dot)} />
                {info.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
