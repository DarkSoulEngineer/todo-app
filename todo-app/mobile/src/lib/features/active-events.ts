import { SEASONAL_CARD_THEMES } from "@/lib/features/card-themes";

export type EventOverride = "all" | null;

/** Gregorian Easter Sunday (Meeus/Jones/Butcher). */
function easterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const value = h + l - 7 * m + 114;
  return new Date(year, Math.floor(value / 31) - 1, value % 31 + 1);
}

/** Local calendar days, not UTC. Birthday has no automatic date until configured. */
export function getActiveEventThemes(now = new Date(), override: EventOverride = null) {
  if (override === "all") return SEASONAL_CARD_THEMES;
  const month = now.getMonth() + 1, day = now.getDate();
  const easter = easterDate(now.getFullYear());
  return SEASONAL_CARD_THEMES.filter(({ id }) => {
    switch (id) {
      case "halloween": return month === 10 && day === 31;
      case "christmas": return month === 12 && day === 25;
      case "new-year": return month === 1 && day === 1;
      case "valentines": return month === 2 && day === 14;
      case "easter": return now.getMonth() === easter.getMonth() && day === easter.getDate();
      default: return false;
    }
  });
}

// Session-only preview: never persisted into task data or device settings.
let eventOverride: EventOverride = null;
const listeners = new Set<() => void>();
export const getEventOverride = () => eventOverride;
export function setEventOverride(value: EventOverride) {
  eventOverride = value;
  listeners.forEach((listener) => listener());
}
export function subscribeToEvents(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
