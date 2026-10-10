import { TasksProvider } from "@/components/tasks-provider";
import { TodoApp } from "@/components/todo-app";

export default function Home() {
  return (
    <TasksProvider>
      <TodoApp />
    </TasksProvider>
  );
}
