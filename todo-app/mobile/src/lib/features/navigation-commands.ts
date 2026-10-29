import type { JanusProject } from "@/lib/domain/projects";
import type { Command } from "@/lib/features/commands";

export type MainDestination = "/" | "/top-tasks" | "/settings";

/** Shared by Home, workspaces, Top Tasks and Settings; never includes closed boards. */
export function createNavigationCommands({ projects, currentProjectId, openBoard, navigate }: {
  projects: JanusProject[];
  currentProjectId: string | null;
  openBoard: (id: string) => void;
  navigate: (destination: MainDestination) => void;
}): Command[] {
  const open = projects.filter((project) => !project.closedAt);
  const current = open.findIndex((project) => project.id === currentProjectId);
  const commands: Command[] = [
    { id: "all-boards", label: "Go to Home / board selection", shortcut: "Shift H", run: () => navigate("/") },
    { id: "top-tasks", label: "Go to Top Tasks", shortcut: "Shift T", run: () => navigate("/top-tasks") },
    { id: "settings", label: "Open Settings", shortcut: "Shift S", run: () => navigate("/settings") },
    { id: "switch-board", label: "Change board", shortcut: "Shift B", detail: "Search open boards, then select with ↑/↓ and Enter", children: open.map((project) => ({
      id: project.id, label: project.name, selected: project.id === currentProjectId,
      detail: `${project.id === currentProjectId ? "Current board · " : ""}${project.workspace.tasks.length} cards · ${project.workspace.sections.length} lists`,
      run: () => openBoard(project.id),
    })) },
  ];
  if (open.length > 1) {
    for (const direction of [-1, 1] as const) {
      const target = open[current < 0 ? (direction === -1 ? open.length - 1 : 0) : (current + direction + open.length) % open.length];
      commands.push({ id: direction === -1 ? "previous-board" : "next-board", label: `${direction === -1 ? "Previous" : "Next"} board`, shortcut: direction === -1 ? "[" : "]", detail: target.name, run: () => openBoard(target.id) });
    }
  }
  return commands;
}
