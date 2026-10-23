import { useTasks, type TasksApi } from "@/hooks/use-tasks";
import { createContext, useContext, type ReactNode } from "react";

const TasksContext = createContext<TasksApi | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const tasks = useTasks();
  return <TasksContext.Provider value={tasks}>{children}</TasksContext.Provider>;
}

export function useTasksContext(): TasksApi {
  const context = useContext(TasksContext);
  if (!context) throw new Error("useTasksContext must be used inside TasksProvider");
  return context;
}
