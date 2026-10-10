import { format, isValid, parseISO, startOfDay } from "date-fns";

/** ISO string -> value for <input type="datetime-local">. */
export function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = parseISO(iso);
  return isValid(date) ? format(date, "yyyy-MM-dd'T'HH:mm") : "";
}

/** <input type="datetime-local"> value -> ISO string (or null when empty/invalid). */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO string -> a native <input type="datetime-local"> default attr, kept local. */
export function dateTimeLocalNow(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

/**
 * Reschedules a task by dropping it on a calendar day: keeps the original
 * clock time when the task already had a due date, otherwise defaults to 09:00.
 */
export function rescheduleToDay(day: Date, dueAt: string | null): string {
  const target = new Date(day);
  if (dueAt) {
    const original = parseISO(dueAt);
    if (isValid(original)) {
      target.setHours(original.getHours(), original.getMinutes(), 0, 0);
      return target.toISOString();
    }
  }
  target.setHours(9, 0, 0, 0);
  return target.toISOString();
}

/**
 * Pushes an overdue task into the next day (keeping its clock time) so it can
 * land in an "open / upcoming" column when dragged on the board.
 */
export function rescheduleToNextDay(dueAt: string | null, now: Date): string {
  const target = startOfDay(now);
  target.setDate(target.getDate() + 1);
  if (dueAt) {
    const original = parseISO(dueAt);
    if (isValid(original)) {
      target.setHours(original.getHours(), original.getMinutes(), 0, 0);
      return target.toISOString();
    }
  }
  target.setHours(9, 0, 0, 0);
  return target.toISOString();
}
