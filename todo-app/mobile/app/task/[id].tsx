import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ReferenceTaskInspectorScreen } from "@/components/reference/mobile";
import { useReferenceTheme } from "@/components/reference/reference-theme";
import { useTasksContext } from "@/providers/tasks-provider";
import { makeId } from "@/lib/utils/id";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import type { Priority } from "@/lib/domain/types";

type TaskOrigin = "reference-board" | "my-tasks" | "calendar" | "desktop";

function parseOrigin(value: string | string[] | undefined): TaskOrigin {
  const origin = Array.isArray(value) ? value[0] : value;
  return origin === "my-tasks" || origin === "calendar" || origin === "desktop" || origin === "reference-board" ? origin : "reference-board";
}

export default function TaskInspectorRoute() {
  const api = useTasksContext();
  const { colors, type } = useReferenceTheme();
  const params = useLocalSearchParams<{ id?: string | string[]; origin?: string | string[]; boardId?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const origin = parseOrigin(params.origin);
  const boardId = Array.isArray(params.boardId) ? params.boardId[0] : params.boardId;
  const task = api.tasks.find((item) => item.id === id);
  const returnToOrigin = useCallback(() => {
    if (origin === "desktop" && boardId) return router.replace(`/board/${boardId}`);
    if (origin === "my-tasks") return router.replace("/calendar");
    if (origin === "calendar") return router.replace("/calendar");
    return router.replace(api.currentProjectId ? `/board/${api.currentProjectId}` : "/");
  }, [api.currentProjectId, boardId, origin]);

  useEffect(() => {
    if (!api.isLoading && (!id || !task)) returnToOrigin();
  }, [api.isLoading, id, returnToOrigin, task]);

  if (!task) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.background }}>
        <ThemeAtmosphere />
        <ActivityIndicator color={colors.primary} />
        <Text style={[type.body, { color: colors.muted }]}>Loading task…</Text>
      </View>
    );
  }

  const appendActivity = (message: string, type = "edit") => {
    if (!id) return;
    api.appendTaskActivity(id, { id: makeId(8), type, message, createdAt: new Date().toISOString() });
  };

  return (
    <ReferenceTaskInspectorScreen
      task={task}
      onBack={returnToOrigin}
      onDiscard={returnToOrigin}
      onCancelTask={() => {
        api.toggleCancel(task.id);
        returnToOrigin();
      }}
      onDelete={() => {
        api.deleteTask(task.id);
        returnToOrigin();
      }}
      onSave={(draft) => {
        const changes: string[] = [];
        if (draft.title.trim() !== task.title) changes.push("title");
        if (draft.description.trim() !== task.description) changes.push("description");
        if (draft.dueAt !== task.dueAt) changes.push("due date");
        if (draft.priority !== task.priority) changes.push("priority");
        if (JSON.stringify(draft.subtasks) !== JSON.stringify(task.subtasks)) changes.push("checklist");
        if (JSON.stringify(draft.tags ?? []) !== JSON.stringify(task.tags ?? [])) changes.push("tags");
        api.updateTask(task.id, draft);
        if (changes.length) appendActivity(`Updated ${changes.join(", ")}`);
        returnToOrigin();
      }}
      onEditProperty={(property, value) => {
        if (property === "priority" && (value === "low" || value === "medium" || value === "high")) {
          api.patchTask(task.id, { priority: value as Priority });
          appendActivity(`Changed priority to ${value}`);
        } else if (property === "dueDate" && (value === null || typeof value === "string")) {
          api.setTaskDueAt(task.id, value);
          appendActivity(value ? "Set a due date" : "Removed the due date");
        } else if (property === "status" && (value === "completed" || value === "canceled" || value === "open")) {
          api.setTaskStatus(task.id, value);
          appendActivity(value === "open" ? "Reopened task" : value === "completed" ? "Completed task" : "Canceled task", "status");
        }
      }}
      onAddAttachment={(attachment) => {
        api.addAttachment(task.id, attachment);
        appendActivity(`Added attachment ${attachment.name}`, "attachment");
      }}
      onRemoveAttachment={(attachmentId) => {
        const attachment = task.attachments.find((item) => item.id === attachmentId);
        api.removeAttachment(task.id, attachmentId);
        appendActivity(attachment ? `Removed attachment ${attachment.name}` : "Removed an attachment", "attachment");
      }}
    />
  );
}
