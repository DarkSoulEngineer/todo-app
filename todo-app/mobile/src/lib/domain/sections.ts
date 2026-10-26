import { makeId } from "@/lib/utils/id";
import { deriveStatus } from "@/lib/domain/status";
import type { BoardSection, Task, TaskStatus } from "@/lib/domain/types";

/** Order of the built-in, status-backed columns. */
export const STATUS_SECTIONS: TaskStatus[] = ["upcoming", "overdue", "completed", "canceled"];

/** The list that canceled tasks are automatically moved into. */
export const CANCELED_SECTION_TITLE = "Canceled";

export function isCanceledSection(section: BoardSection): boolean {
  return section.title.trim().toLowerCase() === CANCELED_SECTION_TITLE.toLowerCase();
}

export function findCanceledSection(sections: BoardSection[]): BoardSection | undefined {
  return sections.find(isCanceledSection);
}

/**
 * A new board starts from scratch: no columns at all. The predefined
 * Upcoming/Overdue/Completed/Canceled layout is gone: the user adds their own
 * sections, and a card is only ever placed in a column that exists.
 */
export function defaultSections(): BoardSection[] {
  return [];
}

export function isStatusSection(
  section: BoardSection,
): section is BoardSection & { status: TaskStatus } {
  return typeof section.status === "string";
}

export function isCustomSection(section: BoardSection): boolean {
  return section.status === undefined;
}

function asStatus(value: unknown): TaskStatus | undefined {
  return STATUS_SECTIONS.includes(value as TaskStatus) ? (value as TaskStatus) : undefined;
}

/**
 * Coerces unknown persisted data into a valid section list. A board that
 * stored no sections stays empty: nothing is backfilled, so a board always
 * shows exactly the columns the user created.
 */
export function normalizeSections(value: unknown): BoardSection[] {
  const list = Array.isArray(value) ? value : [];
  const seenIds = new Set<string>();
  const result: BoardSection[] = [];

  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!title) continue;

    const status = asStatus(record.status);
    // Only keep the first section for a given status; extras fall back to custom.
    const duplicateStatus =
      status !== undefined && result.some((section) => section.status === status);
    const effectiveStatus = duplicateStatus ? undefined : status;

    let id = typeof record.id === "string" && record.id ? record.id : makeId(10);
    if (seenIds.has(id)) id = `${id}-${makeId(4)}`;
    seenIds.add(id);

    const section: BoardSection = { id, title };
    if (effectiveStatus) section.status = effectiveStatus;
    if (record.hidden === true) section.hidden = true;
    result.push(section);
  }

  return result;
}

/** Drops `sectionId` references that no longer point at a custom section. */
export function reconcileSectionIds(tasks: { sectionId: string | null }[], sections: BoardSection[]): void {
  const customIds = new Set(sections.filter(isCustomSection).map((section) => section.id));
  for (const task of tasks) {
    if (task.sectionId && !customIds.has(task.sectionId)) task.sectionId = null;
  }
}

/**
 * Determines which board section a task currently belongs to.
 * Returns the section ID or undefined if not found.
 */
export function getTaskSectionId(task: Task, sections: BoardSection[], now: Date): string | undefined {
  if (task.sectionId) {
    const customSection = sections.find((s) => s.id === task.sectionId);
    if (customSection && isCustomSection(customSection)) return customSection.id;
  }
  const status = deriveStatus(task, now);
  const statusSection = sections.find((s) => s.status === status);
  return statusSection?.id;
}

/**
 * Gets the previous and next section IDs relative to the task's current
 * section, following the board's section order.
 */
export function getAdjacentSections(
  task: Task,
  sections: BoardSection[],
  now: Date,
): { prev: string | null; next: string | null } {
  const currentSectionId = getTaskSectionId(task, sections, now);
  if (!currentSectionId) return { prev: null, next: null };

  const currentIndex = sections.findIndex((s) => s.id === currentSectionId);
  if (currentIndex === -1) return { prev: null, next: null };

  const prev = currentIndex > 0 ? sections[currentIndex - 1].id : null;
  const next = currentIndex < sections.length - 1 ? sections[currentIndex + 1].id : null;

  return { prev, next };
}
