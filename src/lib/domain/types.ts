import type { Board } from "@/lib/domain/boards";

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
  /** Id of a custom board section, or null when the task lives in a status column. */
  sectionId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/**
 * A board column. When `status` is set the column is backed by a derived task
 * status (Upcoming/Overdue/Completed/Canceled). Custom sections omit `status`
 * and collect tasks through `Task.sectionId`.
 */
export interface BoardSection {
  id: string;
  title: string;
  status?: TaskStatus;
  /** Status sections can be hidden rather than removed. */
  hidden?: boolean;
}

/** The full persisted workspace: tasks, the board layout and the boards. */
export interface Workspace {
  tasks: Task[];
  sections: BoardSection[];
  /** The user's boards. */
  boards: Board[];
}

/**
 * Fields that may be patched directly onto a task without any status
 * re-derivation (see `patchTask`). Deliberately excludes `completed`,
 * `canceled` and `completedAt`, which are owned by the status APIs.
 */
export type TaskPatch = Partial<
  Pick<Task, "title" | "description" | "dueAt" | "priority" | "category" | "subtasks" | "sectionId">
>;

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
export type SmartList = "today" | "tomorrow" | "thisWeek" | "upcoming" | "overdue" | "all" | "completed" | "canceled" | "by-section";

/** Which surface is showing in the main region. */
export type ViewMode = "list" | "board" | "calendar" | "insights";
