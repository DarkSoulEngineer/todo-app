/**
 * Keyword-based status detection for tasks.
 * Analyzes task title and description to auto-detect status.
 */

export interface StatusKeywords {
  completed: string[];
  overdue: string[];
  upcoming: string[];
  canceled: string[];
}

export const DEFAULT_STATUS_KEYWORDS: StatusKeywords = {
  completed: [
    "done", "finished", "complete", "completed", "✓", "✅", "✔",
    "delivered", "shipped", "published",
    "resolved", "accomplished", "achieved", "finalized",
    "wrapped up", "wrapped-up", "signed off", "signed-off"
  ],
  overdue: [
    "overdue", "late", "past due", "past-due", "expired", "missed",
    "deadline passed", "deadline missed", "behind schedule",
    "overdue by", "days late", "weeks late"
  ],
  upcoming: [
    "upcoming", "coming up", "soon", "scheduled", "planned",
    "next week", "next month", "tomorrow", "this week", "this month",
    "due soon", "coming soon", "on deck", "in queue", "pending",
    "to do", "todo", "to-do", "awaiting", "waiting for"
  ],
  canceled: [
    "cancelled", "canceled", "cancel", "aborted",
    "dropped", "discarded", "rejected", "declined",
    "withdrawn", "scrapped", "terminated", "stopped", "halted",
    "no longer needed", "not doing", "wont do", "won't do"
  ]
};

export type DetectedStatus = "completed" | "overdue" | "upcoming" | "canceled" | null;

/** Escapes regex metacharacters so a literal keyword is matched verbatim. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const keywordPatternCache = new Map<string, RegExp>();

/**
 * Compiles a keyword into a case-insensitive, whole-word matcher.
 *
 * - Whitespace between words is collapsed to `\s+` so "next week" also matches
 *   "next   week".
 * - `\b` anchors are only added next to word characters, so symbol keywords
 *   such as "✓" (which have no word boundary) still match.
 * - Whole-word matching stops substrings from firing, e.g. "done" in "abdone",
 *   "ready" in "already", "fixed" in "prefixed" or "closed" in "enclosed".
 */
function keywordToRegExp(keyword: string): RegExp {
  const trimmed = keyword.trim();
  const cached = keywordPatternCache.get(trimmed);
  if (cached) return cached;

  const body = escapeRegExp(trimmed).replace(/\s+/g, "\\s+");
  const prefix = /^\w/.test(trimmed) ? "\\b" : "";
  const suffix = /\w$/.test(trimmed) ? "\\b" : "";
  const pattern = new RegExp(`${prefix}${body}${suffix}`, "i");

  keywordPatternCache.set(trimmed, pattern);
  return pattern;
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => keywordToRegExp(keyword).test(text));
}

/**
 * Detects status from task title and description based on keywords.
 * Returns the first matching status in priority order: completed > canceled > overdue > upcoming
 */
export function detectStatusFromText(
  title: string,
  description: string,
  keywords: StatusKeywords = DEFAULT_STATUS_KEYWORDS
): DetectedStatus {
  const text = `${title} ${description}`;

  // Priority order: completed > canceled > overdue > upcoming
  // This ensures explicit completion/cancellation takes precedence

  if (matchesAny(text, keywords.completed)) return "completed";
  if (matchesAny(text, keywords.canceled)) return "canceled";
  if (matchesAny(text, keywords.overdue)) return "overdue";
  if (matchesAny(text, keywords.upcoming)) return "upcoming";

  return null;
}
