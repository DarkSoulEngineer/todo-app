import { Ionicons } from "@expo/vector-icons";
import { addDays, addMonths, format, isSameDay, isSameMonth, parseISO, startOfDay, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, InsightsPanel, OptionSheet, TaskCard, TaskEditor, TextEntrySheet, ThemeToggle } from "@/components/janus-board-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { useNow } from "@/hooks/use-now";
import { useTasksContext } from "@/providers/tasks-provider";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";
import { boardColor } from "@/lib/domain/boards";
import { SORT_OPTIONS } from "@/lib/domain/constants";
import { getTaskSectionId, isCustomSection } from "@/lib/domain/sections";
import { parseQuickAdd, quickAddToDraft } from "@/lib/features/quick-add";
import { exportWorkspace, exportWorkspaceCsv, pickWorkspaceFile } from "@/lib/data/transfer";
import { matchesQuery, sortTasks } from "@/lib/domain/tasks-selectors";
import type { BoardSection, SortKey, Task, TaskDraft, ViewMode } from "@/lib/domain/types";

export default function WorkspaceScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const api = useTasksContext();
  const { tasks, sections, boards, projects, isLoading, currentProjectId, currentProjectName } = api;
  const [mode, setMode] = useState<ViewMode>("board");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("manual");
  const [boardFilter, setBoardFilter] = useState("all");
  const [quickAdd, setQuickAdd] = useState("");
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [initialDueAt, setInitialDueAt] = useState<string | null>(null);
  const [taskAction, setTaskAction] = useState<Task | null>(null);
  const [dataMenu, setDataMenu] = useState(false);
  const [sortMenu, setSortMenu] = useState(false);
  const [sectionMenu, setSectionMenu] = useState<BoardSection | null>(null);
  const [renameSectionTarget, setRenameSectionTarget] = useState<BoardSection | null>(null);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(now));
  const [calendarDay, setCalendarDay] = useState<Date | null>(null);

  useEffect(() => {
    if (isLoading || !id) return;
    if (!projects.some((project) => project.id === id)) { router.replace("/"); return; }
    if (id !== currentProjectId) api.switchProject(id);
  }, [api, currentProjectId, id, isLoading, projects]);

  const visibleTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortTasks(tasks.filter((task) => (boardFilter === "all" || task.category === boardFilter) && matchesQuery(task, needle)), sort);
  }, [boardFilter, query, sort, tasks]);
  const activeCount = tasks.filter((task) => !task.completed && !task.canceled).length;
  const completedCount = tasks.filter((task) => task.completed).length;
  const addNewTask = (due?: string | null) => { setEditorTask(null); setInitialDueAt(due ?? null); setEditorVisible(true); };
  const saveTask = (draft: TaskDraft, sectionId: string | null) => {
    if (editorTask) { api.updateTask(editorTask.id, draft); if (sectionId !== editorTask.sectionId) api.setTaskSectionId(editorTask.id, sectionId); toast.success("Task updated"); }
    else { const task = api.addTask(draft); if (sectionId) api.setTaskSectionId(task.id, sectionId); toast.success("Task added", { description: draft.title }); }
    setEditorVisible(false); setEditorTask(null); setInitialDueAt(null);
  };
  const submitQuickAdd = () => { const value = quickAdd.trim(); if (!value) return; const draft = quickAddToDraft(parseQuickAdd(value, now, boards)); const task = api.addTask(draft); toast.success("Task added", { description: task.title }); setQuickAdd(""); };
  const openEditor = (task: Task) => { setEditorTask(task); setInitialDueAt(null); setEditorVisible(true); };
  const clearCompleted = () => { const count = api.clearCompleted(); toast.success(count ? `${count} completed ${count === 1 ? "task" : "tasks"} cleared` : "Nothing to clear"); };
  const importBoard = async () => { try { const result = await pickWorkspaceFile(); if (!result) return; const imported = api.importProject(result.name, result.workspace); toast.success("Board imported"); router.replace(`/board/${imported}`); } catch { toast.error("Could not import that file"); } };

  if (isLoading || !id || !projects.some((project) => project.id === id)) return <View style={[styles.loading, { backgroundColor: theme.colors.background }]}><Text style={{ color: theme.colors.mutedForeground }}>Loading your board…</Text></View>;
  const activeProject = projects.find((project) => project.id === id);
  const calendarTasks = calendarDay ? visibleTasks.filter((task) => task.dueAt && isSameDay(parseISO(task.dueAt), calendarDay)) : [];
  const dataOptions = [
    { label: "Load sample tasks", icon: "sparkles-outline" as const, onPress: () => { const before = api.snapshot(); api.loadSample(); toast.show("Sample workspace loaded", { action: { label: "Undo", onPress: () => api.restore(before) } }); } },
    { label: "Export JSON", icon: "share-outline" as const, onPress: () => { if (activeProject) void exportWorkspace(activeProject.workspace, activeProject.name); } },
    { label: "Export CSV", icon: "document-text-outline" as const, onPress: () => { if (activeProject) void exportWorkspaceCsv(activeProject.workspace, activeProject.name); } },
    { label: "Import board", icon: "cloud-upload-outline" as const, onPress: importBoard },
    { label: "Save version", icon: "bookmark-outline" as const, onPress: () => { api.createVersion(); toast.success("Version saved"); } },
    ...(api.versions.length ? [{ label: `Restore ${api.versions[0].label}`, icon: "return-down-back-outline" as const, onPress: () => { api.restoreVersion(api.versions[0].id); toast.success("Version restored"); } }] : []),
    ...(api.versions.length ? [{ label: `Delete ${api.versions[0].label}`, icon: "trash-outline" as const, destructive: true, onPress: () => { api.deleteVersion(api.versions[0].id); toast.success("Version deleted"); } }] : []),
    { label: "Clear completed", icon: "trash-outline" as const, onPress: clearCompleted },
  ];
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><IconButton icon="arrow-back" label="Back to boards" onPress={() => router.back()} /><View style={styles.headerTitle}><Text style={[styles.boardName, { color: theme.colors.foreground }]} numberOfLines={1}>{currentProjectName}</Text><Text style={[styles.summary, { color: theme.colors.mutedForeground }]}>{activeCount} active · {completedCount} done</Text></View><ThemeToggle /><IconButton icon="ellipsis-horizontal" label="Board data menu" onPress={() => setDataMenu(true)} /></View>
        <View style={[styles.stickyTools, { backgroundColor: theme.colors.background }]}><SegmentedControl options={[{ key: "board", label: "Board" }, { key: "list", label: "List" }, { key: "calendar", label: "Calendar" }, { key: "insights", label: "Insights" }]} value={mode} onChange={(value) => setMode(value as ViewMode)} /><View style={styles.searchRow}><View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={theme.colors.mutedForeground} /><TextInput value={query} onChangeText={setQuery} placeholder="Search tasks" placeholderTextColor={theme.colors.mutedForeground} accessibilityLabel="Search tasks" style={{ flex: 1, color: theme.colors.foreground, height: 44, fontSize: 14 }} />{query ? <IconButton size={36} icon="close-circle" label="Clear search" onPress={() => setQuery("")} /> : null}</View><IconButton icon="options-outline" label="Sort tasks" onPress={() => setSortMenu(true)} /></View>{mode !== "insights" ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 3 }}><FilterChip label="All boards" active={boardFilter === "all"} onPress={() => setBoardFilter("all")} />{boards.map((board) => { const tone = boardColor(board.color); return <FilterChip key={board.id} label={board.label} color={tone.dot} active={boardFilter === board.id} onPress={() => setBoardFilter(board.id)} />; })}</ScrollView> : null}</View>
        {mode !== "insights" ? <View style={styles.quickAdd}><View style={{ flex: 1 }}><Input value={quickAdd} onChangeText={setQuickAdd} onSubmitEditing={submitQuickAdd} placeholder="Add a task…" returnKeyType="done" /><Text style={[styles.quickHint, { color: theme.colors.mutedForeground }]}>Try tomorrow 5pm · !high · #work</Text></View><Button size="icon" accessibilityLabel="Add task" onPress={submitQuickAdd}><Ionicons name="add" size={22} color={theme.colors.primaryForeground} /></Button></View> : null}
        <View style={styles.surface}>{mode === "board" ? <BoardView tasks={visibleTasks} sections={sections} boards={boards} now={now} onTask={openEditor} onComplete={api.toggleComplete} onLongPress={setTaskAction} onAddTask={addNewTask} onSectionMenu={setSectionMenu} onAddSection={() => setAddSectionOpen(true)} /> : mode === "list" ? <ListView tasks={visibleTasks} sections={sections} boards={boards} now={now} onTask={openEditor} onComplete={api.toggleComplete} onLongPress={setTaskAction} onClearCompleted={clearCompleted} onAddTask={addNewTask} /> : mode === "calendar" ? <CalendarView month={calendarMonth} setMonth={setCalendarMonth} selectedDay={calendarDay} setSelectedDay={setCalendarDay} tasks={visibleTasks} onAddTask={addNewTask} now={now} /> : <InsightsPanel tasks={visibleTasks} boards={boards} now={now} />}</View>
      </ScrollView>
      <TaskEditor visible={editorVisible} task={editorTask} initialDueAt={initialDueAt} boards={boards} sections={sections} onClose={() => setEditorVisible(false)} onSave={saveTask} onDelete={editorTask ? () => { api.deleteTask(editorTask.id); setEditorVisible(false); toast.success("Task deleted"); } : undefined} onCancelTask={editorTask ? () => { api.toggleCancel(editorTask.id); setEditorVisible(false); } : undefined} />
      <TaskActions task={taskAction} sections={sections} onClose={() => setTaskAction(null)} onComplete={() => { if (taskAction) api.toggleComplete(taskAction.id); setTaskAction(null); }} onCancel={() => { if (taskAction) api.toggleCancel(taskAction.id); setTaskAction(null); }} onDelete={() => { if (taskAction) api.deleteTask(taskAction.id); setTaskAction(null); toast.success("Task deleted"); }} onMove={(sectionId) => { if (taskAction) api.assignTaskToSection(taskAction.id, sectionId); setTaskAction(null); }} />
      <OptionSheet visible={dataMenu} title="Board tools" options={dataOptions} onClose={() => setDataMenu(false)} />
      <OptionSheet visible={sortMenu} title="Sort tasks" options={SORT_OPTIONS.map((option) => ({ label: option.label, icon: sort === option.value ? "checkmark-circle" : "radio-button-off-outline", onPress: () => setSort(option.value) }))} onClose={() => setSortMenu(false)} />
      <OptionSheet visible={sectionMenu !== null} title={sectionMenu?.title ?? "Section"} options={sectionMenu ? [{ label: "Rename section", icon: "pencil-outline", onPress: () => setRenameSectionTarget(sectionMenu) }, { label: "Delete section", icon: "trash-outline", destructive: true, onPress: () => Alert.alert("Delete section?", "Tasks will return to their status section.", [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => api.deleteSection(sectionMenu.id) }]) }] : []} onClose={() => setSectionMenu(null)} />
      <TextEntrySheet visible={renameSectionTarget !== null} title="Rename section" initialValue={renameSectionTarget?.title ?? ""} placeholder="Section name" onClose={() => setRenameSectionTarget(null)} onSubmit={(value) => { if (renameSectionTarget) api.renameSection(renameSectionTarget.id, value); setRenameSectionTarget(null); }} />
      <Sheet visible={addSectionOpen} onClose={() => setAddSectionOpen(false)}><Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>Add a section</Text><Text style={[styles.sheetCopy, { color: theme.colors.mutedForeground }]}>Use sections to shape this board around your flow.</Text><Input autoFocus value={sectionTitle} onChangeText={setSectionTitle} placeholder="e.g. In progress" onSubmitEditing={() => { if (sectionTitle.trim()) { api.addSection(sectionTitle); setSectionTitle(""); setAddSectionOpen(false); } }} style={{ marginTop: 12 }} /><Button label="Add section" disabled={!sectionTitle.trim()} onPress={() => { api.addSection(sectionTitle); setSectionTitle(""); setAddSectionOpen(false); }} style={{ marginTop: 14 }} /></Sheet>
      {calendarDay ? <Sheet visible onClose={() => setCalendarDay(null)}><Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>{format(calendarDay, "EEEE, MMM d")}</Text>{calendarTasks.length ? calendarTasks.map((task) => <TaskCard key={task.id} task={task} boards={boards} now={now} onPress={() => openEditor(task)} onComplete={() => api.toggleComplete(task.id)} />) : <EmptyState icon="sunny-outline" title="A clear day" message="Nothing is due here yet." />}<Button variant="soft" label="Add task for this day" onPress={() => { const due = new Date(calendarDay); due.setHours(9, 0, 0, 0); setCalendarDay(null); addNewTask(due.toISOString()); }} style={{ marginTop: 6 }}><Ionicons name="add" size={18} color={theme.colors.primary} /><Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Add task for this day</Text></Button></Sheet> : null}
    </View>
  );
}

