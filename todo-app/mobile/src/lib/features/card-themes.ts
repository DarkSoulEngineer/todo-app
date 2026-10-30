import type { BoardColorId } from "@/lib/domain/boards";
import type { TaskStatus } from "@/lib/domain/types";

/**
 * Card accent themes: keyword-driven visual identities for task cards.
 *
 * The web build used Tailwind class strings; React Native needs concrete color
 * values, so each theme carries an accent color and its translucent variants.
 * Seasonal titles take precedence; otherwise the first `CARD_THEMES` match wins.
 */
export interface CardTheme {
  id: string;
  keywords: string[];
  /** Accent rail / icon color. */
  accent: string;
  /** Tinted border tone. */
  border: string;
  /** Very soft background wash. */
  wash: string;
}

function theme(id: string, keywords: string[], hex: string): CardTheme {
  return {
    id,
    keywords,
    accent: hex,
    border: `${hex}59`,
    wash: `${hex}0F`,
  };
}

export interface DecorativeCardTheme extends CardTheme {
  label: string;
  symbol: string;
  decoration: string;
}

export type SeasonalCardTheme = DecorativeCardTheme;

/** Exact status names avoid false positives such as “Not done” or “Late night”. */
export const STATUS_CARD_THEMES: DecorativeCardTheme[] = [
  { ...theme("done", ["done", "complete", "completed", "finished", "resolved", "delivered", "shipped"], "#34D399"), label: "Done", symbol: "✓", decoration: "" },
  { ...theme("canceled", ["canceled", "cancelled", "cancel", "dropped", "abandoned"], "#94A3B8"), label: "Canceled", symbol: "×", decoration: "" },
  { ...theme("overdue", ["overdue", "late", "past due", "expired", "missed deadline"], "#FB7185"), label: "Overdue", symbol: "!", decoration: "" },
];

/** Seasonal easter eggs take priority over generic “gift”, “party”, etc. */
export const SEASONAL_CARD_THEMES: SeasonalCardTheme[] = [
  { ...theme("halloween", ["halloween", "haloween", "all hallows eve"], "#F59E0B"), label: "Halloween", symbol: "🎃", decoration: "✦" },
  { ...theme("christmas", ["christmas", "christmass", "xmas", "noel", "craciun", "crăciun"], "#22C55E"), label: "Christmas", symbol: "🎄", decoration: "❄" },
  { ...theme("easter", ["easter", "paște"], "#C084FC"), label: "Easter", symbol: "🥚", decoration: "✿" },
  { ...theme("new-year", ["new year", "new-year", "new year's", "new year’s", "new years"], "#60A5FA"), label: "New Year", symbol: "🎉", decoration: "✧" },
  { ...theme("birthday", ["birthday", "bday", "b-day"], "#F472B6"), label: "Birthday", symbol: "🎂", decoration: "" },
  { ...theme("valentines", ["valentine", "valentines", "valentine's", "valentine’s"], "#FB7185"), label: "Valentine's Day", symbol: "♥", decoration: "" },
];

/** The theme list, in detection-priority order. */
export const CARD_THEMES: CardTheme[] = [
  theme(
    "urgent",
    ["urgent", "urgently", "asap", "as soon as possible", "critical", "important", "emergency", "immediately", "blocker", "blocking", "time-sensitive", "time sensitive", "do not forget", "don't forget", "dont forget", "high priority"],
    "#F43F5E",
  ),
  theme(
    "meeting",
    ["meeting", "meet", "meetup", "meet-up", "call", "standup", "stand-up", "stand up", "sync", "huddle", "1:1", "one-on-one", "one on one", "conference", "catch up", "catch-up", "interview", "kickoff", "kick-off"],
    "#6366F1",
  ),
  theme(
    "celebration",
    ["birthday", "bday", "party", "gift", "celebrate", "celebration", "anniversary", "wedding", "cake", "surprise", "congrats", "congratulations"],
    "#EC4899",
  ),
  theme(
    "health",
    ["health", "doctor", "dentist", "dental", "meds", "medicine", "medication", "appointment", "checkup", "check-up", "hospital", "clinic", "pharmacy", "prescription", "vaccine", "vaccination", "therapy", "therapist", "symptom", "blood test", "lab test"],
    "#3B82F6",
  ),
  theme(
    "shopping",
    ["buy", "purchase", "shopping", "shop", "groceries", "grocery", "order", "cart", "checkout", "supplies", "restock", "pick up", "pickup"],
    "#F97316",
  ),
  theme(
    "finance",
    ["pay", "payment", "paycheck", "bill", "invoice", "budget", "tax", "taxes", "rent", "salary", "expense", "refund", "bank", "transfer", "subscription", "insurance", "mortgage", "loan", "fee", "reimburse"],
    "#10B981",
  ),
  theme(
    "fitness",
    ["gym", "workout", "work out", "exercise", "run", "running", "jog", "jogging", "yoga", "stretch", "cardio", "weights", "lift", "training", "train", "steps", "walk", "walking", "hike", "hiking", "swim", "swimming", "cycle", "cycling", "bike"],
    "#84CC16",
  ),
  theme(
    "learning",
    ["study", "studying", "learn", "learning", "read", "reading", "course", "exam", "lecture", "homework", "assignment", "revise", "revision", "practice", "tutorial", "lesson", "class", "research", "quiz", "flashcards"],
    "#0EA5E9",
  ),
  theme(
    "travel",
    ["travel", "trip", "flight", "fly", "flying", "hotel", "book", "booking", "vacation", "holiday", "airport", "passport", "visa", "itinerary", "pack", "packing", "road trip", "roadtrip", "check in", "check-in", "tour", "ticket", "rental car", "reservation"],
    "#14B8A6",
  ),
  theme(
    "home",
    ["clean", "cleaning", "laundry", "chore", "home", "house", "fix", "fixing", "repair", "tidy", "organize", "organise", "declutter", "vacuum", "dust", "mop", "dishes", "garden", "yard", "move", "moving", "paint", "assemble", "maintenance", "trash", "recycle"],
    "#8B5CF6",
  ),
  theme(
    "communication",
    ["email", "e-mail", "mail", "reply", "respond", "follow up", "follow-up", "followup", "message", "text", "contact", "reach out", "notify", "send", "newsletter", "dm"],
    "#06B6D4",
  ),
  theme(
    "content",
    ["write", "writing", "report", "doc", "docs", "document", "documentation", "presentation", "slides", "slideshow", "review", "submit", "submission", "draft", "essay", "blog", "article", "post", "paper", "thesis", "proposal", "notes", "minutes", "summary", "publish", "proofread"],
    "#F59E0B",
  ),
];

