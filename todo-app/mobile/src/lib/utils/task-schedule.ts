import { addDays, isValid, parseISO, startOfMonth, startOfWeek } from "date-fns";

export function readScheduleDate(value: string | null): Date | null {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

export function scheduleCalendarDays(month: Date, weekStartsOn: 0 | 1): Date[] {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn });
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

/** Date-only choices mean local end of day, not an arbitrary current time. */
export function selectScheduleDay(day: Date, previous: Date | null): string {
  const next = new Date(day);
  next.setHours(previous?.getHours() ?? 23, previous?.getMinutes() ?? 59, 0, 0);
  return next.toISOString();
}

export function validScheduleTime(hour: string, minute: string): boolean {
  return /^\d{1,2}$/.test(hour) && /^\d{1,2}$/.test(minute)
    && Number(hour) < 24 && Number(minute) < 60;
}

/** Reject invalid and skipped DST times instead of silently rolling them over. */
export function applyScheduleTime(date: Date, hour: string, minute: string): string | null {
  if (!validScheduleTime(hour, minute)) return null;
  const next = new Date(date);
  next.setHours(Number(hour), Number(minute), 0, 0);
  if (next.getDate() !== date.getDate() || next.getHours() !== Number(hour) || next.getMinutes() !== Number(minute)) return null;
  return next.toISOString();
}
