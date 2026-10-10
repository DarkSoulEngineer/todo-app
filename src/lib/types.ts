export type Priority = "low" | "medium" | "high";

/** Derived task status. Completed and Canceled are explicit; the rest come from the due date. */
export type TaskStatus = "upcoming" | "overdue" | "completed" | "canceled";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  /** ISO date-time string, or null when the task has no deadline. */
  dueAt: string | null;
  priority: Priority;
  /** Category id from `lib/categories.ts`, or null when untagged. */
  category: string | null;
  completed: boolean;
  canceled: boolean;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** Editable shape used by the create/edit form. */
export interface TaskDraft {
  title: string;
  description: string;
  dueAt: string | null;
  priority: Priority;
  category: string | null;
  subtasks: Subtask[];
}

export type SortKey = "manual" | "due" | "priority" | "created";

export type StatusFilter = "all" | TaskStatus;

/** Sidebar "smart list" — a saved view over tasks. */
export type SmartList = "today" | "upcoming" | "overdue" | "all" | "completed" | "canceled";

/** Which surface is showing in the main region. */
export type ViewMode = "list" | "board" | "calendar" | "insights";
