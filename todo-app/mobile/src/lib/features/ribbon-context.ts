import type { ViewMode } from "@/lib/domain/types";

export type RibbonTab = "home" | "actions" | "filters" | "hidden" | "select";

export function getRibbonContext(mode: ViewMode) {
  return {
    selection: mode === "board",
    boardDisplay: mode === "board",
    // Activity and Calendar use their own chronological ordering.
    sorting: mode === "board",
    filters: true,
    search: mode !== "insights",
  };
}

export function isRibbonTabAvailable(tab: RibbonTab, mode: ViewMode): boolean {
  const context = getRibbonContext(mode);
  if (tab === "select") return context.selection;
  if (tab === "filters") return context.filters;
  if (tab === "hidden") return context.boardDisplay;
  return true;
}

export function resolveRibbonTab(mode: ViewMode, tab: RibbonTab, previousTab: RibbonTab, selecting: boolean): RibbonTab {
  if (selecting && getRibbonContext(mode).selection) return "select";
  const candidate = tab === "select" ? previousTab : tab;
  return candidate !== "select" && isRibbonTabAvailable(candidate, mode) ? candidate : "home";
}
