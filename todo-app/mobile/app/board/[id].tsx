import { Ionicons } from "@expo/vector-icons";
import { BlurTargetView } from "expo-blur";
import { addDays, format, isSameDay, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarPanel, type CalendarMode } from "@/components/calendar/calendar-panel";
import { CalendarDayTasks } from "@/components/calendar/calendar-day-tasks";
import { InsightsFiltersRibbon, InsightsPanel, OptionSheet, TaskCard, TaskEditor, TextEntrySheet } from "@/components/janus-board-ui";
import { DEFAULT_FILTERS, hasActiveFilters, type InsightsFilters } from "@/lib/features/insights-filters";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { JanusLogo } from "@/components/ui/janus-logo";
import { PriorityStars } from "@/components/ui/priority-stars";
import { StatusIcon } from "@/components/ui/status-icon";
import { tactileCardSurface } from "@/components/ui/tactile";
import { Sheet } from "@/components/ui/sheet";
import { anchorFromEvent, type MenuAnchor } from "@/components/ui/anchored-menu";
import { RibbonScrollView } from "@/components/ui/ribbon-scroll-view";
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
import { MobileBoardRibbon, type RibbonControls } from "@/components/board/mobile-board-ribbon";
import { EventDebugButton } from "@/components/ui/event-debug-button";
import { CreateListDialog } from "@/components/board/create-list-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PRIORITY_META, PRIORITY_ORDER, SORT_OPTIONS } from "@/lib/domain/constants";
import { deriveStatus, STATUS_LABELS } from "@/lib/domain/status";
import { getTaskSectionId, isCustomSection } from "@/lib/domain/sections";
import { matchesBoardTag } from "@/lib/features/special-card-tags";
import { exportWorkspace, exportWorkspaceCsv, pickWorkspaceFile } from "@/lib/data/transfer";
import { matchesQuery, sortTasks } from "@/lib/domain/tasks-selectors";
import { rescheduleToDay } from "@/lib/utils/datetime";
import { getRibbonContext } from "@/lib/features/ribbon-context";
import { ribbonLabel } from "@/lib/utils/ribbon-label";
import { rankTopTasks } from "@/lib/features/top-tasks";
import { sectionDropOrder, taskDropOrder } from "@/lib/features/janus-drag";
import { mobileBottomNavClearance, mobileContentStyle } from "@/theme/layout";
import type { BoardSection, Priority, SortKey, Task, TaskDraft, ViewMode } from "@/lib/domain/types";
import { CommandPalette, type PaletteMode } from "@/components/ui/command-palette";
import type { Command } from "@/lib/features/commands";
import { createNavigationCommands } from "@/lib/features/navigation-commands";

