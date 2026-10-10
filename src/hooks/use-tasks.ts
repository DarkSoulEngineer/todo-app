"use client";

import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSampleTasks } from "@/lib/sample";
import { loadTasks, saveTasks } from "@/lib/storage";
import { applyDraft, createTask } from "@/lib/task-factory";
import type { Task, TaskDraft } from "@/lib/types";

export interface TasksApi {
  tasks: Task[];
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
  reorderTasks: (orderedIds: string[]) => void;
  clearCompleted: () => number;
  getCompletedIds: () => string[];
  /** Immutable copy of the current list, for reversible bulk actions. */
  snapshot: () => Task[];
  restore: (tasks: Task[]) => void;
  loadSample: () => void;
}

export function useTasks(): TasksApi {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tasksRef = useRef<Task[]>([]);

  // Keep a ref of the latest list for synchronous reads inside handlers.
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Hydrate from localStorage after mount. This is a deliberate external-store
  // read that must not run during SSR, so the server and first client render
  // agree and there is no hydration mismatch.
  useEffect(() => {
    const { tasks: stored } = loadTasks();
    /* eslint-disable react-hooks/set-state-in-effect */
    setTasks(stored);
    setIsLoading(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist after every change, but never before the initial load has settled.
  useEffect(() => {
    if (isLoading) return;
    saveTasks(tasks);
  }, [tasks, isLoading]);

  const updateById = useCallback((id: string, updater: (task: Task) => Task) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? updater(task) : task)));
  }, []);

  const addTask = useCallback((draft: TaskDraft): Task => {
    const task = createTask(draft);
    setTasks((prev) => [task, ...prev]);
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
          return { ...task, completed: true, canceled: false, completedAt: stamp, updatedAt: stamp };
        }
        if (status === "canceled") {
          return { ...task, completed: false, canceled: true, completedAt: null, updatedAt: stamp };
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

  /** Reorders a (possibly filtered) subset within the slots those tasks already occupy. */
  const reorderTasks = useCallback((orderedIds: string[]) => {
    setTasks((prev) => {
      const byId = new Map(prev.map((task) => [task.id, task]));
      const moving = new Set(orderedIds.filter((id) => byId.has(id)));
      if (moving.size === 0) return prev;

      const slots: number[] = [];
      prev.forEach((task, index) => {
        if (moving.has(task.id)) slots.push(index);
      });

      const next = [...prev];
      orderedIds.forEach((id, index) => {
        const task = byId.get(id);
        const slot = slots[index];
        if (task && slot !== undefined) next[slot] = task;
      });

      return next;
    });
  }, []);

  const getCompletedIds = useCallback(
    () => tasksRef.current.filter((task) => task.completed).map((task) => task.id),
    [],
  );

  const clearCompleted = useCallback((): number => {
    const completedIds = new Set(
      tasksRef.current.filter((task) => task.completed).map((task) => task.id),
    );
    if (completedIds.size === 0) return 0;
    setTasks((prev) => prev.filter((task) => !completedIds.has(task.id)));
    return completedIds.size;
  }, []);

  const snapshot = useCallback((): Task[] => tasksRef.current.map((task) => ({ ...task })), []);

  const restore = useCallback((next: Task[]) => {
    setTasks(next);
  }, []);

  const loadSample = useCallback(() => {
    setTasks(createSampleTasks());
  }, []);

  return useMemo(
    () => ({
      tasks,
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
      reorderTasks,
      clearCompleted,
      getCompletedIds,
      snapshot,
      restore,
      loadSample,
    }),
    [
      tasks,
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
      reorderTasks,
      clearCompleted,
      getCompletedIds,
      snapshot,
      restore,
      loadSample,
    ],
  );
}
