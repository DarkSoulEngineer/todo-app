import { nanoid } from "nanoid";

/**
 * Generates a short, opaque identifier. Ids are never parsed or compared by
 * shape, so every caller can share this single source (default: 8 chars).
 */
export function makeId(size = 8): string {
  return nanoid(size);
}
