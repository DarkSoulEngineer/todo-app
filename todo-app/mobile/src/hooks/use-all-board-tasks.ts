import { useMemo } from "react";
import type { Board } from "@/lib/domain/boards";
import type { Task } from "@/lib/domain/types";
import { useTasksContext } from "@/providers/tasks-provider";

export interface BoardTaskEntry {
  task: Task;
  projectId: string;
  projectName: string;
  boards: Board[];
}

/**
 * Tasks from every open board, flattened for cross-board overviews such as
 * Top Tasks. The active board's workspace is read from the live
 * task state so edits show immediately, even before the registry catches up.
 */
export function useAllBoardTasks(includeClosed = false) {
  const api = useTasksContext();
  const liveProjects = useMemo(
    () =>
      api.projects.map((project) =>
        project.id === api.currentProjectId
          ? { ...project, workspace: { tasks: api.tasks, sections: api.sections, boards: api.boards } }
          : project,
      ),
    [api.boards, api.currentProjectId, api.projects, api.sections, api.tasks],
  );
  const entries = useMemo<BoardTaskEntry[]>(
    () =>
      liveProjects
        .filter((project) => includeClosed || !project.closedAt)
        .flatMap((project) =>
          project.workspace.tasks.map((task) => ({
            task,
            projectId: project.id,
            projectName: project.name,
            boards: project.workspace.boards,
          })),
        ),
    [includeClosed, liveProjects],
  );

  return { api, projects: liveProjects, entries };
}
