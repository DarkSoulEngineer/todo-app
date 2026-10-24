import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { BoardManagerContent } from "@/components/board/board-manager-content";
import { OptionSheet, TextEntrySheet } from "@/components/janus-board-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { ReferenceMobileBottomNav, type ReferenceMobileTab } from "@/components/reference/mobile/reference-mobile-bottom-nav";
import { useTasksContext } from "@/providers/tasks-provider";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";
import { exportWorkspace, pickWorkspaceFile } from "@/lib/data/transfer";
import { getWorkspaceMetrics, loadManagerState, saveManagerLayout, saveManagerPins } from "@/lib/data/manager-state";
import { EMPTY_BOARD_LAYOUT, boardLayoutOrder, moveBoardInLayout, reconcileBoardLayout, removeBoardFromLayout, type BoardLayout } from "@/lib/features/board-layout";
import type { JanusProject } from "@/lib/domain/projects";

export default function BoardManagerScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const api = useTasksContext();
  const { projects, tasks, sections, boards, isLoading, currentProjectId, createProject, importProject, duplicateProject, renameProject, removeProject, switchProject } = api;
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [menuProject, setMenuProject] = useState<JanusProject | null>(null);
  const [renameTarget, setRenameTarget] = useState<JanusProject | null>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<BoardLayout>(EMPTY_BOARD_LAYOUT);
  const [managerStateLoaded, setManagerStateLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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
  const visibleProjects = useMemo(() => orderedProjects.filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase())), [orderedProjects, query]);
  const activePins = useMemo(() => new Set([...pinnedIds].filter((id) => boardIds.includes(id))), [boardIds, pinnedIds]);
  const displayProjects = editMode ? orderedProjects : [...visibleProjects.filter((project) => activePins.has(project.id)), ...visibleProjects.filter((project) => !activePins.has(project.id))];
  const metrics = useMemo(() => getWorkspaceMetrics(liveProjects, now), [liveProjects, now]);

  useEffect(() => {
    if (!managerReady) return;
    const same = layout.order.length === resolvedLayout.order.length && layout.order.every((id, index) => id === resolvedLayout.order[index]) && layout.cols === resolvedLayout.cols;
    if (!same) void saveManagerLayout(resolvedLayout);
  }, [layout, managerReady, resolvedLayout]);
  useEffect(() => {
    if (managerReady && activePins.size !== pinnedIds.size) void saveManagerPins(activePins);
  }, [activePins, managerReady, pinnedIds.size]);

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
    const from = resolvedLayout.order.indexOf(id);
    const next = moveBoardInLayout(resolvedLayout, from, from + direction);
    if (next === resolvedLayout) return;
    setLayout(next);
    void saveManagerLayout(next);
  };
  const openProject = (id: string) => {
    if (!projects.some((project) => project.id === id)) return;
    switchProject(id);
    router.push(`/board/${id}`);
  };
  const create = () => {
    if (!newName.trim()) return;
    const id = createProject(newName.trim());
    setNewName(""); setShowCreate(false);
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
    if (!managerReady) return;
    Alert.alert("Delete board?", `“${project.name}” and its tasks will be removed.`, [{ text: "Keep it", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => {
      if (!removeProject(project.id)) { toast.error("Keep at least one board"); return; }
      const nextPins = new Set(pinnedIds); nextPins.delete(project.id);
      setPinnedIds(nextPins); void saveManagerPins(nextPins);
      const nextLayout = removeBoardFromLayout(resolvedLayout, project.id);
      setLayout(nextLayout); void saveManagerLayout(nextLayout);
      toast.success("Board deleted");
    } }]);
  };
  const saveProject = (project: JanusProject) => {
    void exportWorkspace(project.id === currentProjectId ? { tasks, sections, boards } : project.workspace, project.name)
      .catch(() => toast.error("Could not export this board", { description: "Please try again on your device." }));
  };
  const duplicate = (project: JanusProject) => {
    const id = duplicateProject(project.id);
    if (id) { toast.success("Board duplicated"); router.push(`/board/${id}`); }
  };
  const activeProject = liveProjects.find((project) => project.id === currentProjectId);
  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "my-tasks") router.replace("/my-tasks");
    else if (tab === "calendar") router.replace("/calendar");
    else if (tab === "settings") router.replace("/settings");
  };

  return <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
    <ThemeAtmosphere />
    <BoardManagerContent projects={displayProjects} totalBoards={projects.length} metrics={metrics} pinnedIds={activePins} ready={managerReady} loading={isLoading} editing={editMode} query={query} now={now} onQuery={setQuery} onEdit={setEditMode} onCreate={() => setShowCreate(true)} onImport={() => { void importBoard(); }} onMore={() => setWorkspaceMenuOpen(true)} onOpen={openProject} onPin={togglePin} onMove={moveBoard} onMenu={setMenuProject} onSave={saveProject} onDuplicate={duplicate} onRemove={askDelete} />
    <ReferenceMobileBottomNav active="boards" onNavigate={navigate} />
    <Sheet visible={showCreate} onClose={() => setShowCreate(false)}><Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>Name your board</Text><Text style={{ color: theme.colors.mutedForeground, marginTop: 6 }}>A focused home for one kind of work.</Text><Input autoFocus value={newName} onChangeText={setNewName} placeholder="e.g. Spring launch" onSubmitEditing={create} style={{ marginTop: 12 }} /><Button label="Create board" onPress={create} disabled={!newName.trim()} style={{ marginTop: 14 }} /></Sheet>
    <OptionSheet visible={menuProject !== null} title={menuProject?.name ?? "Board actions"} options={menuProject ? [
      { label: "Open board", icon: "arrow-forward-circle-outline", onPress: () => openProject(menuProject.id) },
      { label: "Rename", icon: "pencil-outline", onPress: () => setRenameTarget(menuProject) },
      { label: "Duplicate", icon: "copy-outline", onPress: () => duplicate(menuProject) },
      { label: "Export JSON", icon: "share-outline", onPress: () => saveProject(menuProject) },
      { label: "Delete board", icon: "trash-outline", destructive: true, onPress: () => askDelete(menuProject) },
    ] : []} onClose={() => setMenuProject(null)} />
    <OptionSheet visible={workspaceMenuOpen} title="Workspace options" options={[
      { label: "New board", icon: "add-circle-outline", onPress: () => setShowCreate(true) },
      { label: "Import board", icon: "cloud-upload-outline", onPress: importBoard },
      ...(activeProject ? [{ label: "Export active board", icon: "share-outline" as const, onPress: () => saveProject(activeProject) }] : []),
    ]} onClose={() => setWorkspaceMenuOpen(false)} />
    <TextEntrySheet visible={renameTarget !== null} title="Rename board" initialValue={renameTarget?.name ?? ""} placeholder="Board name" onClose={() => setRenameTarget(null)} onSubmit={(value) => { if (renameTarget) renameProject(renameTarget.id, value); setRenameTarget(null); }} />
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, sheetTitle: { fontSize: 23, fontWeight: "700" } });
