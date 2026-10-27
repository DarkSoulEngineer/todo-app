import type { ThemePreference } from "@/theme/tokens";

export type CalendarWeekStart = 0 | 1;
export type CalendarDefaultView = "month" | "week";

export interface AppPreferences {
  calendarWeekStart: CalendarWeekStart;
  calendarDefaultView: CalendarDefaultView;
}

export interface AppSettings extends AppPreferences {
  theme: ThemePreference;
}

/** Settings backups deliberately exclude all board and task data. */
export function serializeSettings(settings: AppSettings): string {
  return JSON.stringify({
    app: "janus",
    version: 1,
    kind: "janus-settings",
    exportedAt: new Date().toISOString(),
    settings: {
      theme: settings.theme,
      calendarDefaultView: settings.calendarDefaultView,
      calendarWeekStart: settings.calendarWeekStart,
    },
  }, null, 2);
}

/** Validate the entire backup before applying any of its values. */
export function parseSettingsJson(raw: string): AppSettings | null {
  try {
    const payload: unknown = JSON.parse(raw.replace(/^\uFEFF/, ""));
    if (!isRecord(payload) || payload.app !== "janus" || payload.kind !== "janus-settings" || payload.version !== 1) return null;
    const settings = payload.settings;
    if (!isRecord(settings)) return null;
    const { theme, calendarDefaultView, calendarWeekStart } = settings;
    if (theme !== "system" && theme !== "light" && theme !== "dark") return null;
    if (calendarDefaultView !== "month" && calendarDefaultView !== "week") return null;
    if (calendarWeekStart !== 0 && calendarWeekStart !== 1) return null;
    return { theme, calendarDefaultView, calendarWeekStart };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
