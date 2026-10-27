import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ReferenceMyTasksScreen, type ReferenceMobileTab, type ReferenceTaskDisplay } from "@/components/reference/mobile";
import { useAllBoardTasks } from "@/hooks/use-all-board-tasks";
import { TaskEditor } from "@/components/janus-board-ui";
import { useToast } from "@/providers/toast-provider";
import type { Task, TaskDraft } from "@/lib/domain/types";
import { getTaskSectionId } from "@/lib/domain/sections";

export default function MyTasksRoute() {
  const { api, entries } = useAllBoardTasks();
  const toast = useToast();
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorProjectId, setEditorProjectId] = useState<string | null>(null);

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

  const openEditor = (task: Task, projectId?: string) => {
    setEditorTask(task);
    setEditorProjectId(projectId ?? null);
    setEditorVisible(true);
  };

  const editorEntry = useMemo(() => {
    if (!editorTask) return null;
    if (editorProjectId) {
      const entry = entries.find((e) => e.projectId === editorProjectId && e.task.id === editorTask.id);
      if (entry) return entry;
    }
    return entries.find((e) => e.task.id === editorTask.id) ?? null;
  }, [editorProjectId, editorTask, entries]);

  const editorBoards = editorEntry?.boards ?? [];
  const editorSections = useMemo(() => {
    if (!editorEntry) return [];
    const project = api.projects.find((p) => p.id === editorEntry.projectId);
    if (project?.workspace) {
      // Prefer live state if this is current project
      if (project.id === api.currentProjectId) {
        return api.sections;
      }
      return project.workspace.sections;
    }
    if (editorEntry.projectId === api.currentProjectId) return api.sections;
    return [];
  }, [api.currentProjectId, api.projects, api.sections, editorEntry]);

  const saveTask = (draft: TaskDraft, sectionId: string | null) => {
    if (!editorTask) return;
    const projectId = editorEntry?.projectId ?? api.currentProjectId;
    if (projectId && typeof (api as any).switchProject === "function" && projectId !== api.currentProjectId) {
      (api as any).switchProject(projectId);
    }
    api.updateTask(editorTask.id, draft);
    if (editorEntry) {
      const currentSectionId = getTaskSectionId(editorTask, editorSections, new Date()) ?? null;
      if (sectionId !== currentSectionId) {
        if (sectionId === null) {
          api.setTaskSectionId(editorTask.id, null);
        } else {
          const section = editorSections.find((s) => s.id === sectionId);
          if (section) {
            api.assignTaskToSection(editorTask.id, sectionId);
          } else {
            api.setTaskSectionId(editorTask.id, sectionId);
          }
        }
      }
    }
    toast.success("Task updated");
    setEditorVisible(false);
    setEditorTask(null);
    setEditorProjectId(null);
  };

  const autoSaveTask = (draft: TaskDraft, sectionId: string | null) => {
    if (!editorTask) return;
    api.updateTask(editorTask.id, draft);
    if (editorEntry) {
      const currentSectionId = getTaskSectionId(editorTask, editorSections, new Date()) ?? null;
      if (sectionId !== currentSectionId) {
        if (sectionId === null) {
          api.setTaskSectionId(editorTask.id, null);
        } else {
          api.assignTaskToSection(editorTask.id, sectionId);
        }
      }
    }
  };

  return (
    <>
      <ReferenceMyTasksScreen
        tasks={tasks}
        boardName={api.currentProjectName}
        onTaskPress={openEditor}
        onToggleComplete={(task) => api.toggleComplete(task.id)}
        onReviewAttention={() => router.replace(api.currentProjectId ? `/board/${api.currentProjectId}` : "/")}
        onRescheduleAttention={() => router.replace("/calendar")}
        onNavigate={navigate}
        activeTab="my-tasks"
      />
      <TaskEditor
        visible={editorVisible}
        task={editorTask}
        boards={editorBoards}
        sections={editorSections}
        onClose={() => {
          setEditorVisible(false);
          setEditorTask(null);
          setEditorProjectId(null);
        }}
        onSave={saveTask}
        onAutoSave={editorTask ? autoSaveTask : undefined}
        onDelete={
          editorTask
            ? () => {
                const before = api.snapshot();
                api.deleteTask(editorTask.id);
                setEditorVisible(false);
                setEditorTask(null);
                setEditorProjectId(null);
                toast.success("Task deleted", { action: { label: "Undo", onPress: () => api.restore(before) } });
              }
            : undefined
        }
        onCancelTask={
          editorTask
            ? () => {
                api.toggleCancel(editorTask.id);
                setEditorVisible(false);
                setEditorTask(null);
                setEditorProjectId(null);
              }
            : undefined
        }
      />
    </>
  );
}
