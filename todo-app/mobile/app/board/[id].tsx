import { Ionicons } from "@expo/vector-icons";
import { addDays, addMonths, addWeeks, format, isSameDay, isSameMonth, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, InsightsPanel, OptionSheet, TaskCard, TaskEditor, TextEntrySheet } from "@/components/janus-board-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { useNow } from "@/hooks/use-now";
import { useTasksContext } from "@/providers/tasks-provider";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";
import { boardColor } from "@/lib/domain/boards";
import { BulkSelectionToolbar } from "@/components/board/bulk-selection-toolbar";
import { MobileTaskColumns } from "@/components/board/mobile-task-columns";
import { MobileBoardRibbon } from "@/components/board/mobile-board-ribbon";
import { PRIORITY_META, PRIORITY_ORDER, SORT_OPTIONS } from "@/lib/domain/constants";
import { deriveStatus, STATUS_LABELS } from "@/lib/domain/status";
import { getTaskSectionId, isCustomSection } from "@/lib/domain/sections";
import { parseQuickAdd, quickAddToDraft } from "@/lib/features/quick-add";
import { exportWorkspace, exportWorkspaceCsv, pickWorkspaceFile } from "@/lib/data/transfer";
import { matchesQuery, sortTasks } from "@/lib/domain/tasks-selectors";
import { rescheduleToDay } from "@/lib/utils/datetime";
import type { BoardSection, Priority, SortKey, Task, TaskDraft, ViewMode } from "@/lib/domain/types";

const UNSORTED_SECTION_ID = "__unsorted";

