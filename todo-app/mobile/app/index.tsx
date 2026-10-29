import { router } from "expo-router";
import { BlurTargetView } from "expo-blur";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { StyleSheet, View } from "react-native";
import { BoardManagerContent } from "@/components/board/board-manager-content";
import { OptionSheet, TextEntrySheet } from "@/components/janus-board-ui";
import { anchorFromEvent, type MenuAnchor } from "@/components/ui/anchored-menu";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { ReferenceMobileBottomNav, type ReferenceMobileTab } from "@/components/reference/mobile/reference-mobile-bottom-nav";
import { WelcomeScreen } from "@/components/setup/welcome-screen";
import { useTasksContext } from "@/providers/tasks-provider";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";
import { exportWorkspace, pickWorkspaceFile } from "@/lib/data/transfer";
import { getWorkspaceMetrics, loadManagerState, saveManagerLayout, saveManagerPins } from "@/lib/data/manager-state";
import { EMPTY_BOARD_LAYOUT, boardLayoutOrder, dropBoardInLayout, moveBoardInLayout, reconcileBoardLayout, removeBoardFromLayout, type BoardLayout } from "@/lib/features/board-layout";
import type { JanusProject } from "@/lib/domain/projects";
import { CommandPalette, type PaletteMode } from "@/components/ui/command-palette";
import type { Command } from "@/lib/features/commands";
import { createNavigationCommands } from "@/lib/features/navigation-commands";

