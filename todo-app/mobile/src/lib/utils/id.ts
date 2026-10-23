/**
 * Generates a short, opaque identifier. Ids are never parsed or compared by
 * shape, so every caller can share this single source (default: 8 chars).
 *
 * `nanoid` is not used on React Native; 36^size combinations keep local ids
 * effectively collision-free while staying short enough for storage keys.
 */
export function makeId(size = 8): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  let id = "";
  for (let index = 0; index < Math.max(4, size); index += 1) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}
