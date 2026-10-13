"use client";

import { Download, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils/utils";
import type { InsightsFilters } from "@/lib/features/insights-filters";
import type { Task } from "@/lib/domain/types";
import type { Board } from "@/lib/domain/boards";
import { exportTasksToCSV, filterTasksByFilters } from "@/lib/features/insights-filters";

interface QuickActionsProps {
  tasks: Task[];
  filters: InsightsFilters;
  boards: Board[];
  hasActiveFilters: boolean;
  onReset: () => void;
}

export function QuickActions({ tasks, filters, boards, hasActiveFilters, onReset }: QuickActionsProps) {
  const filteredTasks = useMemo(() => filterTasksByFilters(tasks, filters, new Date()), [tasks, filters]);

  const handleExportCSV = () => {
    const csv = exportTasksToCSV(filteredTasks, boards);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `tasks-export-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (filteredTasks.length === 0 && !hasActiveFilters) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"} match current filters
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={filteredTasks.length === 0}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-ring",
            filteredTasks.length === 0
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          aria-label="Export filtered tasks as CSV"
        >
          <Download className="h-4 w-4" strokeWidth={2.4} />
          Export CSV
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-ring"
            aria-label="Reset all filters"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.4} />
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}