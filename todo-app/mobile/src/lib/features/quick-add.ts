import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addWeeks,
  isValid,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import { CATEGORIES } from "@/lib/domain/categories";
import type { Board } from "@/lib/domain/boards";
import type { Priority, TaskDraft } from "@/lib/domain/types";

export interface QuickAddParse {
  title: string;
  priority: Priority;
  category: string | null;
  dueAt: string | null;
}

interface DateMatch {
  date: Date;
  /** True when the phrase already carries a specific time (relative offsets). */
  exact: boolean;
  /** Hours/minutes implied by the phrase (e.g. "tonight" => 20:00). */
  impliedTime: { hours: number; minutes: number } | null;
}

const PRIORITY_TOKENS: Record<string, Priority> = {
  critical: "critical",
  crit: "critical",
  c: "critical",
  "4": "critical",
  high: "high",
  h: "high",
  "1": "high",
  medium: "medium",
  med: "medium",
  m: "medium",
  "2": "medium",
  low: "low",
  l: "low",
  "3": "low",
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function collapse(input: string): string {
  return input.replace(/\s{2,}/g, " ").trim();
}

function removeSlice(input: string, match: RegExpMatchArray): string {
  const start = match.index ?? 0;
  const end = start + match[0].length;
  return collapse(`${input.slice(0, start)} ${input.slice(end)}`);
}

function extractPriority(input: string): { rest: string; priority: Priority | null } {
  let priority: Priority | null = null;
  const rest = collapse(
    input.replace(/(^|\s)!([a-z0-9]+)/gi, (match, lead: string, token: string) => {
      const mapped = PRIORITY_TOKENS[token.toLowerCase()];
      if (!mapped) return match;
      priority = mapped;
      return lead;
    }),
  );
  return { rest, priority };
}

function extractCategory(
  input: string,
  boards: readonly Pick<Board, "id" | "label">[] = CATEGORIES,
): { rest: string; category: string | null } {
  const categoryTokens: Record<string, string> = {};
  for (const board of boards) {
    categoryTokens[board.id.toLowerCase()] = board.id;
    categoryTokens[board.label.toLowerCase()] = board.id;
  }
  let category: string | null = null;
  const rest = collapse(
    input.replace(/(^|\s)#([a-z0-9_-]+)/gi, (match, lead: string, token: string) => {
      const mapped = categoryTokens[token.toLowerCase()];
      if (!mapped) return match;
      category = mapped;
      return lead;
    }),
  );
  return { rest, category };
}

function extractDate(input: string, now: Date): { rest: string; match: DateMatch | null } {
  // Dates may be introduced by a connector ("by", "due", "on"); it is consumed
  // with the date so it never leaks into the task title.
  const iso = input.match(/(?:^|\s)(?:by\s+|due\s+|on\s+)?(\d{4})-(\d{1,2})-(\d{1,2})(?=\s|$)/);
  if (iso) {
    const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (isValid(parsed)) {
      return { rest: removeSlice(input, iso), match: { date: startOfDay(parsed), exact: false, impliedTime: null } };
    }
  }

  const relative = input.match(
    /(?:^|\s)in\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w)(?=\s|$)/i,
  );
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    let date: Date;
    if (unit.startsWith("min") || unit === "m") date = addMinutes(now, amount);
    else if (unit.startsWith("h")) date = addHours(now, amount);
    else if (unit.startsWith("d")) date = addDays(now, amount);
    else date = addWeeks(now, amount);
    return { rest: removeSlice(input, relative), match: { date, exact: true, impliedTime: null } };
  }

  const dayAfter = input.match(/(?:^|\s)day after tomorrow(?=\s|$)/i);
  if (dayAfter) {
    return {
      rest: removeSlice(input, dayAfter),
      match: { date: addDays(startOfDay(now), 2), exact: false, impliedTime: null },
    };
  }

  const tomorrow = input.match(/(?:^|\s)tomorrow(?=\s|$)/i);
  if (tomorrow) {
    return {
      rest: removeSlice(input, tomorrow),
      match: { date: addDays(startOfDay(now), 1), exact: false, impliedTime: null },
    };
  }

  const tonight = input.match(/(?:^|\s)tonight(?=\s|$)/i);
  if (tonight) {
    return {
      rest: removeSlice(input, tonight),
      match: { date: startOfDay(now), exact: false, impliedTime: { hours: 20, minutes: 0 } },
    };
  }

  const today = input.match(/(?:^|\s)today(?=\s|$)/i);
  if (today) {
    return {
      rest: removeSlice(input, today),
      match: { date: startOfDay(now), exact: false, impliedTime: null },
    };
  }

  // Weekdays, optionally qualified by "next" before the day or "next week"
  // after it. Matched before the bare "next week" matcher so the "next week"
  // that qualifies a weekday is never consumed on its own.
  const weekday = input.match(
    /(?:^|\s)(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:\s+next\s+week)?(?=\s|$)/i,
  );
  if (weekday) {
    const target = WEEKDAYS[weekday[2].toLowerCase()];
    if (target !== undefined) {
      const base = startOfDay(now);
      let delta = (target - base.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      // Each "next" (prefix or suffix) pushes the target another week out.
      const nexts = weekday[0].match(/next/gi)?.length ?? 0;
      if (nexts > 0) delta += 7 * nexts;
      return {
        rest: removeSlice(input, weekday),
        match: { date: addDays(base, delta), exact: false, impliedTime: null },
      };
    }
  }

  const nextWeek = input.match(/(?:^|\s)next week(?=\s|$)/i);
  if (nextWeek) {
    return {
      rest: removeSlice(input, nextWeek),
      match: { date: addWeeks(startOfDay(now), 1), exact: false, impliedTime: null },
    };
  }

  const nextMonth = input.match(/(?:^|\s)next month(?=\s|$)/i);
  if (nextMonth) {
    return {
      rest: removeSlice(input, nextMonth),
      match: { date: addMonths(startOfDay(now), 1), exact: false, impliedTime: null },
    };
  }

  const endOfWeek = input.match(/(?:^|\s)(?:end of week|eow)(?=\s|$)/i);
  if (endOfWeek) {
    const base = startOfDay(now);
    // Friday of this week; past weekends roll to the coming Friday.
    const delta = (5 - base.getDay() + 7) % 7;
    return {
      rest: removeSlice(input, endOfWeek),
      match: { date: addDays(base, delta), exact: false, impliedTime: { hours: 17, minutes: 0 } },
    };
  }

  const endOfDay = input.match(/(?:^|\s)(?:end of day|eod)(?=\s|$)/i);
  if (endOfDay) {
    return {
      rest: removeSlice(input, endOfDay),
      match: { date: startOfDay(now), exact: false, impliedTime: { hours: 17, minutes: 0 } },
    };
  }

  return { rest: input, match: null };
}