export default function WorkspaceScreen() {
  const { theme, setPreference } = useTheme();
  const { width, height } = useWindowDimensions();
  const blurTarget = useRef<ComponentRef<typeof BlurTargetView> | null>(null);
  const insets = useSafeAreaInsets();
  const { boardDisplay, setBoardDisplayPreferences } = usePreferences();
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
  const fullWidthFeed = splitView || (mode === "insights" && width >= 768);
  const [query, setQuery] = useState("");
  const [compactCards, setCompactCardsState] = useState(boardDisplay.compactCards);
  const [zoom, setZoomState] = useState(boardDisplay.zoom);
  const [showMoveArrows, setShowMoveArrowsState] = useState(boardDisplay.showMoveArrows);
  const [focusedColumn, setFocusedColumnState] = useState(boardDisplay.focusedColumn);
  const setCompactCards = (value: boolean) => { setCompactCardsState(value); setBoardDisplayPreferences({ compactCards: value }); };
  const setZoom = (value: number) => { setZoomState(value); setBoardDisplayPreferences({ zoom: value }); };
  const setShowMoveArrows = (value: boolean) => { setShowMoveArrowsState(value); setBoardDisplayPreferences({ showMoveArrows: value }); };
  const setFocusedColumn = (value: boolean) => { setFocusedColumnState(value); setBoardDisplayPreferences({ focusedColumn: value }); };
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
  // Anchors "small" option menus to the press point on tablet/wide layouts.
  const [smallMenuAnchor, setSmallMenuAnchor] = useState<MenuAnchor | null>(null);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>(null);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [renameBoardOpen, setRenameBoardOpen] = useState(false);
  const [renameCardTarget, setRenameCardTarget] = useState<Task | null>(null);
  const [insightsFilters, setInsightsFilters] = useState<InsightsFilters>(DEFAULT_FILTERS);
  const [insightsOverlayOpen, setInsightsOverlayOpen] = useState(false);
  const ribbonFiltersActive = mode === "insights" ? hasActiveFilters(insightsFilters) : boardFilter !== "all";
  const ribbonControls = useRef<RibbonControls | null>(null);
  const openSmallMenu = (event: GestureResponderEvent, open: () => void) => {
    setSmallMenuAnchor(anchorFromEvent(event));
    open();
  };
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
  const visibleTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortTasks(tasks.filter((task) => (boardFilter === "all" || matchesBoardTag(task, boardFilter, boards)) && matchesQuery(task, needle)), sort);
  }, [boardFilter, boards, query, sort, tasks]);
  // Split Calendar always has a selected date; opening it starts with today,
  // not the old undated create form or a task from another day.
  const selectedCalendarDay = calendarDay ?? (splitView && mode === "calendar" ? now : null);
  const calendarTasks = useMemo(() => selectedCalendarDay ? visibleTasks.filter((task) => task.dueAt && isSameDay(parseISO(task.dueAt), selectedCalendarDay)) : [], [selectedCalendarDay, visibleTasks]);
  const calendarDaySelected = mode === "calendar" && selectedCalendarDay !== null;
  const defaultEditorTask = useMemo(() => {
    if (calendarDaySelected) return calendarTasks.find((task) => !task.completed && !task.canceled) ?? calendarTasks[0] ?? null;
    const entries = tasks.map((task) => ({ task, projectId: currentProjectId, projectName: "", boards }));
    // Match Top Tasks' priority/deadline ordering. Finished-only boards still
    // keep a real task editable, using persisted board order as fallback.
    return rankTopTasks(entries)[0]?.task ?? tasks[0] ?? null;
  }, [boards, calendarDaySelected, calendarTasks, currentProjectId, tasks]);
  const selectionBelongsToBoard = editorProjectId === currentProjectId;
  const validEditorSelection = selectionBelongsToBoard && selectedEditorTask ? (calendarDaySelected ? calendarTasks : tasks).find((task) => task.id === selectedEditorTask.id) : undefined;
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

  useEffect(() => {
    // Remember the default once; ranking, autosaves and filters must not steal
    // selection. Only deletion or a board switch chooses another default.
    if (!splitView || isLoading) return;
    if (!validEditorSelection && !creatingEditorTask) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditorTask(editorTask);
      setEditorProjectId(currentProjectId);
      if (!editorTask) setEditorVisible(false);
    }
    if (!editorVisible && editorTask) setEditorVisible(true);
  }, [creatingEditorTask, currentProjectId, editorTask, editorVisible, isLoading, splitView, validEditorSelection]);
  const renderedBoardTasks = useMemo(() => {
    const hiddenSectionIds = new Set(sections.filter((section) => section.hidden).map((section) => section.id));
    return visibleTasks.filter((task) => {
      const sectionId = getTaskSectionId(task, sections, now);
      return sectionId === undefined || !hiddenSectionIds.has(sectionId);
    });
  }, [now, sections, visibleTasks]);
  const selectedTasks = useMemo(() => renderedBoardTasks.filter((task) => selectedTaskIds.has(task.id)), [renderedBoardTasks, selectedTaskIds]);
  const allVisibleSelected = renderedBoardTasks.length > 0 && renderedBoardTasks.every((task) => selectedTaskIds.has(task.id));
  const enterSelectionMode = () => { if (!getRibbonContext(mode).selection) return; setSelectionMode(true); setSelectedTaskIds(new Set()); };
  const exitSelectionMode = () => { setSelectionMode(false); setSelectedTaskIds(new Set()); };
  const closeTaskOverlays = () => {
    setEditorVisible(false);
    setEditorTask(null);
    setInitialDueAt(null);
    setInitialSectionId(null);
    setCalendarDay(null);
    setCalendarActionTask(null);
    setCalendarPickerTask(null);
    setTaskAction(null);
  };
  const changeMode = (value: ViewMode) => {
    if (value === "list" && !hasTasks) return;
    if (value === mode) return;
    closeTaskOverlays();
    if (value !== "board" && selectionMode) exitSelectionMode();
    setMode(value);
  };
  const leaveWorkspace = () => {
    closeTaskOverlays();
    router.replace("/");
  };
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
    api.setTasksStatus(eligibleTasks.map((task) => task.id), status);
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
  const addNewTask = (due?: string | null, sectionId?: string | null) => {
    const target = sections.find((section) => section.id === sectionId && !section.hidden) ?? sections.find((section) => !section.hidden);
    if (!target) { setAddSectionOpen(true); toast.show("Create a list before adding a card"); return; }
    const selectedDate = due === undefined && mode === "calendar" ? new Date(selectedCalendarDay ?? Date.now()) : null;
    selectedDate?.setHours(9, 0, 0, 0);
    setEditorProjectId(currentProjectId); setEditorTask(null); setInitialDueAt(due ?? selectedDate?.toISOString() ?? null); setInitialSectionId(target.id); setEditorVisible(true);
  };
  const saveTaskSection = (taskId: string, sectionId: string | null) => {
    if (sectionId === null) return;
    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;
    if (isCustomSection(section)) api.setTaskSectionId(taskId, section.id);
    else api.assignTaskToSection(taskId, section.id);
  };
  const saveTask = (draft: TaskDraft, sectionId: string | null) => {
    if (!sectionId || !sections.some((section) => section.id === sectionId)) { toast.error("Choose a list before saving"); return; }
    if (editorTask) { api.updateTask(editorTask.id, draft); const currentSectionId = getTaskSectionId(editorTask, sections, now) ?? null; if (sectionId !== currentSectionId) saveTaskSection(editorTask.id, sectionId); toast.success("Task updated"); }
    else { api.addTask(draft, sectionId); toast.success("Task added", { description: draft.title }); }
    setEditorVisible(false); setEditorTask(null); setInitialDueAt(null); setInitialSectionId(null);
  };
  const autoSaveTask = (draft: TaskDraft, sectionId: string | null) => {
    if (!editorTask) return;
    if (!sections.some((section) => section.id === sectionId)) return;
    const liveTask = tasks.find((task) => task.id === editorTask.id);
    if (!liveTask) return;
    api.updateTask(liveTask.id, draft);
    const currentSectionId = getTaskSectionId(liveTask, sections, now) ?? null;
    if (sectionId !== currentSectionId) saveTaskSection(liveTask.id, sectionId);
  };
  const createFilterTag = (label: string) => {
    if (boards.some((board) => board.label.toLowerCase() === label.toLowerCase())) {
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
  const selectCalendarDay = (day: Date | null) => {
    setCalendarDay(day);
    if (!splitView || !day) return;
    const dayTasks = visibleTasks.filter((task) => task.dueAt && isSameDay(parseISO(task.dueAt), day));
    const firstTask = dayTasks.find((task) => !task.completed && !task.canceled) ?? dayTasks[0];
    setEditorProjectId(currentProjectId);
    setEditorTask(firstTask ?? null);
    setEditorVisible(!!firstTask);
    setInitialDueAt(null);
    setInitialSectionId(null);
  };
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
    closeTaskOverlays();
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
    if (tasks.some((task) => task.sectionId === target.id)) {
      setDeleteSectionTarget(null);
      toast.error("Move or delete this list’s cards first", { description: "Only empty lists can be deleted." });
      return;
    }
    const before = api.snapshot();
    api.deleteSection(target.id);
    setDeleteSectionTarget(null);
    toast.success(`“${target.title}” deleted`, {
      description: "The empty list was removed.",
      action: { label: "Undo", onPress: () => api.restore(before) },
    });
  };
  const moveTaskToSection = (task: Task, sectionId: string | null) => {
    const target = sections.find((section) => section.id === sectionId);
    if (!target) return;
    if (sectionId !== null && getTaskSectionId(task, sections, now) === sectionId) return;
    const before = api.snapshot();
    if (isCustomSection(target)) api.setTaskSectionId(task.id, target.id);
    else api.assignTaskToSection(task.id, target.id);
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

  const dropTask = (taskId: string, sectionId: string | null, beforeTaskId: string | null) => {
    const task = tasks.find((item) => item.id === taskId);
    const section = sections.find((item) => item.id === sectionId && !item.hidden);
    if (!task || !section) return;
    const siblings = visibleTasks.filter((item) => (getTaskSectionId(item, sections, now) ?? null) === sectionId).map((item) => item.id);
    const orderedIds = taskDropOrder(taskId, siblings, beforeTaskId);
    if (!orderedIds) return;
    const sameSection = (getTaskSectionId(task, sections, now) ?? null) === sectionId;
    if (sameSection && orderedIds.every((value, index) => value === siblings[index])) return;
    const before = api.snapshot();
    const previousSort = sort;
    if (!sameSection) api.setTaskSectionId(taskId, sectionId);
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
  const visibleSections = sections.filter((section) => !section.hidden);
  const cardTargets = (run: (task: Task) => void, eligible: (task: Task) => boolean = () => true): Command[] => renderedBoardTasks.filter(eligible).map((task) => ({ id: task.id, label: task.title, detail: sections.find((section) => section.id === getTaskSectionId(task, sections, now))?.title, run: () => run(task) }));
  const neighborList = (task: Task, direction: -1 | 1) => {
    const from = visibleSections.findIndex((section) => section.id === getTaskSectionId(task, sections, now));
    return from < 0 ? undefined : visibleSections[from + direction];
  };
  const commands: Command[] = [
    { id: "new-board", label: "Create new board", shortcut: "B", run: () => setNewBoardOpen(true) },
    { id: "new-card", label: "Create new card", shortcut: "N", run: () => addNewTask() },
    { id: "new-list", label: "Create new list", shortcut: "L", run: () => setAddSectionOpen(true) },
    { id: "rename-board", label: "Rename current board", shortcut: "Shift R", run: () => setRenameBoardOpen(true) },
    { id: "rename-card", label: "Rename card", shortcut: "R", children: cardTargets(setRenameCardTarget) },
    { id: "edit-card", label: "Edit card", children: cardTargets(openEditor) },
    { id: "complete-card", label: "Toggle card complete", children: cardTargets((task) => api.toggleComplete(task.id), (task) => !task.canceled) },
    ...([-1, 1] as const).map((direction): Command => ({ id: direction === -1 ? "card-left" : "card-right", label: `Move card ${direction === -1 ? "left" : "right"}`, shortcut: `Shift ${direction === -1 ? "←" : "→"}`, detail: "Choose a card to move to the neighboring visible list", children: cardTargets((task) => { const target = neighborList(task, direction); if (target) moveTaskToSection(task, target.id); }, (task) => !!neighborList(task, direction)) })),
    ...(["up", "down"] as const).map((direction): Command => ({ id: `card-${direction}`, label: `Move card ${direction}`, shortcut: `Shift ${direction === "up" ? "↑" : "↓"}`, detail: "Reorder within its list", children: cardTargets((task) => reorderTask(task, direction), (task) => { const siblings = visibleTasks.filter((item) => getTaskSectionId(item, sections, now) === getTaskSectionId(task, sections, now)); const from = siblings.findIndex((item) => item.id === task.id); return direction === "up" ? from > 0 : from < siblings.length - 1; }) })),
    { id: "rename-list", label: "Rename list", children: sections.filter(isCustomSection).map((section) => ({ id: section.id, label: section.title, run: () => setRenameSectionTarget(section) })) },
    ...(["left", "right"] as const).map((direction): Command => ({ id: `list-${direction}`, label: `Move list ${direction}`, children: sections.filter((_, index) => direction === "left" ? index > 0 : index < sections.length - 1).map((section) => ({ id: section.id, label: section.title, run: () => moveSection(section, direction) })) })),
    ...createNavigationCommands({ projects: projects.map((project) => project.id === currentProjectId ? { ...project, workspace: { tasks, sections, boards } } : project), currentProjectId: id, openBoard: switchProject, navigate: (destination) => { closeTaskOverlays(); exitSelectionMode(); router.replace(destination); }, setTheme: typeof setPreference === "function" ? setPreference : undefined }),
    ...(["board", "list", "calendar", "insights"] as const).filter((value) => value !== "list" || hasTasks).map((value): Command => ({ id: `view-${value}`, label: `View ${value === "list" ? "activity" : value}`, shortcut: String(["board", "list", "calendar", "insights"].indexOf(value) + 1), run: () => changeMode(value) })),
    ...(getRibbonContext(mode).boardDisplay ? [
      { id: "compact", label: compactCards ? "Use comfortable cards" : "Use compact cards", shortcut: "K", run: () => setCompactCards(!compactCards) },
      { id: "focus-column", label: focusedColumn ? "Show all columns" : "Focus one column", shortcut: "G", run: () => setFocusedColumn(!focusedColumn) },
      { id: "move-arrows", label: showMoveArrows ? "Hide move arrows" : "Show move arrows", shortcut: "W", run: () => setShowMoveArrows(!showMoveArrows) },
      { id: "zoom-in", label: "Zoom in", shortcut: "=", run: () => setZoom(Math.min(1.3, Math.round((zoom + 0.1) * 10) / 10)) },
      { id: "zoom-out", label: "Zoom out", shortcut: "-", run: () => setZoom(Math.max(0.7, Math.round((zoom - 0.1) * 10) / 10)) },
      { id: "zoom-reset", label: "Reset zoom to 100%", shortcut: "0", run: () => setZoom(1) },
      ...(width >= 768 ? [{ id: "dragging", label: dragEnabled ? "Disable dragging" : "Enable dragging", shortcut: "Shift D", run: () => { setDragEnabled(!dragEnabled); if (!dragEnabled) setFocusedColumn(false); } }] : []),
    ] : []),
  ];
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
  // Reuse the same actions as the ribbon. Target pickers remain searchable and
  // destructive commands require a second, explicit selection before running.
  const confirmCommand = (id: string, label: string, run: () => void): Command => ({ id, label, children: [{ id: `${id}-confirm`, label: `Confirm: ${label}`, detail: "Choose Confirm to run it", run }] });
  const ribbonContext = getRibbonContext(mode);
  const ribbonCommands: Command[] = [
    { id: "home-tools", label: "Show Home ribbon tools", shortcut: "Shift U", run: () => ribbonControls.current?.openTab("home") },
    { id: "actions-tools", label: "Show Actions ribbon tools", shortcut: "Shift O", run: () => ribbonControls.current?.openTab("actions") },
    { id: "pin-ribbon", label: "Toggle ribbon pin", shortcut: "Shift P", run: () => ribbonControls.current?.togglePin() },
    ...(!selectionMode ? [{ id: "expand-ribbon", label: "Expand / collapse ribbon", run: () => ribbonControls.current?.toggleExpanded() }] : []),
    { id: "load-sample", label: "Load sample workspace", shortcut: "Shift M", run: () => { const before = api.snapshot(); api.loadSample(); toast.show("Sample workspace loaded", { action: { label: "Undo", onPress: () => api.restore(before) } }); } },
    { id: "export-json", label: "Export board as JSON", run: () => { void exportWorkspace(liveWorkspace, activeProject.name); } },
    { id: "export-csv", label: "Export board as CSV", run: () => { void exportWorkspaceCsv(liveWorkspace, activeProject.name); } },
    { id: "import-board", label: "Import board", run: () => { void importBoard(); } },
    { id: "save-version", label: "Save board version", run: () => { api.createVersion(); toast.success("Version saved"); } },
    confirmCommand("clear-done", "Clear completed cards", clearCompleted),
    confirmCommand("close-board", "Close current board", closeBoard),
    ...(api.versions.length ? [
      confirmCommand("restore-version", `Restore version: ${api.versions[0].label}`, () => { api.restoreVersion(api.versions[0].id); toast.success("Version restored"); }),
      confirmCommand("delete-version", `Delete version: ${api.versions[0].label}`, () => { api.deleteVersion(api.versions[0].id); toast.success("Version deleted"); }),
    ] : []),
    ...(ribbonContext.search ? [{ id: "search-tasks", label: "Search tasks and labels", shortcut: "Q", run: () => ribbonControls.current?.focusSearch() }] : []),
    ...(mode === "insights" ? [
      { id: "filters-tools", label: "Show Insights filters", shortcut: "F", run: () => ribbonControls.current?.openTab("filters") },
      { id: "reset-insights-filters", label: "Reset Insights filters", run: () => setInsightsFilters({ ...DEFAULT_FILTERS }) },
    ] : []),
    ...(ribbonContext.filters && mode !== "insights" ? [
      {
        id: "filter-tags", label: "Filter by tag", shortcut: "F", children: [
          { id: "all", label: "All tags (no filter)", selected: boardFilter === "all", run: () => { setBoardFilter("all"); setSelectedTaskIds(new Set()); } },
          ...boards.map((board) => ({ id: board.id, label: board.label, selected: boardFilter === board.id, run: () => { setBoardFilter(board.id); setSelectedTaskIds(new Set()); } })),
        ]
      },
      { id: "clear-filters", label: "Clear search and tag filter", shortcut: "Shift F", run: () => { setQuery(""); setBoardFilter("all"); setSelectedTaskIds(new Set()); } },
      { id: "filters-tools", label: "Show Filters ribbon tools", run: () => ribbonControls.current?.openTab("filters") },
      { id: "add-tag", label: "Add filter / tag", shortcut: "Shift L", run: () => setAddFilterOpen(true) },
      ...(boards.length ? [{ id: "remove-tag", label: "Remove filter / tag", shortcut: "Shift X", children: boards.map((board) => confirmCommand(board.id, `Remove tag: ${board.label}`, () => removeTag(board))) }] : []),
    ] : []),
    ...(ribbonContext.sorting ? [{ id: "sort-tasks", label: "Sort cards", shortcut: "O", children: SORT_OPTIONS.map((option) => ({ id: option.value, label: option.label, selected: sort === option.value, run: () => setSort(option.value) })) }] : []),
    ...(ribbonContext.boardDisplay ? [
      { id: "list-visibility", label: "Show / hide list", children: sections.map((section) => ({ id: section.id, label: `${section.hidden ? "Show" : "Hide"}: ${section.title}`, run: () => toggleSectionVisibility(section) })) },
      ...(sections.some((section) => section.hidden) ? [{ id: "hidden-tools", label: "Show Hidden lists ribbon tools", shortcut: "Shift V", run: () => ribbonControls.current?.openTab("hidden") }] : []),
    ] : []),
    ...(ribbonContext.selection ? [
      { id: "select-mode", label: selectionMode ? "Exit card selection" : "Select cards", shortcut: "V", run: () => { if (selectionMode) exitSelectionMode(); else ribbonControls.current?.openTab("select"); } },
      ...(selectionMode ? [
        { id: "toggle-card-selection", label: "Select / unselect a card", children: cardTargets((task) => toggleSelectedTask(task.id)).map((entry) => ({ ...entry, selected: selectedTaskIds.has(entry.id) })) },
        { id: "select-all", label: "Select all visible cards", shortcut: "A", run: selectAllVisible },
        ...(selectedTasks.length ? [
          { id: "unselect-all", label: "Unselect all cards", shortcut: "U", run: () => setSelectedTaskIds(new Set<string>()) },
          { id: "complete-selected", label: "Complete selected cards", shortcut: "D", run: () => runBulkStatus("completed", "Tasks completed") },
          { id: "cancel-selected", label: "Cancel selected cards", shortcut: "C", run: () => runBulkStatus("canceled", "Tasks canceled") },
          { id: "restore-selected", label: "Restore selected cards", shortcut: "Shift C", run: () => runBulkStatus("open", "Tasks restored") },
          { id: "move-selected", label: "Move selected cards to list", shortcut: "M", children: sections.map((section) => ({ id: section.id, label: section.title, run: () => runBulkMove(section.id) })) },
          { id: "priority-selected", label: "Set selected cards priority", shortcut: "P", children: PRIORITY_ORDER.map((priority) => ({ id: priority, label: PRIORITY_META[priority].label, run: () => runBulkPriority(priority) })) },
          confirmCommand("delete-selected", "Delete selected cards", deleteSelected),
        ] : []),
      ] : []),
    ] : []),
  ];
  const boardGroup = <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionActionRow}><OptionTool icon="archive-outline" label="Close board" onPress={closeBoard} /><Pressable accessibilityRole="button" accessibilityLabel={`Switch board: ${activeProject?.name ?? "Current board"}`} accessibilityHint="Opens a dropdown of open boards." onPress={(event) => openSmallMenu(event, () => setProjectSwitcherOpen(true))} style={[styles.optionDropdown, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}><Ionicons name="swap-horizontal-outline" size={15} color={theme.colors.mutedForeground} /><Text numberOfLines={1} ellipsizeMode="tail" style={[styles.optionDropdownLabel, { maxWidth: 128, minWidth: 0, color: theme.colors.foreground }]}>{ribbonLabel(activeProject?.name ?? "Switch board")}</Text><Ionicons name="chevron-down" size={15} color={theme.colors.mutedForeground} /></Pressable></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>BOARD</Text></View>;
  const actionsContent = <RibbonScrollView accessibilityLabel="Board actions" contentContainerStyle={styles.optionTools}>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="sparkles-outline" label="Load sample" onPress={() => { const before = api.snapshot(); api.loadSample(); toast.show("Sample workspace loaded", { action: { label: "Undo", onPress: () => api.restore(before) } }); }} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>CREATE</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="share-outline" label="Export JSON" onPress={() => { if (activeProject) void exportWorkspace(liveWorkspace, activeProject.name); }} /><OptionTool icon="document-text-outline" label="Export CSV" onPress={() => { if (activeProject) void exportWorkspaceCsv(liveWorkspace, activeProject.name); }} /><OptionTool icon="download-outline" label="Import board" onPress={importBoard} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>DATA</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="bookmark-outline" label="Save version" onPress={() => { api.createVersion(); toast.success("Version saved"); }} />{api.versions.length ? <OptionTool icon="return-down-back-outline" label={`Restore ${api.versions[0].label}`} onPress={() => { api.restoreVersion(api.versions[0].id); toast.success("Version restored"); }} /> : null}{api.versions.length ? <OptionTool icon="trash-outline" label={`Delete ${api.versions[0].label}`} tone="danger" onPress={() => { api.deleteVersion(api.versions[0].id); toast.success("Version deleted"); }} /> : null}</View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>VERSIONS</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="checkmark-done-outline" label="Clear done" onPress={clearCompleted} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>TIDY UP</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><EventDebugButton onOpenChange={setInsightsOverlayOpen} /></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>DEBUG</Text></View>
  </RibbonScrollView>;
  const activeFilterBoard = boards.find((board) => board.id === boardFilter);
  const activeSortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort";
  const showEditor = !activityUnavailable && (splitView || (editorVisible && (!editorTask || tasks.some((task) => task.id === editorTask.id))));
  const taskEditor = <TaskEditor presentation={splitView ? "panel" : "sheet"} visible={showEditor} task={editorTask} initialDueAt={initialDueAt} initialSectionId={initialSectionId} boards={boards} sections={sections} onClose={() => setEditorVisible(false)} onSave={saveTask} onAutoSave={editorTask ? autoSaveTask : undefined} onDelete={editorTask ? () => { const before = api.snapshot(); api.deleteTask(editorTask.id); setEditorVisible(false); toast.success("Task deleted", { action: { label: "Undo", onPress: () => api.restore(before) } }); } : undefined} onCancelTask={editorTask ? () => { api.toggleCancel(editorTask.id); setEditorVisible(false); } : undefined} />;
  const filterOptions = [{ label: "All boards", icon: boardFilter === "all" ? "checkmark-circle" as const : "radio-button-off-outline" as const, onPress: () => { setBoardFilter("all"); setSelectedTaskIds(new Set()); } }, ...boards.map((board) => ({ label: board.label, icon: boardFilter === board.id ? "checkmark-circle" as const : "radio-button-off-outline" as const, onPress: () => { setBoardFilter(board.id); setSelectedTaskIds(new Set()); } }))];
  const filtersContent = mode === "insights" ? <InsightsFiltersRibbon filters={insightsFilters} onChange={setInsightsFilters} boards={boards} now={now} onOverlayChange={setInsightsOverlayOpen} /> : <RibbonScrollView accessibilityLabel="Board filters" contentContainerStyle={styles.optionTools}>
    {getRibbonContext(mode).sorting ? <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionActionRow}><Pressable accessibilityRole="button" accessibilityLabel={`Sort cards: ${activeSortLabel}`} accessibilityHint="Opens a dropdown of sort options." onPress={(event) => openSmallMenu(event, () => setSortMenu(true))} style={[styles.optionDropdown, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}><Ionicons name="swap-vertical-outline" size={15} color={theme.colors.mutedForeground} /><Text numberOfLines={1} ellipsizeMode="tail" style={[styles.optionDropdownLabel, { maxWidth: 128, minWidth: 0, color: theme.colors.foreground }]}>{ribbonLabel(activeSortLabel)}</Text><Ionicons name="chevron-down" size={15} color={theme.colors.mutedForeground} /></Pressable></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>SORT</Text></View> : null}
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionActionRow}><Pressable accessibilityRole="button" accessibilityLabel={`Filter board: ${activeFilterBoard?.label ?? "All boards"}`} accessibilityHint="Opens a dropdown of boards to filter by." onPress={(event) => openSmallMenu(event, () => setFilterMenu(true))} style={[styles.optionDropdown, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}>{activeFilterBoard ? <View style={[styles.optionToolDot, { backgroundColor: boardColor(activeFilterBoard.color).dot }]} /> : <Ionicons name="grid-outline" size={15} color={theme.colors.mutedForeground} />}<Text numberOfLines={1} ellipsizeMode="tail" style={[styles.optionDropdownLabel, { maxWidth: 128, minWidth: 0, color: theme.colors.foreground }]}>{ribbonLabel(activeFilterBoard?.label ?? "All boards")}</Text><Ionicons name="chevron-down" size={15} color={theme.colors.mutedForeground} /></Pressable></View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>FILTER</Text></View>
    <View style={[styles.optionToolGroup, { borderColor: theme.colors.border }]}><View style={styles.optionToolButtons}><OptionTool icon="pricetag-outline" label="Add filter/tag" onPress={() => setAddFilterOpen(true)} />{boards.length ? <OptionTool icon="trash-outline" label="Remove tag" tone="danger" onPress={(event) => openSmallMenu(event, () => setRemoveTagOpen(true))} /> : null}</View><Text style={[styles.optionCaption, { color: theme.colors.mutedForeground }]}>TAGS</Text></View>
  </RibbonScrollView>;
  return (
    <View testID="workspace-viewport" style={[styles.root, { height, maxHeight: height, minHeight: 0, overflow: "hidden", backgroundColor: theme.colors.background }]}>
      <BlurTargetView ref={blurTarget} style={{ flex: 1, minHeight: 0 }}>
        <ThemeAtmosphere />
        <View style={{ flex: 1, minHeight: 0, paddingLeft: insets.left, paddingRight: insets.right }}>
          <MobileBoardRibbon toolsOverlayOpen={insightsOverlayOpen} controlsRef={ribbonControls} onCommands={() => setPaletteMode("commands")} hiddenSections={sections.filter((section) => section.hidden)} onShowSection={toggleSectionVisibility} selection={selectionMode ? <BulkSelectionToolbar selectedCount={selectedTasks.length} allSelected={allVisibleSelected} onSelectAll={selectAllVisible} onClear={() => setSelectedTaskIds(new Set())} onComplete={() => runBulkStatus("completed", "Tasks completed")} onCancel={() => runBulkStatus("canceled", "Tasks canceled")} onRestore={() => runBulkStatus("open", "Tasks restored")} onDelete={deleteSelected} onMove={(event) => openSmallMenu(event, () => setBulkSectionMenu(true))} onPriority={(event) => openSmallMenu(event, () => setBulkPriorityMenu(true))} onClose={exitSelectionMode} /> : null} selecting={selectionMode} onSelect={enterSelectionMode} onDeselect={exitSelectionMode} filters={filtersContent} filtersActive={ribbonFiltersActive} mode={mode} onMode={changeMode} query={query} onQuery={(value) => { setQuery(value); setSelectedTaskIds(new Set()); }} onBoards={leaveWorkspace} onSwitchBoard={(event) => { closeTaskOverlays(); if (event) setSmallMenuAnchor(anchorFromEvent(event)); setProjectSwitcherOpen(true); }} onNewTask={() => addNewTask()} onAddSection={() => setAddSectionOpen(true)} zoom={zoom} onZoom={(next) => setZoom(Math.min(1.3, Math.max(0.7, Math.round(next * 10) / 10)))} compact={compactCards} onCompact={() => setCompactCards(!compactCards)} showMoveArrows={showMoveArrows} onShowMoveArrows={() => setShowMoveArrows(!showMoveArrows)} focused={focusedColumn} onFocused={() => setFocusedColumn(!focusedColumn)} dragEnabled={dragEnabled} onToggleDrag={() => { setDragEnabled((enabled) => !enabled); if (!dragEnabled) setFocusedColumn(false); }} homeBoard={boardGroup}>
            {actionsContent}
          </MobileBoardRibbon>
          <View style={{ flex: 1, minHeight: 0, flexDirection: "row" }}>
            {mode === "board" ? <View style={{ flex: 1, minHeight: 0 }}>
              {hasRefinements && visibleTasks.length === 0 ? <ScrollView contentContainerStyle={[mobileContentStyle, { paddingBottom: mobileBottomNavClearance + insets.bottom }]}><WorkspaceEmptyState hasRefinements onCreate={() => addNewTask()} onClear={() => { setQuery(""); setBoardFilter("all"); setSelectedTaskIds(new Set()); }} /></ScrollView> : <MobileTaskColumns key={id} tasks={visibleTasks} sections={sections} boards={boards} now={now} compact={compactCards} zoom={zoom} showMoveArrows={showMoveArrows} dragEnabled={dragEnabled} focused={focusedColumn} selectionMode={selectionMode} selectedTaskIds={selectedTaskIds} onToggleSelect={toggleSelectedTask} onTask={openEditor} onLongPress={(task, event) => { if (event) setSmallMenuAnchor(anchorFromEvent(event)); setTaskAction(task); }} onMove={moveTaskToSection} onTaskDrop={dropTask} onSectionDrop={dropSection} onToggleSubtask={api.toggleSubtask} onAddTask={(sectionId) => addNewTask(null, sectionId)} onSectionMenu={(section, anchor) => { setSmallMenuAnchor(anchor ?? null); setSectionMenu(section); }} onRenameSection={setRenameSectionTarget} onAddSection={() => setAddSectionOpen(true)} />}
            </View> : <ScrollView testID="workspace-feed-pane" style={{ flex: 1, minWidth: 0 }} contentContainerStyle={fullWidthFeed ? { padding: splitView ? 12 : 20, paddingBottom: mobileBottomNavClearance + insets.bottom } : [mobileContentStyle, { paddingBottom: mobileBottomNavClearance + insets.bottom }]} showsVerticalScrollIndicator={fullWidthFeed} keyboardShouldPersistTaps="handled">
              {mode === "list" ? <ListView compact={splitView} tasks={visibleTasks} boards={boards} now={now} hasRefinements={hasRefinements} selectedTaskId={splitView && showEditor ? editorTask?.id : undefined} onTask={openEditor} onTaskAction={(task, event) => { if (event) { setSmallMenuAnchor(anchorFromEvent(event)); setTaskAction(task); } else { setTaskAction(task); } }} onClear={() => { setQuery(""); setBoardFilter("all"); }} /> : mode === "calendar" ? <CalendarView month={calendarMonth} setMonth={setCalendarMonth} selectedDay={selectedCalendarDay} setSelectedDay={selectCalendarDay} tasks={visibleTasks} boards={boards} split={splitView} onAddTask={addNewTask} onTask={openEditor} onTaskAction={(task, event) => { if (event) setSmallMenuAnchor(anchorFromEvent(event)); setCalendarActionTask(task); }} now={now} /> : <InsightsPanel tasks={tasks} boards={boards} now={now} filters={insightsFilters} />}
            </ScrollView>}
            <View key={currentProjectId} testID="workspace-editor-pane" style={splitView ? { flex: 1, minWidth: 0, minHeight: 0, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border, backgroundColor: theme.colors.card } : undefined}>
              {splitView && calendarDaySelected && !editorTask && !creatingEditorTask ? <View testID="calendar-empty-day-watermark" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: mobileBottomNavClearance + insets.bottom }}>
                <View style={{ opacity: 0.08 }}><JanusLogo size={Math.max(0, (width - insets.left - insets.right) / 3)} color={theme.colors.foreground} surfaceColor={theme.colors.card} shadow /></View>
              </View> : taskEditor}
            </View>
          </View>
        </View>
      </BlurTargetView>
      <CommandPalette mode={paletteMode} onMode={setPaletteMode} commands={[...commands, ...ribbonCommands]} blocked={(!splitView && editorVisible) || !!taskAction || !!sectionMenu || projectSwitcherOpen || !!renameSectionTarget || !!deleteSectionTarget || addSectionOpen || filterMenu || addFilterOpen || removeTagOpen || sortMenu || bulkSectionMenu || bulkPriorityMenu || (!splitView && !!calendarDay) || !!calendarActionTask || !!calendarPickerTask || newBoardOpen || renameBoardOpen || !!renameCardTarget} />
      <TextEntrySheet visible={newBoardOpen} title="New board" placeholder="Board name" actionLabel="Create board" onClose={() => setNewBoardOpen(false)} onSubmit={(name) => { const nextId = api.createProject(name); setNewBoardOpen(false); if (nextId) { closeTaskOverlays(); router.replace(`/board/${nextId}`); } }} />
      <TextEntrySheet visible={renameBoardOpen} title="Rename board" initialValue={activeProject.name} placeholder="Board name" onClose={() => setRenameBoardOpen(false)} onSubmit={(name) => { api.renameProject(activeProject.id, name); setRenameBoardOpen(false); }} />
      <TextEntrySheet visible={renameCardTarget !== null} title="Rename card" initialValue={renameCardTarget?.title ?? ""} placeholder="Card name" onClose={() => setRenameCardTarget(null)} onSubmit={(title) => { if (renameCardTarget && tasks.some((task) => task.id === renameCardTarget.id)) api.patchTask(renameCardTarget.id, { title }); setRenameCardTarget(null); }} />
      <MobileBoardBottomNav mode={mode} hasTasks={hasTasks} onMode={changeMode} blurTarget={blurTarget} />
      <CalendarTaskActions task={calendarActionTask} now={now} onClose={() => setCalendarActionTask(null)} onComplete={() => { if (calendarActionTask) api.toggleComplete(calendarActionTask.id); setCalendarActionTask(null); }} onChooseDate={() => { if (calendarActionTask) setCalendarPickerTask(calendarActionTask); setCalendarActionTask(null); }} onToday={() => { if (calendarActionTask) rescheduleTask(calendarActionTask, startOfDay(now)); setCalendarActionTask(null); }} onTomorrow={() => { if (calendarActionTask) rescheduleTask(calendarActionTask, addDays(startOfDay(now), 1)); setCalendarActionTask(null); }} onClearDue={() => { if (calendarActionTask) clearTaskDueDate(calendarActionTask); setCalendarActionTask(null); }} anchor={smallMenuAnchor} />
      {calendarPickerTask ? <DateTimePicker value={calendarPickerTask.dueAt ? parseISO(calendarPickerTask.dueAt) : now} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, selected) => { setCalendarPickerTask(null); if (selected) rescheduleTask(calendarPickerTask, selected); }} /> : null}
      <TaskActions task={taskAction} anchor={smallMenuAnchor} tasks={visibleTasks} sections={sections} now={now} onClose={() => setTaskAction(null)} onComplete={() => { if (taskAction) api.toggleComplete(taskAction.id); setTaskAction(null); }} onCancel={() => { if (taskAction) api.toggleCancel(taskAction.id); setTaskAction(null); }} onDelete={() => { if (taskAction) { const before = api.snapshot(); api.deleteTask(taskAction.id); setTaskAction(null); toast.success("Task deleted", { action: { label: "Undo", onPress: () => api.restore(before) } }); } }} onMove={(sectionId) => { if (taskAction) moveTaskToSection(taskAction, sectionId); setTaskAction(null); }} onMoveUp={() => { if (taskAction) reorderTask(taskAction, "up"); setTaskAction(null); }} onMoveDown={() => { if (taskAction) reorderTask(taskAction, "down"); setTaskAction(null); }} />
      <OptionSheet visible={projectSwitcherOpen} title="Switch board" options={projectOptions} onClose={() => setProjectSwitcherOpen(false)} anchor={smallMenuAnchor} />
      <OptionSheet visible={filterMenu} title="Filter by board" options={filterOptions} onClose={() => setFilterMenu(false)} anchor={smallMenuAnchor} />
      <TextEntrySheet visible={addFilterOpen} title="Add filter/tag" description="Create a tag to group tasks and filter this board." placeholder="Tag name" actionLabel="Add tag" onClose={() => setAddFilterOpen(false)} onSubmit={createFilterTag} />
      <OptionSheet visible={removeTagOpen} title="Remove tag" options={boards.map((board) => ({ label: board.label, icon: "trash-outline" as const, destructive: true, onPress: () => removeTag(board) }))} onClose={() => setRemoveTagOpen(false)} anchor={smallMenuAnchor} />
      <OptionSheet visible={sortMenu} title="Sort tasks" options={SORT_OPTIONS.map((option) => ({ label: option.label, icon: sort === option.value ? "checkmark-circle" : "radio-button-off-outline", onPress: () => setSort(option.value) }))} onClose={() => setSortMenu(false)} anchor={smallMenuAnchor} />
      <OptionSheet visible={bulkSectionMenu} title="Move selected tasks" options={sections.map((section) => ({ label: `Move to ${section.title}`, icon: "arrow-forward-outline" as const, onPress: () => runBulkMove(section.id) }))} onClose={() => setBulkSectionMenu(false)} anchor={smallMenuAnchor} />
      <OptionSheet visible={bulkPriorityMenu} title="Set selected priority" options={PRIORITY_ORDER.map((priority) => ({ label: PRIORITY_META[priority].label, icon: "star-outline" as const, onPress: () => runBulkPriority(priority) }))} onClose={() => setBulkPriorityMenu(false)} anchor={smallMenuAnchor} />
      <OptionSheet visible={sectionMenu !== null} title={sectionMenu?.title ?? "List"} options={sectionMenu ? [
        ...(isCustomSection(sectionMenu) ? [{ label: "Rename list", icon: "pencil-outline" as const, onPress: () => setRenameSectionTarget(sectionMenu) }] : []),
        { label: sectionMenu.hidden ? "Show list" : "Hide list", icon: sectionMenu.hidden ? "eye-outline" as const : "eye-off-outline" as const, onPress: () => toggleSectionVisibility(sectionMenu) },
        ...(sections.findIndex((section) => section.id === sectionMenu.id) > 0 ? [{ label: "Move list left", icon: "arrow-back-outline" as const, onPress: () => moveSection(sectionMenu, "left") }] : []),
        ...(sections.findIndex((section) => section.id === sectionMenu.id) < sections.length - 1 ? [{ label: "Move list right", icon: "arrow-forward-outline" as const, onPress: () => moveSection(sectionMenu, "right") }] : []),
        ...(isCustomSection(sectionMenu) ? [{ label: "Delete list", icon: "trash-outline" as const, destructive: true, onPress: () => setDeleteSectionTarget(sectionMenu) }] : []),
      ] : []} onClose={() => setSectionMenu(null)} anchor={smallMenuAnchor} />
      <ConfirmationDialog visible={deleteSectionTarget !== null} title="Delete list?" description={`“${deleteSectionTarget?.title ?? ""}” can be removed once it is empty. Move or delete its cards first.`} confirmLabel="Delete list" cancelLabel="Keep list" onClose={() => setDeleteSectionTarget(null)} onConfirm={deleteList} />
      <TextEntrySheet visible={renameSectionTarget !== null} title="Rename list" initialValue={renameSectionTarget?.title ?? ""} placeholder="List name" onClose={() => setRenameSectionTarget(null)} onSubmit={(value) => { if (renameSectionTarget) api.renameSection(renameSectionTarget.id, value); setRenameSectionTarget(null); }} />
      <CreateListDialog visible={addSectionOpen} title={sectionTitle} onChangeTitle={setSectionTitle} onClose={() => setAddSectionOpen(false)} onCreate={(title) => { api.addSection(title); setSectionTitle(""); setAddSectionOpen(false); }} />
      {splitView || mode !== "calendar" ? null : <Sheet visible={calendarDay !== null} onClose={() => setCalendarDay(null)}>
        {calendarDay ? (
          <>
            <Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>{format(calendarDay, "EEEE, MMM d")}</Text>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: 13, marginTop: 4 }}>{calendarTasks.length} {calendarTasks.length === 1 ? "task" : "tasks"} · Select a task to edit it</Text>
            <View style={{ marginTop: 14 }}>
              {calendarTasks.length ? calendarTasks.map((task) => <TaskCard key={task.id} task={task} boards={boards} now={now} onPress={() => { setCalendarDay(null); openEditor(task); }} onLongPress={(event) => { if (event) setSmallMenuAnchor(anchorFromEvent(event)); setCalendarDay(null); setCalendarActionTask(task); }} onActionPress={(event) => { setSmallMenuAnchor(anchorFromEvent(event)); setCalendarDay(null); setCalendarActionTask(task); }} />) : <EmptyState icon="sunny-outline" title="A clear day" message="Nothing is due here yet." />}
              <Button variant="soft" label="Add task for this day" onPress={() => { const due = new Date(calendarDay); due.setHours(9, 0, 0, 0); setCalendarDay(null); addNewTask(due.toISOString()); }} style={{ marginTop: 6 }}><Ionicons name="add" size={18} color={theme.colors.primary} /><Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Add task for this day</Text></Button>
            </View>
          </>
        ) : null}
      </Sheet>}
    </View>
  );
}

