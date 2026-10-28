import { Ionicons } from "@expo/vector-icons";
import { BlurTargetView } from "expo-blur";
import { addDays, format, isSameDay, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarPanel, type CalendarMode } from "@/components/calendar/calendar-panel";
import { InsightsPanel, OptionSheet, TaskCard, TaskEditor, TextEntrySheet } from "@/components/janus-board-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Sheet } from "@/components/ui/sheet";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { useNow } from "@/hooks/use-now";
import { useTasksContext } from "@/providers/tasks-provider";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";
import { usePreferences } from "@/providers/preferences-provider";
import { BOARD_COLORS, boardColor } from "@/lib/domain/boards";
import { BulkSelectionToolbar } from "@/components/board/bulk-selection-toolbar";
import { MobileBoardBottomNav } from "@/components/board/mobile-board-bottom-nav";
import { MobileTaskColumns } from "@/components/board/mobile-task-columns";
import { MobileBoardRibbon } from "@/components/board/mobile-board-ribbon";
import { PRIORITY_META, PRIORITY_ORDER, SORT_OPTIONS } from "@/lib/domain/constants";
import { deriveStatus, STATUS_LABELS } from "@/lib/domain/status";
import { getTaskSectionId, isCustomSection } from "@/lib/domain/sections";
import { exportWorkspace, exportWorkspaceCsv, pickWorkspaceFile } from "@/lib/data/transfer";
import { matchesQuery, sortTasks } from "@/lib/domain/tasks-selectors";
import { rescheduleToDay } from "@/lib/utils/datetime";
import { getRibbonContext } from "@/lib/features/ribbon-context";
import { rankTopTasks } from "@/lib/features/top-tasks";
import { sectionDropOrder, taskDropOrder } from "@/lib/features/janus-drag";
import { mobileBottomNavClearance, mobileContentStyle } from "@/theme/layout";
import type { BoardSection, Priority, SortKey, Task, TaskDraft, ViewMode } from "@/lib/domain/types";

