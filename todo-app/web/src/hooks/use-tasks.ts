"use client";

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
import { isCustomSection, isStatusSection } from "@/lib/domain/sections";
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
} from "@/lib/domain/projects";
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
  /** Set status directly (used by board drag-and-drop). */
  setTaskStatus: (id: string, status: "completed" | "canceled" | "open") => void;
  /** Move a task to a due date (used by calendar drag-and-drop), or clear it. */
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
  /** @deprecated Board API wrapper — use the board actions above. */
  deletedCategories: string[];
  /** @deprecated Board API wrapper — use the board actions above. */
  deleteCategory: (id: string) => { label: string; affected: number } | null;
  /** @deprecated Board API wrapper — use the board actions above. */
  restoreCategory: (id: string) => void;
  /** @deprecated Board API wrapper — use the board actions above. */
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
  // Boards as project tenants: each board owns a full workspace.
  /** All boards (projects) in registry order. */
  projects: JanusProject[];
  /** Id of the currently loaded board. */
  currentProjectId: string;
  /** Name of the currently loaded board. */
  currentProjectName: string;
  /** Creates a new empty board and switches to it. Returns the new id. */
  createProject: (name?: string) => string;
  /** Creates a board from an imported workspace and switches to it. Returns the new id, or "" when unavailable. */
  importProject: (name: string, workspace: Workspace) => string;
  /** Duplicates a board (tasks/sections/categories included) and switches to it. */
  duplicateProject: (id: string) => string | null;
  renameProject: (id: string, name: string) => void;
  switchProject: (id: string) => void;
  /** Removes a board with its data. False when it is the last remaining board. */
  removeProject: (id: string) => boolean;
}

