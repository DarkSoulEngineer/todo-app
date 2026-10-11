import type { BoardColorId } from "@/lib/boards";

/**
 * Card themes: keyword-driven visual identities for task cards.
 *
 * A small, fixed, non-editable vocabulary of common task words. When a task's
 * title or description contains a theme keyword (whole-word, case-insensitive)
 * the card picks up that theme's accent rail, tinted border and background wash.
 *
 * Themes are ADDITIVE and SECONDARY: they never outrank task *status*.
 * Completed / canceled / overdue cards keep their emerald / slate / red styling
 * and only borrow the quieter parts of a theme. See the precedence notes in
 * `task-card.tsx` for exactly which layer wins.
 *
 * Every class below is a complete static Tailwind literal (no concatenation or
 * dynamic construction) so Tailwind's compiler can see it — built-up class
 * names get purged. The hues follow the `boards.ts` / `status.ts` palette
 * language with translucent tints that read quietly on light and dark cards.
 *
 * CANONICAL RECIPE — every rail, border and wash in this file (and the status
 * rails/borders in `task-card.tsx`) shares one set of alphas:
 *   rail   → from-{hue}-500/70 via-{hue}-500/45 to-{hue}-500/10
 *   border → border-{hue}-500/35
 *   wash   → bg-[radial-gradient(120%_100%_at_100%_0%,rgba(RGB,0.05),transparent_65%)]
 *            dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(RGB,0.09),transparent_65%)]
 * Only the hue differs (a 500-scale Tailwind color / 500-scale RGB); the alphas
 * are identical everywhere by design.
 */

/**
 * One theme. Tokens are grouped as full class strings, never partial fragments,
 * so each value can be dropped straight into `cn()`.
 */
export interface CardTheme {
  /** Stable identifier (safe as a React key / persisted value). */
  id: string;
  /** Trigger words, all lowercase. Matched on word boundaries. */
  keywords: string[];
  /** Gradient stops for the left accent rail (used with `bg-gradient-to-b`). */
  accent: string;
  /** Themed border tone — only applied to plain (upcoming) cards. */
  border: string;
  /** Full-bleed radial background wash layered over the card. */
  wash: string;
}

const ROSE = {
  accent: "from-rose-500/70 via-rose-500/45 to-rose-500/10",
  border: "border-rose-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(244,63,94,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(244,63,94,0.09),transparent_65%)]",
};
const INDIGO = {
  accent: "from-indigo-500/70 via-indigo-500/45 to-indigo-500/10",
  border: "border-indigo-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(99,102,241,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(99,102,241,0.09),transparent_65%)]",
};
const PINK = {
  accent: "from-pink-500/70 via-pink-500/45 to-pink-500/10",
  border: "border-pink-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(236,72,153,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(236,72,153,0.09),transparent_65%)]",
};
const BLUE = {
  accent: "from-blue-500/70 via-blue-500/45 to-blue-500/10",
  border: "border-blue-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(59,130,246,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(59,130,246,0.09),transparent_65%)]",
};
const ORANGE = {
  accent: "from-orange-500/70 via-orange-500/45 to-orange-500/10",
  border: "border-orange-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(249,115,22,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(249,115,22,0.09),transparent_65%)]",
};
const EMERALD = {
  accent: "from-emerald-500/70 via-emerald-500/45 to-emerald-500/10",
  border: "border-emerald-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(16,185,129,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(16,185,129,0.09),transparent_65%)]",
};
const LIME = {
  accent: "from-lime-500/70 via-lime-500/45 to-lime-500/10",
  border: "border-lime-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(132,204,22,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(132,204,22,0.09),transparent_65%)]",
};
const SKY = {
  accent: "from-sky-500/70 via-sky-500/45 to-sky-500/10",
  border: "border-sky-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(14,165,233,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(14,165,233,0.09),transparent_65%)]",
};
const TEAL = {
  accent: "from-teal-500/70 via-teal-500/45 to-teal-500/10",
  border: "border-teal-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(20,184,166,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(20,184,166,0.09),transparent_65%)]",
};
const VIOLET = {
  accent: "from-violet-500/70 via-violet-500/45 to-violet-500/10",
  border: "border-violet-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(139,92,246,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(139,92,246,0.09),transparent_65%)]",
};
const CYAN = {
  accent: "from-cyan-500/70 via-cyan-500/45 to-cyan-500/10",
  border: "border-cyan-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(6,182,212,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(6,182,212,0.09),transparent_65%)]",
};
const AMBER = {
  accent: "from-amber-500/70 via-amber-500/45 to-amber-500/10",
  border: "border-amber-500/35",
  wash: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(245,158,11,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(245,158,11,0.09),transparent_65%)]",
};

