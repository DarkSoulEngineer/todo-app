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
    "ready", "delivered", "shipped", "published", "closed",
    "resolved", "fixed", "accomplished", "achieved", "finalized",
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
    "cancelled", "canceled", "cancel", "cancelled", "aborted",
    "dropped", "discarded", "rejected", "declined", "void",
    "withdrawn", "scrapped", "terminated", "stopped", "halted",
    "no longer needed", "not doing", "wont do", "won't do"
  ]
};

export type DetectedStatus = "completed" | "overdue" | "upcoming" | "canceled" | null;

/**
 * Detects status from task title and description based on keywords.
 * Returns the first matching status in priority order: completed > canceled > overdue > upcoming
 */
export function detectStatusFromText(
  title: string,
  description: string,
  keywords: StatusKeywords = DEFAULT_STATUS_KEYWORDS
): DetectedStatus {
  const text = `${title} ${description}`.toLowerCase();
  
  // Priority order: completed > canceled > overdue > upcoming
  // This ensures explicit completion/cancellation takes precedence
  
  for (const keyword of keywords.completed) {
    if (text.includes(keyword.toLowerCase())) return "completed";
  }
  
  for (const keyword of keywords.canceled) {
    if (text.includes(keyword.toLowerCase())) return "canceled";
  }
  
  for (const keyword of keywords.overdue) {
    if (text.includes(keyword.toLowerCase())) return "overdue";
  }
  
  for (const keyword of keywords.upcoming) {
    if (text.includes(keyword.toLowerCase())) return "upcoming";
  }
  
  return null;
}