export default function WorkspaceScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const api = useTasksContext();
  const { tasks, sections, boards, projects, isLoading, currentProjectId, switchProject: switchProjectApi } = api;
  const requestedProjectId = useRef<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("board");
  const [query, setQuery] = useState("");
  const [compactCards, setCompactCards] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showCheckboxes, setShowCheckboxes] = useState(true);
  const [showMoveArrows, setShowMoveArrows] = useState(false);
  const [focusedColumn, setFocusedColumn] = useState(false);
  const [sort, setSort] = useState<SortKey>("manual");
  const [boardFilter, setBoardFilter] = useState("all");
  const [filterMenu, setFilterMenu] = useState(false);
  const [quickAdd, setQuickAdd] = useState("");
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [initialDueAt, setInitialDueAt] = useState<string | null>(null);
  const [taskAction, setTaskAction] = useState<Task | null>(null);
  const [sortMenu, setSortMenu] = useState(false);
  const [sectionMenu, setSectionMenu] = useState<BoardSection | null>(null);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [renameSectionTarget, setRenameSectionTarget] = useState<BoardSection | null>(null);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [initialSectionId, setInitialSectionId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => now);
  const [calendarDay, setCalendarDay] = useState<Date | null>(null);
  const [calendarActionTask, setCalendarActionTask] = useState<Task | null>(null);
  const [calendarPickerTask, setCalendarPickerTask] = useState<Task | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [bulkSectionMenu, setBulkSectionMenu] = useState(false);
  const [bulkPriorityMenu, setBulkPriorityMenu] = useState(false);

  const projectIds = useMemo(() => projects.map((project) => project.id).join("\0"), [projects]);

  useEffect(() => {
    if (isLoading || !id) return;
    if (!projectIds.split("\0").includes(id)) {
      if (requestedProjectId.current !== id) {
        requestedProjectId.current = id;
        router.replace("/");
      }
      return;
    }
    if (id === currentProjectId) {
      requestedProjectId.current = null;
      return;
    }
    const routedProject = projects.find((project) => project.id === id);
    if (!routedProject || routedProject.closedAt) return;
    if (requestedProjectId.current === id) return;
    requestedProjectId.current = id;
    switchProjectApi(id);
  }, [currentProjectId, id, isLoading, projectIds, projects, switchProjectApi]);

  const visibleTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortTasks(tasks.filter((task) => (boardFilter === "all" || task.category === boardFilter) && matchesQuery(task, needle)), sort);
  }, [boardFilter, query, sort, tasks]);
  const renderedBoardTasks = useMemo(() => {
    const hiddenSectionIds = new Set(sections.filter((section) => section.hidden).map((section) => section.id));
    return visibleTasks.filter((task) => {
      const sectionId = getTaskSectionId(task, sections, now);
      // BoardView renders tasks without a resolved section in Unsorted, while
      // tasks resolved to hidden sections have no rendered column.
      return sectionId === undefined || !hiddenSectionIds.has(sectionId);
    });
  }, [now, sections, visibleTasks]);
  const selectedTasks = useMemo(() => renderedBoardTasks.filter((task) => selectedTaskIds.has(task.id)), [renderedBoardTasks, selectedTaskIds]);
  const allVisibleSelected = renderedBoardTasks.length > 0 && renderedBoardTasks.every((task) => selectedTaskIds.has(task.id));
  const enterSelectionMode = () => { setMode("board"); setSelectionMode(true); setSelectedTaskIds(new Set()); };
  const exitSelectionMode = () => { setSelectionMode(false); setSelectedTaskIds(new Set()); };
  const toggleSelectedTask = (taskId: string) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };
  const selectAllVisible = () => setSelectedTaskIds(new Set(renderedBoardTasks.map((task) => task.id)));
  const runBulkStatus = (status: "completed" | "canceled" | "open", message: string) => {
    const eligibleTasks = selectedTasks.filter((task) => {
      if (status === "open") return task.completed || task.canceled;
      return !task.completed && !task.canceled;
    });
    if (!eligibleTasks.length) return;
    const before = api.snapshot();
    eligibleTasks.forEach((task) => {
      if (status === "completed") api.toggleComplete(task.id);
      else if (status === "canceled") api.toggleCancel(task.id);
      else if (task.completed) api.toggleComplete(task.id);
      else api.toggleCancel(task.id);
    });
    toast.success(message, { action: { label: "Undo", onPress: () => api.restore(before) } });
  };
  const runBulkPriority = (priority: Priority) => {
    if (!selectedTasks.length) return;
    const before = api.snapshot();
    selectedTasks.forEach((task) => api.patchTask(task.id, { priority }));
    toast.success(`Set priority to ${PRIORITY_META[priority].label}`, { action: { label: "Undo", onPress: () => api.restore(before) } });
  };
  const runBulkMove = (sectionId: string | null) => {
    if (!selectedTasks.length) return;
    const target = sections.find((section) => section.id === sectionId);
    if (sectionId !== null && !target) return;
    const before = api.snapshot();
    selectedTasks.forEach((task) => {
      if (sectionId === null) api.setTaskSectionId(task.id, null);
      else api.assignTaskToSection(task.id, sectionId);
    });
    toast.success(`Moved ${selectedTasks.length} ${selectedTasks.length === 1 ? "task" : "tasks"} to ${target?.title ?? "Unsorted"}`, { action: { label: "Undo", onPress: () => api.restore(before) } });
  };
  const deleteSelected = () => {
    if (!selectedTasks.length) return;
    const before = api.snapshot();
    selectedTasks.forEach((task) => api.deleteTask(task.id));
    exitSelectionMode();
    toast.success(`${selectedTasks.length} ${selectedTasks.length === 1 ? "task" : "tasks"} deleted`, { action: { label: "Undo", onPress: () => api.restore(before) } });
  };
  const addNewTask = (due?: string | null, sectionId?: string | null) => { setEditorTask(null); setInitialDueAt(due ?? null); setInitialSectionId(sectionId ?? null); setEditorVisible(true); };
  const saveTaskSection = (taskId: string, sectionId: string | null) => {
    if (sectionId === null || sectionId === UNSORTED_SECTION_ID) {
      api.setTaskSectionId(taskId, null);
      return;
    }
    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;
    if (isCustomSection(section)) api.setTaskSectionId(taskId, section.id);
    else api.assignTaskToSection(taskId, section.id);
  };
  const saveTask = (draft: TaskDraft, sectionId: string | null) => {
    if (editorTask) { api.updateTask(editorTask.id, draft); const currentSectionId = getTaskSectionId(editorTask, sections, now) ?? null; if (sectionId !== currentSectionId) saveTaskSection(editorTask.id, sectionId); toast.success("Task updated"); }
    else { const task = api.addTask(draft); const targetSectionId = sectionId ?? initialSectionId; if (targetSectionId) saveTaskSection(task.id, targetSectionId); toast.success("Task added", { description: draft.title }); }
    setEditorVisible(false); setEditorTask(null); setInitialDueAt(null); setInitialSectionId(null);
  };
  const submitQuickAdd = () => { const value = quickAdd.trim(); if (!value) return; const draft = quickAddToDraft(parseQuickAdd(value, now, boards)); const task = api.addTask(draft); toast.success("Task added", { description: task.title }); setQuickAdd(""); };
  const openEditor = (task: Task) => { setEditorTask(task); setInitialDueAt(null); setEditorVisible(true); };
  const rescheduleTask = (task: Task, day: Date) => { api.setTaskDueAt(task.id, rescheduleToDay(day, task.dueAt)); toast.success("Rescheduled", { description: format(day, "EEE, MMM d") }); };
  const clearTaskDueDate = (task: Task) => { api.setTaskDueAt(task.id, null); toast.success("Due date removed", { description: task.title }); };
  const clearCompleted = () => {
    const before = api.snapshot();
    const count = api.clearCompleted();
    if (!count) {
      toast.success("Nothing to clear");
      return;
    }
    toast.success(`${count} completed ${count === 1 ? "task" : "tasks"} cleared`, {
      action: { label: "Undo", onPress: () => api.restore(before) },
    });
  };
  const importBoard = async () => { try { const result = await pickWorkspaceFile(); if (!result) return; const imported = api.importProject(result.name, result.workspace); toast.success("Board imported"); router.replace(`/board/${imported}`); } catch { toast.error("Could not import that file"); } };
  const switchProject = (projectId: string) => { setProjectSwitcherOpen(false); if (projectId !== id) router.replace(`/board/${projectId}`); };
  const toggleSectionVisibility = (section: BoardSection) => {
    const before = api.snapshot();
    api.toggleSectionHidden(section.id);
    toast.success(section.hidden ? `Showing “${section.title}”` : `Hid “${section.title}”`, {
      action: { label: "Undo", onPress: () => api.restore(before) },
    });
  };
  const moveSection = (section: BoardSection, direction: "left" | "right") => {
    const from = sections.findIndex((item) => item.id === section.id);
    const to = from + (direction === "left" ? -1 : 1);
    if (from < 0 || to < 0 || to >= sections.length) return;
    const orderedIds = sections.map((item) => item.id);
    [orderedIds[from], orderedIds[to]] = [orderedIds[to], orderedIds[from]];
    const before = api.snapshot();
    api.reorderSections(orderedIds);
    toast.success(`Moved “${section.title}” ${direction}`, {
      action: { label: "Undo", onPress: () => api.restore(before) },
    });
  };
  const moveTaskToSection = (task: Task, sectionId: string | null) => {
    const target = sectionId === null ? null : sections.find((section) => section.id === sectionId);
    if (sectionId !== null && !target) return;
    if (sectionId === null && task.sectionId === null) return;
    if (sectionId !== null && getTaskSectionId(task, sections, now) === sectionId) return;
    const before = api.snapshot();
    if (sectionId === null) api.setTaskSectionId(task.id, null);
    else if (target && isCustomSection(target)) api.setTaskSectionId(task.id, sectionId);
    else if (target) api.assignTaskToSection(task.id, sectionId);
    toast.success(`Moved to ${target?.title ?? "Unsorted"}`, {
      action: { label: "Undo", onPress: () => api.restore(before) },
    });
  };
  const reorderTask = (task: Task, direction: "up" | "down") => {
    const sectionId = getTaskSectionId(task, sections, now);
    const siblings = visibleTasks.filter((item) => getTaskSectionId(item, sections, now) === sectionId);
    const from = siblings.findIndex((item) => item.id === task.id);
    const to = from + (direction === "up" ? -1 : 1);
    if (from < 0 || to < 0 || to >= siblings.length) return;
    const orderedIds = siblings.map((item) => item.id);
    [orderedIds[from], orderedIds[to]] = [orderedIds[to], orderedIds[from]];
    const before = api.snapshot();
    const previousSort = sort;
    api.reorderTasks(orderedIds);
    if (previousSort !== "manual") setSort("manual");
    toast.success(`Moved task ${direction}`, {
      description: previousSort === "manual" ? undefined : "Switched to manual order",
      action: { label: "Undo", onPress: () => { api.restore(before); setSort(previousSort); } },
    });
  };

  const currentProject = projects.find((project) => project.id === id);
  if (isLoading || !id || !currentProject) return <View style={[styles.loading, { backgroundColor: theme.colors.background }]}><ActivityIndicator color={theme.colors.primary} /><Text style={{ color: theme.colors.mutedForeground }}>Loading your board…</Text></View>;
  if (currentProject.closedAt) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, backgroundColor: theme.colors.background }}>
    <Ionicons name="archive-outline" size={42} color={theme.colors.mutedForeground} />
    <Text accessibilityRole="header" style={{ color: theme.colors.foreground, fontSize: 22, fontWeight: "700", marginTop: 14 }}>Board closed</Text>
    <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, maxWidth: 360 }}>“{currentProject.name}” is closed. Reopen it to view and edit its tasks.</Text>
    <Button label="Reopen board" onPress={() => { if (api.reopenProject(currentProject.id)) toast.success("Board reopened"); }} style={{ marginTop: 22, alignSelf: "stretch", maxWidth: 320 }} />
    <Button variant="outline" label="Back to boards" onPress={() => router.replace("/")} style={{ marginTop: 10, alignSelf: "stretch", maxWidth: 320 }} />
  </View>;
  const activeProject = currentProject;
  // `projects` is the persisted registry projection and may lag one render
  // behind the live task state. Exports must include the edits visible on this
  // screen, not only the last registry snapshot.
  const liveWorkspace = { tasks, sections, boards };
  const hasRefinements = query.trim().length > 0 || boardFilter !== "all";
  const projectOptions = projects.filter((project) => !project.closedAt).map((project) => ({ label: project.name, icon: project.id === id ? "checkmark-circle" as const : "radio-button-off-outline" as const, onPress: () => switchProject(project.id) }));
  const closeBoard = () => {
    const projectId = activeProject.id;
    if (!api.closeProject(projectId)) return;
    toast.show("Board closed", {
      description: "Reopen it anytime from Closed boards.",
      action: { label: "Undo", onPress: () => api.reopenProject(projectId) },
    });
    router.replace("/");
  };
  const calendarTasks = calendarDay ? visibleTasks.filter((task) => task.dueAt && isSameDay(parseISO(task.dueAt), calendarDay)) : [];
  const actionsContent = <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.optionTools}>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="sparkles-outline" label="Load sample" onPress={() => { const before = api.snapshot(); api.loadSample(); toast.show("Sample workspace loaded", { action: { label: "Undo", onPress: () => api.restore(before) } }); }} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>CREATE</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="share-outline" label="Export JSON" onPress={() => { if (activeProject) void exportWorkspace(liveWorkspace, activeProject.name); }} /><OptionTool icon="document-text-outline" label="Export CSV" onPress={() => { if (activeProject) void exportWorkspaceCsv(liveWorkspace, activeProject.name); }} /><OptionTool icon="cloud-upload-outline" label="Import board" onPress={importBoard} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>DATA</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="bookmark-outline" label="Save version" onPress={() => { api.createVersion(); toast.success("Version saved"); }} />{api.versions.length ? <OptionTool icon="return-down-back-outline" label={`Restore ${api.versions[0].label}`} onPress={() => { api.restoreVersion(api.versions[0].id); toast.success("Version restored"); }} /> : null}{api.versions.length ? <OptionTool icon="trash-outline" label={`Delete ${api.versions[0].label}`} tone="danger" onPress={() => { api.deleteVersion(api.versions[0].id); toast.success("Version deleted"); }} /> : null}</View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>VERSIONS</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="checkmark-done-outline" label="Clear done" onPress={clearCompleted} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>TIDY UP</Text></View>
    <View style={styles.optionToolGroup}><View style={styles.optionToolButtons}><OptionTool icon="swap-horizontal-outline" label="Switch board" onPress={() => setProjectSwitcherOpen(true)} /><OptionTool icon="archive-outline" label="Close board" onPress={closeBoard} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>BOARD</Text></View>
  </ScrollView>;
  const activeFilterBoard = boards.find((board) => board.id === boardFilter);
  const filterOptions = [{ label: "All boards", icon: boardFilter === "all" ? "checkmark-circle" as const : "radio-button-off-outline" as const, onPress: () => { setBoardFilter("all"); setSelectedTaskIds(new Set()); } }, ...boards.map((board) => ({ label: board.label, icon: boardFilter === board.id ? "checkmark-circle" as const : "radio-button-off-outline" as const, onPress: () => { setBoardFilter(board.id); setSelectedTaskIds(new Set()); } }))];
  const filtersContent = <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.optionTools}>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="swap-vertical-outline" label="Sort" onPress={() => setSortMenu(true)} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>SORT</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionActionRow}><Pressable accessibilityRole="button" accessibilityLabel={`Filter board: ${activeFilterBoard?.label ?? "All boards"}`} accessibilityHint="Opens a dropdown of boards to filter by." onPress={() => setFilterMenu(true)} style={[styles.optionDropdown, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}>{activeFilterBoard ? <View style={[styles.optionToolDot, { backgroundColor: boardColor(activeFilterBoard.color).dot }]} /> : <Ionicons name="grid-outline" size={15} color={theme.colors.mutedForeground} />}<Text numberOfLines={1} style={[styles.optionDropdownLabel, { color: theme.colors.foreground }]}>{activeFilterBoard?.label ?? "All boards"}</Text><Ionicons name="chevron-down" size={15} color={theme.colors.mutedForeground} /></Pressable></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>FILTER</Text></View>
    <View style={[styles.optionToolGroup, styles.optionActionGroup, { borderColor: theme.colors.border }]}><View style={styles.optionActionRow}><Input value={quickAdd} onChangeText={setQuickAdd} onSubmitEditing={submitQuickAdd} placeholder="Quick add: tomorrow · !high" style={styles.optionInput} /><Button size="sm" label="Add" onPress={submitQuickAdd} disabled={!quickAdd.trim()} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>ACTIONS</Text></View>
  </ScrollView>;
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ThemeAtmosphere />
      <View style={{ flex: 1, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}>
        <MobileBoardRibbon selection={selectionMode ? <BulkSelectionToolbar selectedCount={selectedTasks.length} allSelected={allVisibleSelected} onSelectAll={selectAllVisible} onClear={() => setSelectedTaskIds(new Set())} onComplete={() => runBulkStatus("completed", "Tasks completed")} onCancel={() => runBulkStatus("canceled", "Tasks canceled")} onRestore={() => runBulkStatus("open", "Tasks restored")} onDelete={deleteSelected} onMove={() => setBulkSectionMenu(true)} onPriority={() => setBulkPriorityMenu(true)} onClose={exitSelectionMode} /> : null} selecting={selectionMode} onSelect={enterSelectionMode} onDeselect={exitSelectionMode} filters={filtersContent} mode={mode} onMode={(value) => { if (value !== "board" && selectionMode) exitSelectionMode(); setMode(value); }} query={query} onQuery={(value) => { setQuery(value); setSelectedTaskIds(new Set()); }} onBoards={() => router.replace("/")} onSwitchBoard={() => setProjectSwitcherOpen(true)} onNewTask={() => addNewTask()} onSample={() => { const before = api.snapshot(); api.loadSample(); toast.show("Sample workspace loaded", { action: { label: "Undo", onPress: () => api.restore(before) } }); }} onAddSection={() => setAddSectionOpen(true)} zoom={zoom} onZoom={(next) => setZoom(Math.min(1.3, Math.max(0.7, Math.round(next * 10) / 10)))} compact={compactCards} onCompact={() => setCompactCards(!compactCards)} showCheckboxes={showCheckboxes} onShowCheckboxes={() => setShowCheckboxes(!showCheckboxes)} showMoveArrows={showMoveArrows} onShowMoveArrows={() => setShowMoveArrows(!showMoveArrows)} focused={focusedColumn} onFocused={() => setFocusedColumn(!focusedColumn)}>
          {actionsContent}
        </MobileBoardRibbon>
        {mode === "board" ? <View style={{ flex: 1, minHeight: 0 }}>
          {hasRefinements && visibleTasks.length === 0 ? <ScrollView contentContainerStyle={[styles.surface, { paddingBottom: 76 }]}><WorkspaceEmptyState hasRefinements onCreate={() => addNewTask()} onClear={() => { setQuery(""); setBoardFilter("all"); setSelectedTaskIds(new Set()); }} /></ScrollView> : <MobileTaskColumns key={id} tasks={visibleTasks} sections={sections} now={now} compact={compactCards} zoom={zoom} showCheckboxes={showCheckboxes} showMoveArrows={showMoveArrows} focused={focusedColumn} hiddenSections={sections.filter((section) => section.hidden)} selectionMode={selectionMode} selectedTaskIds={selectedTaskIds} onToggleSelect={toggleSelectedTask} onShowSection={toggleSectionVisibility} onTask={openEditor} onComplete={api.toggleComplete} onLongPress={setTaskAction} onMove={moveTaskToSection} onToggleSubtask={api.toggleSubtask} onAddTask={(sectionId) => addNewTask(null, sectionId)} onSectionMenu={setSectionMenu} onAddSection={() => setAddSectionOpen(true)} />}
        </View> : <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.surface, { paddingBottom: 76 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {mode === "list" ? <ListView tasks={visibleTasks} boards={boards} now={now} hasRefinements={hasRefinements} onTask={openEditor} onClear={() => { setQuery(""); setBoardFilter("all"); }} /> : mode === "calendar" ? <CalendarView month={calendarMonth} setMonth={setCalendarMonth} selectedDay={calendarDay} setSelectedDay={setCalendarDay} tasks={visibleTasks} onAddTask={addNewTask} onTask={openEditor} onTaskAction={setCalendarActionTask} now={now} /> : <InsightsPanel tasks={tasks} boards={boards} now={now} />}
        </ScrollView>}
      </View>
       <TaskEditor visible={editorVisible} task={editorTask} initialDueAt={initialDueAt} boards={boards} sections={sections} onClose={() => setEditorVisible(false)} onSave={saveTask} onDelete={editorTask ? () => { const before = api.snapshot(); api.deleteTask(editorTask.id); setEditorVisible(false); toast.success("Task deleted", { action: { label: "Undo", onPress: () => api.restore(before) } }); } : undefined} onCancelTask={editorTask ? () => { api.toggleCancel(editorTask.id); setEditorVisible(false); } : undefined} />
       <CalendarTaskActions task={calendarActionTask} now={now} onClose={() => setCalendarActionTask(null)} onChooseDate={() => { if (calendarActionTask) setCalendarPickerTask(calendarActionTask); setCalendarActionTask(null); }} onToday={() => { if (calendarActionTask) rescheduleTask(calendarActionTask, startOfDay(now)); setCalendarActionTask(null); }} onTomorrow={() => { if (calendarActionTask) rescheduleTask(calendarActionTask, addDays(startOfDay(now), 1)); setCalendarActionTask(null); }} onClearDue={() => { if (calendarActionTask) clearTaskDueDate(calendarActionTask); setCalendarActionTask(null); }} />
       {calendarPickerTask ? <DateTimePicker value={calendarPickerTask.dueAt ? parseISO(calendarPickerTask.dueAt) : now} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, selected) => { setCalendarPickerTask(null); if (selected) rescheduleTask(calendarPickerTask, selected); }} /> : null}
       <TaskActions task={taskAction} tasks={visibleTasks} sections={sections} now={now} onClose={() => setTaskAction(null)} onComplete={() => { if (taskAction) api.toggleComplete(taskAction.id); setTaskAction(null); }} onCancel={() => { if (taskAction) api.toggleCancel(taskAction.id); setTaskAction(null); }} onDelete={() => { if (taskAction) { const before = api.snapshot(); api.deleteTask(taskAction.id); setTaskAction(null); toast.success("Task deleted", { action: { label: "Undo", onPress: () => api.restore(before) } }); } }} onMove={(sectionId) => { if (taskAction) moveTaskToSection(taskAction, sectionId); setTaskAction(null); }} onMoveUp={() => { if (taskAction) reorderTask(taskAction, "up"); setTaskAction(null); }} onMoveDown={() => { if (taskAction) reorderTask(taskAction, "down"); setTaskAction(null); }} />
       <OptionSheet visible={projectSwitcherOpen} title="Switch board" options={projectOptions} onClose={() => setProjectSwitcherOpen(false)} />
      <OptionSheet visible={filterMenu} title="Filter by board" options={filterOptions} onClose={() => setFilterMenu(false)} />
       <OptionSheet visible={sortMenu} title="Sort tasks" options={SORT_OPTIONS.map((option) => ({ label: option.label, icon: sort === option.value ? "checkmark-circle" : "radio-button-off-outline", onPress: () => setSort(option.value) }))} onClose={() => setSortMenu(false)} />
        <OptionSheet visible={bulkSectionMenu} title="Move selected tasks" options={[{ label: "Move to Unsorted", icon: "file-tray-outline" as const, onPress: () => runBulkMove(null) }, ...sections.map((section) => ({ label: `Move to ${section.title}`, icon: "arrow-forward-outline" as const, onPress: () => runBulkMove(section.id) }))]} onClose={() => setBulkSectionMenu(false)} />
       <OptionSheet visible={bulkPriorityMenu} title="Set selected priority" options={PRIORITY_ORDER.map((priority) => ({ label: PRIORITY_META[priority].label, icon: "flag-outline" as const, onPress: () => runBulkPriority(priority) }))} onClose={() => setBulkPriorityMenu(false)} />
       <OptionSheet visible={sectionMenu !== null} title={sectionMenu?.title ?? "Section"} options={sectionMenu ? [
         ...(isCustomSection(sectionMenu) ? [{ label: "Rename section", icon: "pencil-outline" as const, onPress: () => setRenameSectionTarget(sectionMenu) }] : []),
         { label: sectionMenu.hidden ? "Show section" : "Hide section", icon: sectionMenu.hidden ? "eye-outline" as const : "eye-off-outline" as const, onPress: () => toggleSectionVisibility(sectionMenu) },
         ...(sections.findIndex((section) => section.id === sectionMenu.id) > 0 ? [{ label: "Move section left", icon: "arrow-back-outline" as const, onPress: () => moveSection(sectionMenu, "left") }] : []),
         ...(sections.findIndex((section) => section.id === sectionMenu.id) < sections.length - 1 ? [{ label: "Move section right", icon: "arrow-forward-outline" as const, onPress: () => moveSection(sectionMenu, "right") }] : []),
         ...(isCustomSection(sectionMenu) ? [{ label: "Delete section", icon: "trash-outline" as const, destructive: true, onPress: () => Alert.alert("Delete section?", "Tasks will return to their status section.", [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => api.deleteSection(sectionMenu.id) }]) }] : []),
       ] : []} onClose={() => setSectionMenu(null)} />
       <TextEntrySheet visible={renameSectionTarget !== null} title="Rename section" initialValue={renameSectionTarget?.title ?? ""} placeholder="Section name" onClose={() => setRenameSectionTarget(null)} onSubmit={(value) => { if (renameSectionTarget) api.renameSection(renameSectionTarget.id, value); setRenameSectionTarget(null); }} />
      <Sheet visible={addSectionOpen} onClose={() => setAddSectionOpen(false)}><Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>Add a section</Text><Text style={[styles.sheetCopy, { color: theme.colors.mutedForeground }]}>Use sections to shape this board around your flow.</Text><Input autoFocus value={sectionTitle} onChangeText={setSectionTitle} placeholder="e.g. In progress" onSubmitEditing={() => { if (sectionTitle.trim()) { api.addSection(sectionTitle); setSectionTitle(""); setAddSectionOpen(false); } }} style={{ marginTop: 12 }} /><Button label="Add section" disabled={!sectionTitle.trim()} onPress={() => { api.addSection(sectionTitle); setSectionTitle(""); setAddSectionOpen(false); }} style={{ marginTop: 14 }} /></Sheet>
       {calendarDay ? <Sheet visible onClose={() => setCalendarDay(null)}><Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>{format(calendarDay, "EEEE, MMM d")}</Text>{calendarTasks.length ? calendarTasks.map((task) => <TaskCard key={task.id} task={task} boards={boards} now={now} onPress={() => openEditor(task)} onComplete={() => api.toggleComplete(task.id)} onLongPress={() => setCalendarActionTask(task)} />) : <EmptyState icon="sunny-outline" title="A clear day" message="Nothing is due here yet." />}<Button variant="soft" label="Add task for this day" onPress={() => { const due = new Date(calendarDay); due.setHours(9, 0, 0, 0); setCalendarDay(null); addNewTask(due.toISOString()); }} style={{ marginTop: 6 }}><Ionicons name="add" size={18} color={theme.colors.primary} /><Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Add task for this day</Text></Button></Sheet> : null}
     </View>
  );
}