export function useTasks(): TasksApi {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sections, setSections] = useState<BoardSection[]>([]);
  const [boards, setBoards] = useState<Board[]>(defaultBoards);
  const [projectsState, setProjectsState] = useState<ProjectsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const tasksRef = useRef<Task[]>([]);
  const sectionsRef = useRef<BoardSection[]>([]);
  const boardsRef = useRef<Board[]>(defaultBoards());
  const projectsRef = useRef<ProjectsState | null>(null);
  const activeIdRef = useRef<string | null>(null);

  // Keep refs of the latest state for synchronous reads inside handlers.
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);

  // Hydrate from the project registry after mount. This is a deliberate
  // external-store read that must not run during SSR, so the server and first
  // client render agree and there is no hydration mismatch. The registry
  // holds every board; its current project's workspace becomes live state.
  useEffect(() => {
    const registry = loadProjects();
    const active = activeProject(registry);
    projectsRef.current = registry;
    activeIdRef.current = active.id;
    /* eslint-disable react-hooks/set-state-in-effect */
    setProjectsState(registry);
    setTasks(active.workspace.tasks);
    setSections(active.workspace.sections);
    setBoards(active.workspace.boards);
    setIsLoading(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist after every change, once hydrated: writes the current workspace
  // into the ACTIVE project slot. Switch handlers below update ids and
  // workspace state in one batched commit, so this effect can never write
  // one project's data into another's slot.
  useEffect(() => {
    if (isLoading) return;
    const registry = projectsRef.current;
    const activeId = activeIdRef.current;
    if (!registry || !activeId) return;
    const next = withWorkspace(registry, activeId, { tasks, sections, boards });
    if (next === registry) return;
    projectsRef.current = next;
    setProjectsState(next);
    saveProjects(next);
  }, [tasks, sections, boards, isLoading]);

  const updateById = useCallback(
    (id: string, updater: (task: Task) => Task) => {
      setTasks((prev) => prev.map((task) => (task.id === id ? updater(task) : task)));
    },
    [],
  );

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
      setTasks((prev) => prev.map((task) => (task.id === id ? previous : task)));
    },
    [taskHistory],
  );

  const clearTaskHistory = useCallback(() => setTaskHistory({}), []);

  const addTask = useCallback((draft: TaskDraft): Task => {
    const task = createTask(draft);
    setTasks((prev) => [...prev, task]);
    return task;
  }, []);

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

  const deleteTask = useCallback((id: string) => {
    recordTask(id);
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, [recordTask]);

  const toggleComplete = useCallback(
    (id: string) => {
      recordTask(id);
      updateById(id, (task) => {
        const completed = !task.completed;
        return {
          ...task,
          completed,
          canceled: completed ? false : task.canceled,
          completedAt: completed ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [recordTask, updateById],
  );

  const toggleCancel = useCallback(
    (id: string) => {
      recordTask(id);
      updateById(id, (task) => {
        const canceled = !task.canceled;
        return {
          ...task,
          canceled,
          completed: canceled ? false : task.completed,
          completedAt: canceled ? null : task.completedAt,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [recordTask, updateById],
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
      recordTask(id);
      updateById(id, (task) => {
        const stamp = new Date().toISOString();
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
            sectionId: null,
            updatedAt: stamp,
          };
        }
        return { ...task, completed: false, canceled: false, completedAt: null, updatedAt: stamp };
      });
    },
    [updateById, recordTask],
  );

  const setTaskDueAt = useCallback(
    (id: string, dueAt: string | null) => {
      recordTask(id);
      updateById(id, (task) => ({ ...task, dueAt, updatedAt: new Date().toISOString() }));
    },
    [recordTask, updateById],
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
    setSections((prev) => [...prev, section]);
    return section;
  }, []);

  const renameSection = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSections((prev) =>
      prev.map((section) => (section.id === id ? { ...section, title: trimmed } : section)),
    );
  }, []);

  const deleteSection = useCallback((id: string) => {
    setSections((prev) => {
      const target = prev.find((section) => section.id === id);
      if (!target || !isCustomSection(target)) return prev;
      return prev.filter((section) => section.id !== id);
    });
    // Tasks that lived in this section return to their status column.
    setTasks((prev) =>
      prev.map((task) => (task.sectionId === id ? { ...task, sectionId: null } : task)),
    );
  }, []);

  const toggleSectionHidden = useCallback((id: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, hidden: !section.hidden } : section,
      ),
    );
  }, []);

  const reorderSections = useCallback((orderedIds: string[]) => {
    setSections((prev) => {
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
  }, []);

  /** Reorders a (possibly filtered) subset within the slots those tasks already occupy. */
  const reorderTasks = useCallback((orderedIds: string[]) => {
    setTasks((prev) => {
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
  }, []);

  const clearCompleted = useCallback((): number => {
    const completedIds = new Set(
      tasksRef.current.filter((task) => task.completed).map((task) => task.id),
    );
    if (completedIds.size === 0) return 0;
    setTasks((prev) => prev.filter((task) => !completedIds.has(task.id)));
    return completedIds.size;
  }, []);

  const getCompletedIds = useCallback(
    () => tasksRef.current.filter((task) => task.completed).map((task) => task.id),
    [],
  );

  const createBoard = useCallback((input: { label: string; color: BoardColorId }): Board => {
    const label = input.label.trim() || "New board";
    const board: Board = { id: `board-${makeId(8)}`, label, color: input.color };
    setBoards((prev) => [...prev, board]);
    return board;
  }, []);

  const renameBoard = useCallback((id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setBoards((prev) =>
      prev.map((board) => (board.id === id ? { ...board, label: trimmed } : board)),
    );
  }, []);

  const recolorBoard = useCallback((id: string, color: BoardColorId) => {
    setBoards((prev) => prev.map((board) => (board.id === id ? { ...board, color } : board)));
  }, []);

  /** Removes a board and strips the tag from every task that carried it. */
  const deleteBoard = useCallback((id: string): { label: string; affected: number } | null => {
    const board = boardsRef.current.find((item) => item.id === id);
    if (!board) return null;

    const stamp = new Date().toISOString();
    const affected = tasksRef.current.filter((task) => task.category === id).length;
    setTasks((prev) =>
      prev.map((task) =>
        task.category === id ? { ...task, category: null, updatedAt: stamp } : task,
      ),
    );
    setBoards((prev) => prev.filter((item) => item.id !== id));
    return { label: board.label, affected };
  }, []);

  const restoreBuiltInBoards = useCallback(() => {
    setBoards((prev) => {
      const missing = missingBuiltInBoards(prev);
      return missing.length > 0 ? [...prev, ...missing] : prev;
    });
  }, []);

  const restoreBoard = useCallback((id: string) => {
    const builtIn = BUILT_IN_BOARDS.find((board) => board.id === id);
    if (!builtIn) return;
    setBoards((prev) => (prev.some((board) => board.id === id) ? prev : [...prev, { ...builtIn }]));
  }, []);

  // Deprecated wrappers around the board API, kept so the category-named
  // consumers keep working until they migrate.
  const deletedCategories = useMemo(
    () => missingBuiltInBoards(boards).map((board) => board.id),
    [boards],
  );
  const deleteCategory = useCallback((id: string) => deleteBoard(id), [deleteBoard]);
  const restoreCategory = useCallback((id: string) => restoreBoard(id), [restoreBoard]);
  const restoreCategories = useCallback(() => restoreBuiltInBoards(), [restoreBuiltInBoards]);

  const snapshot = useCallback(
    (): Workspace => ({
      tasks: tasksRef.current.map(cloneTask),
      sections: sectionsRef.current.map((section) => ({ ...section })),
      boards: boardsRef.current.map((board) => ({ ...board })),
    }),
    [],
  );

  const restore = useCallback((workspace: Workspace) => {
    setTasks(workspace.tasks.map(cloneTask));
    setSections(workspace.sections.map((section) => ({ ...section })));
    setBoards(workspace.boards.map((board) => ({ ...board })));
  }, []);

  const loadSample = useCallback(() => {
    const samples = createSampleTasks();
    // Install the sample boards too (built-ins + custom demo categories), so
    // custom categories are visible on the loaded example tasks.
    setBoards(SAMPLE_BOARDS.map((board) => ({ ...board })));
    if (sectionsRef.current.length === 0) {
      // A from-scratch board has no columns, so the demo would render an empty
      // board: give it the sample columns and sort the tasks into them. Boards
      // that already have their own sections keep them — the tasks then fall
      // into whichever column their status implies.
      setSections(SAMPLE_SECTIONS.map((section) => ({ ...section })));
      setTasks(distributeSampleTasks(samples));
    } else {
      setTasks(samples);
    }
  }, []);

  // ---- Boards as project tenants -------------------------------------------

  /**
   * Applies a new registry snapshot. With `activate`, the registry's current
   * project also replaces the live workspace state (switch/create/duplicate);
   * without it only metadata changes (rename) keep the current workspace.
   */
  const applyRegistry = useCallback((next: ProjectsState, activate: boolean) => {
    projectsRef.current = next;
    setProjectsState(next);
    saveProjects(next);
    if (!activate) return;
    const active = activeProject(next);
    activeIdRef.current = active.id;
    setTasks(active.workspace.tasks);
    setSections(active.workspace.sections);
    setBoards(active.workspace.boards);
  }, []);

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

  const switchProject = useCallback(
    (id: string) => {
      const registry = registryWithLiveWorkspace();
      if (!registry || registry.currentId === id || activeIdRef.current === id) return;
      if (!registry.projects.some((project) => project.id === id)) return;
      applyRegistry({ ...registry, currentId: id }, true);
    },
    [applyRegistry, registryWithLiveWorkspace]
  );

  const createProject = useCallback(
    (name?: string) => {
      const registry = registryWithLiveWorkspace();
      if (!registry) return "";
      const project = newProject(name);
      applyRegistry(
        { ...registry, currentId: project.id, projects: [...registry.projects, project] },
        true
      );
      return project.id;
    },
    [applyRegistry, registryWithLiveWorkspace]
  );

  const importProject = useCallback(
    (name: string, workspace: Workspace) => {
      const registry = registryWithLiveWorkspace();
      if (!registry) return "";
      const project = projectFromWorkspace(name, workspace);
      applyRegistry(
        { ...registry, currentId: project.id, projects: [...registry.projects, project] },
        true
      );
      return project.id;
    },
    [applyRegistry, registryWithLiveWorkspace]
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
        true
      );
      return copy.id;
    },
    [applyRegistry, registryWithLiveWorkspace]
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
              : project
          ),
        },
        false
      );
    },
    [applyRegistry, registryWithLiveWorkspace]
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
        wasCurrent
      );
      return true;
    },
    [applyRegistry, registryWithLiveWorkspace]
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
      projects: projectsState?.projects ?? [],
      currentProjectId: projectsState?.currentId ?? "",
      currentProjectName: projectsState ? activeProject(projectsState).name : "",
      createProject,
      importProject,
      duplicateProject,
      renameProject,
      switchProject,
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
      loadSample,
      projectsState,
      createProject,
      importProject,
      duplicateProject,
      renameProject,
      switchProject,
      removeProject,
    ],
  );
}