export default function BoardManagerScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const api = useTasksContext();
  const blurTarget = useRef<ComponentRef<typeof BlurTargetView> | null>(null);
  const { projects, tasks, sections, boards, isLoading, currentProjectId, createProject, importProject, duplicateProject, renameProject, removeProject, switchProject, closeProject, reopenProject } = api;
  const [showCreate, setShowCreate] = useState(false);
  const [menuProject, setMenuProject] = useState<JanusProject | null>(null);
  const [closedPromptProject, setClosedPromptProject] = useState<JanusProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JanusProject | null>(null);
  const [renameTarget, setRenameTarget] = useState<JanusProject | null>(null);
  const [query, setQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<BoardLayout>(EMPTY_BOARD_LAYOUT);
  const [managerStateLoaded, setManagerStateLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>(null);
  const managerReady = !isLoading && managerStateLoaded;

  useEffect(() => {
    let cancelled = false;
    void loadManagerState().then((saved) => {
      if (cancelled) return;
      setPinnedIds(saved.pinnedIds);
      setLayout(saved.layout);
      setManagerStateLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // The registry can lag a render behind the active workspace. Always use live
  // state for cards, statistics, and exports, including immediately after edits.
  const liveProjects = useMemo(() => projects.map((project) => project.id === currentProjectId ? { ...project, workspace: { tasks, sections, boards } } : project), [boards, currentProjectId, projects, sections, tasks]);
  const boardIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const resolvedLayout = useMemo(() => managerReady ? reconcileBoardLayout(layout, boardIds) : layout, [layout, boardIds, managerReady]);
  const orderedProjects = useMemo(() => {
    const byId = new Map(liveProjects.map((project) => [project.id, project]));
    return boardLayoutOrder(resolvedLayout, boardIds).map((id) => byId.get(id)).filter((project): project is JanusProject => project !== undefined);
  }, [boardIds, liveProjects, resolvedLayout]);
  const openProjects = useMemo(() => orderedProjects.filter((project) => !project.closedAt), [orderedProjects]);
  const closedProjects = useMemo(() => orderedProjects.filter((project) => project.closedAt), [orderedProjects]);
  const visibleProjects = useMemo(() => openProjects.filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase())), [openProjects, query]);
  const visibleClosedProjects = useMemo(() => closedProjects.filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase())), [closedProjects, query]);
  const activePins = useMemo(() => new Set([...pinnedIds].filter((id) => boardIds.includes(id))), [boardIds, pinnedIds]);
  const displayProjects = editMode ? openProjects : [...visibleProjects.filter((project) => activePins.has(project.id)), ...visibleProjects.filter((project) => !activePins.has(project.id))];
  const metrics = useMemo(() => getWorkspaceMetrics(openProjects, now), [openProjects, now]);

  useEffect(() => {
    if (!managerReady) return;
    const same = layout.order.length === resolvedLayout.order.length && layout.order.every((id, index) => id === resolvedLayout.order[index]) && layout.cols === resolvedLayout.cols;
    if (!same) void saveManagerLayout(resolvedLayout);
  }, [layout, managerReady, resolvedLayout]);
  useEffect(() => {
    if (managerReady && activePins.size !== pinnedIds.size) void saveManagerPins(activePins);
  }, [activePins, managerReady, pinnedIds.size]);

  if (!isLoading && projects.length === 0) {
    return <WelcomeScreen />;
  }

  const togglePin = (id: string) => {
    if (!managerReady) return;
    setPinnedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      void saveManagerPins(next);
      return next;
    });
  };
  const moveBoard = (id: string, direction: -1 | 1) => {
    if (!managerReady) return;
    const order = resolvedLayout.order;
    const from = order.indexOf(id);
    if (from === -1) return;
    // Closed boards are hidden from the arrange list, so step over them.
    const closedIds = new Set(closedProjects.map((project) => project.id));
    let to = from + direction;
    while (to >= 0 && to < order.length && closedIds.has(order[to])) to += direction;
    if (to < 0 || to >= order.length) return;
    const next = moveBoardInLayout(resolvedLayout, from, to);
    if (next === resolvedLayout) return;
    setLayout(next);
    void saveManagerLayout(next);
  };
  const reopenBoard = (project: JanusProject) => {
    if (!reopenProject(project.id)) return;
    // toast.success("Board reopened"); // optional, navigation handled elsewhere
  };
  const reorderBoard = (sourceId: string, targetId: string) => {
    if (!managerReady || !editMode) return;
    const next = dropBoardInLayout(resolvedLayout, sourceId, targetId, openProjects.map((project) => project.id));
    if (next === resolvedLayout) return;
    setLayout(next);
    void saveManagerLayout(next);
  };
  const promptClosed = (project: JanusProject) => {
    setClosedPromptProject(project);
  };
  const openProject = (id: string) => {
    const project = projects.find((entry) => entry.id === id);
    if (!project) return;
    if (project.closedAt) { /* was automatically opening; now does nothing per request */ return; }
    switchProject(id);
    router.push(`/board/${id}`);
  };
  const closeBoard = (project: JanusProject) => {
    if (!closeProject(project.id)) return;
    toast.show("Board closed", {
      description: "Reopen it anytime from Closed boards.",
      action: { label: "Undo", onPress: () => reopenProject(project.id) },
    });
  };
  const create = (name: string) => {
    if (!name.trim()) return;
    const id = createProject(name.trim());
    setShowCreate(false);
    if (id) router.push(`/board/${id}`);
  };
  const importBoard = async () => {
    try {
      const result = await pickWorkspaceFile();
      if (!result) return;
      const id = importProject(result.name, result.workspace);
      toast.success("Board imported", { description: result.name });
      if (id) router.push(`/board/${id}`);
    } catch { toast.error("Could not import that file", { description: "Choose a Janus JSON backup." }); }
  };
  const askDelete = (project: JanusProject) => {
    setDeleteTarget(project);
  };
  const deleteBoard = (project: JanusProject) => {
    if (!managerReady) return;
    if (!removeProject(project.id)) { toast.error("Keep at least one board"); return; }
    const nextPins = new Set(pinnedIds); nextPins.delete(project.id);
    setPinnedIds(nextPins); void saveManagerPins(nextPins);
    const nextLayout = removeBoardFromLayout(resolvedLayout, project.id);
    setLayout(nextLayout); void saveManagerLayout(nextLayout);
    toast.success("Board deleted");
  };
  const saveProject = (project: JanusProject) => {
    void exportWorkspace(project.id === currentProjectId ? { tasks, sections, boards } : project.workspace, project.name)
      .catch(() => toast.error("Could not export this board", { description: "Please try again on your device." }));
  };
  const duplicate = (project: JanusProject) => {
    const id = duplicateProject(project.id);
    if (id) { toast.success("Board duplicated"); }
  };
  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "top-tasks") router.replace("/top-tasks");
    else if (tab === "settings") router.replace("/settings");
  };

  const commands: Command[] = managerReady ? [
    { id: "new-board", label: "Create new board", shortcut: "B", run: () => setShowCreate(true) },
    ...createNavigationCommands({ projects: orderedProjects, currentProjectId, openBoard: openProject, navigate: (destination) => router.replace(destination) }),
    { id: "rename-board", label: "Rename board", shortcut: "Shift R", children: orderedProjects.map((project) => ({ id: project.id, label: project.name, run: () => setRenameTarget(project) })) },
    ...([-1, 1] as const).map((direction): Command => ({ id: `board-${direction}`, label: `Move board ${direction === -1 ? "left" : "right"}`, detail: "Change saved board order; pinned boards remain first", children: openProjects.filter((_, index) => direction === -1 ? index > 0 : index < openProjects.length - 1).map((project) => ({ id: project.id, label: project.name, run: () => moveBoard(project.id, direction) })) })),
    { id: "import", label: "Import board", run: () => { void importBoard(); } },
  ] : [];

  return <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
    <BlurTargetView ref={blurTarget} style={styles.root}>
    <ThemeAtmosphere />
    <BoardManagerContent onCommands={() => setPaletteMode("commands")} projects={displayProjects} statsProjects={openProjects} closedProjects={visibleClosedProjects} totalBoards={openProjects.length} metrics={metrics} pinnedIds={activePins} ready={managerReady} loading={isLoading} editing={editMode} query={query} now={now} onQuery={setQuery} onEdit={setEditMode} onCreate={() => setShowCreate(true)} onImport={() => { void importBoard(); }} onOpen={openProject} onReopen={reopenBoard} onPin={togglePin} onMove={moveBoard} onReorder={reorderBoard} onMenu={(project, event) => { setMenuAnchor(event ? anchorFromEvent(event) : null); setMenuProject(project); }} onRename={setRenameTarget} onSave={saveProject} onDuplicate={duplicate} onRemove={askDelete} />
    </BlurTargetView>
    <CommandPalette mode={paletteMode} onMode={setPaletteMode} commands={commands} blocked={!managerReady || showCreate || !!menuProject || !!closedPromptProject || !!deleteTarget || !!renameTarget} />
    <ReferenceMobileBottomNav active="boards" onNavigate={navigate} blurTarget={blurTarget} />
    <TextEntrySheet visible={showCreate} title="New board" description="Add lists and categories after creating the board." placeholder="Board name" actionLabel="Create board" onClose={() => setShowCreate(false)} onSubmit={create} />
    <OptionSheet visible={menuProject !== null} title={menuProject?.name ?? "Board actions"} options={menuProject ? [
      ...(menuProject.closedAt
        ? [{ label: "Reopen board", icon: "refresh-outline" as const, onPress: () => reopenBoard(menuProject) }]
        : [
          { label: "Open board", icon: "arrow-forward-circle-outline" as const, onPress: () => openProject(menuProject.id) },
          { label: "Close board", icon: "archive-outline" as const, onPress: () => closeBoard(menuProject) },
        ]),
      { label: "Rename", icon: "pencil-outline", onPress: () => setRenameTarget(menuProject) },
      ...(menuProject.closedAt ? [] : [{ label: "Duplicate", icon: "copy-outline" as const, onPress: () => duplicate(menuProject) }]),
      { label: "Export JSON", icon: "share-outline", onPress: () => saveProject(menuProject) },
      { label: "Delete board", icon: "trash-outline", destructive: true, onPress: () => askDelete(menuProject) },
    ] : []} onClose={() => setMenuProject(null)} anchor={menuAnchor} />
    <OptionSheet visible={closedPromptProject !== null} title={closedPromptProject ? `“${closedPromptProject.name}” is closed` : "Board closed"} options={closedPromptProject ? [
      { label: "Reopen board", icon: "refresh-outline" as const, onPress: () => reopenBoard(closedPromptProject) },
      { label: "Keep it closed", icon: "close-outline" as const, onPress: () => undefined },
    ] : []} onClose={() => setClosedPromptProject(null)} />
    <ConfirmationDialog visible={deleteTarget !== null} title={deleteTarget ? `Delete “${deleteTarget.name}”?` : "Delete board?"} description="This board and all of its lists and cards will be permanently removed. This cannot be undone." confirmLabel="Delete board" cancelLabel="Keep it" onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) { deleteBoard(deleteTarget); setDeleteTarget(null); } }} />
    <TextEntrySheet visible={renameTarget !== null} title="Rename board" initialValue={renameTarget?.name ?? ""} placeholder="Board name" onClose={() => setRenameTarget(null)} onSubmit={(value) => { if (renameTarget) renameProject(renameTarget.id, value); setRenameTarget(null); }} />
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
