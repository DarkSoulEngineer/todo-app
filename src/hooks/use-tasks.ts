"use client";

import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCategory } from "@/lib/categories";
import { overdueAt, rescheduleToNextDay } from "@/lib/datetime";
import { createSampleTasks } from "@/lib/sample";
import { isCustomSection, isStatusSection } from "@/lib/sections";
import { loadWorkspace, saveWorkspace } from "@/lib/storage";
import { applyDraft, createTask } from "@/lib/task-factory";
import type { BoardSection, Task, TaskDraft, Workspace } from "@/lib/types";

export interface TasksApi {
  tasks: Task[];
  sections: BoardSection[];
  /** Ids of built-in categories the user deleted. */
  deletedCategories: string[];
  isLoading: boolean;
  isEmpty: boolean;
  addTask: (draft: TaskDraft) => Task;
  updateTask: (id: string, draft: TaskDraft) => void;
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
   * Deletes a built-in category: it stops being offered anywhere and every task
   * tagged with it loses the tag. Null when the id is not a known category.
   */
  deleteCategory: (id: string) => { label: string; affected: number } | null;
  /** Puts a deleted category back on offer (its tasks stay untagged). */
  restoreCategory: (id: string) => void;
  /** Puts every deleted category back on offer. */
  restoreCategories: () => void;
  clearCompleted: () => number;
  getCompletedIds: () => string[];
  /** Immutable copy of the workspace, for reversible bulk actions. */
  snapshot: () => Workspace;
  restore: (workspace: Workspace) => void;
  loadSample: () => void;
}

export function useTasks(): TasksApi {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sections, setSections] = useState<BoardSection[]>([]);
  const [deletedCategories, setDeletedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tasksRef = useRef<Task[]>([]);
  const sectionsRef = useRef<BoardSection[]>([]);
  const deletedCategoriesRef = useRef<string[]>([]);

  // Keep refs of the latest state for synchronous reads inside handlers.
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    deletedCategoriesRef.current = deletedCategories;
  }, [deletedCategories]);

  // Hydrate from localStorage after mount. This is a deliberate external-store
  // read that must not run during SSR, so the server and first client render
  // agree and there is no hydration mismatch.
  useEffect(() => {
    const { workspace } = loadWorkspace();
    /* eslint-disable react-hooks/set-state-in-effect */
    setTasks(workspace.tasks);
    setSections(workspace.sections);
    setDeletedCategories(workspace.deletedCategories);
    setIsLoading(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist after every change, once hydrated.
  useEffect(() => {
    if (isLoading) return;
    saveWorkspace({ tasks, sections, deletedCategories });
  }, [tasks, sections, deletedCategories, isLoading]);

  const updateById = useCallback(
    (id: string, updater: (task: Task) => Task) => {
      setTasks((prev) => prev.map((task) => (task.id === id ? updater(task) : task)));
    },
    [],
  );

  const addTask = useCallback((draft: TaskDraft): Task => {
    const task = createTask(draft);
    setTasks((prev) => [...prev, task]);
    return task;
  }, []);

  const updateTask = useCallback(
    (id: string, draft: TaskDraft) => {
      updateById(id, (task) => applyDraft(task, draft));
    },
    [updateById],
  );

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const toggleComplete = useCallback(
    (id: string) => {
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
    [updateById],
  );

  const toggleCancel = useCallback(
    (id: string) => {
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
    [updateById],
  );

  const toggleSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      updateById(taskId, (task) => ({
        ...task,
        subtasks: task.subtasks.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateById],
  );

  const addSubtask = useCallback(
    (taskId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      updateById(taskId, (task) => ({
        ...task,
        subtasks: [...task.subtasks, { id: nanoid(8), title: trimmed, done: false }],
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateById],
  );

  const removeSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      updateById(taskId, (task) => ({
        ...task,
        subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateById],
  );

  const setTaskStatus = useCallback(
    (id: string, status: "completed" | "canceled" | "open") => {
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
    [updateById],
  );

  const setTaskDueAt = useCallback(
    (id: string, dueAt: string | null) => {
      updateById(id, (task) => ({ ...task, dueAt, updatedAt: new Date().toISOString() }));
    },
    [updateById],
  );

  const setTaskSectionId = useCallback(
    (id: string, sectionId: string | null) => {
      updateById(id, (task) => ({
        ...task,
        sectionId,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateById],
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
    [updateById],
  );

  const addSection = useCallback((title: string): BoardSection => {
    const section: BoardSection = {
      id: `custom-${nanoid(8)}`,
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

  const deleteCategory = useCallback(
    (id: string): { label: string; affected: number } | null => {
      const category = getCategory(id);
      if (!category) return null;

      const affected = tasksRef.current.filter((task) => task.category === id).length;
      const stamp = new Date().toISOString();
      setTasks((prev) =>
        prev.map((task) =>
          task.category === id ? { ...task, category: null, updatedAt: stamp } : task,
        ),
      );
      // Records the deletion, de-duplicated: deleting twice keeps one entry.
      setDeletedCategories((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return { label: category.label, affected };
    },
    [],
  );

  const restoreCategory = useCallback((id: string) => {
    setDeletedCategories((prev) => prev.filter((item) => item !== id));
  }, []);

  const restoreCategories = useCallback(() => {
    setDeletedCategories([]);
  }, []);

  const snapshot = useCallback(
    (): Workspace => ({
      tasks: tasksRef.current.map((task) => ({ ...task })),
      sections: sectionsRef.current.map((section) => ({ ...section })),
      deletedCategories: [...deletedCategoriesRef.current],
    }),
    [],
  );

  const restore = useCallback((workspace: Workspace) => {
    setTasks(workspace.tasks);
    setSections(workspace.sections);
    setDeletedCategories(workspace.deletedCategories);
  }, []);

  const loadSample = useCallback(() => {
    setTasks(createSampleTasks());
  }, []);

  return useMemo(
    () => ({
      tasks,
      sections,
      deletedCategories,
      isLoading,
      isEmpty: tasks.length === 0,
      addTask,
      updateTask,
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
      deleteCategory,
      restoreCategory,
      restoreCategories,
      clearCompleted,
      getCompletedIds,
      snapshot,
      restore,
      loadSample,
    }),
    [
      tasks,
      sections,
      deletedCategories,
      isLoading,
      addTask,
      updateTask,
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
      deleteCategory,
      restoreCategory,
      restoreCategories,
      clearCompleted,
      getCompletedIds,
      snapshot,
      restore,
      loadSample,
    ],
  );
}
