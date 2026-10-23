import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JanusLockup } from "@/components/brand/janus-logo";
import { BoardCard, IconButton, OptionSheet, TextEntrySheet, ThemeToggle } from "@/components/janus-board-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useTasksContext } from "@/providers/tasks-provider";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";
import { boardColor } from "@/lib/domain/boards";
import { exportWorkspace, pickWorkspaceFile } from "@/lib/data/transfer";
import type { JanusProject } from "@/lib/domain/projects";

export default function BoardManagerScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const { projects, isLoading, currentProjectId, createProject, importProject, duplicateProject, renameProject, removeProject, switchProject } = useTasksContext();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [menuProject, setMenuProject] = useState<JanusProject | null>(null);
  const [renameProjectTarget, setRenameProjectTarget] = useState<JanusProject | null>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const totals = useMemo(() => projects.reduce((all, project) => {
    const tasks = project.workspace.tasks;
    all.tasks += tasks.length;
    all.completed += tasks.filter((task) => task.completed).length;
    return all;
  }, { tasks: 0, completed: 0 }), [projects]);
  const columns = dimensions.width >= 720 ? 3 : 2;

  const openProject = (id: string) => { const project = projects.find((item) => item.id === id); if (!project) return; switchProject(id); router.push(`/board/${id}`); };
  const create = () => {
    const id = createProject(newName.trim() || "Untitled board");
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
  const askDelete = (project: JanusProject) => Alert.alert("Delete board?", `“${project.name}” and its tasks will be removed.`, [{ text: "Keep it", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { const ok = removeProject(project.id); if (ok) toast.success("Board deleted"); else toast.error("Keep at least one board"); } }]);
  const menuOptions = menuProject ? [
    { label: "Open board", icon: "arrow-forward-circle-outline" as const, onPress: () => openProject(menuProject.id) },
    { label: "Rename", icon: "pencil-outline" as const, onPress: () => setRenameProjectTarget(menuProject) },
    { label: "Duplicate", icon: "copy-outline" as const, onPress: () => { const id = duplicateProject(menuProject.id); if (id) { toast.success("Board duplicated"); router.push(`/board/${id}`); } } },
    { label: "Export JSON", icon: "share-outline" as const, onPress: () => void exportWorkspace(menuProject.workspace, menuProject.name) },
    { label: "Delete board", icon: "trash-outline" as const, destructive: true, onPress: () => askDelete(menuProject) },
  ] : [];
  const activeProject = projects.find((project) => project.id === currentProjectId);
  const workspaceOptions = [
    { label: "New board", icon: "add-circle-outline" as const, onPress: () => setShowCreate(true) },
    { label: "Import board", icon: "cloud-upload-outline" as const, onPress: importBoard },
    ...(activeProject ? [{ label: "Export active board", icon: "share-outline" as const, onPress: () => { void exportWorkspace(activeProject.workspace, activeProject.name); } }] : []),
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}><JanusLockup tagline="A calmer way to move work forward" /><ThemeToggle /></View>
        <View style={[styles.hero, { backgroundColor: theme.colors.primarySoft }]}><View style={{ flex: 1 }}><Text style={[styles.kicker, { color: theme.colors.accentForeground }]}>YOUR WORKSPACE</Text><Text style={[styles.heroTitle, { color: theme.colors.foreground }]}>Make room for what matters.</Text><Text style={[styles.heroCopy, { color: theme.colors.mutedForeground }]}>Keep every project close, clear, and ready for the next small step.</Text></View><View style={[styles.heroOrb, { backgroundColor: theme.colors.primary }]}><Text style={{ color: theme.colors.primaryForeground, fontSize: 28, fontWeight: "800" }}>✦</Text></View></View>
        <View style={styles.statsRow}><Metric value={projects.length.toString()} label="boards" /><Metric value={totals.tasks.toString()} label="tasks" /><Metric value={totals.completed.toString()} label="done" /></View>
         <View style={styles.sectionHeader}><View><Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>Your boards</Text><Text style={[styles.sectionHint, { color: theme.colors.mutedForeground }]}>{projects.length ? "Pick up where you left off." : "Start with a focused space."}</Text></View><IconButton icon="ellipsis-horizontal" label="Workspace options" onPress={() => setWorkspaceMenuOpen(true)} /></View>
        <View style={styles.actionRow}><Button label="New board" onPress={() => setShowCreate(true)} style={{ flex: 1 }}><Text style={{ color: theme.colors.primaryForeground, fontSize: 20, fontWeight: "400" }}>＋</Text><Text style={{ color: theme.colors.primaryForeground, fontWeight: "700" }}>New board</Text></Button><Button variant="secondary" label="Import" onPress={importBoard}><Text style={{ color: theme.colors.secondaryForeground, fontSize: 18 }}>↥</Text><Text style={{ color: theme.colors.secondaryForeground, fontWeight: "700" }}>Import</Text></Button></View>
        {isLoading ? <LoadingState /> : projects.length === 0 ? <EmptyState icon="layers-outline" title="No boards yet" message="Create a board for a project, a season, or simply the things on your mind." actionLabel="Create your first board" onAction={() => setShowCreate(true)} /> : <View style={[styles.grid, { gap: 12 }]}>{projects.map((project, index) => { const color = boardColor(project.workspace.boards[index % Math.max(1, project.workspace.boards.length)]?.color ?? (["violet", "teal", "orange", "blue"] as const)[index % 4]).dot; const tasks = project.workspace.tasks; return <View key={project.id} style={{ width: `${100 / columns - 2}%` }}><BoardCard label={project.name} count={tasks.length} completed={tasks.filter((task) => task.completed).length} color={color} onPress={() => openProject(project.id)} onMenu={() => setMenuProject(project)} /></View>; })}</View>}
        <Text style={[styles.footerNote, { color: theme.colors.mutedForeground }]}>Private by default · stored on this device</Text>
      </ScrollView>
      <Sheet visible={showCreate} onClose={() => setShowCreate(false)}><Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>Name your board</Text><Text style={[styles.sheetCopy, { color: theme.colors.mutedForeground }]}>A board is a calm, focused home for one kind of work.</Text><Input autoFocus value={newName} onChangeText={setNewName} placeholder="e.g. Spring launch" onSubmitEditing={create} style={{ marginTop: 12 }} /><Button label="Create board" onPress={create} disabled={!newName.trim()} style={{ marginTop: 14 }} /></Sheet>
      <OptionSheet visible={menuProject !== null} title={menuProject?.name ?? "Board actions"} options={menuOptions} onClose={() => setMenuProject(null)} />
      <OptionSheet visible={workspaceMenuOpen} title="Workspace options" options={workspaceOptions} onClose={() => setWorkspaceMenuOpen(false)} />
      <TextEntrySheet visible={renameProjectTarget !== null} title="Rename board" initialValue={renameProjectTarget?.name ?? ""} placeholder="Board name" onClose={() => setRenameProjectTarget(null)} onSubmit={(value) => { if (renameProjectTarget) renameProject(renameProjectTarget.id, value); setRenameProjectTarget(null); }} />
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) { const { theme } = useTheme(); return <View style={styles.metric}><Text style={[styles.metricValue, { color: theme.colors.foreground }]}>{value}</Text><Text style={[styles.metricLabel, { color: theme.colors.mutedForeground }]}>{label}</Text></View>; }
function LoadingState() { const { theme } = useTheme(); return <View style={{ gap: 12, marginTop: 12 }}>{[1, 2, 3].map((item) => <View key={item} style={[styles.skeleton, { backgroundColor: theme.colors.skeleton }]}><ActivityIndicator color={theme.colors.primary} /></View>)}</View>; }

