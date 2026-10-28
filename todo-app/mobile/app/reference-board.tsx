import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { OptionSheet, TextEntrySheet } from "@/components/janus-board-ui";
import { anchorFromEvent, type MenuAnchor } from "@/components/ui/anchored-menu";
import { ReferenceJanusScreen, type ReferenceMobileTab } from "@/components/reference/mobile";
import { useTasksContext } from "@/providers/tasks-provider";
import { useToast } from "@/providers/toast-provider";
import { getTaskSectionId } from "@/lib/domain/sections";
import type { Task } from "@/lib/domain/types";

export default function ReferenceBoardRoute() {
  const api = useTasksContext();
  const toast = useToast();
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [boardActionsOpen, setBoardActionsOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [renameBoardOpen, setRenameBoardOpen] = useState(false);
  const [taskAction, setTaskAction] = useState<Task | null>(null);

  const activeProject = api.projects.find((project) => project.id === api.currentProjectId);
  const taskSectionId = taskAction ? getTaskSectionId(taskAction, api.sections, new Date()) : undefined;
  const moveOptions = taskAction ? api.sections
    .filter((section) => section.id !== taskSectionId)
    .map((section) => ({ label: `Move to ${section.title}`, icon: "arrow-forward-outline" as const, onPress: () => api.assignTaskToSection(taskAction.id, section.id) })) : [];
  const taskOptions = taskAction ? [
    { label: taskAction.completed ? "Mark incomplete" : "Complete task", icon: "checkmark-circle-outline" as const, onPress: () => api.toggleComplete(taskAction.id) },
    { label: taskAction.canceled ? "Restore task" : "Cancel task", icon: "close-circle-outline" as const, onPress: () => api.toggleCancel(taskAction.id) },
    ...moveOptions,
    { label: "Delete task", icon: "trash-outline" as const, destructive: true, onPress: () => { const before = api.snapshot(); api.deleteTask(taskAction.id); toast.success("Task deleted", { action: { label: "Undo", onPress: () => api.restore(before) } }); } },
  ] : [];

  const deleteBoard = () => {
    const name = api.currentProjectName || "this board";
    Alert.alert("Delete board?", `“${name}” and its tasks will be removed.`, [
      { text: "Keep it", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        if (api.removeProject(api.currentProjectId)) toast.success("Board deleted");
        else toast.error("Keep at least one board");
      } },
    ]);
  };

  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "boards") return router.replace("/");
    if (tab === "top-tasks") return router.replace("/top-tasks");
    if (tab === "settings") return router.replace("/settings");
  };

  return (
    <>
      <ReferenceJanusScreen
        tasks={api.tasks}
        sections={api.sections}
        title="Board"
        subtitle="Workspace"
        onTaskPress={(task) => router.push({ pathname: "/task/[id]", params: { id: task.id, origin: "reference-board" } })}
        onToggleComplete={(task) => api.toggleComplete(task.id)}
        onTaskMenu={(task) => setTaskAction(task)}
        onAddTask={(sectionId) => {
          if (sectionId) router.push({ pathname: "/task/new", params: { sectionId, origin: "reference-board" } });
          else router.push({ pathname: "/task/new", params: { origin: "reference-board" } });
        }}
        onMenu={(event) => { if (event) setMenuAnchor(anchorFromEvent(event)); setBoardActionsOpen(true); }}
        onNavigate={navigate}
        activeTab="boards"
      />
      <OptionSheet
        visible={projectSwitcherOpen}
        title="Switch board"
        options={api.projects.filter((project) => !project.closedAt).map((project) => ({
          label: project.name,
          icon: project.id === api.currentProjectId ? "checkmark-circle" : "layers-outline",
          onPress: () => api.switchProject(project.id),
        }))}
        onClose={() => setProjectSwitcherOpen(false)}
        anchor={menuAnchor}
      />
      <OptionSheet
        visible={boardActionsOpen}
        title={activeProject?.name ?? "Board actions"}
        options={[
          { label: "Switch board", icon: "layers-outline", onPress: () => setProjectSwitcherOpen(true) },
          { label: "Open board manager", icon: "grid-outline", onPress: () => router.replace("/") },
          { label: "Rename board", icon: "pencil-outline", onPress: () => setRenameBoardOpen(true) },
          { label: "Duplicate board", icon: "copy-outline", onPress: () => { const id = api.duplicateProject(api.currentProjectId); if (id) toast.success("Board duplicated"); } },
          { label: "Delete board", icon: "trash-outline", destructive: true, onPress: deleteBoard },
        ]}
        onClose={() => setBoardActionsOpen(false)}
        anchor={menuAnchor}
      />
      <OptionSheet visible={taskAction !== null} title={taskAction?.title ?? "Task actions"} options={taskOptions} onClose={() => setTaskAction(null)} />
      <TextEntrySheet visible={renameBoardOpen} title="Rename board" initialValue={api.currentProjectName} placeholder="Board name" onClose={() => setRenameBoardOpen(false)} onSubmit={(name) => { api.renameProject(api.currentProjectId, name); setRenameBoardOpen(false); }} />
    </>
  );
}