function OptionTool({ icon, dot, label, onPress, selected = false, tone = "default" }: { icon?: keyof typeof Ionicons.glyphMap; dot?: string; label: string; onPress: (event: GestureResponderEvent) => void; selected?: boolean; tone?: "default" | "danger" }) { const { theme } = useTheme(); const color = tone === "danger" ? theme.colors.destructive : selected ? theme.colors.primary : theme.colors.mutedForeground; return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={styles.optionTool}>{dot ? <View style={[styles.optionToolDot, { backgroundColor: dot }]} /> : icon ? <Ionicons name={icon} size={19} color={color} /> : null}<Text numberOfLines={2} style={[styles.optionToolText, { color }]}>{label}</Text></Pressable>; }


function WorkspaceEmptyState({ hasRefinements, onCreate, onClear }: { hasRefinements: boolean; onCreate: () => void; onClear: () => void }) { return hasRefinements ? <EmptyState plain title="No matching tasks" message="Try a different search or clear the current board filter." actionLabel="Clear search and filters" onAction={onClear} /> : <EmptyState icon="checkmark-done-outline" title="Your board is ready" message="Add a task to give this workspace its first next step." actionLabel="Create a task" onAction={onCreate} />; }

function ListView({ tasks, boards, now, hasRefinements, selectedTaskId, compact = false, onTask, onClear, onTaskAction }: { tasks: Task[]; boards: import("@/lib/domain/boards").Board[]; now: Date; hasRefinements: boolean; selectedTaskId?: string; compact?: boolean; onTask: (task: Task) => void; onClear: () => void; onTaskAction?: (task: Task, event?: GestureResponderEvent) => void }) {
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
      if (compact) return <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} accessibilityState={{ selected: selectedTaskId === task.id }} onPress={() => onTask(task)} style={({ pressed }) => [{ minHeight: 68, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: selectedTaskId === task.id ? theme.colors.primary : theme.colors.border, backgroundColor: theme.colors.card }, tactileCardSurface({ pressed, selected: selectedTaskId === task.id, dark: theme.scheme === "dark" })]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name={task.completed ? "checkmark-circle-outline" : task.canceled ? "ban-outline" : "create-outline"} size={17} color={statusColor} /><Text numberOfLines={1} style={{ flex: 1, color: theme.colors.foreground, fontSize: 14, fontWeight: "700" }}>{task.title}</Text><Text style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>{format(parseISO(stamp), "p")}</Text></View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6, marginLeft: 25 }}><Text style={{ color: statusColor, fontSize: 11, fontWeight: "600" }}>{eventType}</Text><PriorityStars priority={task.priority} size={11} />{task.dueAt ? <Text style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>Due {format(parseISO(task.dueAt), "MMM d")}</Text> : null}{board ? <Text numberOfLines={1} style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>{board.label}</Text> : null}</View>
      </Pressable>;
      return <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} accessibilityState={{ selected: selectedTaskId === task.id }} onPress={() => onTask(task)} style={({ pressed }) => [{ borderWidth: 1, borderColor: selectedTaskId === task.id ? theme.colors.primary : theme.colors.border, backgroundColor: theme.colors.card, borderRadius: 17, padding: 13, marginBottom: 8 }, tactileCardSurface({ pressed, selected: selectedTaskId === task.id, dark: theme.scheme === "dark" })]}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}><StatusIcon status={status} size={17} /><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: theme.colors.foreground, fontSize: 15, lineHeight: 20, fontWeight: "700", textDecorationLine: task.completed ? "line-through" : "none" }} numberOfLines={2}>{task.title}</Text><Text style={{ color: theme.colors.mutedForeground, fontSize: 12, marginTop: 3 }}>{eventType} · {format(parseISO(stamp), "p")}</Text></View><Ionicons name="chevron-forward" size={17} color={theme.colors.mutedForeground} /></View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 11, marginLeft: 40 }}><Text style={{ color: statusColor, fontSize: 11, fontWeight: "800" }}>{STATUS_LABELS[status]}</Text><PriorityStars priority={task.priority} />{task.dueAt ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name="time-outline" size={14} color={theme.colors.mutedForeground} /><Text style={{ color: theme.colors.mutedForeground, fontSize: 11, fontWeight: "600" }}>{format(parseISO(task.dueAt), "MMM d, h:mm a")}</Text></View> : null}{board ? <Text style={{ color: theme.colors.mutedForeground, fontSize: 11, fontWeight: "600" }}>· {board.label}</Text> : null}</View>
      </Pressable>;
    })}</View>)}
  </View>;
}
function CalendarView({ month, setMonth, selectedDay, setSelectedDay, tasks, boards, now, split = false, onAddTask, onTask, onTaskAction }: { month: Date; setMonth: (date: Date) => void; selectedDay: Date | null; setSelectedDay: (date: Date | null) => void; tasks: Task[]; boards: import("@/lib/domain/boards").Board[]; now: Date; split?: boolean; onAddTask: (due?: string | null) => void; onTask: (task: Task) => void; onTaskAction: (task: Task, event?: GestureResponderEvent) => void }) {
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
      daySelectionOnly
      onModeChange={setCalendarMode}
      onAnchorChange={setMonth}
      onSelectDay={setSelectedDay}
      onTaskPress={onTask}
      onTaskLongPress={onTaskAction}
      onToday={() => { setMonth(calendarMode === "week" ? startOfWeek(now, { weekStartsOn: calendarWeekStart }) : startOfMonth(now)); setSelectedDay(startOfDay(now)); }}
    />
    {split && selectedDay ? <CalendarDayTasks day={selectedDay} tasks={dayTasks} boards={boards} now={now} onTask={onTask} onTaskAction={onTaskAction} onAddTask={() => addForDay(selectedDay)} /> : null}
  </View>;
}
function CalendarTaskActions({ task, now, onClose, onComplete, onChooseDate, onToday, onTomorrow, onClearDue, anchor }: { task: Task | null; now: Date; onClose: () => void; onComplete: () => void; onChooseDate: () => void; onToday: () => void; onTomorrow: () => void; onClearDue: () => void; anchor?: MenuAnchor | null }) {
  return <OptionSheet visible={task !== null} title={task?.title ?? "Calendar task"} options={[{ label: task?.completed ? "Mark incomplete" : "Complete task", icon: "checkmark-circle-outline" as const, onPress: onComplete }, ...(Platform.OS !== "web" ? [{ label: "Choose a day", icon: "calendar-outline" as const, onPress: onChooseDate }] : []), { label: `Move to today · ${format(now, "MMM d")}`, icon: "today-outline" as const, onPress: onToday }, { label: `Move to tomorrow · ${format(addDays(now, 1), "MMM d")}`, icon: "arrow-forward-circle-outline" as const, onPress: onTomorrow }, ...(task?.dueAt ? [{ label: "Remove due date", icon: "close-circle-outline" as const, destructive: true, onPress: onClearDue }] : [])]} onClose={onClose} anchor={anchor} />;
}