function OptionTool({ icon, dot, label, onPress, selected = false, tone = "default" }: { icon?: keyof typeof Ionicons.glyphMap; dot?: string; label: string; onPress: () => void; selected?: boolean; tone?: "default" | "danger" }) { const { theme } = useTheme(); const color = tone === "danger" ? theme.colors.destructive : selected ? theme.colors.primary : theme.colors.mutedForeground; return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={styles.optionTool}>{dot ? <View style={[styles.optionToolDot, { backgroundColor: dot }]} /> : icon ? <Ionicons name={icon} size={19} color={color} /> : null}<Text numberOfLines={2} style={[styles.optionToolText, { color }]}>{label}</Text></Pressable>; }


function WorkspaceEmptyState({ hasRefinements, onCreate, onClear }: { hasRefinements: boolean; onCreate: () => void; onClear: () => void }) { return hasRefinements ? <EmptyState icon="search-outline" title="No matching tasks" message="Try a different search or clear the current board filter." actionLabel="Clear search and filters" onAction={onClear} /> : <EmptyState icon="checkmark-done-outline" title="Your board is ready" message="Add a task to give this workspace its first next step." actionLabel="Create a task" onAction={onCreate} />; }

function ListView({ tasks, boards, now, hasRefinements, onTask, onClear }: { tasks: Task[]; boards: import("@/lib/domain/boards").Board[]; now: Date; hasRefinements: boolean; onTask: (task: Task) => void; onClear: () => void }) {
  const { theme } = useTheme();
  const groupedByDay = useMemo(() => {
    const entries = [...tasks].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
    const groups = new Map<string, Task[]>();
    for (const task of entries) {
      const day = format(parseISO(task.updatedAt || task.createdAt), "PP");
      const group = groups.get(day);
      if (group) group.push(task); else groups.set(day, [task]);
    }
    return [...groups.entries()];
  }, [tasks]);
  return <View>
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name="pulse-outline" size={19} color={theme.colors.primary} /><Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>Activity</Text></View>
      <Text style={{ color: theme.colors.mutedForeground, fontSize: 13, lineHeight: 19, marginTop: 4 }}>Recent activity on the board, newest first.</Text>
    </View>
    {groupedByDay.length === 0 ? <View style={{ borderWidth: StyleSheet.hairlineWidth, borderStyle: "dashed", borderColor: theme.colors.border, backgroundColor: theme.colors.card, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 30, alignItems: "center" }}><Ionicons name={hasRefinements ? "search-outline" : "pulse-outline"} size={25} color={theme.colors.mutedForeground} /><Text style={{ color: theme.colors.foreground, fontSize: 16, fontWeight: "700", marginTop: 9 }}>{hasRefinements ? "No matching activity" : "No changes yet"}</Text><Text style={{ color: theme.colors.mutedForeground, fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 5 }}>{hasRefinements ? "Try a different search or clear the current board filter." : "Activity will appear here as tasks are added and updated."}</Text>{hasRefinements ? <Button variant="soft" label="Clear search and filters" onPress={onClear} style={{ marginTop: 14 }} /> : null}</View> : groupedByDay.map(([day, entries]) => <View key={day} style={{ marginBottom: 18 }}><Text style={[styles.groupTitle, { color: theme.colors.mutedForeground, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }]}>{day}</Text>{entries.map((task) => {
      const stamp = task.updatedAt || task.createdAt;
      const status = deriveStatus(task, now);
      const eventType = task.completed ? "Completed" : task.canceled ? "Canceled" : task.createdAt === task.updatedAt ? "Added" : "Updated";
       const statusColor = status === "completed" ? theme.colors.success : status === "canceled" ? theme.colors.mutedForeground : status === "overdue" ? theme.colors.destructive : theme.colors.primary;
      const board = boards.find((item) => item.id === task.category);
      const priority = PRIORITY_META[task.priority];
      return <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={() => onTask(task)} style={({ pressed }) => [{ borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, backgroundColor: theme.colors.card, borderRadius: 17, padding: 13, marginBottom: 8, opacity: pressed ? 0.8 : 1 }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}><View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: `${statusColor}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name={status === "completed" ? "checkmark-circle-outline" : status === "canceled" ? "ban-outline" : status === "overdue" ? "alert-circle-outline" : "create-outline"} size={17} color={statusColor} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: theme.colors.foreground, fontSize: 15, lineHeight: 20, fontWeight: "700", textDecorationLine: task.completed ? "line-through" : "none" }} numberOfLines={2}>{task.title}</Text><Text style={{ color: theme.colors.mutedForeground, fontSize: 12, marginTop: 3 }}>{eventType} · {format(parseISO(stamp), "p")}</Text></View><Ionicons name="chevron-forward" size={17} color={theme.colors.mutedForeground} /></View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 11, marginLeft: 40 }}><View style={{ minHeight: 25, paddingHorizontal: 8, borderRadius: 999, backgroundColor: `${statusColor}18`, flexDirection: "row", alignItems: "center", gap: 4 }}><Text style={{ color: statusColor, fontSize: 11, fontWeight: "800" }}>{STATUS_LABELS[status]}</Text></View><View style={{ minHeight: 25, paddingHorizontal: 8, borderRadius: 999, backgroundColor: priority.tint, flexDirection: "row", alignItems: "center", gap: 5 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: priority.dot }} /><Text style={{ color: priority.ink, fontSize: 11, fontWeight: "800" }}>{priority.label}</Text></View>{task.dueAt ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name="time-outline" size={14} color={theme.colors.mutedForeground} /><Text style={{ color: theme.colors.mutedForeground, fontSize: 11, fontWeight: "600" }}>{format(parseISO(task.dueAt), "MMM d, h:mm a")}</Text></View> : null}{board ? <Text style={{ color: theme.colors.mutedForeground, fontSize: 11, fontWeight: "600" }}>· {board.label}</Text> : null}</View>
      </Pressable>;
    })}</View>)}
  </View>;
}
function CalendarView({ month, setMonth, selectedDay, setSelectedDay, tasks, onAddTask, onTask, onTaskAction, now }: { month: Date; setMonth: (date: Date) => void; selectedDay: Date | null; setSelectedDay: (date: Date | null) => void; tasks: Task[]; onAddTask: (due?: string | null) => void; onTask: (task: Task) => void; onTaskAction: (task: Task) => void; now: Date }) {
  const { theme } = useTheme();
  const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");
  const first = startOfWeek(calendarMode === "week" ? month : startOfMonth(month), { weekStartsOn: 1 });
  const days = Array.from({ length: calendarMode === "week" ? 7 : 42 }, (_, index) => addDays(first, index));
  const title = calendarMode === "week" ? `${format(days[0], "MMM d")} to ${format(days[6], "MMM d, yyyy")}` : format(month, "MMMM yyyy");
  const shift = (delta: number) => setMonth(calendarMode === "week" ? addWeeks(month, delta) : addMonths(month, delta));
  const taskColor = (task: Task) => task.canceled ? theme.colors.mutedForeground : task.completed ? theme.colors.success : task.priority === "high" ? theme.colors.warning : theme.colors.primary;
  const visibleDayTasks = (day: Date) => tasks.filter((task) => task.dueAt && isSameDay(parseISO(task.dueAt), day)).sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || ""));
  const unscheduled = tasks.filter((task) => !task.dueAt);
  const addForDay = (day: Date) => { const due = new Date(day); due.setHours(9, 0, 0, 0); onAddTask(due.toISOString()); };
  return <View>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}><IconButton icon="chevron-back" label={calendarMode === "week" ? "Previous week" : "Previous month"} onPress={() => shift(-1)} /><IconButton icon="chevron-forward" label={calendarMode === "week" ? "Next week" : "Next month"} onPress={() => shift(1)} /></View><Text style={[styles.monthTitle, { color: theme.colors.foreground, flex: 1, textAlign: "center", fontSize: 16 }]} numberOfLines={1}>{title}</Text><Button variant="soft" size="sm" label="Today" onPress={() => setMonth(calendarMode === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now))} /></View>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}><Text style={{ color: theme.colors.mutedForeground, fontSize: 12, flex: 1 }}>{calendarMode === "week" ? "A closer look at this week" : "Tap a day to open its task sheet"}</Text><View style={{ flexDirection: "row", borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, backgroundColor: theme.colors.secondary, borderRadius: 11, padding: 3, gap: 2 }}>{(["month", "week"] as const).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: calendarMode === value }} onPress={() => setCalendarMode(value)} style={{ minHeight: 34, paddingHorizontal: 11, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: calendarMode === value ? theme.colors.card : "transparent" }}><Text style={{ color: calendarMode === value ? theme.colors.foreground : theme.colors.mutedForeground, fontSize: 12, fontWeight: "700" }}>{value === "month" ? "Month" : "Week"}</Text></Pressable>)}</View></View>
     <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 8 }}>{[{ label: "Overdue", color: theme.colors.destructive }, { label: "High", color: theme.colors.warning }, { label: "Done", color: theme.colors.success }, { label: "Canceled", color: theme.colors.mutedForeground }].map((item) => <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.color }} /><Text style={{ color: item.color, fontSize: 10, fontWeight: "700" }}>{item.label}</Text></View>)}</View>
     <View style={{ flexDirection: "row" }}>{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <Text key={`${day}-${index}`} style={{ flex: 1, textAlign: "center", color: theme.colors.mutedForeground, fontSize: 11, fontWeight: "800", marginBottom: 6 }}>{day}</Text>)}</View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border }}>
      {days.map((day) => {
        const dayTasks = visibleDayTasks(day);
        const selected = selectedDay ? isSameDay(selectedDay, day) : false;
        const today = isSameDay(day, now);
        return <View key={day.toISOString()} style={{ width: "14.2857%", minHeight: calendarMode === "week" ? 132 : 78, padding: 6, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, backgroundColor: selected ? theme.colors.primarySoft : theme.colors.card, opacity: calendarMode === "month" && !isSameMonth(day, month) ? 0.42 : 1 }}>
          {/* The day hit surface sits behind sibling task controls, never around them. */}
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${format(day, "MMMM d")}`} accessibilityState={{ selected }} onPress={() => setSelectedDay(day)} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: today ? theme.colors.primary : theme.colors.foreground, fontSize: 12, fontWeight: today || selected ? "800" : "600" }}>{format(day, "d")}</Text>
            {dayTasks.length > 2 ? <Text style={{ color: theme.colors.mutedForeground, fontSize: 10, fontWeight: "700" }}>+{dayTasks.length - 2}</Text> : null}
          </View>
          {dayTasks.slice(0, calendarMode === "week" ? 5 : 2).map((task) => <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={(event) => { event.stopPropagation(); onTask(task); }} onLongPress={(event) => { event.stopPropagation(); onTaskAction(task); }} style={({ pressed }) => [{ borderRadius: 6, paddingHorizontal: 4, paddingVertical: 3, marginBottom: 3, backgroundColor: `${taskColor(task)}20`, opacity: pressed ? 0.65 : 1 }]}><View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: taskColor(task) }} /><Text style={{ flex: 1, color: theme.colors.foreground, fontSize: 10, lineHeight: 13, fontWeight: "700", textDecorationLine: task.completed ? "line-through" : "none" }} numberOfLines={1}>{task.title}</Text></View></Pressable>)}
        </View>;
      })}
    </View>
    <View style={{ marginTop: 15, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, backgroundColor: theme.colors.card, padding: 13 }}><Text style={[styles.sectionTitle, { color: theme.colors.foreground, fontSize: 15 }]}>Plan a day</Text><Text style={{ color: theme.colors.mutedForeground, fontSize: 13, lineHeight: 19, marginTop: 4 }}>Open a date for its full task sheet, or long press a task to reschedule it.</Text><Button variant="soft" label={`Add for ${selectedDay ? format(selectedDay, "MMM d") : "today"}`} onPress={() => addForDay(selectedDay ?? now)} style={{ marginTop: 10 }}><Ionicons name="add" size={17} color={theme.colors.primary} /><Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Add task</Text></Button></View>
    <View style={{ marginTop: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, borderStyle: "dashed", backgroundColor: theme.colors.backgroundAlt, padding: 13 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Ionicons name="file-tray-outline" size={17} color={theme.colors.mutedForeground} /><Text style={{ color: theme.colors.foreground, fontSize: 14, fontWeight: "800" }}>Unscheduled</Text><Text style={{ color: theme.colors.mutedForeground, fontSize: 12, fontWeight: "700" }}>· {unscheduled.length}</Text></View><Text style={{ color: theme.colors.mutedForeground, fontSize: 12, lineHeight: 18, marginTop: 5 }}>{unscheduled.length ? "Long press a task to choose a day." : "Every task has a due date."}</Text>{unscheduled.slice(0, 4).map((task) => <Pressable key={task.id} onPress={() => onTask(task)} onLongPress={() => onTaskAction(task)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: taskColor(task) }} /><Text style={{ flex: 1, color: theme.colors.foreground, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{task.title}</Text><Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.mutedForeground} /></Pressable>)}</View>
  </View>;
}
function CalendarTaskActions({ task, now, onClose, onChooseDate, onToday, onTomorrow, onClearDue }: { task: Task | null; now: Date; onClose: () => void; onChooseDate: () => void; onToday: () => void; onTomorrow: () => void; onClearDue: () => void }) {
  return <OptionSheet visible={task !== null} title={task?.title ?? "Calendar task"} options={[{ label: "Choose a day", icon: "calendar-outline", onPress: onChooseDate }, { label: `Move to today · ${format(now, "MMM d")}`, icon: "today-outline", onPress: onToday }, { label: `Move to tomorrow · ${format(addDays(now, 1), "MMM d")}`, icon: "arrow-forward-circle-outline", onPress: onTomorrow }, ...(task?.dueAt ? [{ label: "Remove due date", icon: "close-circle-outline" as const, destructive: true, onPress: onClearDue }] : [])]} onClose={onClose} />;
}

function TaskActions({ task, tasks, sections, now, onClose, onComplete, onCancel, onDelete, onMove, onMoveUp, onMoveDown }: { task: Task | null; tasks: Task[]; sections: BoardSection[]; now: Date; onClose: () => void; onComplete: () => void; onCancel: () => void; onDelete: () => void; onMove: (sectionId: string | null) => void; onMoveUp: () => void; onMoveDown: () => void }) {
  const sectionId = task ? getTaskSectionId(task, sections, now) : undefined;
  const siblings = task ? tasks.filter((item) => getTaskSectionId(item, sections, now) === sectionId) : [];
  const taskIndex = task ? siblings.findIndex((item) => item.id === task.id) : -1;
  const moveOptions = [...sections.filter((section) => section.id !== sectionId).map((section) => ({ label: `Move to ${section.title}`, icon: "arrow-forward-outline" as const, onPress: () => onMove(section.id) })), ...(sectionId !== undefined ? [{ label: "Move to Unsorted", icon: "file-tray-outline" as const, onPress: () => onMove(null) }] : [])];
  return <OptionSheet visible={task !== null} title={task?.title ?? "Task actions"} options={[{ label: task?.completed ? "Mark incomplete" : "Complete task", icon: "checkmark-circle-outline", onPress: onComplete }, { label: task?.canceled ? "Restore task" : "Cancel task", icon: "close-circle-outline", onPress: onCancel }, ...(taskIndex > 0 ? [{ label: "Move task up", icon: "arrow-up-outline" as const, onPress: onMoveUp }] : []), ...(taskIndex >= 0 && taskIndex < siblings.length - 1 ? [{ label: "Move task down", icon: "arrow-down-outline" as const, onPress: onMoveDown }] : []), ...moveOptions, { label: "Delete task", icon: "trash-outline", destructive: true, onPress: onDelete }]} onClose={onClose} />;
}

const styles = StyleSheet.create({ root: { flex: 1 }, headerBlock: { borderBottomWidth: StyleSheet.hairlineWidth }, loading: { flex: 1, alignItems: "center", justifyContent: "center" }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 2 }, headerActions: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth }, headerActionButton: { flex: 1, minHeight: 44 }, headerTitle: { flex: 1, marginHorizontal: 4, minWidth: 0 }, headerEyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: "#737686", marginBottom: 1 }, ribbonLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginRight: 2 }, boardName: { fontSize: 17, fontWeight: "800" }, summary: { fontSize: 11, marginTop: 2 }, stickyTools: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, elevation: 3, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, searchRow: { flexDirection: "row", alignItems: "center", gap: 7 }, searchBox: { flex: 1, height: 44, flexDirection: "row", alignItems: "center", paddingLeft: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth }, modeSwitchContent: { paddingRight: 4 }, modeSwitch: { flexDirection: "row", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 3, gap: 2 }, modeSwitchItem: { minHeight: 44, minWidth: 78, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, quickAdd: { paddingHorizontal: 16, paddingTop: 14, flexDirection: "row", gap: 8 }, quickHint: { fontSize: 11, marginTop: 5, marginLeft: 4 }, surface: { padding: 12, paddingTop: 16 }, statusBar: { minHeight: 28, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 }, statusText: { fontSize: 10, fontWeight: "600" }, hiddenSections: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 10, marginBottom: 12, gap: 8 }, hiddenSectionsHeader: { flexDirection: "row", alignItems: "center", gap: 6 }, hiddenSectionsScroll: { gap: 8 }, hiddenSectionChip: { minHeight: 40, maxWidth: 190, paddingHorizontal: 11, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 6 }, boardScroll: { gap: 12, paddingRight: 16, paddingBottom: 12 }, column: { width: 292, minHeight: 280, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 12 }, columnHeader: { flexDirection: "row", alignItems: "center", minHeight: 48, marginBottom: 8 }, columnTitle: { fontSize: 16, fontWeight: "800" }, addColumn: { width: 180, minHeight: 110, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }, listGroup: { marginBottom: 18 }, groupTitle: { fontSize: 17, fontWeight: "800", marginBottom: 9 }, monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, monthTitle: { fontSize: 19, fontWeight: "800" }, weekRow: { flexDirection: "row", marginBottom: 4 }, weekLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "800" }, calendarGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: "#00000015" }, dayCell: { width: `${100 / 7}%`, height: 58, alignItems: "center", justifyContent: "center", borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, gap: 7 }, dayDots: { flexDirection: "row", gap: 3, height: 5 }, dayDot: { width: 5, height: 5, borderRadius: 3 }, calendarFooter: { marginTop: 22, padding: 16, borderRadius: 19, backgroundColor: "#00000008" }, sectionTitle: { fontSize: 18, fontWeight: "800" }, sheetTitle: { fontSize: 21, fontWeight: "800" }, sheetCopy: { fontSize: 14, lineHeight: 20, marginTop: 5 }, optionTools: { flexDirection: "row", paddingHorizontal: 10, paddingTop: 5, paddingBottom: 4 }, optionToolGroup: { borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5, gap: 3 }, optionToolButtons: { flexDirection: "row" }, optionTool: { minWidth: 65, maxWidth: 92, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 6 }, optionToolText: { fontSize: 10, textAlign: "center" }, optionToolDot: { width: 9, height: 9, borderRadius: 5 }, optionCaption: { textAlign: "center", fontSize: 9, letterSpacing: 0.5 }, optionActionGroup: { width: 250 }, optionActionRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48 }, optionInput: { flex: 1, height: 36, fontSize: 13, paddingHorizontal: 10, borderRadius: 10 }, optionDropdown: { minWidth: 148, height: 36, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 }, optionDropdownLabel: { flexShrink: 1, fontSize: 12, fontWeight: "600" },
});
