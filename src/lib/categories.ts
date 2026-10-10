export interface Category {
  id: string;
  label: string;
  /** Solid dot / progress fill. */
  dot: string;
  /** Pill styling for chips and menus. */
  pill: string;
  /** Translucent ring tone, used for selected filter chips. */
  ring: string;
}

export const CATEGORIES: Category[] = [
  {
    id: "work",
    label: "Work",
    dot: "bg-cyan-500",
    pill: "bg-cyan-500/12 text-cyan-700 ring-cyan-500/25 dark:text-cyan-300",
    ring: "ring-cyan-500/40",
  },
  {
    id: "personal",
    label: "Personal",
    dot: "bg-pink-500",
    pill: "bg-pink-500/12 text-pink-700 ring-pink-500/25 dark:text-pink-300",
    ring: "ring-pink-500/40",
  },
  {
    id: "shopping",
    label: "Shopping",
    dot: "bg-orange-500",
    pill: "bg-orange-500/12 text-orange-700 ring-orange-500/25 dark:text-orange-300",
    ring: "ring-orange-500/40",
  },
  {
    id: "health",
    label: "Health",
    dot: "bg-teal-500",
    pill: "bg-teal-500/12 text-teal-700 ring-teal-500/25 dark:text-teal-300",
    ring: "ring-teal-500/40",
  },
  {
    id: "learning",
    label: "Learning",
    dot: "bg-lime-500",
    pill: "bg-lime-500/12 text-lime-700 ring-lime-500/25 dark:text-lime-300",
    ring: "ring-lime-500/40",
  },
  {
    id: "home",
    label: "Home",
    dot: "bg-indigo-500",
    pill: "bg-indigo-500/12 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
    ring: "ring-indigo-500/40",
  },
];

const CATEGORY_MAP = new Map(CATEGORIES.map((category) => [category.id, category]));

export function getCategory(id: string | null | undefined): Category | null {
  if (!id) return null;
  return CATEGORY_MAP.get(id) ?? null;
}

/** True when the value is the id of a known built-in category. */
export function isCategoryId(value: unknown): value is string {
  return typeof value === "string" && CATEGORY_MAP.has(value);
}

/** The categories still available to the user, in their original order. */
export function selectCategories(deleted: readonly string[]): Category[] {
  if (deleted.length === 0) return [...CATEGORIES];
  const removed = new Set(deleted);
  return CATEGORIES.filter((category) => !removed.has(category.id));
}
