import { makeId } from "@/lib/utils/id";
import {
  BUILT_IN_BOARDS,
  defaultBoards,
  missingBuiltInBoards,
  type Board,
  type BoardColorId,
} from "@/lib/domain/boards";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { overdueAt, rescheduleToNextDay } from "@/lib/utils/datetime";
import {
  createSampleTasks,
  distributeSampleTasks,
  SAMPLE_BOARDS,
  SAMPLE_SECTIONS,
} from "@/lib/data/sample";
import {
  CANCELED_SECTION_TITLE,
  findCanceledSection,
  isCustomSection,
  isStatusSection,
} from "@/lib/domain/sections";
import {
  activeProject,
  cloneProject,
  loadProjects,
  newProject,
  projectFromWorkspace,
  saveProjects,
  withWorkspace,
  type ProjectsState,
  type JanusProject,
  type ProjectImport,
} from "@/lib/domain/projects";
import { loadVersions, saveVersions } from "@/lib/data/versions";
import {
  applyTaskPatch,
  applyDraft,
  cloneTask,
  createTask,
  normalizeActivityEvent,
  normalizeAttachment,
} from "@/lib/domain/task-factory";
import type {
  ActivityEvent,
  Attachment,
  BoardSection,
  Task,
  TaskDraft,
  TaskPatch,
  Workspace,
  WorkspaceVersion,
} from "@/lib/domain/types";

