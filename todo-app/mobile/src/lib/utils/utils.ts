/** "1 task" / "3 tasks" */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Caps a list for preview text without mutating it. */
export function take<T>(items: readonly T[], count: number): T[] {
  return items.slice(0, count);
}
