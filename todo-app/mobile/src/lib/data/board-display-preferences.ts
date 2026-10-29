export interface BoardDisplayPreferences {
  compactCards: boolean;
  focusedColumn: boolean;
  showMoveArrows: boolean;
  zoom: number;
}

export const defaultBoardDisplay: BoardDisplayPreferences = {
  compactCards: false,
  focusedColumn: false,
  showMoveArrows: false,
  zoom: 1,
};

export function normalizeBoardDisplay(value: unknown): BoardDisplayPreferences {
  const next = { ...defaultBoardDisplay };
  if (!value || typeof value !== "object" || Array.isArray(value)) return next;
  const stored = value as Record<string, unknown>;
  for (const key of ["compactCards", "focusedColumn", "showMoveArrows"] as const) {
    if (typeof stored[key] === "boolean") next[key] = stored[key];
  }
  if (typeof stored.zoom === "number" && Number.isFinite(stored.zoom)) {
    next.zoom = Math.min(1.3, Math.max(0.7, Math.round(stored.zoom * 10) / 10));
  }
  return next;
}