export interface TasksApi {
  tasks: Task[];
  sections: BoardSection[];
  /** The user's boards, in display order. */
  boards: Board[];
  isLoading: boolean;
  isEmpty: boolean;
  addTask: (draft: TaskDraft) => Task;
  updateTask: (id: string, draft: TaskDraft) => void;
  /**
   * Merges only the provided fields into a task and bumps `updatedAt`. Unlike
   * `updateTask`, it never re-runs keyword/status derivation and never touches
   * `completed`/`canceled`/`completedAt`.
   */
  patchTask: (id: string, patch: TaskPatch) => void;
  /** Appends one timeline event; activity is intentionally not patchable. */
  appendTaskActivity: (taskId: string, event: ActivityEvent) => void;
  /** Adds attachment metadata; binary upload/storage is handled elsewhere. */
  addAttachment: (taskId: string, attachment: Attachment) => void;
  /** Removes attachment metadata by id. */
  removeAttachment: (taskId: string, attachmentId: string) => void;
  deleteTask: (id: string) => void;
  toggleComplete: (id: string) => void;
  toggleCancel: (id: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addSubtask: (taskId: string, title: string) => void;
  removeSubtask: (taskId: string, subtaskId: string) => void;
  /** Set status directly (used by board move actions). */
  setTaskStatus: (id: string, status: "completed" | "canceled" | "open") => void;
  /** Move a task to a due date (used by calendar actions), or clear it. */
  setTaskDueAt: (id: string, dueAt: string | null) => void;
  /** Assign a task to a board section (status or custom) honouring its meaning. */
  assignTaskToSection: (taskId: string, sectionId: string) => void;
  /** Point a task at a custom section (or null to release it). */
  setTaskSectionId: (taskId: string, sectionId: string | null) => void;
  addSection: (title: string) => BoardSection;
  renameSection: (id: string, title: string) => void;
  /** Removes a custom section; its tasks return to their status column. */
  deleteSection: (id: string) => void;
  toggleSectionHidden: (id: string) => void;
  reorderSections: (orderedIds: string[]) => void;
  reorderTasks: (orderedIds: string[]) => void;
  /**
   * Board management. Deleting a board also strips the tag from its tasks.
   * `deleteBoard` reports the label and how many tasks lost the tag.
   */
  createBoard: (input: { label: string; color: BoardColorId }) => Board;
  renameBoard: (id: string, label: string) => void;
  recolorBoard: (id: string, color: BoardColorId) => void;
  deleteBoard: (id: string) => { label: string; affected: number } | null;
  /** Puts the built-in boards that are missing back on offer. */
  restoreBuiltInBoards: () => void;
  /** @deprecated Board API wrapper: use the board actions above. */
  deletedCategories: string[];
  /** @deprecated Board API wrapper: use the board actions above. */
  deleteCategory: (id: string) => { label: string; affected: number } | null;
  /** @deprecated Board API wrapper: use the board actions above. */
  restoreCategory: (id: string) => void;
  /** @deprecated Board API wrapper: use the board actions above. */
  restoreCategories: () => void;
  clearCompleted: () => number;
  getCompletedIds: () => string[];
  /** Immutable copy of the workspace, for reversible bulk actions. */
  snapshot: () => Workspace;
  restore: (workspace: Workspace) => void;
  /** True when this specific task has recoverable previous states. */
  canRevertTask: (id: string) => boolean;
  /** Reverts a specific task to its previous state, if available. */
  revertTask: (id: string) => void;
  /** Clears the tracked per-task history. */
  clearTaskHistory: () => void;
  loadSample: () => void;
  // Saved workspace snapshots.
  versions: WorkspaceVersion[];
  createVersion: () => void;
  restoreVersion: (id: string) => void;
  deleteVersion: (id: string) => void;
  // Boards as project tenants: each board owns a full workspace.
  /** All boards (projects) in registry order. */
  projects: JanusProject[];
  /** Id of the currently loaded board. */
  currentProjectId: string;
  /** Name of the currently loaded board. */
  currentProjectName: string;
  /** Creates a new empty board and switches to it. Returns the new id. */
  createProject: (name?: string) => string;
  /** Creates a board from an imported workspace and switches to it. */
  importProject: (name: string, workspace: Workspace) => string;
  /** Adds every board in a backup at once, preserving closed state. */
  importProjects: (entries: ProjectImport[]) => string[];
  /** Duplicates a board (tasks/sections/boards included) and switches to it. */
  duplicateProject: (id: string) => string | null;
  renameProject: (id: string, name: string) => void;
  switchProject: (id: string) => void;
  /** Marks a board closed without deleting it. Closed boards can be reopened. */
  closeProject: (id: string) => boolean;
  /** Reopens a closed board and makes it the active board. */
  reopenProject: (id: string) => boolean;
  /** Removes a board with its data. False when it is the last remaining board. */
  removeProject: (id: string) => boolean;
}

export function useTasks(): TasksApi {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sections, setSections] = useState<BoardSection[]>([]);
  const [boards, setBoards] = useState<Board[]>(defaultBoards);
  const [projectsState, setProjectsState] = useState<ProjectsState | null>(null);
  const [versions, setVersions] = useState<WorkspaceVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tasksRef = useRef<Task[]>([]);
  const sectionsRef = useRef<BoardSection[]>([]);
  const boardsRef = useRef<Board[]>(defaultBoards());
  const projectsRef = useRef<ProjectsState | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const versionsRef = useRef<WorkspaceVersion[]>([]);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);

  useEffect(() => {
    versionsRef.current = versions;
  }, [versions]);

  // Hydrate the project registry once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [registry, storedVersions] = await Promise.all([loadProjects(), loadVersions()]);
      if (cancelled) return;
      const active = activeProject(registry);
      projectsRef.current = registry;
      activeIdRef.current = active.id;
      setProjectsState(registry);
      tasksRef.current = active.workspace.tasks;
      sectionsRef.current = active.workspace.sections;
      boardsRef.current = active.workspace.boards;
      setTasks(active.workspace.tasks);
      setSections(active.workspace.sections);
      setBoards(active.workspace.boards);
      setVersions(storedVersions);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after every change, once hydrated. Writes are serialized so an
  // older snapshot can never land after a newer one.
  useEffect(() => {
    if (isLoading) return;
    const registry = projectsRef.current;
    const activeId = activeIdRef.current;
    if (!registry || !activeId) return;
    const next = withWorkspace(registry, activeId, { tasks, sections, boards });
    if (next === registry) return;
    projectsRef.current = next;
    setProjectsState(next);
    saveQueueRef.current = saveQueueRef.current.then(() => saveProjects(next));
  }, [tasks, sections, boards, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    saveQueueRef.current = saveQueueRef.current.then(() => saveVersions(versions));
  }, [versions, isLoading]);

  // React batches state updates, while project actions can be invoked
  // synchronously after a task/section/board action (for example, duplicate
  // the current project immediately after editing it). Keep the refs eager so
  // those actions always fold the latest in-memory workspace into the registry.
  const setLiveTasks = useCallback((updater: (previous: Task[]) => Task[]) => {
    const next = updater(tasksRef.current);
    tasksRef.current = next;
    setTasks(next);
  }, []);
  const setLiveSections = useCallback((updater: (previous: BoardSection[]) => BoardSection[]) => {
    const next = updater(sectionsRef.current);
    sectionsRef.current = next;
    setSections(next);
  }, []);
  const setLiveBoards = useCallback((updater: (previous: Board[]) => Board[]) => {
    const next = updater(boardsRef.current);
    boardsRef.current = next;
    setBoards(next);
  }, []);

  /**
   * Canceling a task always gives it a real "Canceled" list to live in. The
   * list is custom (not status-backed) so it can still be renamed, hidden, or
   * deleted like every other list on the board.
   */
  const ensureCanceledSection = useCallback((): BoardSection => {
    const existing = findCanceledSection(sectionsRef.current);
    if (existing) {
      if (existing.hidden) {
        setLiveSections((prev) =>
          prev.map((section) =>
            section.id === existing.id ? { ...section, hidden: false } : section,
          ),
        );
      }
      return existing;
    }
    const section: BoardSection = {
      id: `custom-${makeId(8)}`,
      title: CANCELED_SECTION_TITLE,
    };
    setLiveSections((prev) => [...prev, section]);
    return section;
  }, [setLiveSections]);

  const updateById = useCallback((id: string, updater: (task: Task) => Task) => {
    setLiveTasks((prev) => prev.map((task) => (task.id === id ? updater(task) : task)));
  }, [setLiveTasks]);

  /**
   * Project actions can happen before the persistence effect gets a turn (for
   * example, after editing a task and immediately opening the board manager).
   * Fold the live workspace into the registry first so switching, duplicating,
   * importing, or removing a project never drops the latest edit.
   */
  const registryWithLiveWorkspace = useCallback((): ProjectsState | null => {
    const registry = projectsRef.current;
    const activeId = activeIdRef.current;
    if (!registry || !activeId) return registry;
    const next = withWorkspace(registry, activeId, {
      tasks: tasksRef.current,
      sections: sectionsRef.current,
      boards: boardsRef.current,
    });
    projectsRef.current = next;
    return next;
  }, []);

  const [taskHistory, setTaskHistory] = useState<Record<string, Task[]>>({});

  /** Pushes the current version of one task onto its revert stack (last 10). */
  const recordTask = useCallback((id: string) => {
    const current = tasksRef.current.find((task) => task.id === id);
    if (!current) return;
    const clone = cloneTask(current);
      setTaskHistory((prev) => ({
      ...prev,
      [id]: [clone, ...(prev[id] ?? [])].slice(0, 10),
    }));
  }, []);

  /**
   * Updates a task in the active board when possible, otherwise in whichever
   * project owns it. Cross-board overviews (My Tasks, Calendar) rely on this so
   * completing or rescheduling a task never silently targets the wrong board.
   */
  const updateTaskAnywhere = useCallback((id: string, updater: (task: Task) => Task) => {
    if (tasksRef.current.some((task) => task.id === id)) {
      recordTask(id);
      updateById(id, updater);
      return;
    }
    const registry = registryWithLiveWorkspace();
    if (!registry) return;
    const stamp = new Date().toISOString();
    let found = false;
    const projects = registry.projects.map((project) => {
      const index = project.workspace.tasks.findIndex((task) => task.id === id);
      if (index === -1) return project;
      found = true;
      const nextTasks = project.workspace.tasks.slice();
      nextTasks[index] = updater(nextTasks[index]);
      return { ...project, updatedAt: stamp, workspace: { ...project.workspace, tasks: nextTasks } };
    });
    if (!found) return;
    const next = { ...registry, projects };
    projectsRef.current = next;
    setProjectsState(next);
    saveQueueRef.current = saveQueueRef.current.then(() => saveProjects(next));
  }, [recordTask, registryWithLiveWorkspace, updateById]);

  const canRevertTask = useCallback(
    (id: string) => (taskHistory[id]?.length ?? 0) > 0,
    [taskHistory],
  );

  const revertTask = useCallback(
    (id: string) => {
      const stack = taskHistory[id];
      if (!stack || stack.length === 0) return;
      const previous = stack[0];
      setTaskHistory((prev) => ({
        ...prev,
        [id]: (prev[id] ?? []).slice(1),
      }));
      setLiveTasks((prev) => prev.map((task) => (task.id === id ? previous : task)));
    },
    [setLiveTasks, taskHistory],
  );

  const clearTaskHistory = useCallback(() => setTaskHistory({}), []);

  const addTask = useCallback((draft: TaskDraft): Task => {
    const task = createTask(draft);
    setLiveTasks((prev) => [...prev, task]);
    return task;
  }, [setLiveTasks]);

  const updateTask = useCallback(
    (id: string, draft: TaskDraft) => {
      recordTask(id);
      updateById(id, (task) => applyDraft(task, draft));
    },
    [recordTask, updateById],
  );

  const patchTask = useCallback(
    (id: string, patch: TaskPatch) => {
      if (typeof patch !== "object" || patch === null) return;
      recordTask(id);
      updateById(id, (task) => ({ ...applyTaskPatch(task, patch), updatedAt: new Date().toISOString() }));
    },
    [recordTask, updateById],
  );

  const appendTaskActivity = useCallback(
    (taskId: string, event: ActivityEvent) => {
      const normalized = normalizeActivityEvent(event);
      if (!normalized) return;
      recordTask(taskId);
      updateById(taskId, (task) => ({
        ...cloneTask(task),
        activity: [...(task.activity ?? []), normalized].slice(-50),
        updatedAt: new Date().toISOString(),
      }));
    },
    [recordTask, updateById],
  );

  const addAttachment = useCallback(
    (taskId: string, attachment: Attachment) => {
      const normalized = normalizeAttachment(attachment);
      if (!normalized) return;
      recordTask(taskId);
      updateById(taskId, (task) => ({
        ...cloneTask(task),
        attachments: [...(task.attachments ?? []), normalized],
        updatedAt: new Date().toISOString(),
      }));
    },
    [recordTask, updateById],
  );

  const removeAttachment = useCallback(
    (taskId: string, attachmentId: string) => {
      if (typeof attachmentId !== "string" || !attachmentId) return;
      recordTask(taskId);
      updateById(taskId, (task) => ({
        ...cloneTask(task),
        attachments: (task.attachments ?? []).filter((attachment) => attachment.id !== attachmentId),
        updatedAt: new Date().toISOString(),
      }));
    },
    [recordTask, updateById],
  );

  const deleteTask = useCallback(
    (id: string) => {
      recordTask(id);
      setLiveTasks((prev) => prev.filter((task) => task.id !== id));
    },
    [recordTask, setLiveTasks],
  );

  const toggleComplete = useCallback(
    (id: string) => {
      const canceledSection = findCanceledSection(sectionsRef.current);
      updateTaskAnywhere(id, (task) => {
        const completed = !task.completed;
        const leaveCanceledList =
          completed && task.sectionId !== null && task.sectionId === canceledSection?.id;
        return {
          ...task,
          completed,
          canceled: completed ? false : task.canceled,
          completedAt: completed ? new Date().toISOString() : null,
          sectionId: leaveCanceledList ? null : task.sectionId,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateTaskAnywhere],
  );

  const toggleCancel = useCallback(
    (id: string) => {
      const current = tasksRef.current.find((task) => task.id === id);
      if (!current) return;
      recordTask(id);
      const canceling = !current.canceled;
      const canceledSection = canceling
        ? ensureCanceledSection()
        : findCanceledSection(sectionsRef.current);
      updateById(id, (task) => {
        const restoreFromCanceledList =
          !canceling && task.sectionId !== null && task.sectionId === canceledSection?.id;
        return {
          ...task,
          canceled: canceling,
          completed: canceling ? false : task.completed,
          completedAt: canceling ? null : task.completedAt,
          sectionId: canceling
            ? canceledSection && isCustomSection(canceledSection)
              ? canceledSection.id
              : null
            : restoreFromCanceledList
              ? null
              : task.sectionId,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [ensureCanceledSection, recordTask, updateById],
  );

  const toggleSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      recordTask(taskId);
      updateById(taskId, (task) => ({
        ...task,
        subtasks: task.subtasks.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    [recordTask, updateById],
  );

  const addSubtask = useCallback(
    (taskId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      recordTask(taskId);
      updateById(taskId, (task) => ({
        ...task,
        subtasks: [...task.subtasks, { id: makeId(8), title: trimmed, done: false }],
        updatedAt: new Date().toISOString(),
      }));
    },
    [recordTask, updateById],
  );

  const removeSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      recordTask(taskId);
      updateById(taskId, (task) => ({
        ...task,
        subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
        updatedAt: new Date().toISOString(),
      }));
    },
    [recordTask, updateById],
  );

  const setTaskStatus = useCallback(
    (id: string, status: "completed" | "canceled" | "open") => {
      if (!tasksRef.current.some((task) => task.id === id)) return;
      const canceledSection =
        status === "canceled"
          ? ensureCanceledSection()
          : findCanceledSection(sectionsRef.current);
      recordTask(id);
      updateById(id, (task) => {
        const stamp = new Date().toISOString();
        const inCanceledList =
          task.sectionId !== null && task.sectionId === canceledSection?.id;
        if (status === "completed") {
          return {
            ...task,
            completed: true,
            canceled: false,
            completedAt: stamp,
            sectionId: null,
            updatedAt: stamp,
          };
        }
        if (status === "canceled") {
          return {
            ...task,
            completed: false,
            canceled: true,
            completedAt: null,
            sectionId:
              canceledSection && isCustomSection(canceledSection)
                ? canceledSection.id
                : null,
            updatedAt: stamp,
          };
        }
        return {
          ...task,
          completed: false,
          canceled: false,
          completedAt: null,
          sectionId: inCanceledList ? null : task.sectionId,
          updatedAt: stamp,
        };
      });
    },
    [ensureCanceledSection, updateById, recordTask],
  );

  const setTaskDueAt = useCallback(
    (id: string, dueAt: string | null) => {
      updateTaskAnywhere(id, (task) => ({ ...task, dueAt, updatedAt: new Date().toISOString() }));
    },
    [updateTaskAnywhere],
  );

  const setTaskSectionId = useCallback(
    (id: string, sectionId: string | null) => {
      recordTask(id);
      updateById(id, (task) => ({
        ...task,
        sectionId,
        updatedAt: new Date().toISOString(),
      }));
    },
    [recordTask, updateById],
  );

  /**
   * Moves a task into a board section. Status sections set the matching status
   * (and clear `sectionId`); custom sections set `sectionId` and leave status
   * flags alone.
   */
  const assignTaskToSection = useCallback(
    (taskId: string, sectionId: string) => {
      const section = sectionsRef.current.find((item) => item.id === sectionId);
      if (!section) return;

      recordTask(taskId);
      const stamp = new Date().toISOString();
      updateById(taskId, (task) => {
        if (isStatusSection(section)) {
          switch (section.status) {
            case "completed":
              return {
                ...task,
                completed: true,
                canceled: false,
                completedAt: stamp,
                sectionId: null,
                updatedAt: stamp,
              };
            case "canceled":
              return {
                ...task,
                completed: false,
                canceled: true,
                completedAt: null,
                sectionId: null,
                updatedAt: stamp,
              };
            case "overdue":
              return {
                ...task,
                completed: false,
                canceled: false,
                completedAt: null,
                sectionId: null,
                dueAt: overdueAt(new Date()),
                updatedAt: stamp,
              };
            case "upcoming": {
              const due = task.dueAt ? Date.parse(task.dueAt) : Number.POSITIVE_INFINITY;
              const overdue = due < Date.now();
              return {
                ...task,
                completed: false,
                canceled: false,
                completedAt: null,
                sectionId: null,
                dueAt: overdue ? rescheduleToNextDay(task.dueAt, new Date()) : task.dueAt,
                updatedAt: stamp,
              };
            }
          }
        }
        return { ...task, sectionId: section.id, updatedAt: stamp };
      });
    },
    [recordTask, updateById],
  );

  const addSection = useCallback((title: string): BoardSection => {
    const section: BoardSection = {
      id: `custom-${makeId(8)}`,
      title: title.trim() || "New section",
    };
    setLiveSections((prev) => [...prev, section]);
    return section;
  }, [setLiveSections]);

  const renameSection = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setLiveSections((prev) =>
      prev.map((section) => (section.id === id ? { ...section, title: trimmed } : section)),
    );
  }, [setLiveSections]);

  const deleteSection = useCallback((id: string) => {
    setLiveSections((prev) => {
      const target = prev.find((section) => section.id === id);
      if (!target || !isCustomSection(target)) return prev;
      return prev.filter((section) => section.id !== id);
    });
    setLiveTasks((prev) =>
      prev.map((task) => (task.sectionId === id ? { ...task, sectionId: null } : task)),
    );
  }, [setLiveSections, setLiveTasks]);

  const toggleSectionHidden = useCallback((id: string) => {
    setLiveSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, hidden: !section.hidden } : section,
      ),
    );
  }, [setLiveSections]);

  const reorderSections = useCallback((orderedIds: string[]) => {
    setLiveSections((prev) => {
      const byId = new Map(prev.map((section) => [section.id, section]));
      const next: BoardSection[] = [];
      for (const id of orderedIds) {
        const section = byId.get(id);
        if (section) {
          next.push(section);
          byId.delete(id);
        }
      }
      for (const section of byId.values()) next.push(section);
      return next;
    });
  }, [setLiveSections]);

  /** Reorders a (possibly filtered) subset within the slots those tasks already occupy. */
  const reorderTasks = useCallback((orderedIds: string[]) => {
    setLiveTasks((prev) => {
      const byId = new Map(prev.map((task) => [task.id, task]));
      const moving = new Set(orderedIds.filter((id) => byId.has(id)));
      if (moving.size === 0) return prev;

      const slots: number[] = [];
      for (const [index, task] of prev.entries()) {
        if (moving.has(task.id)) slots.push(index);
      }

      const next = [...prev];
      orderedIds.forEach((id, order) => {
        const task = byId.get(id);
        const slot = slots[order];
        if (task && slot !== undefined) next[slot] = task;
      });
      return next;
    });
  }, [setLiveTasks]);

  const clearCompleted = useCallback((): number => {
    const completedIds = new Set(
      tasksRef.current.filter((task) => task.completed).map((task) => task.id),
    );
    if (completedIds.size === 0) return 0;
    setLiveTasks((prev) => prev.filter((task) => !completedIds.has(task.id)));
    return completedIds.size;
  }, [setLiveTasks]);

  const getCompletedIds = useCallback(
    () => tasksRef.current.filter((task) => task.completed).map((task) => task.id),
    [],
  );

  const createBoard = useCallback((input: { label: string; color: BoardColorId }): Board => {
    const label = input.label.trim() || "New board";
    const board: Board = { id: `board-${makeId(8)}`, label, color: input.color };
    setLiveBoards((prev) => [...prev, board]);
    return board;
  }, [setLiveBoards]);

  const renameBoard = useCallback((id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setLiveBoards((prev) =>
      prev.map((board) => (board.id === id ? { ...board, label: trimmed } : board)),
    );
  }, [setLiveBoards]);

  const recolorBoard = useCallback((id: string, color: BoardColorId) => {
    setLiveBoards((prev) => prev.map((board) => (board.id === id ? { ...board, color } : board)));
  }, [setLiveBoards]);

  /** Removes a board and strips the tag from every task that carried it. */
  const deleteBoard = useCallback((id: string): { label: string; affected: number } | null => {
    const board = boardsRef.current.find((item) => item.id === id);
    if (!board) return null;

    const stamp = new Date().toISOString();
    const affected = tasksRef.current.filter((task) => task.category === id).length;
    setLiveTasks((prev) =>
      prev.map((task) =>
        task.category === id ? { ...task, category: null, updatedAt: stamp } : task,
      ),
    );
    setLiveBoards((prev) => prev.filter((item) => item.id !== id));
    return { label: board.label, affected };
  }, [setLiveBoards, setLiveTasks]);

  const restoreBuiltInBoards = useCallback(() => {
    setLiveBoards((prev) => {
      const missing = missingBuiltInBoards(prev);
      return missing.length > 0 ? [...prev, ...missing] : prev;
    });
  }, [setLiveBoards]);

  const restoreBoard = useCallback((id: string) => {
    const builtIn = BUILT_IN_BOARDS.find((board) => board.id === id);
    if (!builtIn) return;
    setLiveBoards((prev) => (prev.some((board) => board.id === id) ? prev : [...prev, { ...builtIn }]));
  }, [setLiveBoards]);

  // Deprecated wrappers around the board API, kept so category-named
  // consumers can share the domain hook with the web build.
  const deletedCategories = useMemo(
    () => missingBuiltInBoards(boards).map((board) => board.id),
    [boards],
  );
  const deleteCategory = useCallback((id: string) => deleteBoard(id), [deleteBoard]);
  const restoreCategory = useCallback((id: string) => restoreBoard(id), [restoreBoard]);
  const restoreCategories = useCallback(() => restoreBuiltInBoards(), [restoreBuiltInBoards]);

  const snapshot = useCallback(
    (): Workspace => ({
      tasks: tasksRef.current.map((task) => ({
        ...cloneTask(task),
      })),
      sections: sectionsRef.current.map((section) => ({ ...section })),
      boards: boardsRef.current.map((board) => ({ ...board })),
    }),
    [],
  );

  const restore = useCallback((workspace: Workspace) => {
    // Do not retain references supplied by an undo/version/import caller. A
    // later edit must not mutate the saved workspace behind that caller's back.
    const nextTasks = workspace.tasks.map(cloneTask);
    const nextSections = workspace.sections.map((section) => ({ ...section }));
    const nextBoards = workspace.boards.map((board) => ({ ...board }));
    tasksRef.current = nextTasks;
    sectionsRef.current = nextSections;
    boardsRef.current = nextBoards;
    setTasks(nextTasks);
    setSections(nextSections);
    setBoards(nextBoards);
  }, []);

  const loadSample = useCallback(() => {
    const samples = createSampleTasks();
    const sampleBoards = SAMPLE_BOARDS.map((board) => ({ ...board }));
    boardsRef.current = sampleBoards;
    setBoards(sampleBoards);
    if (sectionsRef.current.length === 0) {
      const sampleSections = SAMPLE_SECTIONS.map((section) => ({ ...section }));
      const sampleTasks = distributeSampleTasks(samples);
      sectionsRef.current = sampleSections;
      tasksRef.current = sampleTasks;
      setSections(sampleSections);
      setTasks(sampleTasks);
    } else {
      tasksRef.current = samples;
      setTasks(samples);
    }
  }, []);

  const createVersion = useCallback(() => {
    const version: WorkspaceVersion = {
      id: `${Date.now()}-${makeId(6)}`,
      label: `Version ${versionsRef.current.length + 1}`,
      createdAt: new Date().toISOString(),
      taskCount: tasksRef.current.length,
      workspace: snapshot(),
    };
    setVersions((prev) => [version, ...prev]);
  }, [snapshot]);

  const restoreVersion = useCallback(
    (id: string) => {
      const version = versionsRef.current.find((item) => item.id === id);
      if (version) restore(version.workspace);
    },
    [restore],
  );

  const deleteVersion = useCallback((id: string) => {
    setVersions((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // ---- Boards as project tenants -------------------------------------------

  /**
   * Applies a new registry snapshot. With `activate`, the registry's current
   * project also replaces the live workspace state (switch/create/duplicate);
   * without it only metadata changes (rename) keep the current workspace.
   */
  const applyRegistry = useCallback((next: ProjectsState, activate: boolean) => {
    projectsRef.current = next;
    setProjectsState((current) => (current === next ? current : next));
    saveQueueRef.current = saveQueueRef.current.then(() => saveProjects(next));
    if (!activate) return;
    const active = activeProject(next);
    activeIdRef.current = active.id;
    tasksRef.current = active.workspace.tasks;
    sectionsRef.current = active.workspace.sections;
    boardsRef.current = active.workspace.boards;
    setTasks(active.workspace.tasks);
    setSections(active.workspace.sections);
    setBoards(active.workspace.boards);
  }, []);

  const switchProject = useCallback(
    (id: string) => {
      const registry = registryWithLiveWorkspace();
      if (!registry || registry.currentId === id || activeIdRef.current === id) return;
      if (!registry.projects.some((project) => project.id === id)) return;
      applyRegistry({ ...registry, currentId: id }, true);
    },
    [applyRegistry, registryWithLiveWorkspace],
  );

  const createProject = useCallback(
    (name?: string) => {
      const registry = registryWithLiveWorkspace();
      if (!registry) return "";
      const project = newProject(name);
      applyRegistry(
        { ...registry, currentId: project.id, projects: [...registry.projects, project] },
        true,
      );
      return project.id;
    },
    [applyRegistry, registryWithLiveWorkspace],
  );

  const importProject = useCallback(
    (name: string, workspace: Workspace) => {
      const registry = registryWithLiveWorkspace();
      if (!registry) return "";
      const project = projectFromWorkspace(name, workspace);
      applyRegistry(
        { ...registry, currentId: project.id, projects: [...registry.projects, project] },
        true,
      );
      return project.id;
    },
    [applyRegistry, registryWithLiveWorkspace],
  );

  const importProjects = useCallback(
    (entries: ProjectImport[]) => {
      const registry = registryWithLiveWorkspace();
      if (!registry || entries.length === 0) return [];
      const imported = entries.map((entry) => {
        const project = projectFromWorkspace(entry.name, entry.workspace);
        return entry.closedAt ? { ...project, closedAt: entry.closedAt } : project;
      });
      const firstOpen = imported.find((project) => !project.closedAt);
      applyRegistry(
        {
          ...registry,
          currentId: firstOpen?.id ?? registry.currentId,
          projects: [...registry.projects, ...imported],
        },
        Boolean(firstOpen),
      );
      return imported.map((project) => project.id);
    },
    [applyRegistry, registryWithLiveWorkspace],
  );

  const duplicateProject = useCallback(
    (id: string) => {
      const registry = registryWithLiveWorkspace();
      if (!registry) return null;
      const source = registry.projects.find((project) => project.id === id);
      if (!source) return null;
      const copy = cloneProject(source);
      applyRegistry(
        { ...registry, currentId: copy.id, projects: [...registry.projects, copy] },
        true,
      );
      return copy.id;
    },
    [applyRegistry, registryWithLiveWorkspace],
  );

  const renameProject = useCallback(
    (id: string, name: string) => {
      const registry = registryWithLiveWorkspace();
      const trimmed = name.trim();
      if (!registry || !trimmed) return;
      applyRegistry(
        {
          ...registry,
          projects: registry.projects.map((project) =>
            project.id === id
              ? { ...project, name: trimmed, updatedAt: new Date().toISOString() }
              : project,
          ),
        },
        false,
      );
    },
    [applyRegistry, registryWithLiveWorkspace],
  );

  /** Marks a board closed; the current board falls back to the next open one. */
  const closeProject = useCallback(
    (id: string) => {
      const registry = registryWithLiveWorkspace();
      if (!registry) return false;
      const target = registry.projects.find((project) => project.id === id);
      if (!target || target.closedAt) return false;
      const timestamp = new Date().toISOString();
      const projects = registry.projects.map((project) =>
        project.id === id
          ? { ...project, closedAt: timestamp, updatedAt: timestamp }
          : project,
      );
      const wasCurrent = registry.currentId === id;
      const fallback = projects.find((project) => !project.closedAt);
      applyRegistry(
        {
          ...registry,
          projects,
          currentId: wasCurrent && fallback ? fallback.id : registry.currentId,
        },
        wasCurrent && fallback !== undefined,
      );
      return true;
    },
    [applyRegistry, registryWithLiveWorkspace],
  );

  /** Clears the closed flag and activates the board. */
  const reopenProject = useCallback(
    (id: string) => {
      const registry = registryWithLiveWorkspace();
      if (!registry) return false;
      const target = registry.projects.find((project) => project.id === id);
      if (!target || !target.closedAt) return false;
      const timestamp = new Date().toISOString();
      applyRegistry(
        {
          ...registry,
          currentId: id,
          projects: registry.projects.map((project) =>
            project.id === id
              ? { ...project, closedAt: undefined, updatedAt: timestamp }
              : project,
          ),
        },
        true,
      );
      return true;
    },
    [applyRegistry, registryWithLiveWorkspace],
  );

  /** Removes a board and its data; refuses to remove the last remaining board. */
  const removeProject = useCallback(
    (id: string) => {
      const registry = registryWithLiveWorkspace();
      if (!registry || registry.projects.length <= 1) return false;
      if (!registry.projects.some((project) => project.id === id)) return false;
      const projects = registry.projects.filter((project) => project.id !== id);
      const wasCurrent = registry.currentId === id;
      applyRegistry(
        {
          ...registry,
          projects,
          currentId: wasCurrent ? (projects[0]?.id ?? "") : registry.currentId,
        },
        wasCurrent,
      );
      return true;
    },
    [applyRegistry, registryWithLiveWorkspace],
  );

  return useMemo(
    () => ({
      tasks,
      sections,
      boards,
      isLoading,
      isEmpty: tasks.length === 0,
      addTask,
      updateTask,
      patchTask,
      appendTaskActivity,
      addAttachment,
      removeAttachment,
      deleteTask,
      toggleComplete,
      toggleCancel,
      toggleSubtask,
      addSubtask,
      removeSubtask,
      setTaskStatus,
      setTaskDueAt,
      setTaskSectionId,
      assignTaskToSection,
      addSection,
      renameSection,
      deleteSection,
      toggleSectionHidden,
      reorderSections,
      reorderTasks,
      createBoard,
      renameBoard,
      recolorBoard,
      deleteBoard,
      restoreBuiltInBoards,
      deletedCategories,
      deleteCategory,
      restoreCategory,
      restoreCategories,
      clearCompleted,
      getCompletedIds,
      snapshot,
      restore,
      canRevertTask,
      revertTask,
      clearTaskHistory,
      loadSample,
      versions,
      createVersion,
      restoreVersion,
      deleteVersion,
      projects: projectsState?.projects ?? [],
      currentProjectId: projectsState?.currentId ?? "",
      currentProjectName: projectsState ? activeProject(projectsState).name : "",
      createProject,
      importProject,
      importProjects,
      duplicateProject,
      renameProject,
      switchProject,
      closeProject,
      reopenProject,
      removeProject,
    }),
    [
      tasks,
      sections,
      boards,
      isLoading,
      addTask,
      updateTask,
      patchTask,
      appendTaskActivity,
      addAttachment,
      removeAttachment,
      deleteTask,
      toggleComplete,
      toggleCancel,
      toggleSubtask,
      addSubtask,
      removeSubtask,
      setTaskStatus,
      setTaskDueAt,
      setTaskSectionId,
      assignTaskToSection,
      addSection,
      renameSection,
      deleteSection,
      toggleSectionHidden,
      reorderSections,
      reorderTasks,
      createBoard,
      renameBoard,
      recolorBoard,
      deleteBoard,
      restoreBuiltInBoards,
      deletedCategories,
      deleteCategory,
      restoreCategory,
      restoreCategories,
      clearCompleted,
      getCompletedIds,
      snapshot,
      restore,
      canRevertTask,
      revertTask,
      clearTaskHistory,
      loadSample,
      versions,
      createVersion,
      restoreVersion,
      deleteVersion,
      projectsState,
      createProject,
      importProject,
      importProjects,
      duplicateProject,
      renameProject,
      switchProject,
      closeProject,
      reopenProject,
      removeProject,
    ],
  );
}
