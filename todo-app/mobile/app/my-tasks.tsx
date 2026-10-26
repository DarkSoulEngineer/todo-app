import { router } from "expo-router";
import { useMemo } from "react";
import { ReferenceMyTasksScreen, type ReferenceMobileTab, type ReferenceTaskDisplay } from "@/components/reference/mobile";
import { useAllBoardTasks } from "@/hooks/use-all-board-tasks";

export default function MyTasksRoute() {
  const { api, entries } = useAllBoardTasks();
  const tasks = useMemo<ReferenceTaskDisplay[]>(
    () =>
      entries.map(({ task, projectId, projectName, boards }) => ({
        task,
        projectId,
        projectLabel: projectName,
        boardLabel: boards.find((board) => board.id === task.category)?.label,
      })),
    [entries],
  );

  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "my-tasks") return;
    if (tab === "boards") return router.replace("/");
    if (tab === "calendar") return router.replace("/calendar");
    if (tab === "settings") return router.replace("/settings");
  };

  return (
    <ReferenceMyTasksScreen
      tasks={tasks}
      boardName={api.currentProjectName}
      onTaskPress={(_, projectId) => {
        const boardId = projectId ?? api.currentProjectId;
        if (boardId) router.push(`/board/${boardId}`);
      }}
      onToggleComplete={(task) => api.toggleComplete(task.id)}
      onReviewAttention={() => router.replace(api.currentProjectId ? `/board/${api.currentProjectId}` : "/")}
      onRescheduleAttention={() => router.replace("/calendar")}
      onNavigate={navigate}
      activeTab="my-tasks"
    />
  );
}
