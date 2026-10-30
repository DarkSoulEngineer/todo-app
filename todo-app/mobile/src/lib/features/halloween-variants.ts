export const HALLOWEEN_VARIANTS = ["skeleton", "zombie", "vampire", "clown", "ghost", "pumpkin"] as const;
export type HalloweenVariant = typeof HALLOWEEN_VARIANTS[number];

/** A task's random-looking costume stays the same across views and app restarts. */
export function halloweenVariantForCard(cardId: string): HalloweenVariant {
  let hash = 2166136261;
  for (let index = 0; index < cardId.length; index++) {
    hash = Math.imul(hash ^ cardId.charCodeAt(index), 16777619);
  }
  return HALLOWEEN_VARIANTS[(hash >>> 0) % HALLOWEEN_VARIANTS.length];
}