function TaskActions({ task, tasks, sections, now, onClose, onComplete, onCancel, onDelete, onMove, onMoveUp, onMoveDown, anchor }: { task: Task | null; tasks: Task[]; sections: BoardSection[]; now: Date; onClose: () => void; onComplete: () => void; onCancel: () => void; onDelete: () => void; onMove: (sectionId: string | null) => void; onMoveUp: () => void; onMoveDown: () => void; anchor?: MenuAnchor | null }) {
  const sectionId = task ? getTaskSectionId(task, sections, now) : undefined;
  const siblings = task ? tasks.filter((item) => getTaskSectionId(item, sections, now) === sectionId) : [];
  const taskIndex = task ? siblings.findIndex((item) => item.id === task.id) : -1;
  const moveOptions = sections.filter((section) => section.id !== sectionId).map((section) => ({ label: `Move to ${section.title}`, icon: "arrow-forward-outline" as const, onPress: () => onMove(section.id) }));
  return <OptionSheet visible={task !== null} title={task?.title ?? "Task actions"} options={[{ label: task?.completed ? "Mark incomplete" : "Complete task", icon: "checkmark-circle-outline" as const, onPress: onComplete }, { label: task?.canceled ? "Restore task" : "Cancel task", icon: "close-circle-outline" as const, onPress: onCancel }, ...(taskIndex > 0 ? [{ label: "Move task up", icon: "arrow-up-outline" as const, onPress: onMoveUp }] : []), ...(taskIndex >= 0 && taskIndex < siblings.length - 1 ? [{ label: "Move task down", icon: "arrow-down-outline" as const, onPress: onMoveDown }] : []), ...moveOptions, { label: "Delete task", icon: "trash-outline" as const, destructive: true, onPress: onDelete }]} onClose={onClose} anchor={anchor} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, headerBlock: { borderBottomWidth: StyleSheet.hairlineWidth }, loading: { flex: 1, alignItems: "center", justifyContent: "center" }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 2 }, headerActions: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth }, headerActionButton: { flex: 1, minHeight: 44 }, headerTitle: { flex: 1, marginHorizontal: 4, minWidth: 0 }, headerEyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: "#737686", marginBottom: 1 }, ribbonLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginRight: 2 }, boardName: { fontSize: 17, fontWeight: "800" }, summary: { fontSize: 11, marginTop: 2 }, stickyTools: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, elevation: 3, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, searchRow: { flexDirection: "row", alignItems: "center", gap: 7 }, searchBox: { flex: 1, height: 44, flexDirection: "row", alignItems: "center", paddingLeft: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth }, modeSwitchContent: { paddingRight: 4 }, modeSwitch: { flexDirection: "row", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 3, gap: 2 }, modeSwitchItem: { minHeight: 44, minWidth: 78, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, statusBar: { minHeight: 28, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 }, statusText: { fontSize: 10, fontWeight: "600" }, hiddenSections: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 10, marginBottom: 12, gap: 8 }, hiddenSectionsHeader: { flexDirection: "row", alignItems: "center", gap: 6 }, hiddenSectionsScroll: { gap: 8 }, hiddenSectionChip: { minHeight: 40, maxWidth: 190, paddingHorizontal: 11, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 6 }, boardScroll: { gap: 12, paddingRight: 16, paddingBottom: 12 }, column: { width: 292, minHeight: 280, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 12 }, columnHeader: { flexDirection: "row", alignItems: "center", minHeight: 48, marginBottom: 8 }, columnTitle: { fontSize: 16, fontWeight: "800" }, addColumn: { width: 180, minHeight: 110, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }, listGroup: { marginBottom: 18 }, groupTitle: { fontSize: 17, fontWeight: "800", marginBottom: 9 }, monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, monthTitle: { fontSize: 19, fontWeight: "800" }, weekRow: { flexDirection: "row", marginBottom: 4 }, weekLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "800" }, calendarGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: "#00000015" }, dayCell: { width: `${100 / 7}%`, height: 58, alignItems: "center", justifyContent: "center", borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, gap: 7 }, dayDots: { flexDirection: "row", gap: 3, height: 5 }, dayDot: { width: 5, height: 5, borderRadius: 3 }, calendarFooter: { marginTop: 22, padding: 16, borderRadius: 19, backgroundColor: "#00000008" }, sheetTitle: { fontSize: 21, fontWeight: "800" }, sheetCopy: { fontSize: 14, lineHeight: 20, marginTop: 5 }, optionTools: { flexDirection: "row", paddingHorizontal: 10, paddingTop: 5, paddingBottom: 4 }, optionToolGroup: { borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5, gap: 3 }, optionToolButtons: { flexDirection: "row" }, optionTool: { minWidth: 65, maxWidth: 92, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 6 }, optionToolText: { fontSize: 10, textAlign: "center" }, optionToolDot: { width: 9, height: 9, borderRadius: 5 }, optionCaption: { textAlign: "center", fontSize: 9, letterSpacing: 0.5 }, optionActionRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48 }, optionDropdown: { minWidth: 148, height: 36, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 }, optionDropdownLabel: { flexShrink: 1, fontSize: 12, fontWeight: "600" },
});
