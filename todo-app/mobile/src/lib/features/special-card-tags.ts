import type { Board } from "@/lib/domain/boards";
import type { Task } from "@/lib/domain/types";
import { classifySpecialCardTag, detectSeasonalCardTheme } from "@/lib/features/card-themes";

/** Status and event groups are exclusive; custom easter eggs and ordinary tags coexist. */
export function normalizeCardTags(input: readonly unknown[] | undefined): string[] {
  const result: string[] = [];
  for (const item of input ?? []) {
    if (typeof item !== "string" || !item.trim()) continue;
    const special = classifySpecialCardTag(item);
    const label = special?.theme.label ?? item.trim();
    for (let index = result.length - 1; index >= 0; index--) {
      const existing = classifySpecialCardTag(result[index]);
      if ((special && special.group !== "easter-egg" && existing?.group === special.group) || result[index].toLowerCase() === label.toLowerCase()) result.splice(index, 1);
    }
    result.push(label);
  }
  return result;
}

export function statusCardTag(tags: readonly string[] = []) {
  return tags.map(classifySpecialCardTag).filter((tag) => tag?.group === "status").at(-1)?.theme ?? null;
}

/** Legacy category filters also match ordinary and special card tags. */
export function matchesBoardTag(task: Pick<Task, "category" | "tags">, id: string, boards: readonly Board[]): boolean {
  if (task.category === id) return true;
  const board = boards.find((board) => board.id === id);
  if (!board) return false;
  const special = classifySpecialCardTag(board.label);
  return (task.tags ?? []).some((tag) => special ? classifySpecialCardTag(tag)?.theme.id === special.theme.id : tag.trim().toLowerCase() === board.label.trim().toLowerCase());
}

export function toggleCardTag(tags: readonly string[], label: string): string[] {
  const special = classifySpecialCardTag(label);
  const active = tags.some((tag) => special ? classifySpecialCardTag(tag)?.theme.id === special.theme.id : tag.toLowerCase() === label.trim().toLowerCase());
  return active
    ? normalizeCardTags(tags.filter((tag) => special ? classifySpecialCardTag(tag)?.theme.id !== special.theme.id : tag.toLowerCase() !== label.trim().toLowerCase()))
    : normalizeCardTags([...tags, label]);
}

/** Merge external updates into an open editor without dropping unsaved tag edits. */
export function mergeCardTagDraft(local: string[], previous: readonly string[], incoming: readonly string[]): string[] {
  const before = normalizeCardTags(previous), next = normalizeCardTags(incoming);
  let merged = normalizeCardTags(local);
  const choice = (tags: readonly string[], group: "status" | "event") => tags.map(classifySpecialCardTag).find((tag) => tag?.group === group)?.theme;
  for (const group of ["status", "event"] as const) {
    if (choice(merged, group)?.id === choice(before, group)?.id && choice(before, group)?.id !== choice(next, group)?.id) {
      merged = merged.filter((tag) => classifySpecialCardTag(tag)?.group !== group);
      const selected = choice(next, group);
      if (selected) merged.push(selected.label);
    }
  }
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const isMergeableTag = (tag: string) => {
    const special = classifySpecialCardTag(tag);
    return !special || special.group === "easter-egg";
  };
  for (const tag of before.filter(isMergeableTag)) {
    if (!next.some((value) => same(tag, value))) merged = merged.filter((value) => !same(tag, value));
  }
  for (const tag of next.filter(isMergeableTag)) {
    if (!before.some((value) => same(tag, value)) && !merged.some((value) => same(tag, value))) merged.push(tag);
  }
  const result = normalizeCardTags(merged);
  return JSON.stringify(result) === JSON.stringify(local) ? local : result;
}

function statusFields(task: Task, id: string, stamp: string): Partial<Task> {
  if (id === "done") return { completed: true, canceled: false, completedAt: task.completed && task.completedAt ? task.completedAt : stamp };
  if (id === "canceled") return { completed: false, canceled: true, completedAt: null };
  return { completed: false, canceled: false, completedAt: null };
}

/** Explicit tag edits own status; event tags never change deadlines or placement. */
export function applyCardTags(task: Task, input: readonly unknown[], stamp = new Date().toISOString()): Task {
  const tags = normalizeCardTags(input);
  const status = statusCardTag(tags);
  const removedStatus = !status && statusCardTag(task.tags);
  return { ...task, tags, specialTagsVersion: 1, ...(status ? statusFields(task, status.id, stamp) : removedStatus ? statusFields(task, "open", stamp) : {}) };
}

export function setCardStatus(task: Task, status: "completed" | "canceled" | "open", stamp = new Date().toISOString()): Task {
  const ordinaryAndEvent = (task.tags ?? []).filter((tag) => classifySpecialCardTag(tag)?.group !== "status");
  const label = status === "completed" ? "Done" : status === "canceled" ? "Canceled" : null;
  return { ...applyCardTags(task, label ? [...ordinaryAndEvent, label] : ordinaryAndEvent, stamp), ...statusFields(task, label === "Done" ? "done" : label === "Canceled" ? "canceled" : "open", stamp), updatedAt: stamp };
}

/** Moving into a status-named section applies its matching status tag. */
export function applySectionCardStatus(task: Task, sectionTitle: string, stamp = new Date().toISOString()): Task {
  const status = classifySpecialCardTag(sectionTitle);
  if (status?.group !== "status") return task;
  if (status.theme.id === "done") return setCardStatus(task, "completed", stamp);
  if (status.theme.id === "canceled") return setCardStatus(task, "canceled", stamp);
  const reopened = setCardStatus(task, "open", stamp);
  return applyCardTags(reopened, [...reopened.tags, status.theme.label], stamp);
}

/** Convert a legacy single category if it names a special tag. */
export function applyCategoryCardTag(task: Task, boards: readonly Board[]): Task {
  const board = boards.find((board) => board.id === task.category);
  const special = board ? classifySpecialCardTag(board.label) : null;
  return special ? { ...applyCardTags(task, [...(task.tags ?? []), special.theme.label]), category: null } : task;
}

/** One-time compatibility conversion. Never re-infer tags after the version mark. */
export function migrateCardTags(task: Task, listTitle = "", boards: readonly Board[] = []): Task {
  let tags = normalizeCardTags(task.tags);
  if (task.specialTagsVersion !== 1 && !tags.some((tag) => ["event", "easter-egg"].includes(classifySpecialCardTag(tag)?.group ?? ""))) {
    const event = detectSeasonalCardTheme(task.title) ?? detectSeasonalCardTheme(listTitle);
    if (event) tags = normalizeCardTags([...tags, event.label]);
  }
  if (!statusCardTag(tags)) {
    if (task.completed) tags.push("Done");
    else if (task.canceled) tags.push("Canceled");
  }
  return applyCategoryCardTag(applyCardTags(task, tags, task.updatedAt), boards);
}