function FilterChip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) { const { theme } = useTheme(); return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.filterChip, { backgroundColor: active ? theme.colors.primarySoft : theme.colors.secondary, borderColor: active ? theme.colors.primary : theme.colors.border }]}>{color ? <View style={[styles.filterDot, { backgroundColor: color }]} /> : null}<Text style={{ color: active ? theme.colors.accentForeground : theme.colors.secondaryForeground, fontSize: 12, fontWeight: "700" }}>{label}</Text></Pressable>; }

function BoardView({ tasks, sections, boards, now, onTask, onComplete, onLongPress, onSectionMenu, onAddSection, onAddTask }: { tasks: Task[]; sections: BoardSection[]; boards: import("@/lib/domain/boards").Board[]; now: Date; onTask: (task: Task) => void; onComplete: (id: string) => void; onLongPress: (task: Task) => void; onSectionMenu: (section: BoardSection) => void; onAddSection: () => void; onAddTask: (due?: string | null) => void }) {
  const { theme } = useTheme();
  const unassigned = tasks.filter((task) => !getTaskSectionId(task, sections, now));
  const columns = [...sections.filter((section) => !section.hidden), ...(unassigned.length ? [{ id: "__unsorted", title: "Unsorted" } as BoardSection] : [])];
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardScroll}>{columns.map((section) => { const synthetic = section.id === "__unsorted"; const columnTasks = synthetic ? unassigned : tasks.filter((task) => getTaskSectionId(task, sections, now) === section.id); return <View key={section.id} style={[styles.column, { backgroundColor: theme.colors.backgroundAlt, borderColor: theme.colors.border }]}><View style={styles.columnHeader}><View style={{ flex: 1 }}><Text style={[styles.columnTitle, { color: theme.colors.foreground }]} numberOfLines={1}>{section.title}</Text><Text style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>{columnTasks.length} {columnTasks.length === 1 ? "task" : "tasks"}</Text></View>{isCustomSection(section) && !synthetic ? <IconButton size={40} icon="ellipsis-horizontal" label={`Actions for ${section.title}`} onPress={() => onSectionMenu(section)} /> : null}</View>{columnTasks.map((task) => <TaskCard key={task.id} task={task} boards={boards} now={now} onPress={() => onTask(task)} onComplete={() => onComplete(task.id)} onLongPress={() => onLongPress(task)} />)}<Button variant="ghost" label="Add task" onPress={() => onAddTask()} style={{ alignSelf: "flex-start" }}><Ionicons name="add" size={18} color={theme.colors.primary} /><Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Add task</Text></Button></View>; })}<View style={[styles.addColumn, { borderColor: theme.colors.borderStrong }]}><Button variant="soft" label="Add section" onPress={onAddSection}><Ionicons name="add" size={18} color={theme.colors.primary} /><Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Add section</Text></Button></View>{columns.length === 0 ? <EmptyState icon="grid-outline" title="Shape your board" message="Add your first section, then move tasks into it." actionLabel="Add section" onAction={onAddSection} /> : null}</ScrollView>;
}

