import type { Priority, Task } from "@/lib/domain/types";

export interface TaskCompletionCelebrationEvent {
  id: number;
  title: string;
  priority: Priority;
  completedChecklistItems: number;
  origin: { x: number; y: number } | null;
}

type CompletionState = Pick<Task, "completed" | "canceled" | "title" | "priority" | "subtasks">;
type Listener = (celebration: TaskCompletionCelebrationEvent) => void;
type MeasureOrigin = (callback: (origin: { x: number; y: number } | null) => void) => void;

export const MAX_CELEBRATION_PARTICLES = 120;
export const CHECKLIST_PARTICLE_WEIGHT = 0.25;

const listeners = new Set<Listener>();
const origins = new Map<string, MeasureOrigin>();
const dispatchDelays = new Map<string, number>();
let nextCelebrationId = 0;

export function deferTaskCompletionCelebration(taskId: string, delayMs: number): void {
  dispatchDelays.set(taskId, Math.max(0, delayMs));
}

export function registerTaskCompletionOrigin(taskId: string, measure: MeasureOrigin): () => void {
  origins.set(taskId, measure);
  return () => {
    if (origins.get(taskId) === measure) origins.delete(taskId);
  };
}

export function subscribeToTaskCompletionCelebrations(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function celebrateTaskCompletion(previous: CompletionState, next: CompletionState, taskId?: string): void {
  if (previous.completed || !next.completed || next.canceled) return;

  const celebration = {
    id: ++nextCelebrationId,
    title: next.title,
    priority: next.priority,
    completedChecklistItems: next.subtasks.filter((subtask) => subtask.done).length,
    origin: null as { x: number; y: number } | null,
  };
  const delayMs = taskId ? dispatchDelays.get(taskId) ?? 0 : 0;
  if (taskId) dispatchDelays.delete(taskId);
  const dispatch = () => {
    if (delayMs > 0) setTimeout(() => listeners.forEach((listener) => listener(celebration)), delayMs);
    else listeners.forEach((listener) => listener(celebration));
  };
  const measure = taskId ? origins.get(taskId) : undefined;
  if (!measure) {
    dispatch();
    return;
  }
  measure((origin) => {
    celebration.origin = origin;
    dispatch();
  });
}

export function celebrationParticleCount(priority: Priority, completedChecklistItems = 0): number {
  let baseCount: number;
  switch (priority) {
    case "low": baseCount = 16; break;
    case "medium": baseCount = 28; break;
    case "high": baseCount = 44; break;
    case "critical": baseCount = 64; break;
  }
  const checklistBonus = Math.max(0, Math.floor(completedChecklistItems)) * CHECKLIST_PARTICLE_WEIGHT;
  return Math.min(MAX_CELEBRATION_PARTICLES, Math.round(baseCount * (1 + checklistBonus)));
}