/**
 * Category wash: the background tint for cards tagged with a board.
 *
 * Same subtle recipe as the theme washes — right-anchored top-right gradient,
 * light-mode alpha 0.05, dark-mode 0.09, `transparent_65%` end stop, complete
 * static Tailwind literals — so a tagged card reads as tinted by its
 * board color rather than by any keyword theme. Keyed by every `BoardColorId`.
 */
export const CARD_COLOR_WASHES: Record<BoardColorId, string> = {
  cyan: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(6,182,212,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(6,182,212,0.09),transparent_65%)]",
  pink: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(236,72,153,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(236,72,153,0.09),transparent_65%)]",
  orange: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(249,115,22,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(249,115,22,0.09),transparent_65%)]",
  teal: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(20,184,166,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(20,184,166,0.09),transparent_65%)]",
  lime: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(132,204,22,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(132,204,22,0.09),transparent_65%)]",
  indigo: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(99,102,241,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(99,102,241,0.09),transparent_65%)]",
  violet: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(139,92,246,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(139,92,246,0.09),transparent_65%)]",
  amber: "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(245,158,11,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(245,158,11,0.09),transparent_65%)]",
};

/**
 * UPCOMING_WASH: the default wash for plain, untagged, open cards.
 *
 * A subtle blue (blue-500 hue, same RGB as the BLUE keyword theme) so the
 * default card reads calmer than the old violet neutral. Same recipe as the
 * category and theme washes: right-anchored top-right, light 0.05 / dark 0.09,
 * `transparent_65%` end stop, complete static Tailwind literal.
 */
export const UPCOMING_WASH =
  "bg-[radial-gradient(120%_100%_at_100%_0%,rgba(59,130,246,0.05),transparent_65%)] dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(59,130,246,0.09),transparent_65%)]";

/**
 * The theme list, in detection-priority order.
 *
 * PRECEDENCE: the first theme (in this array order) to match wins. Ordering is
 * deliberate — high-urgency and high-specificity themes sit first so a task like
 * "Urgent: pay the bill" reads as urgent rather than finance. Within a theme the
 * keywords are tested in order, but since they all select the same theme that
 * order is cosmetic.
 */
