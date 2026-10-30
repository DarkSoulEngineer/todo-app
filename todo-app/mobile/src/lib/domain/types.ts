import type { Board } from "@/lib/domain/boards";

export type Priority = "critical" | "high" | "medium" | "low";

/** Derived task status. Completed and Canceled are explicit; the rest come from the due date. */
export type TaskStatus = "upcoming" | "overdue" | "completed" | "canceled";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

/** A file or link attached to a task. */
export interface Attachment {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

/** An immutable entry in a task's activity timeline. */
export interface ActivityEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  /** ISO date-time string, or null when the task has no deadline. */
  dueAt: string | null;
  priority: Priority;
  /** User-defined tag id, or null when untagged. */
  category: string | null;
  completed: boolean;
  canceled: boolean;
  subtasks: Subtask[];
  /** Id of the user-chosen list, or null when unassigned. */
  sectionId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  tags: string[];
  /** One-time migration marker: list/title names no longer assign special tags. */
  specialTagsVersion?: 1;
  attachments: Attachment[];
  activity: ActivityEvent[];
}

/**
 * A user-defined board column. Legacy `status` metadata is accepted during
 * import and migrated to explicit task assignments, then removed.
 */
export interface BoardSection {
  id: string;
  title: string;
  status?: TaskStatus;
  /** Any list can be hidden without removing it or its cards. */
  hidden?: boolean;
}

/** A saved point-in-time snapshot of a workspace. */
export interface WorkspaceVersion {
  id: string;
  label: string;
  createdAt: string;
  taskCount: number;
  workspace: Workspace;
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
  Pick<
    Task,
    "title" | "description" | "dueAt" | "priority" | "category" | "subtasks" | "sectionId" | "tags"
  >
>;

/** Editable shape used by the create/edit form. */
export interface TaskDraft {
  title: string;
  description: string;
  dueAt: string | null;
  priority: Priority;
  category: string | null;
  subtasks: Subtask[];
  /** Optional so existing form callers remain source-compatible. */
  tags?: string[];
}

export type SortKey = "manual" | "due" | "priority" | "created";

export type StatusFilter = "all" | TaskStatus;

/** Sidebar "smart list": a saved view over tasks. */
export type SmartList = "today" | "tomorrow" | "thisWeek" | "upcoming" | "overdue" | "all" | "completed" | "canceled" | "by-section";

/** Which surface is showing in the main region. */
export type ViewMode = "list" | "board" | "calendar" | "insights";
