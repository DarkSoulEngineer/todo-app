/** Display-only cap; retain the original value for editing and accessibility. */
export function ribbonLabel(value: string, limit = 16): string {
  const characters = Array.from(value);
  return characters.length > limit ? `${characters.slice(0, limit - 3).join("")}...` : value;
}