function ListView({ tasks, sections, boards, now, onTask, onComplete, onLongPress, onClearCompleted, onAddTask }: { tasks: Task[]; sections: BoardSection[]; boards: import("@/lib/domain/boards").Board[]; now: Date; onTask: (task: Task) => void; onComplete: (id: string) => void; onLongPress: (task: Task) => void; onClearCompleted: () => void; onAddTask: () => void }) {
  const { theme } = useTheme();
  const groups = sections.map((section) => ({ section, tasks: tasks.filter((task) => getTaskSectionId(task, sections, now) === section.id) })).filter((group) => group.tasks.length > 0);
  const grouped = new Set(groups.flatMap((group) => group.tasks.map((task) => task.id)));
  const ungrouped = tasks.filter((task) => !grouped.has(task.id));
  return <View>{groups.map((group) => <View key={group.section.id} style={styles.listGroup}><Text style={[styles.groupTitle, { color: theme.colors.foreground }]}>{group.section.title}<Text style={{ color: theme.colors.mutedForeground }}>  {group.tasks.length}</Text></Text>{group.tasks.map((task) => <TaskCard key={task.id} task={task} boards={boards} now={now} onPress={() => onTask(task)} onComplete={() => onComplete(task.id)} onLongPress={() => onLongPress(task)} />)}</View>)}{ungrouped.length ? <View style={styles.listGroup}><Text style={[styles.groupTitle, { color: theme.colors.foreground }]}>Unsorted <Text style={{ color: theme.colors.mutedForeground }}> {ungrouped.length}</Text></Text>{ungrouped.map((task) => <TaskCard key={task.id} task={task} boards={boards} now={now} onPress={() => onTask(task)} onComplete={() => onComplete(task.id)} onLongPress={() => onLongPress(task)} />)}</View> : null}{tasks.filter((task) => task.completed).length ? <Button variant="secondary" label="Clear completed" onPress={onClearCompleted} /> : null}{tasks.length === 0 ? <EmptyState icon="checkmark-done-outline" title="A clean slate" message="Add a task above and make today a little lighter." actionLabel="Create a task" onAction={onAddTask} /> : null}</View>;
}