export default function WorkspaceScreen() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const blurTarget = useRef<ComponentRef<typeof BlurTargetView> | null>(null);
  const insets = useSafeAreaInsets();
  const now = useNow();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const api = useTasksContext();
  const { tasks, sections, boards, projects, isLoading, currentProjectId, switchProject: switchProjectApi } = api;
  const requestedProjectId = useRef<string | null>(null);
  const [requestedMode, setMode] = useState<ViewMode>("board");
  const hasTasks = tasks.length > 0;
  const activityUnavailable = requestedMode === "list" && !hasTasks;
  const mode = activityUnavailable ? "board" : requestedMode;
  // Match the existing desktop workspace breakpoint for the split editor tabs.
  const splitView = (mode === "list" || mode === "calendar") && width >= 900;
  const [query, setQuery] = useState("");
  const [compactCards, setCompactCards] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showMoveArrows, setShowMoveArrows] = useState(false);
  const [focusedColumn, setFocusedColumn] = useState(false);
  const [sort, setSort] = useState<SortKey>("manual");
  const [boardFilter, setBoardFilter] = useState("all");
  const [filterMenu, setFilterMenu] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [removeTagOpen, setRemoveTagOpen] = useState(false);
  const [selectedEditorTask, setEditorTask] = useState<Task | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [initialDueAt, setInitialDueAt] = useState<string | null>(null);
  const [taskAction, setTaskAction] = useState<Task | null>(null);
  const [sortMenu, setSortMenu] = useState(false);
  const [sectionMenu, setSectionMenu] = useState<BoardSection | null>(null);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [renameSectionTarget, setRenameSectionTarget] = useState<BoardSection | null>(null);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<BoardSection | null>(null);
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
  const [editorProjectId, setEditorProjectId] = useState(currentProjectId);
  const [dragEnabled, setDragEnabled] = useState(true);
  useEffect(() => {
    if (!activityUnavailable || isLoading) return;
    // Clear Activity's editor when the last card is removed or an empty board opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode("board");
    setEditorVisible(false);
    setEditorTask(null);
    setInitialDueAt(null);
    setInitialSectionId(null);
  }, [activityUnavailable, isLoading]);
  const defaultEditorTask = useMemo(() => {
    const entries = tasks.map((task) => ({ task, projectId: currentProjectId, projectName: "", boards }));
    // Match Top Tasks' priority/deadline ordering. Finished-only boards still
    // keep a real task editable, using persisted board order as fallback.
    return rankTopTasks(entries)[0]?.task ?? tasks[0] ?? null;
  }, [boards, currentProjectId, tasks]);
  const selectionBelongsToBoard = editorProjectId === currentProjectId;
  const validEditorSelection = selectionBelongsToBoard && selectedEditorTask ? tasks.find((task) => task.id === selectedEditorTask.id) : undefined;
  const creatingEditorTask = selectionBelongsToBoard && editorVisible && !selectedEditorTask;
  const editorTask = splitView
    ? validEditorSelection ?? (creatingEditorTask ? null : defaultEditorTask)
    : selectedEditorTask;

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
  useEffect(() => {
    // Remember the default once; ranking, autosaves and filters must not steal
    // selection. Only deletion or a board switch chooses another default.
    if (!splitView || isLoading) return;
    if (!validEditorSelection && !creatingEditorTask) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditorTask(editorTask);
      setEditorProjectId(currentProjectId);
    }
    if (!editorVisible) setEditorVisible(true);
  }, [creatingEditorTask, currentProjectId, editorTask, editorVisible, isLoading, splitView, validEditorSelection]);
  const renderedBoardTasks = useMemo(() => {
    const hiddenSectionIds = new Set(sections.filter((section) => section.hidden).map((section) => section.id));
    return visibleTasks.filter((task) => {
      const sectionId = getTaskSectionId(task, sections, now);
      return sectionId !== undefined && !hiddenSectionIds.has(sectionId);
    });
  }, [now, sections, visibleTasks]);
  const selectedTasks = useMemo(() => renderedBoardTasks.filter((task) => selectedTaskIds.has(task.id)), [renderedBoardTasks, selectedTaskIds]);
  const allVisibleSelected = renderedBoardTasks.length > 0 && renderedBoardTasks.every((task) => selectedTaskIds.has(task.id));
  const enterSelectionMode = () => { if (!getRibbonContext(mode).selection) return; setSelectionMode(true); setSelectedTaskIds(new Set()); };
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
    if (!target) return;
    const before = api.snapshot();
    selectedTasks.forEach((task) => api.assignTaskToSection(task.id, target.id));
    toast.success(`Moved ${selectedTasks.length} ${selectedTasks.length === 1 ? "task" : "tasks"} to ${target.title}`, { action: { label: "Undo", onPress: () => api.restore(before) } });
  };
  const deleteSelected = () => {
    if (!selectedTasks.length) return;
    const before = api.snapshot();
    selectedTasks.forEach((task) => api.deleteTask(task.id));
    exitSelectionMode();
    toast.success(`${selectedTasks.length} ${selectedTasks.length === 1 ? "task" : "tasks"} deleted`, { action: { label: "Undo", onPress: () => api.restore(before) } });
  };
  const addNewTask = (due?: string | null, sectionId?: string | null) => { setEditorProjectId(currentProjectId); setEditorTask(null); setInitialDueAt(due ?? null); setInitialSectionId(sectionId ?? null); setEditorVisible(true); };
  const saveTaskSection = (taskId: string, sectionId: string | null) => {
    if (sectionId === null) return;
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
  const autoSaveTask = (draft: TaskDraft, sectionId: string | null) => {
    if (!editorTask) return;
    const liveTask = tasks.find((task) => task.id === editorTask.id);
    if (!liveTask) return;
    api.updateTask(liveTask.id, draft);
    const currentSectionId = getTaskSectionId(liveTask, sections, now) ?? null;
    if (sectionId !== currentSectionId) saveTaskSection(liveTask.id, sectionId);
  };
  const createFilterTag = (label: string) => {    if (boards.some((board) => board.label.toLowerCase() === label.toLowerCase())) {
      toast.error("Tag already exists", { description: label });
      return;
    }
    const color = BOARD_COLORS[boards.length % BOARD_COLORS.length]?.id ?? "slate";
    const board = api.createBoard({ label, color });
    setAddFilterOpen(false);
    toast.success("Filter/tag added", { description: `Assign "${board.label}" from a card's Tags section, then filter by it.` });
  };
  const removeTag = (tag: { id: string; label: string }) => {
    const before = api.snapshot();
    const result = api.deleteBoard(tag.id);
    if (!result) return;
    if (boardFilter === tag.id) setBoardFilter("all");
    toast.success(`Tag “${result.label}” removed`, {
      description: result.affected
        ? `Removed from ${result.affected} ${result.affected === 1 ? "task" : "tasks"}.`
        : "No tasks were using it.",
      action: { label: "Undo", onPress: () => api.restore(before) },
    });
  };
  const openEditor = (task: Task) => { setEditorProjectId(currentProjectId); setEditorTask(task); setInitialDueAt(null); setEditorVisible(true); };
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
  const switchProject = (projectId: string) => {
    setProjectSwitcherOpen(false);
    if (projectId === id) return;
    setEditorVisible(false); setEditorTask(null); setInitialDueAt(null); setInitialSectionId(null);
    exitSelectionMode();
    router.replace(`/board/${projectId}`);
  };
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
  const deleteList = () => {
    const target = deleteSectionTarget;
    if (!target) return;
    const before = api.snapshot();
    api.deleteSection(target.id);
    setDeleteSectionTarget(null);
    toast.success(`“${target.title}” deleted`, {
      description: "Cards in this list were kept.",
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
    toast.success(`Moved to ${target?.title ?? "list"}`, {
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

  const dropTask = (taskId: string, sectionId: string, beforeTaskId: string | null) => {
    const task = tasks.find((item) => item.id === taskId);
    const section = sections.find((item) => item.id === sectionId && !item.hidden);
    if (!task || !section) return;
    const siblings = visibleTasks.filter((item) => getTaskSectionId(item, sections, now) === sectionId).map((item) => item.id);
    const orderedIds = taskDropOrder(taskId, siblings, beforeTaskId);
    if (!orderedIds) return;
    const sameSection = getTaskSectionId(task, sections, now) === sectionId;
    if (sameSection && orderedIds.every((value, index) => value === siblings[index])) return;
    const before = api.snapshot();
    const previousSort = sort;
    if (!sameSection) api.assignTaskToSection(taskId, sectionId);
    api.reorderTasks(orderedIds);
    setSort("manual");
    toast.success(sameSection ? "Card reordered" : `Moved to ${section.title}`, {
      description: previousSort === "manual" ? undefined : "Switched to manual order",
      action: { label: "Undo", onPress: () => { api.restore(before); setSort(previousSort); } },
    });
  };
  const dropSection = (sectionId: string, targetId: string) => {
    const orderedIds = sectionDropOrder(sections, sectionId, targetId);
    if (!orderedIds) return;
    const before = api.snapshot();
    api.reorderSections(orderedIds);
    toast.success("List reordered", { action: { label: "Undo", onPress: () => api.restore(before) } });
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
    {mode === "board" ? <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="reorder-three-outline" label={dragEnabled ? "Disable dragging" : "Enable dragging"} selected={dragEnabled} onPress={() => { setDragEnabled((enabled) => !enabled); if (!dragEnabled) setFocusedColumn(false); }} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>DRAG & DROP</Text></View> : null}
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="sparkles-outline" label="Load sample" onPress={() => { const before = api.snapshot(); api.loadSample(); toast.show("Sample workspace loaded", { action: { label: "Undo", onPress: () => api.restore(before) } }); }} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>CREATE</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="share-outline" label="Export JSON" onPress={() => { if (activeProject) void exportWorkspace(liveWorkspace, activeProject.name); }} /><OptionTool icon="document-text-outline" label="Export CSV" onPress={() => { if (activeProject) void exportWorkspaceCsv(liveWorkspace, activeProject.name); }} /><OptionTool icon="cloud-upload-outline" label="Import board" onPress={importBoard} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>DATA</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="bookmark-outline" label="Save version" onPress={() => { api.createVersion(); toast.success("Version saved"); }} />{api.versions.length ? <OptionTool icon="return-down-back-outline" label={`Restore ${api.versions[0].label}`} onPress={() => { api.restoreVersion(api.versions[0].id); toast.success("Version restored"); }} /> : null}{api.versions.length ? <OptionTool icon="trash-outline" label={`Delete ${api.versions[0].label}`} tone="danger" onPress={() => { api.deleteVersion(api.versions[0].id); toast.success("Version deleted"); }} /> : null}</View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>VERSIONS</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="checkmark-done-outline" label="Clear done" onPress={clearCompleted} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>TIDY UP</Text></View>
    <View style={styles.optionToolGroup}><View style={styles.optionToolButtons}><OptionTool icon="swap-horizontal-outline" label="Switch board" onPress={() => setProjectSwitcherOpen(true)} /><OptionTool icon="archive-outline" label="Close board" onPress={closeBoard} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>BOARD</Text></View>
  </ScrollView>;
  const activeFilterBoard = boards.find((board) => board.id === boardFilter);
  const showEditor = !activityUnavailable && (splitView || (editorVisible && (!editorTask || tasks.some((task) => task.id === editorTask.id))));
  const taskEditor = <TaskEditor presentation={splitView ? "panel" : "sheet"} visible={showEditor} task={editorTask} initialDueAt={initialDueAt} boards={boards} sections={sections} onClose={() => setEditorVisible(false)} onSave={saveTask} onAutoSave={editorTask ? autoSaveTask : undefined} onDelete={editorTask ? () => { const before = api.snapshot(); api.deleteTask(editorTask.id); setEditorVisible(false); toast.success("Task deleted", { action: { label: "Undo", onPress: () => api.restore(before) } }); } : undefined} onCancelTask={editorTask ? () => { api.toggleCancel(editorTask.id); setEditorVisible(false); } : undefined} />;
  const filterOptions = [{ label: "All boards", icon: boardFilter === "all" ? "checkmark-circle" as const : "radio-button-off-outline" as const, onPress: () => { setBoardFilter("all"); setSelectedTaskIds(new Set()); } }, ...boards.map((board) => ({ label: board.label, icon: boardFilter === board.id ? "checkmark-circle" as const : "radio-button-off-outline" as const, onPress: () => { setBoardFilter(board.id); setSelectedTaskIds(new Set()); } }))];
  const filtersContent = <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.optionTools}>
    {getRibbonContext(mode).sorting ? <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="swap-vertical-outline" label="Sort" onPress={() => setSortMenu(true)} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>SORT</Text></View> : null}
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionActionRow}><Pressable accessibilityRole="button" accessibilityLabel={`Filter board: ${activeFilterBoard?.label ?? "All boards"}`} accessibilityHint="Opens a dropdown of boards to filter by." onPress={() => setFilterMenu(true)} style={[styles.optionDropdown, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}>{activeFilterBoard ? <View style={[styles.optionToolDot, { backgroundColor: boardColor(activeFilterBoard.color).dot }]} /> : <Ionicons name="grid-outline" size={15} color={theme.colors.mutedForeground} />}<Text numberOfLines={1} style={[styles.optionDropdownLabel, { color: theme.colors.foreground }]}>{activeFilterBoard?.label ?? "All boards"}</Text><Ionicons name="chevron-down" size={15} color={theme.colors.mutedForeground} /></Pressable></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>FILTER</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="pricetag-outline" label="Add filter/tag" onPress={() => setAddFilterOpen(true)} />{boards.length ? <OptionTool icon="trash-outline" label="Remove tag" tone="danger" onPress={() => setRemoveTagOpen(true)} /> : null}</View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>TAGS</Text></View>
  </ScrollView>;
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
      <ThemeAtmosphere />
      <View style={{ flex: 1, paddingBottom: mode === "board" ? mobileBottomNavClearance + insets.bottom : 0, paddingLeft: insets.left, paddingRight: insets.right }}>
        <MobileBoardRibbon selection={selectionMode ? <BulkSelectionToolbar selectedCount={selectedTasks.length} allSelected={allVisibleSelected} onSelectAll={selectAllVisible} onClear={() => setSelectedTaskIds(new Set())} onComplete={() => runBulkStatus("completed", "Tasks completed")} onCancel={() => runBulkStatus("canceled", "Tasks canceled")} onRestore={() => runBulkStatus("open", "Tasks restored")} onDelete={deleteSelected} onMove={() => setBulkSectionMenu(true)} onPriority={() => setBulkPriorityMenu(true)} onClose={exitSelectionMode} /> : null} selecting={selectionMode} onSelect={enterSelectionMode} onDeselect={exitSelectionMode} filters={filtersContent} filtersActive={boardFilter !== "all"} mode={mode} onMode={(value) => { if (value !== "board" && selectionMode) exitSelectionMode(); if (value !== mode) { setEditorVisible(false); setEditorTask(null); setInitialDueAt(null); setInitialSectionId(null); } setMode(value); }} query={query} onQuery={(value) => { setQuery(value); setSelectedTaskIds(new Set()); }} onBoards={() => router.replace("/")} onSwitchBoard={() => setProjectSwitcherOpen(true)} onNewTask={() => addNewTask()} onAddSection={() => setAddSectionOpen(true)} zoom={zoom} onZoom={(next) => setZoom(Math.min(1.3, Math.max(0.7, Math.round(next * 10) / 10)))} compact={compactCards} onCompact={() => setCompactCards(!compactCards)} showMoveArrows={showMoveArrows} onShowMoveArrows={() => setShowMoveArrows(!showMoveArrows)} focused={focusedColumn} onFocused={() => setFocusedColumn(!focusedColumn)}>
          {actionsContent}
        </MobileBoardRibbon>
        <View style={{ flex: 1, minHeight: 0, flexDirection: "row" }}>
        {mode === "board" ? <View style={{ flex: 1, minHeight: 0 }}>
          {hasRefinements && visibleTasks.length === 0 ? <ScrollView contentContainerStyle={[mobileContentStyle, { paddingBottom: mobileBottomNavClearance + insets.bottom }]}><WorkspaceEmptyState hasRefinements onCreate={() => addNewTask()} onClear={() => { setQuery(""); setBoardFilter("all"); setSelectedTaskIds(new Set()); }} /></ScrollView> : <MobileTaskColumns key={id} tasks={visibleTasks} sections={sections} boards={boards} now={now} compact={compactCards} zoom={zoom} showMoveArrows={showMoveArrows} dragEnabled={dragEnabled} focused={focusedColumn} hiddenSections={sections.filter((section) => section.hidden)} selectionMode={selectionMode} selectedTaskIds={selectedTaskIds} onToggleSelect={toggleSelectedTask} onShowSection={toggleSectionVisibility} onTask={openEditor} onLongPress={setTaskAction} onMove={moveTaskToSection} onTaskDrop={dropTask} onSectionDrop={dropSection} onToggleSubtask={api.toggleSubtask} onAddTask={(sectionId) => addNewTask(null, sectionId)} onSectionMenu={setSectionMenu} onAddSection={() => setAddSectionOpen(true)} />}
        </View> : <ScrollView style={{ flex: splitView ? 4 : 1, minWidth: 0 }} contentContainerStyle={splitView ? { padding: 12, paddingBottom: mobileBottomNavClearance + insets.bottom } : [mobileContentStyle, { paddingBottom: mobileBottomNavClearance + insets.bottom }]} showsVerticalScrollIndicator={splitView} keyboardShouldPersistTaps="handled">
          {mode === "list" ? <ListView compact={splitView} tasks={visibleTasks} boards={boards} now={now} hasRefinements={hasRefinements} selectedTaskId={splitView && showEditor ? editorTask?.id : undefined} onTask={openEditor} onClear={() => { setQuery(""); setBoardFilter("all"); }} /> : mode === "calendar" ? <CalendarView month={calendarMonth} setMonth={setCalendarMonth} selectedDay={calendarDay} setSelectedDay={setCalendarDay} tasks={visibleTasks} boards={boards} split={splitView} onAddTask={addNewTask} onTask={openEditor} onTaskAction={setCalendarActionTask} now={now} /> : <InsightsPanel tasks={tasks} boards={boards} now={now} />}
        </ScrollView>}
        <View key={currentProjectId} style={splitView ? { flex: 6, minWidth: 440, minHeight: 0, marginTop: 12, marginRight: 12, marginBottom: 12 + insets.bottom, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, borderRadius: 14, overflow: "hidden", backgroundColor: theme.colors.card } : undefined}>
          {taskEditor}
        </View>
        </View>
      </View>
      </BlurTargetView>
      <MobileBoardBottomNav mode={mode} hasTasks={hasTasks} onMode={(value) => { if (value === "list" && !hasTasks) return; if (value !== "board" && selectionMode) exitSelectionMode(); if (value !== mode) { setEditorVisible(false); setEditorTask(null); setInitialDueAt(null); setInitialSectionId(null); } setMode(value); }} blurTarget={blurTarget} />
       <CalendarTaskActions task={calendarActionTask} now={now} onClose={() => setCalendarActionTask(null)} onComplete={() => { if (calendarActionTask) api.toggleComplete(calendarActionTask.id); setCalendarActionTask(null); }} onChooseDate={() => { if (calendarActionTask) setCalendarPickerTask(calendarActionTask); setCalendarActionTask(null); }} onToday={() => { if (calendarActionTask) rescheduleTask(calendarActionTask, startOfDay(now)); setCalendarActionTask(null); }} onTomorrow={() => { if (calendarActionTask) rescheduleTask(calendarActionTask, addDays(startOfDay(now), 1)); setCalendarActionTask(null); }} onClearDue={() => { if (calendarActionTask) clearTaskDueDate(calendarActionTask); setCalendarActionTask(null); }} />
       {calendarPickerTask ? <DateTimePicker value={calendarPickerTask.dueAt ? parseISO(calendarPickerTask.dueAt) : now} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, selected) => { setCalendarPickerTask(null); if (selected) rescheduleTask(calendarPickerTask, selected); }} /> : null}
       <TaskActions task={taskAction} tasks={visibleTasks} sections={sections} now={now} onClose={() => setTaskAction(null)} onComplete={() => { if (taskAction) api.toggleComplete(taskAction.id); setTaskAction(null); }} onCancel={() => { if (taskAction) api.toggleCancel(taskAction.id); setTaskAction(null); }} onDelete={() => { if (taskAction) { const before = api.snapshot(); api.deleteTask(taskAction.id); setTaskAction(null); toast.success("Task deleted", { action: { label: "Undo", onPress: () => api.restore(before) } }); } }} onMove={(sectionId) => { if (taskAction) moveTaskToSection(taskAction, sectionId); setTaskAction(null); }} onMoveUp={() => { if (taskAction) reorderTask(taskAction, "up"); setTaskAction(null); }} onMoveDown={() => { if (taskAction) reorderTask(taskAction, "down"); setTaskAction(null); }} />
       <OptionSheet visible={projectSwitcherOpen} title="Switch board" options={projectOptions} onClose={() => setProjectSwitcherOpen(false)} />
      <OptionSheet visible={filterMenu} title="Filter by board" options={filterOptions} onClose={() => setFilterMenu(false)} />
      <TextEntrySheet visible={addFilterOpen} title="Add filter/tag" description="Create a tag to group tasks and filter this board." placeholder="Tag name" actionLabel="Add tag" onClose={() => setAddFilterOpen(false)} onSubmit={createFilterTag} />
      <OptionSheet visible={removeTagOpen} title="Remove tag" options={boards.map((board) => ({ label: board.label, icon: "trash-outline" as const, destructive: true, onPress: () => removeTag(board) }))} onClose={() => setRemoveTagOpen(false)} />
       <OptionSheet visible={sortMenu} title="Sort tasks" options={SORT_OPTIONS.map((option) => ({ label: option.label, icon: sort === option.value ? "checkmark-circle" : "radio-button-off-outline", onPress: () => setSort(option.value) }))} onClose={() => setSortMenu(false)} />
        <OptionSheet visible={bulkSectionMenu} title="Move selected tasks" options={sections.map((section) => ({ label: `Move to ${section.title}`, icon: "arrow-forward-outline" as const, onPress: () => runBulkMove(section.id) }))} onClose={() => setBulkSectionMenu(false)} />
       <OptionSheet visible={bulkPriorityMenu} title="Set selected priority" options={PRIORITY_ORDER.map((priority) => ({ label: PRIORITY_META[priority].label, icon: "flag-outline" as const, onPress: () => runBulkPriority(priority) }))} onClose={() => setBulkPriorityMenu(false)} />
       <OptionSheet visible={sectionMenu !== null} title={sectionMenu?.title ?? "List"} options={sectionMenu ? [
         ...(isCustomSection(sectionMenu) ? [{ label: "Rename list", icon: "pencil-outline" as const, onPress: () => setRenameSectionTarget(sectionMenu) }] : []),
         { label: sectionMenu.hidden ? "Show list" : "Hide list", icon: sectionMenu.hidden ? "eye-outline" as const : "eye-off-outline" as const, onPress: () => toggleSectionVisibility(sectionMenu) },
         ...(sections.findIndex((section) => section.id === sectionMenu.id) > 0 ? [{ label: "Move list left", icon: "arrow-back-outline" as const, onPress: () => moveSection(sectionMenu, "left") }] : []),
         ...(sections.findIndex((section) => section.id === sectionMenu.id) < sections.length - 1 ? [{ label: "Move list right", icon: "arrow-forward-outline" as const, onPress: () => moveSection(sectionMenu, "right") }] : []),
         ...(isCustomSection(sectionMenu) ? [{ label: "Delete list", icon: "trash-outline" as const, destructive: true, onPress: () => setDeleteSectionTarget(sectionMenu) }] : []),
       ] : []} onClose={() => setSectionMenu(null)} />
       <Sheet visible={deleteSectionTarget !== null} onClose={() => setDeleteSectionTarget(null)}>
         <Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>Delete list?</Text>
          <Text style={[styles.sheetCopy, { color: theme.colors.mutedForeground }]}>“{deleteSectionTarget?.title}” will be removed. Its cards will move to the first available list. An Inbox list will be created if needed.</Text>
         <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
           <Button variant="outline" label="Keep list" onPress={() => setDeleteSectionTarget(null)} style={{ flex: 1 }} />
           <Button variant="danger" label="Delete list" onPress={deleteList} style={{ flex: 1 }} />
         </View>
       </Sheet>
       <TextEntrySheet visible={renameSectionTarget !== null} title="Rename list" initialValue={renameSectionTarget?.title ?? ""} placeholder="List name" onClose={() => setRenameSectionTarget(null)} onSubmit={(value) => { if (renameSectionTarget) api.renameSection(renameSectionTarget.id, value); setRenameSectionTarget(null); }} />
      <Sheet visible={addSectionOpen} onClose={() => setAddSectionOpen(false)}><Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>Add a list</Text><Text style={[styles.sheetCopy, { color: theme.colors.mutedForeground }]}>Use lists to shape this board around your flow.</Text><Input autoFocus value={sectionTitle} onChangeText={setSectionTitle} placeholder="e.g. In progress" onSubmitEditing={() => { if (sectionTitle.trim()) { api.addSection(sectionTitle); setSectionTitle(""); setAddSectionOpen(false); } }} style={{ marginTop: 12 }} /><Button label="Add list" disabled={!sectionTitle.trim()} onPress={() => { api.addSection(sectionTitle); setSectionTitle(""); setAddSectionOpen(false); }} style={{ marginTop: 14 }} /></Sheet>
       {splitView ? null : <Sheet visible={calendarDay !== null} onClose={() => setCalendarDay(null)}>
         {calendarDay ? (
           <>
             <Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>{format(calendarDay, "EEEE, MMM d")}</Text>
             <View style={{ marginTop: 14 }}>
                 {calendarTasks.length ? calendarTasks.map((task) => <TaskCard key={task.id} task={task} boards={boards} now={now} onPress={() => openEditor(task)} onLongPress={() => setCalendarActionTask(task)} />) : <EmptyState icon="sunny-outline" title="A clear day" message="Nothing is due here yet." />}
                <Button variant="soft" label="Add task for this day" onPress={() => { const due = new Date(calendarDay); due.setHours(9, 0, 0, 0); setCalendarDay(null); addNewTask(due.toISOString()); }} style={{ marginTop: 6 }}><Ionicons name="add" size={18} color={theme.colors.primary} /><Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Add task for this day</Text></Button>
              </View>
           </>
         ) : null}
       </Sheet>}
     </View>
  );
}

function OptionTool({ icon, dot, label, onPress, selected = false, tone = "default" }: { icon?: keyof typeof Ionicons.glyphMap; dot?: string; label: string; onPress: () => void; selected?: boolean; tone?: "default" | "danger" }) { const { theme } = useTheme(); const color = tone === "danger" ? theme.colors.destructive : selected ? theme.colors.primary : theme.colors.mutedForeground; return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={styles.optionTool}>{dot ? <View style={[styles.optionToolDot, { backgroundColor: dot }]} /> : icon ? <Ionicons name={icon} size={19} color={color} /> : null}<Text numberOfLines={2} style={[styles.optionToolText, { color }]}>{label}</Text></Pressable>; }


function WorkspaceEmptyState({ hasRefinements, onCreate, onClear }: { hasRefinements: boolean; onCreate: () => void; onClear: () => void }) { return hasRefinements ? <EmptyState icon="search-outline" title="No matching tasks" message="Try a different search or clear the current board filter." actionLabel="Clear search and filters" onAction={onClear} /> : <EmptyState icon="checkmark-done-outline" title="Your board is ready" message="Add a task to give this workspace its first next step." actionLabel="Create a task" onAction={onCreate} />; }

function ListView({ tasks, boards, now, hasRefinements, selectedTaskId, compact = false, onTask, onClear }: { tasks: Task[]; boards: import("@/lib/domain/boards").Board[]; now: Date; hasRefinements: boolean; selectedTaskId?: string; compact?: boolean; onTask: (task: Task) => void; onClear: () => void }) {
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
    {groupedByDay.length === 0 ? <View style={{ borderWidth: StyleSheet.hairlineWidth, borderStyle: "dashed", borderColor: theme.colors.border, backgroundColor: theme.colors.card, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 30, alignItems: "center" }}><Ionicons name={hasRefinements ? "search-outline" : "pulse-outline"} size={25} color={theme.colors.mutedForeground} /><Text style={{ color: theme.colors.foreground, fontSize: 16, fontWeight: "700", marginTop: 9 }}>{hasRefinements ? "No matching activity" : "No changes yet"}</Text><Text style={{ color: theme.colors.mutedForeground, fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 5 }}>{hasRefinements ? "Try a different search or clear the current board filter." : "Activity will appear here as tasks are added and updated."}</Text>{hasRefinements ? <Button variant="soft" label="Clear search and filters" onPress={onClear} style={{ marginTop: 14 }} /> : null}</View> : groupedByDay.map(([day, entries]) => <View key={day} style={{ marginBottom: 18 }}><Text style={[styles.groupTitle, { color: theme.colors.mutedForeground, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }]}>{day}</Text>{entries.map((task) => {
      const stamp = task.updatedAt || task.createdAt;
      const status = deriveStatus(task, now);
      const eventType = task.completed ? "Completed" : task.canceled ? "Canceled" : task.createdAt === task.updatedAt ? "Added" : "Updated";
       const statusColor = status === "completed" ? theme.colors.success : status === "canceled" ? theme.colors.mutedForeground : status === "overdue" ? theme.colors.destructive : theme.colors.primary;
      const board = boards.find((item) => item.id === task.category);
      const priority = PRIORITY_META[task.priority];
      if (compact) return <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} accessibilityState={{ selected: selectedTaskId === task.id }} onPress={() => onTask(task)} style={({ pressed }) => ({ minHeight: 68, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 6, borderRadius: 10, borderWidth: 1, borderColor: selectedTaskId === task.id ? theme.colors.primary : theme.colors.border, backgroundColor: selectedTaskId === task.id ? theme.colors.primarySoft : theme.colors.card, opacity: pressed ? 0.8 : 1 })}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name={task.completed ? "checkmark-circle-outline" : task.canceled ? "ban-outline" : "create-outline"} size={17} color={statusColor} /><Text numberOfLines={1} style={{ flex: 1, color: theme.colors.foreground, fontSize: 14, fontWeight: "700" }}>{task.title}</Text><Text style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>{format(parseISO(stamp), "p")}</Text></View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6, marginLeft: 25 }}><Text style={{ color: statusColor, fontSize: 11, fontWeight: "600" }}>{eventType}</Text><Text style={{ color: priority.dot, fontSize: 11, fontWeight: "600" }}>{priority.label}</Text>{task.dueAt ? <Text style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>Due {format(parseISO(task.dueAt), "MMM d")}</Text> : null}{board ? <Text numberOfLines={1} style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>{board.label}</Text> : null}</View>
      </Pressable>;
      return <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} accessibilityState={{ selected: selectedTaskId === task.id }} onPress={() => onTask(task)} style={({ pressed }) => [{ borderWidth: selectedTaskId === task.id ? 1 : StyleSheet.hairlineWidth, borderColor: selectedTaskId === task.id ? theme.colors.primary : theme.colors.border, backgroundColor: selectedTaskId === task.id ? theme.colors.primarySoft : theme.colors.card, borderRadius: 17, padding: 13, marginBottom: 8, opacity: pressed ? 0.8 : 1 }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}><View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: `${statusColor}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name={status === "completed" ? "checkmark-circle-outline" : status === "canceled" ? "ban-outline" : status === "overdue" ? "alert-circle-outline" : "create-outline"} size={17} color={statusColor} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: theme.colors.foreground, fontSize: 15, lineHeight: 20, fontWeight: "700", textDecorationLine: task.completed ? "line-through" : "none" }} numberOfLines={2}>{task.title}</Text><Text style={{ color: theme.colors.mutedForeground, fontSize: 12, marginTop: 3 }}>{eventType} · {format(parseISO(stamp), "p")}</Text></View><Ionicons name="chevron-forward" size={17} color={theme.colors.mutedForeground} /></View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 11, marginLeft: 40 }}><View style={{ minHeight: 25, paddingHorizontal: 8, borderRadius: 999, backgroundColor: `${statusColor}18`, flexDirection: "row", alignItems: "center", gap: 4 }}><Text style={{ color: statusColor, fontSize: 11, fontWeight: "800" }}>{STATUS_LABELS[status]}</Text></View><View style={{ minHeight: 25, paddingHorizontal: 8, borderRadius: 999, backgroundColor: priority.tint, flexDirection: "row", alignItems: "center", gap: 5 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: priority.dot }} /><Text style={{ color: priority.ink, fontSize: 11, fontWeight: "800" }}>{priority.label}</Text></View>{task.dueAt ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name="time-outline" size={14} color={theme.colors.mutedForeground} /><Text style={{ color: theme.colors.mutedForeground, fontSize: 11, fontWeight: "600" }}>{format(parseISO(task.dueAt), "MMM d, h:mm a")}</Text></View> : null}{board ? <Text style={{ color: theme.colors.mutedForeground, fontSize: 11, fontWeight: "600" }}>· {board.label}</Text> : null}</View>
      </Pressable>;
    })}</View>)}
  </View>;
}
function CalendarView({ month, setMonth, selectedDay, setSelectedDay, tasks, boards, now, split = false, onAddTask, onTask, onTaskAction }: { month: Date; setMonth: (date: Date) => void; selectedDay: Date | null; setSelectedDay: (date: Date | null) => void; tasks: Task[]; boards: import("@/lib/domain/boards").Board[]; now: Date; split?: boolean; onAddTask: (due?: string | null) => void; onTask: (task: Task) => void; onTaskAction: (task: Task) => void }) {
  const { theme } = useTheme();
  const { calendarDefaultView, calendarWeekStart } = usePreferences();
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(calendarDefaultView);
  const addForDay = (day: Date) => { const due = new Date(day); due.setHours(9, 0, 0, 0); onAddTask(due.toISOString()); };
  const dayTasks = useMemo(() => split && selectedDay ? tasks.filter((task) => task.dueAt && isSameDay(parseISO(task.dueAt), selectedDay)) : [], [selectedDay, split, tasks]);
  return <View>
    <CalendarPanel
      anchor={month}
      mode={calendarMode}
      selectedDay={selectedDay}
      tasks={tasks}
      now={now}
      weekStartsOn={calendarWeekStart}
      onModeChange={setCalendarMode}
      onAnchorChange={setMonth}
      onSelectDay={setSelectedDay}
      onTaskPress={onTask}
      onTaskLongPress={onTaskAction}
      onToday={() => setMonth(calendarMode === "week" ? startOfWeek(now, { weekStartsOn: calendarWeekStart }) : startOfMonth(now))}
    />
    {split && selectedDay ? <View style={{ marginTop: 15 }}>
      <SectionHeading title={format(selectedDay, "EEEE, MMM d")} subtitle={dayTasks.length ? `${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"} due. Select one to edit it in the panel.` : "Nothing is due this day yet."} style={{ marginBottom: 8 }} />
      {dayTasks.map((task) => <TaskCard key={task.id} compact task={task} boards={boards} now={now} onPress={() => onTask(task)} onLongPress={() => onTaskAction(task)} />)}
      <Button variant="soft" label={`Add for ${format(selectedDay, "MMM d")}`} onPress={() => addForDay(selectedDay)} style={{ marginTop: 4 }}><Ionicons name="add" size={17} color={theme.colors.primary} /><Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Add task</Text></Button>
    </View> : <View style={{ marginTop: 15 }}>
      <SectionHeading title="Plan a day" subtitle={split ? "Tap a date to see its tasks here, or long press a task to reschedule it." : "Tap a date to open its task sheet, or long press a task to reschedule it."} style={{ marginBottom: 8 }} />
      <View style={{ borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, backgroundColor: theme.colors.card, padding: 13 }}>
        <Button variant="soft" label={`Add for ${selectedDay ? format(selectedDay, "MMM d") : "today"}`} onPress={() => addForDay(selectedDay ?? now)}><Ionicons name="add" size={17} color={theme.colors.primary} /><Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Add task</Text></Button>
      </View>
    </View>}
  </View>;
}
function CalendarTaskActions({ task, now, onClose, onComplete, onChooseDate, onToday, onTomorrow, onClearDue }: { task: Task | null; now: Date; onClose: () => void; onComplete: () => void; onChooseDate: () => void; onToday: () => void; onTomorrow: () => void; onClearDue: () => void }) {
  return <OptionSheet visible={task !== null} title={task?.title ?? "Calendar task"} options={[{ label: task?.completed ? "Mark incomplete" : "Complete task", icon: "checkmark-circle-outline", onPress: onComplete }, { label: "Choose a day", icon: "calendar-outline", onPress: onChooseDate }, { label: `Move to today · ${format(now, "MMM d")}`, icon: "today-outline", onPress: onToday }, { label: `Move to tomorrow · ${format(addDays(now, 1), "MMM d")}`, icon: "arrow-forward-circle-outline", onPress: onTomorrow }, ...(task?.dueAt ? [{ label: "Remove due date", icon: "close-circle-outline" as const, destructive: true, onPress: onClearDue }] : [])]} onClose={onClose} />;
}

function TaskActions({ task, tasks, sections, now, onClose, onComplete, onCancel, onDelete, onMove, onMoveUp, onMoveDown }: { task: Task | null; tasks: Task[]; sections: BoardSection[]; now: Date; onClose: () => void; onComplete: () => void; onCancel: () => void; onDelete: () => void; onMove: (sectionId: string | null) => void; onMoveUp: () => void; onMoveDown: () => void }) {
  const sectionId = task ? getTaskSectionId(task, sections, now) : undefined;
  const siblings = task ? tasks.filter((item) => getTaskSectionId(item, sections, now) === sectionId) : [];
  const taskIndex = task ? siblings.findIndex((item) => item.id === task.id) : -1;
  const moveOptions = sections.filter((section) => section.id !== sectionId).map((section) => ({ label: `Move to ${section.title}`, icon: "arrow-forward-outline" as const, onPress: () => onMove(section.id) }));
  return <OptionSheet visible={task !== null} title={task?.title ?? "Task actions"} options={[{ label: task?.completed ? "Mark incomplete" : "Complete task", icon: "checkmark-circle-outline", onPress: onComplete }, { label: task?.canceled ? "Restore task" : "Cancel task", icon: "close-circle-outline", onPress: onCancel }, ...(taskIndex > 0 ? [{ label: "Move task up", icon: "arrow-up-outline" as const, onPress: onMoveUp }] : []), ...(taskIndex >= 0 && taskIndex < siblings.length - 1 ? [{ label: "Move task down", icon: "arrow-down-outline" as const, onPress: onMoveDown }] : []), ...moveOptions, { label: "Delete task", icon: "trash-outline", destructive: true, onPress: onDelete }]} onClose={onClose} />;
}

const styles = StyleSheet.create({ root: { flex: 1 }, headerBlock: { borderBottomWidth: StyleSheet.hairlineWidth }, loading: { flex: 1, alignItems: "center", justifyContent: "center" }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 2 }, headerActions: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth }, headerActionButton: { flex: 1, minHeight: 44 }, headerTitle: { flex: 1, marginHorizontal: 4, minWidth: 0 }, headerEyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: "#737686", marginBottom: 1 }, ribbonLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginRight: 2 }, boardName: { fontSize: 17, fontWeight: "800" }, summary: { fontSize: 11, marginTop: 2 }, stickyTools: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, elevation: 3, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, searchRow: { flexDirection: "row", alignItems: "center", gap: 7 }, searchBox: { flex: 1, height: 44, flexDirection: "row", alignItems: "center", paddingLeft: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth }, modeSwitchContent: { paddingRight: 4 }, modeSwitch: { flexDirection: "row", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 3, gap: 2 }, modeSwitchItem: { minHeight: 44, minWidth: 78, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, statusBar: { minHeight: 28, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 }, statusText: { fontSize: 10, fontWeight: "600" }, hiddenSections: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 10, marginBottom: 12, gap: 8 }, hiddenSectionsHeader: { flexDirection: "row", alignItems: "center", gap: 6 }, hiddenSectionsScroll: { gap: 8 }, hiddenSectionChip: { minHeight: 40, maxWidth: 190, paddingHorizontal: 11, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 6 }, boardScroll: { gap: 12, paddingRight: 16, paddingBottom: 12 }, column: { width: 292, minHeight: 280, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 12 }, columnHeader: { flexDirection: "row", alignItems: "center", minHeight: 48, marginBottom: 8 }, columnTitle: { fontSize: 16, fontWeight: "800" }, addColumn: { width: 180, minHeight: 110, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }, listGroup: { marginBottom: 18 }, groupTitle: { fontSize: 17, fontWeight: "800", marginBottom: 9 }, monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, monthTitle: { fontSize: 19, fontWeight: "800" }, weekRow: { flexDirection: "row", marginBottom: 4 }, weekLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "800" }, calendarGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: "#00000015" }, dayCell: { width: `${100 / 7}%`, height: 58, alignItems: "center", justifyContent: "center", borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, gap: 7 }, dayDots: { flexDirection: "row", gap: 3, height: 5 }, dayDot: { width: 5, height: 5, borderRadius: 3 }, calendarFooter: { marginTop: 22, padding: 16, borderRadius: 19, backgroundColor: "#00000008" }, sheetTitle: { fontSize: 21, fontWeight: "800" }, sheetCopy: { fontSize: 14, lineHeight: 20, marginTop: 5 }, optionTools: { flexDirection: "row", paddingHorizontal: 10, paddingTop: 5, paddingBottom: 4 }, optionToolGroup: { borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5, gap: 3 }, optionToolButtons: { flexDirection: "row" }, optionTool: { minWidth: 65, maxWidth: 92, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 6 }, optionToolText: { fontSize: 10, textAlign: "center" }, optionToolDot: { width: 9, height: 9, borderRadius: 5 }, optionCaption: { textAlign: "center", fontSize: 9, letterSpacing: 0.5 }, optionActionRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48 }, optionDropdown: { minWidth: 148, height: 36, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 }, optionDropdownLabel: { flexShrink: 1, fontSize: 12, fontWeight: "600" },
});