const styles = StyleSheet.create({ root: { flex: 1 }, content: { paddingHorizontal: 18, paddingTop: 14 }, topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, hero: { minHeight: 188, borderRadius: 26, marginTop: 25, padding: 22, flexDirection: "row", overflow: "hidden" }, kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }, heroTitle: { fontSize: 28, lineHeight: 33, fontWeight: "800", maxWidth: 280, marginTop: 12 }, heroCopy: { fontSize: 14, lineHeight: 20, maxWidth: 280, marginTop: 10 }, heroOrb: { width: 82, height: 82, borderRadius: 32, alignItems: "center", justifyContent: "center", position: "absolute", right: -12, bottom: -12, transform: [{ rotate: "12deg" }] }, statsRow: { flexDirection: "row", gap: 1, marginVertical: 18, backgroundColor: "transparent" }, metric: { flex: 1, paddingVertical: 4 }, metricValue: { fontSize: 23, fontWeight: "800" }, metricLabel: { fontSize: 12, marginTop: 2, fontWeight: "600" }, sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { fontSize: 21, fontWeight: "800" }, sectionHint: { fontSize: 13, marginTop: 4 }, actionRow: { flexDirection: "row", gap: 9, marginTop: 16, marginBottom: 16 }, grid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" }, footerNote: { textAlign: "center", fontSize: 11, marginTop: 28 }, skeleton: { height: 128, borderRadius: 20, alignItems: "center", justifyContent: "center" }, sheetTitle: { fontSize: 22, fontWeight: "800" }, sheetCopy: { fontSize: 14, lineHeight: 20, marginTop: 5 },
});
