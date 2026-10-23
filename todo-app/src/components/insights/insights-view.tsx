"use client";

import { useState } from "react";
import { InsightsPanel } from "@/components/insights/insights-panel";
import { StatsDashboard } from "@/components/insights/stats-dashboard";
import { InsightsFiltersView } from "@/components/insights/insights-filters";
import { ProductivityCharts } from "@/components/insights/productivity-charts";
import { QuickActions } from "@/components/insights/insights-quick-actions";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { DEFAULT_FILTERS, hasActiveFilters, resetFilters, type InsightsFilters } from "@/lib/features/insights-filters";

/** Dedicated dashboard: headline stats, the 7-day trend and a category breakdown. */
export function InsightsView({ now }: { now: Date }) {
  const { tasks, boards } = useTasksContext();
  const [filters, setFilters] = useState<InsightsFilters>(DEFAULT_FILTERS);

  const activeFilters = hasActiveFilters(filters);

  const handleFilterChange = (newFilters: InsightsFilters) => {
    setFilters(newFilters);
  };

  const handleReset = () => {
    setFilters(resetFilters());
  };

  // Check if there's any data to show
  const hasData = tasks.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky Filter Bar */}
      <InsightsFiltersView
        filters={filters}
        boards={boards}
        onChange={handleFilterChange}
        onReset={handleReset}
        hasActiveFilters={activeFilters}
      />

      {/* Main Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <StatsDashboard now={now} filters={filters} />
        <InsightsPanel now={now} filters={filters} />
      </div>

      {/* Productivity Charts (replaces "By category" section) */}
      {hasData ? (
        <ProductivityCharts tasks={tasks} filters={filters} boards={boards} now={now} />
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card/70 p-5 text-center">
          <p className="text-muted-foreground">No tasks yet. Create your first task to see insights.</p>
        </div>
      )}

      {/* Quick Actions */}
      <QuickActions
        tasks={tasks}
        filters={filters}
        boards={boards}
        hasActiveFilters={activeFilters}
        onReset={handleReset}
      />
    </div>
  );
}