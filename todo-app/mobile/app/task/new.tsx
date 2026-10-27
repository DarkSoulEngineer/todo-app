import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import { ReferenceNewTaskScreen } from "@/components/reference/mobile";
import { useTasksContext } from "@/providers/tasks-provider";

type TaskOrigin = "reference-board" | "my-tasks" | "calendar" | "desktop";

function parseOrigin(value: string | string[] | undefined): TaskOrigin {
  const origin = Array.isArray(value) ? value[0] : value;
  return origin === "my-tasks" || origin === "calendar" || origin === "desktop" || origin === "reference-board" ? origin : "reference-board";
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function NewTaskRoute() {
  const api = useTasksContext();
  const { currentProjectId, isLoading, projects, switchProject } = api;
  const params = useLocalSearchParams<{
    sectionId?: string | string[];
    origin?: string | string[];
    boardId?: string | string[];
    categoryId?: string | string[];
    category?: string | string[];
    dueAt?: string | string[];
  }>();
  const sectionId = firstParam(params.sectionId);
  const origin = parseOrigin(params.origin);
  const boardId = firstParam(params.boardId);
  const requestedCategory = firstParam(params.categoryId) ?? firstParam(params.category);
  const dueAt = firstParam(params.dueAt);
  const requestedProjectId = boardId && projects.some((project) => project.id === boardId) ? boardId : null;
  const workspaceReady = !isLoading && Boolean(currentProjectId) && (!requestedProjectId || currentProjectId === requestedProjectId);

  // A task opened from a desktop board must be created in that board's
  // workspace. This also makes the category and section lists below come from
  // the same project the user will return to.
  useEffect(() => {
    if (!requestedProjectId || requestedProjectId === currentProjectId || isLoading) return;
    switchProject(requestedProjectId);
  }, [currentProjectId, isLoading, requestedProjectId, switchProject]);

  const categoryId = useMemo(
    () => (workspaceReady && requestedCategory && api.boards.some((board) => board.id === requestedCategory) ? requestedCategory : null),
    [api.boards, requestedCategory, workspaceReady],
  );
  const section = workspaceReady ? api.sections.find((item) => item.id === sectionId) : undefined;
  const returnToOrigin = () => {
    if (origin === "desktop" && boardId) return router.replace(`/board/${boardId}`);
    if (origin === "my-tasks" || origin === "calendar") return router.replace("/top-tasks");
    if (origin === "reference-board") return router.replace("/reference-board");
    return router.replace(api.currentProjectId ? `/board/${api.currentProjectId}` : "/");
  };

  // Do not mount the form until hydration and any requested project switch
  // have completed. This prevents a fast submit from being written into the
  // temporary empty workspace used while the provider hydrates.
  if (!workspaceReady) return null;

  return (
    <ReferenceNewTaskScreen
      boardLabel={api.currentProjectName || "Current board"}
      sectionLabel={section?.title ?? "No list"}
      initialDraft={{ ...(dueAt ? { dueAt } : {}), ...(categoryId ? { category: categoryId } : {}) }}
      onCancel={returnToOrigin}
      onSubmit={(draft, attachments) => {
        if (!workspaceReady) return;
        // `null` is a meaningful explicit “None” selection. Only accept a
        // submitted category when it belongs to the active workspace; never
        // replace an explicit null with the route's initial category.
        const selectedCategory = draft.category === null
          ? null
          : draft.category && api.boards.some((board) => board.id === draft.category)
            ? draft.category
            : null;
        const task = api.addTask({ ...draft, category: selectedCategory });
        if (section) api.assignTaskToSection(task.id, section.id);
        attachments.forEach((attachment) => api.addAttachment(task.id, attachment));
        returnToOrigin();
      }}
    />
  );
}