function CalendarView({ month, setMonth, selectedDay, setSelectedDay, tasks, onAddTask, now }: { month: Date; setMonth: (date: Date) => void; selectedDay: Date | null; setSelectedDay: (date: Date | null) => void; tasks: Task[]; onAddTask: (due?: string | null) => void; now: Date }) {
  const { theme } = useTheme();
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }, (_, index) => addDays(first, index));
  return <View><View style={styles.monthHeader}><IconButton icon="chevron-back" label="Previous month" onPress={() => setMonth(subMonths(month, 1))} /><Text style={[styles.monthTitle, { color: theme.colors.foreground }]}>{format(month, "MMMM yyyy")}</Text><IconButton icon="chevron-forward" label="Next month" onPress={() => setMonth(addMonths(month, 1))} /></View><Button variant="soft" size="sm" label="Today" onPress={() => setMonth(startOfMonth(now))} style={{ alignSelf: "flex-end", marginBottom: 10 }} /><View style={styles.weekRow}>{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <Text key={`${day}-${index}`} style={[styles.weekLabel, { color: theme.colors.mutedForeground }]}>{day}</Text>)}</View><View style={styles.calendarGrid}>{days.map((day) => { const count = tasks.filter((task) => task.dueAt && isSameDay(parseISO(task.dueAt), day)).length; const selected = selectedDay ? isSameDay(selectedDay, day) : false; return <Pressable key={day.toISOString()} accessibilityRole="button" accessibilityLabel={`Open ${format(day, "MMMM d")}`} onPress={() => setSelectedDay(day)} style={[styles.dayCell, { borderColor: theme.colors.border }, !isSameMonth(day, month) && { opacity: 0.35 }, selected && { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}><Text style={{ color: isSameDay(day, now) ? theme.colors.primary : theme.colors.foreground, fontSize: 13, fontWeight: isSameDay(day, now) ? "800" : "500" }}>{format(day, "d")}</Text><View style={styles.dayDots}>{Array.from({ length: Math.min(3, count) }, (_, index) => <View key={index} style={[styles.dayDot, { backgroundColor: theme.colors.primary }]} />)}</View></Pressable>; })}</View><View style={styles.calendarFooter}><Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>Plan a day</Text><Text style={{ color: theme.colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>Tap any date to see what is due, or start a task at 9:00 AM.</Text><Button label="Add for today" onPress={() => onAddTask(new Date(startOfDay(now).setHours(9, 0, 0, 0)).toISOString())} style={{ marginTop: 12 }} /></View></View>;
}

function TaskActions({ task, sections, onClose, onComplete, onCancel, onDelete, onMove }: { task: Task | null; sections: BoardSection[]; onClose: () => void; onComplete: () => void; onCancel: () => void; onDelete: () => void; onMove: (sectionId: string) => void }) { return <OptionSheet visible={task !== null} title={task?.title ?? "Task actions"} options={[{ label: task?.completed ? "Mark incomplete" : "Complete task", icon: "checkmark-circle-outline", onPress: onComplete }, { label: task?.canceled ? "Restore task" : "Cancel task", icon: "close-circle-outline", onPress: onCancel }, ...sections.map((section) => ({ label: `Move to ${section.title}`, icon: "arrow-forward-outline" as const, onPress: () => onMove(section.id) })), { label: "Delete task", icon: "trash-outline", destructive: true, onPress: onDelete }]} onClose={onClose} />; }

const styles = StyleSheet.create({ root: { flex: 1 }, loading: { flex: 1, alignItems: "center", justifyContent: "center" }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 2 }, headerTitle: { flex: 1, marginHorizontal: 4 }, boardName: { fontSize: 17, fontWeight: "800" }, summary: { fontSize: 11, marginTop: 2 }, stickyTools: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "transparent" }, searchRow: { flexDirection: "row", alignItems: "center", gap: 7 }, searchBox: { flex: 1, height: 44, flexDirection: "row", alignItems: "center", paddingLeft: 12, borderRadius: 14, backgroundColor: "transparent", borderWidth: StyleSheet.hairlineWidth, borderColor: "#00000020" }, filterChip: { minHeight: 44, paddingHorizontal: 11, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 6 }, filterDot: { width: 7, height: 7, borderRadius: 4 }, quickAdd: { paddingHorizontal: 16, paddingTop: 14, flexDirection: "row", gap: 8 }, quickHint: { fontSize: 11, marginTop: 5, marginLeft: 4 }, surface: { padding: 16, paddingTop: 18 }, boardScroll: { gap: 12, paddingRight: 16, paddingBottom: 12 }, column: { width: 292, minHeight: 280, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 12 }, columnHeader: { flexDirection: "row", alignItems: "center", minHeight: 48, marginBottom: 8 }, columnTitle: { fontSize: 16, fontWeight: "800" }, addColumn: { width: 180, minHeight: 110, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }, listGroup: { marginBottom: 18 }, groupTitle: { fontSize: 17, fontWeight: "800", marginBottom: 9 }, monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, monthTitle: { fontSize: 19, fontWeight: "800" }, weekRow: { flexDirection: "row", marginBottom: 4 }, weekLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "800" }, calendarGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: "#00000015" }, dayCell: { width: `${100 / 7}%`, height: 58, alignItems: "center", justifyContent: "center", borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, gap: 7 }, dayDots: { flexDirection: "row", gap: 3, height: 5 }, dayDot: { width: 5, height: 5, borderRadius: 3 }, calendarFooter: { marginTop: 22, padding: 16, borderRadius: 19, backgroundColor: "#00000008" }, sectionTitle: { fontSize: 18, fontWeight: "800" }, sheetTitle: { fontSize: 21, fontWeight: "800" }, sheetCopy: { fontSize: 14, lineHeight: 20, marginTop: 5 },
});
