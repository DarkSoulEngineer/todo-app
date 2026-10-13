"use client";

import { Calendar, Filter, X, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils/utils";
import { boardColor } from "@/lib/domain/boards";
import type { InsightsFilters, DateRangePreset, StatusFilterOption, PriorityFilterOption } from "@/lib/features/insights-filters";
import type { Board } from "@/lib/domain/boards";

interface InsightsFiltersProps {
  filters: InsightsFilters;
  boards: Board[];
  onChange: (filters: InsightsFilters) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "custom", label: "Custom" },
];

const STATUS_OPTIONS: { value: StatusFilterOption; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "📋" },
  { value: "completed", label: "Completed", icon: "✅" },
  { value: "overdue", label: "Overdue", icon: "⚠️" },
  { value: "canceled", label: "Canceled", icon: "❌" },
];

const PRIORITY_OPTIONS: { value: PriorityFilterOption; label: string; color: string }[] = [
  { value: "all", label: "All", color: "" },
  { value: "high", label: "High", color: "text-red-600 dark:text-red-400" },
  { value: "medium", label: "Medium", color: "text-amber-600 dark:text-amber-400" },
  { value: "low", label: "Low", color: "text-green-600 dark:text-green-400" },
];

export function InsightsFiltersView({
  filters,
  boards,
  onChange,
  onReset,
  hasActiveFilters,
}: InsightsFiltersProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const customStartRef = useRef<HTMLInputElement>(null);
  const customEndRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const boardDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCustomOpen(false);
      }
      if (boardDropdownRef.current && !boardDropdownRef.current.contains(event.target as Node)) {
        setIsBoardOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDateRangeChange = (preset: DateRangePreset) => {
    onChange({ ...filters, dateRange: preset });
    if (preset !== "custom") {
      setIsCustomOpen(false);
    }
  };

  const handleCustomDateChange = (field: "start" | "end", date: Date | null) => {
    if (field === "start") {
      onChange({ ...filters, customStart: date });
    } else {
      onChange({ ...filters, customEnd: date });
    }
  };

  const handleStatusChange = (status: StatusFilterOption) => {
    onChange({ ...filters, status });
  };

  const handlePriorityChange = (priority: PriorityFilterOption) => {
    onChange({ ...filters, priority });
  };

  const handleBoardChange = (boardId: string) => {
    onChange({ ...filters, boardId });
    setIsBoardOpen(false);
  };

  const formatDateForInput = (date: Date | null): string => {
    if (!date) return "";
    return date.toISOString().split("T")[0];
  };

  const parseInputDate = (value: string): Date | null => {
    if (!value) return null;
    const date = new Date(value + "T00:00:00");
    return isNaN(date.getTime()) ? null : date;
  };

  const handleCustomStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = parseInputDate(e.target.value);
    handleCustomDateChange("start", date);
  };

  const handleCustomEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = parseInputDate(e.target.value);
    handleCustomDateChange("end", date);
  };

  return (
    <div
      className="sticky top-16 z-20 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4"
      role="search"
      aria-label="Insights filters"
    >
      {/* Date Range */}
      <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
        <label htmlFor="date-range" className="sr-only">
          Date range
        </label>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
            "bg-muted text-muted-foreground hover:bg-muted/80 focus-ring"
          )}
          onClick={() => setIsCustomOpen(!isCustomOpen)}
          aria-expanded={isCustomOpen}
          aria-haspopup="listbox"
        >
          <Calendar className="h-4 w-4" strokeWidth={2.4} />
          <span>
            {DATE_RANGE_OPTIONS.find((o) => o.value === filters.dateRange)?.label || "Custom"}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isCustomOpen && "rotate-180")} />
        </button>

        {isCustomOpen && (
          <div className="absolute z-30 mt-1.5 flex flex-col gap-2 rounded-lg border border-border bg-card p-2 shadow-lg min-w-[280px] sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-1" role="listbox" aria-label="Quick date ranges">
              {DATE_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={filters.dateRange === option.value}
                  onClick={() => handleDateRangeChange(option.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    filters.dateRange === option.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {filters.dateRange === "custom" && (
              <div className="flex items-center gap-2 border-t border-border/60 pt-2 sm:border-t-0 sm:pl-2 sm:border-l">
                <label htmlFor="custom-start" className="sr-only">
                  Start date
                </label>
                <input
                  ref={customStartRef}
                  id="custom-start"
                  type="date"
                  value={formatDateForInput(filters.customStart)}
                  onChange={handleCustomStartChange}
                  className="h-9 w-36 rounded-md border border-input bg-background px-2 text-sm focus-ring"
                  max={formatDateForInput(filters.customEnd || new Date())}
                />
                <span className="text-muted-foreground">to</span>
                <label htmlFor="custom-end" className="sr-only">
                  End date
                </label>
                <input
                  ref={customEndRef}
                  id="custom-end"
                  type="date"
                  value={formatDateForInput(filters.customEnd)}
                  onChange={handleCustomEndChange}
                  className="h-9 w-36 rounded-md border border-input bg-background px-2 text-sm focus-ring"
                  min={formatDateForInput(filters.customStart)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Status filter">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleStatusChange(option.value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all",
              "focus-ring",
              filters.status === option.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            aria-pressed={filters.status === option.value}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>

      {/* Priority Filter */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Priority filter">
        {PRIORITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handlePriorityChange(option.value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all",
              "focus-ring",
              filters.priority === option.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
              option.value !== "all" && option.color
            )}
            aria-pressed={filters.priority === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Board Filter */}
      <div className="flex flex-wrap items-center gap-2" ref={boardDropdownRef}>
        <label htmlFor="board-filter" className="sr-only">
          Board filter
        </label>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
            "bg-muted text-muted-foreground hover:bg-muted/80 focus-ring"
          )}
          onClick={() => setIsBoardOpen(!isBoardOpen)}
          aria-expanded={isBoardOpen}
          aria-haspopup="listbox"
        >
          <Filter className="h-4 w-4" strokeWidth={2.4} />
          <span>
            {filters.boardId === "all"
              ? "All boards"
              : boards.find((b) => b.id === filters.boardId)?.label || "All boards"}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isBoardOpen && "rotate-180")} />
        </button>

        {isBoardOpen && (
          <div
            className="absolute z-30 mt-1.5 w-56 rounded-lg border border-border bg-card p-1 shadow-lg"
            role="listbox"
            aria-label="Select board"
          >
            <button
              type="button"
              role="option"
              aria-selected={filters.boardId === "all"}
              onClick={() => handleBoardChange("all")}
              className={cn(
                "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                filters.boardId === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-muted" />
              All boards
            </button>
            {boards.map((board) => {
              const color = boardColor(board.color);
              return (
                <button
                  key={board.id}
                  type="button"
                  role="option"
                  aria-selected={filters.boardId === board.id}
                  onClick={() => handleBoardChange(board.id)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                    filters.boardId === board.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", color.dot)} />
                  {board.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Reset Filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-ring"
          aria-label="Reset all filters"
        >
          <X className="h-4 w-4" strokeWidth={2.4} />
          Reset
        </button>
      )}
    </div>
  );
}