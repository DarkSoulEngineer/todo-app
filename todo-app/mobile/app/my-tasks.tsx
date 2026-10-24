import { router } from "expo-router";
import { ReferenceMyTasksScreen, type ReferenceMobileTab } from "@/components/reference/mobile";
import { useTasksContext } from "@/providers/tasks-provider";

export default function MyTasksRoute() {
  const api = useTasksContext();

  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "my-tasks") return;
    if (tab === "boards") return router.replace("/");
    if (tab === "calendar") return router.replace("/calendar");
    if (tab === "settings") return router.replace("/settings");
  };

  return (
    <ReferenceMyTasksScreen
      tasks={api.tasks}
      boardName={api.currentProjectName}
      onTaskPress={(task) => router.push({ pathname: "/task/[id]", params: { id: task.id, origin: "my-tasks" } })}
      onToggleComplete={(task) => api.toggleComplete(task.id)}
      onCreateTask={() => router.push({ pathname: "/task/new", params: { origin: "my-tasks" } })}
       onReviewAttention={() => router.replace(api.currentProjectId ? `/board/${api.currentProjectId}` : "/")}
      onRescheduleAttention={() => router.replace("/calendar")}
      onNavigate={navigate}
      activeTab="my-tasks"
    />
  );
}