export const CARD_THEMES: CardTheme[] = [
  {
    id: "urgent",
    keywords: [
      "urgent",
      "urgently",
      "asap",
      "as soon as possible",
      "critical",
      "important",
      "emergency",
      "immediately",
      "blocker",
      "blocking",
      "time-sensitive",
      "time sensitive",
      "do not forget",
      "don't forget",
      "dont forget",
      "high priority",
    ],
    ...ROSE,
  },
  {
    id: "meeting",
    keywords: [
      "meeting",
      "meet",
      "meetup",
      "meet-up",
      "call",
      "standup",
      "stand-up",
      "stand up",
      "sync",
      "huddle",
      "1:1",
      "one-on-one",
      "one on one",
      "conference",
      "catch up",
      "catch-up",
      "interview",
      "kickoff",
      "kick-off",
    ],
    ...INDIGO,
  },
  {
    id: "celebration",
    keywords: [
      "birthday",
      "bday",
      "party",
      "gift",
      "celebrate",
      "celebration",
      "anniversary",
      "wedding",
      "cake",
      "surprise",
      "congrats",
      "congratulations",
    ],
    ...PINK,
  },
  {
    id: "health",
    keywords: [
      "health",
      "doctor",
      "dentist",
      "dental",
      "meds",
      "medicine",
      "medication",
      "appointment",
      "checkup",
      "check-up",
      "hospital",
      "clinic",
      "pharmacy",
      "prescription",
      "vaccine",
      "vaccination",
      "therapy",
      "therapist",
      "symptom",
      "blood test",
      "lab test",
    ],
    ...BLUE,
  },
  {
    id: "shopping",
    keywords: [
      "buy",
      "purchase",
      "shopping",
      "shop",
      "groceries",
      "grocery",
      "order",
      "cart",
      "checkout",
      "supplies",
      "restock",
      "pick up",
      "pickup",
    ],
    ...ORANGE,
  },
  {
    id: "finance",
    keywords: [
      "pay",
      "payment",
      "paycheck",
      "bill",
      "invoice",
      "budget",
      "tax",
      "taxes",
      "rent",
      "salary",
      "expense",
      "refund",
      "bank",
      "transfer",
      "subscription",
      "insurance",
      "mortgage",
      "loan",
      "fee",
      "reimburse",
    ],
    ...EMERALD,
  },
  {
    id: "fitness",
    keywords: [
      "gym",
      "workout",
      "work out",
      "exercise",
      "run",
      "running",
      "jog",
      "jogging",
      "yoga",
      "stretch",
      "cardio",
      "weights",
      "lift",
      "training",
      "train",
      "steps",
      "walk",
      "walking",
      "hike",
      "hiking",
      "swim",
      "swimming",
      "cycle",
      "cycling",
      "bike",
    ],
    ...LIME,
  },
  {
    id: "learning",
    keywords: [
      "study",
      "studying",
      "learn",
      "learning",
      "read",
      "reading",
      "course",
      "exam",
      "lecture",
      "homework",
      "assignment",
      "revise",
      "revision",
      "practice",
      "tutorial",
      "lesson",
      "class",
      "research",
      "quiz",
      "flashcards",
    ],
    ...SKY,
  },
  {
    id: "travel",
    keywords: [
      "travel",
      "trip",
      "flight",
      "fly",
      "flying",
      "hotel",
      "book",
      "booking",
      "vacation",
      "holiday",
      "airport",
      "passport",
      "visa",
      "itinerary",
      "pack",
      "packing",
      "road trip",
      "roadtrip",
      "check in",
      "check-in",
      "tour",
      "ticket",
      "rental car",
      "reservation",
    ],
    ...TEAL,
  },
  {
    id: "home",
    keywords: [
      "clean",
      "cleaning",
      "laundry",
      "chore",
      "home",
      "house",
      "fix",
      "fixing",
      "repair",
      "tidy",
      "organize",
      "organise",
      "declutter",
      "vacuum",
      "dust",
      "mop",
      "dishes",
      "garden",
      "yard",
      "move",
      "moving",
      "paint",
      "assemble",
      "maintenance",
      "trash",
      "recycle",
    ],
    ...VIOLET,
  },
  {
    id: "communication",
    keywords: [
      "email",
      "e-mail",
      "mail",
      "reply",
      "respond",
      "follow up",
      "follow-up",
      "followup",
      "message",
      "text",
      "contact",
      "reach out",
      "notify",
      "send",
      "newsletter",
      "dm",
    ],
    ...CYAN,
  },
  {
    id: "content",
    keywords: [
      "write",
      "writing",
      "report",
      "doc",
      "docs",
      "document",
      "documentation",
      "presentation",
      "slides",
      "slideshow",
      "review",
      "submit",
      "submission",
      "draft",
      "essay",
      "blog",
      "article",
      "post",
      "paper",
      "thesis",
      "proposal",
      "notes",
      "minutes",
      "summary",
      "publish",
      "proofread",
    ],
    ...AMBER,
  },
];

/** Regex metacharacters that must be escaped before a keyword becomes a pattern. */
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/**
 * Compiles one lowercase keyword into a whole-word matcher.
 *
 * Boundaries are non-alphanumeric characters (or the string edges), so "call"
 * matches "call" and "call." but never "callback", and "buy" never matches
 * "buyer". A single optional plural suffix ("s" / "es") is allowed so "call"
 * also matches "calls" and "chore" matches "chores" without listing every plural.
 * Internal whitespace is collapsed to `\s+` so multi-word keywords tolerate
 * extra spacing.
 */
function compileKeyword(keyword: string): RegExp {
  const escaped = keyword
    .toLowerCase()
    .trim()
    .replace(REGEX_SPECIAL, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:e?s)?(?![a-z0-9])`);
}

/** Themes paired with their pre-compiled matchers (built once at module load). */
const THEME_MATCHERS: ReadonlyArray<{ theme: CardTheme; matchers: readonly RegExp[] }> =
  CARD_THEMES.map((theme) => ({
    theme,
    matchers: theme.keywords.map(compileKeyword),
  }));

/**
 * Picks the first matching theme for a task's text, or null when nothing fits.
 *
 * Case-insensitive, whole-word, and deterministic: themes are tested in
 * `CARD_THEMES` order, so the first theme with any matching keyword wins (see
 * the precedence note above the array). Pure and side-effect free — inputs are
 * never mutated, and empty / missing text returns null.
 */
export function detectCardTheme(title: string, description: string): CardTheme | null {
  const haystack = `${title ?? ""} ${description ?? ""}`.toLowerCase();
  if (!haystack.trim()) return null;

  for (const { theme, matchers } of THEME_MATCHERS) {
    for (const matcher of matchers) {
      if (matcher.test(haystack)) return theme;
    }
  }
  return null;
}