/** Soft background tint for a card tagged with a board color. */
export const BOARD_WASHES: Record<BoardColorId, string> = {
  slate: "#6B72800D",
  blue: "#3B82F60D",
  teal: "#14B8A60D",
  lime: "#84CC160D",
  amber: "#F59E0B0F",
  orange: "#F973160D",
  pink: "#EC48990D",
  violet: "#8B5CF60D",
};

/** Very soft corner glows by priority (mirrors the web card recipe). */
export const PRIORITY_WASHES: Record<"critical" | "high" | "medium" | "low", string> = {
  critical: "#EF444414",
  high: "#F9731614",
  medium: "#F59E0B12",
  low: "#64748B0D",
};

/** Regex metacharacters that must be escaped before a keyword becomes a pattern. */
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** Compiles one lowercase keyword into a whole-word matcher. */
function compileKeyword(keyword: string): RegExp {
  const escaped = keyword
    .toLowerCase()
    .trim()
    .replace(REGEX_SPECIAL, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:e?s)?(?![a-z0-9])`);
}

const THEME_MATCHERS = CARD_THEMES.map((entry) => ({
  theme: entry,
  matchers: entry.keywords.map(compileKeyword),
}));

const SEASONAL_MATCHERS = SEASONAL_CARD_THEMES.map((entry) => ({ theme: entry, matchers: entry.keywords.map(compileKeyword) }));

/** Titles opt in; a passing mention in the description does not change design. */
export function detectSeasonalCardTheme(title: string): SeasonalCardTheme | null {
  const text = (title ?? "").toLowerCase();
  return SEASONAL_MATCHERS.find((entry) => entry.matchers.some((matcher) => matcher.test(text)))?.theme ?? null;
}

export function detectStatusCardTheme(title: string): DecorativeCardTheme | null {
  const name = (title ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return STATUS_CARD_THEMES.find((entry) => entry.keywords.includes(name)) ?? null;
}

/** Explicit event designs stay intact; ordinary cards reflect their actual state. */
export function resolveCardDecoration(tags: readonly string[] = [], status: TaskStatus | null = null): DecorativeCardTheme | null {
  const special = tags.map(classifySpecialCardTag).filter((entry) => entry !== null);
  const event = special.findLast((entry) => entry.group === "event");
  if (event) return event.theme;
  const stateId = status === "completed" ? "done" : status;
  const actual = STATUS_CARD_THEMES.find((entry) => entry.id === stateId);
  if (actual) return actual;
  const taggedStatus = special.findLast((entry) => entry.group === "status");
  if (taggedStatus) return taggedStatus.theme;
  return null;
}

export interface SpecialCardTag { group: "status" | "event"; theme: DecorativeCardTheme }

/** A special tag must be a complete name/alias, not a passing word in a sentence. */
export function classifySpecialCardTag(label: string): SpecialCardTag | null {
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/’/g, "'").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  const name = normalize(label);
  for (const [group, entries] of [["status", STATUS_CARD_THEMES], ["event", SEASONAL_CARD_THEMES]] as const) {
    const entry = entries.find((entry) => [entry.label, ...entry.keywords].some((alias) => normalize(alias) === name));
    if (entry) return { group, theme: entry };
  }
  return null;
}

/** Picks the first matching theme for a task's text, or null when nothing fits. */
export function detectCardTheme(title: string, description: string): CardTheme | null {
  const haystack = `${title ?? ""} ${description ?? ""}`.toLowerCase();
  if (!haystack.trim()) return null;
  for (const { theme: entry, matchers } of THEME_MATCHERS) {
    for (const matcher of matchers) {
      if (matcher.test(haystack)) return entry;
    }
  }
  return null;
}