function extractTime(input: string): { rest: string; time: { hours: number; minutes: number } | null } {
  const colon = input.match(/(?:^|\s)(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?(?=\s|$)/i);
  if (colon) {
    let hours = Number(colon[1]);
    const minutes = Number(colon[2]);
    const meridiem = colon[3]?.toLowerCase();
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { rest: removeSlice(input, colon), time: { hours, minutes } };
    }
  }

  const meridian = input.match(/(?:^|\s)(?:at\s+)?(\d{1,2})\s*(am|pm)(?=\s|$)/i);
  if (meridian) {
    let hours = Number(meridian[1]);
    const meridiem = meridian[2].toLowerCase();
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    if (hours >= 0 && hours <= 23) {
      return { rest: removeSlice(input, meridian), time: { hours, minutes: 0 } };
    }
  }

  const bare = input.match(/(?:^|\s)at\s+(\d{1,2})(?=\s|$)/i);
  if (bare) {
    const hours = Number(bare[1]);
    if (hours >= 0 && hours <= 23) {
      return { rest: removeSlice(input, bare), time: { hours, minutes: 0 } };
    }
  }

  const noon = input.match(/(?:^|\s)noon(?=\s|$)/i);
  if (noon) {
    return { rest: removeSlice(input, noon), time: { hours: 12, minutes: 0 } };
  }

  const midnight = input.match(/(?:^|\s)midnight(?=\s|$)/i);
  if (midnight) {
    return { rest: removeSlice(input, midnight), time: { hours: 0, minutes: 0 } };
  }

  return { rest: input, time: null };
}

function defaultTimeFor(day: Date, now: Date): Date {
  const base = startOfDay(now);
  if (day.getTime() === base.getTime()) {
    return setMinutes(addHours(now, 2), 0);
  }
  return setMinutes(setHours(day, 9), 0);
}

/**
 * Turns "Buy milk tomorrow 5pm !high #home" into a task draft.
 * Anything it cannot understand stays in the title, so it never loses input.
 */
export function parseQuickAdd(
  raw: string,
  now: Date = new Date(),
  boards?: readonly Pick<Board, "id" | "label">[],
): QuickAddParse {
  let working = raw;

  const priorityPart = extractPriority(working);
  working = priorityPart.rest;

  const categoryPart = extractCategory(working, boards ?? CATEGORIES);
  working = categoryPart.rest;

  const datePart = extractDate(working, now);
  working = datePart.rest;

  const timePart = extractTime(working);
  working = timePart.rest;

  const explicitTime = timePart.time;
  const dateMatch = datePart.match;
  let due: Date | null = null;

  if (dateMatch) {
    if (explicitTime) {
      due = setMinutes(setHours(dateMatch.date, explicitTime.hours), explicitTime.minutes);
    } else if (dateMatch.impliedTime) {
      due = setMinutes(
        setHours(dateMatch.date, dateMatch.impliedTime.hours),
        dateMatch.impliedTime.minutes,
      );
    } else if (dateMatch.exact) {
      due = dateMatch.date;
    } else {
      due = defaultTimeFor(dateMatch.date, now);
    }
  } else if (explicitTime) {
    const base = startOfDay(now);
    const candidate = setMinutes(setHours(base, explicitTime.hours), explicitTime.minutes);
    due = candidate.getTime() <= now.getTime() ? addDays(candidate, 1) : candidate;
  }

  const title = collapse(working) || (raw.trim() ? raw.trim() : "New task");

  return {
    title,
    priority: priorityPart.priority ?? "medium",
    category: categoryPart.category,
    dueAt: due ? due.toISOString() : null,
  };
}

export function quickAddToDraft(parsed: QuickAddParse): TaskDraft {
  return {
    title: parsed.title,
    description: "",
    dueAt: parsed.dueAt,
    priority: parsed.priority,
    category: parsed.category,
    subtasks: [],
  };
}
