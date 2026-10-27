import { Ionicons } from "@expo/vector-icons";
import { BlurTargetView } from "expo-blur";
import { router } from "expo-router";
import { useMemo, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OptionSheet, TaskCard, TaskEditor } from "@/components/janus-board-ui";
import { ReferenceMobileBottomNav, type ReferenceMobileTab } from "@/components/reference/mobile/reference-mobile-bottom-nav";
import { Pill, ScreenHeader } from "@/components/reference/mobile/reference-primitives";
import { useReferenceTheme } from "@/components/reference/reference-theme";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { useAllBoardTasks, type BoardTaskEntry } from "@/hooks/use-all-board-tasks";
import { useNow } from "@/hooks/use-now";
import { getTaskSectionId } from "@/lib/domain/sections";
import type { TaskDraft } from "@/lib/domain/types";
import { rankTopTasks, type TopTasksLimit } from "@/lib/features/top-tasks";
import { useToast } from "@/providers/toast-provider";
import { mobileBottomNavClearance, mobileContentStyle } from "@/theme/layout";

type TaskTarget = { projectId: string; taskId: string };

export default function TopTasksRoute() {
  const { api, entries } = useAllBoardTasks();
  const { colors, type } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const toast = useToast();
  const blurTarget = useRef<ComponentRef<typeof BlurTargetView> | null>(null);
  const [limit, setLimit] = useState<TopTasksLimit>(3);
  const [editing, setEditing] = useState<TaskTarget | null>(null);
  const [menu, setMenu] = useState<TaskTarget | null>(null);
  const ranked = useMemo(() => rankTopTasks(entries), [entries]);
  const visible = ranked.slice(0, limit);
  const editorEntry = editing ? entries.find((entry) => entry.projectId === editing.projectId && entry.task.id === editing.taskId) : undefined;
  const menuEntry = menu ? entries.find((entry) => entry.projectId === menu.projectId && entry.task.id === menu.taskId) : undefined;
  const ownerProject = editorEntry ? api.projects.find((project) => project.id === editorEntry.projectId) : undefined;
  const editorSections = editorEntry?.projectId === api.currentProjectId ? api.sections : ownerProject?.workspace.sections ?? [];

  const activateOwner = (entry: BoardTaskEntry) => {
    if (entry.projectId !== api.currentProjectId) api.switchProject(entry.projectId);
  };
  const openTask = (entry: BoardTaskEntry) => {
    activateOwner(entry);
    setEditing({ projectId: entry.projectId, taskId: entry.task.id });
  };
  const completeTask = (entry: BoardTaskEntry) => {
    activateOwner(entry);
    api.toggleComplete(entry.task.id);
  };
  const updateTask = (draft: TaskDraft, sectionId: string | null) => {
    if (!editorEntry) return;
    activateOwner(editorEntry);
    api.updateTask(editorEntry.task.id, draft);
    const currentSection = getTaskSectionId(editorEntry.task, editorSections, now) ?? null;
    if (sectionId !== currentSection) {
      if (sectionId === null) api.setTaskSectionId(editorEntry.task.id, null);
      else api.assignTaskToSection(editorEntry.task.id, sectionId);
    }
  };
  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "boards") router.replace("/");
    if (tab === "settings") router.replace("/settings");
  };

  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <BlurTargetView ref={blurTarget} style={styles.root}>
    <ThemeAtmosphere />
    <ScreenHeader title="Top Tasks" subtitle="Your next priorities across open boards" showThemeToggle={false} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + mobileBottomNavClearance }]}>
      <View style={[styles.limitSwitch, { backgroundColor: colors.surfaceLow, borderColor: colors.outlineVariant }]}>
        {([3, 10] as const).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={`Show top ${value} tasks`} accessibilityState={{ selected: limit === value }} onPress={() => setLimit(value)} style={[styles.limitOption, limit === value && { backgroundColor: colors.card }]}>
          <Ionicons name={value === 3 ? "flame-outline" : "list-outline"} size={17} color={limit === value ? colors.primary : colors.muted} />
          <Text style={[type.bodyStrong, { color: limit === value ? colors.primary : colors.muted }]}>Top {value}</Text>
        </Pressable>)}
      </View>
      <SectionHeading title="What to focus on" subtitle="High priority first, then earliest deadlines. Completed and canceled tasks stay out of this list." right={<Pill label={`${visible.length} of ${ranked.length}`} tone="primary" />} />
      {api.isLoading ? <ActivityIndicator accessibilityLabel="Loading top tasks" color={colors.primary} /> : visible.length ? visible.map((entry, index) => <View key={`${entry.projectId}:${entry.task.id}`}>
        <View style={styles.taskHeading}><Text style={[styles.rank, { color: colors.primary }]}>#{index + 1}</Text><Text numberOfLines={1} style={[type.caption, { flex: 1, color: colors.muted }]}>{entry.projectName}</Text></View>
        <TaskCard task={entry.task} boards={entry.boards} now={now} onPress={() => openTask(entry)} onLongPress={() => setMenu({ projectId: entry.projectId, taskId: entry.task.id })} />
      </View>) : <EmptyState icon="checkmark-done-outline" title="Nothing needs your attention" message="There are no unfinished tasks across your open boards. Add a task from Home to get started." actionLabel="Go to Home" onAction={() => router.replace("/")} />}
    </ScrollView>
    </BlurTargetView>
    <ReferenceMobileBottomNav active="top-tasks" onNavigate={navigate} blurTarget={blurTarget} />
    <OptionSheet visible={Boolean(menuEntry)} title={menuEntry?.task.title ?? "Task actions"} onClose={() => setMenu(null)} options={menuEntry ? [
      { label: "Edit task", icon: "create-outline", onPress: () => openTask(menuEntry) },
      { label: "Complete task", icon: "checkmark-circle-outline", onPress: () => completeTask(menuEntry) },
      { label: "Open board", icon: "albums-outline", onPress: () => { activateOwner(menuEntry); router.push(`/board/${menuEntry.projectId}`); } },
      { label: "Cancel task", icon: "close-circle-outline", onPress: () => { activateOwner(menuEntry); api.toggleCancel(menuEntry.task.id); } },
    ] : []} />
    <TaskEditor visible={Boolean(editorEntry)} task={editorEntry?.task ?? null} boards={editorEntry?.boards ?? []} sections={editorSections} onClose={() => setEditing(null)} onSave={(draft, sectionId) => { updateTask(draft, sectionId); setEditing(null); toast.success("Task updated"); }} onAutoSave={editorEntry ? updateTask : undefined}
      onDelete={editorEntry ? () => { activateOwner(editorEntry); api.deleteTask(editorEntry.task.id); setEditing(null); toast.success("Task deleted"); } : undefined}
      onCancelTask={editorEntry ? () => { activateOwner(editorEntry); api.toggleCancel(editorEntry.task.id); setEditing(null); } : undefined}
    />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { ...mobileContentStyle, gap: 16 },
  limitSwitch: { flexDirection: "row", padding: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, gap: 4 },
  limitOption: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10 },
  taskHeading: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 6 },
  rank: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
