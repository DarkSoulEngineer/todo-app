import DateTimePicker from "@react-native-community/datetimepicker";
import { addDays, format, isSameDay, isValid, parseISO, startOfDay } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarPanel, type CalendarMode } from "@/components/calendar/calendar-panel";
import { OptionSheet, TaskEditor } from "@/components/janus-board-ui";
import { ReferenceMobileBottomNav, type ReferenceMobileTab } from "@/components/reference/mobile/reference-mobile-bottom-nav";
import { ReferenceMyTasksScreen } from "@/components/reference/mobile/reference-my-tasks-screen";
import { Pill, ScreenHeader, SurfaceCard } from "@/components/reference/mobile/reference-primitives";
import { useReferenceTheme, type ReferenceColors, referenceSpacing } from "@/components/reference/reference-theme";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { SectionHeading } from "@/components/ui/section-heading";
import { useAllBoardTasks } from "@/hooks/use-all-board-tasks";
import { deriveStatus } from "@/lib/domain/status";
import { rescheduleToDay } from "@/lib/utils/datetime";
import type { Task, TaskDraft } from "@/lib/domain/types";
import { usePreferences } from "@/providers/preferences-provider";
import { useToast } from "@/providers/toast-provider";
import { getTaskSectionId } from "@/lib/domain/sections";
import { mobileBottomNavClearance, mobileContentStyle } from "@/theme/layout";

export default function CalendarRoute() {
  const { api, entries } = useAllBoardTasks();
  const { colors, type } = useReferenceTheme();
  const { calendarDefaultView, calendarWeekStart } = usePreferences();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const styles = createStyles(colors);
  const today = startOfDay(new Date());
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(calendarDefaultView);
  const [calendarAnchor, setCalendarAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);
  const [calendarActionTask, setCalendarActionTask] = useState<Task | null>(null);
  const [calendarPickerTask, setCalendarPickerTask] = useState<Task | null>(null);
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorProjectId, setEditorProjectId] = useState<string | null>(null);
  const [addDueAt, setAddDueAt] = useState<string | null>(null);
  const tasks = useMemo(() => entries.map((entry) => entry.task), [entries]);
  const agendaTasks = useMemo(() => entries.map(({ task, projectId, projectName, boards }) => ({
    task, projectId, projectLabel: projectName,
    boardLabel: boards.find((board) => board.id === task.category)?.label,
  })), [entries]);
  const projectIdByTaskId = useMemo(() => new Map(entries.map((entry) => [entry.task.id, entry.projectId])), [entries]);

  const openTask = (task: Task) => {
    const projectId = projectIdByTaskId.get(task.id);
    setEditorTask(task);
    setEditorProjectId(projectId ?? null);
    setAddDueAt(null);
    setEditorVisible(true);
  };

  const selectedTasks = useMemo(() => tasksForDay(tasks, selectedDay), [tasks, selectedDay]);

  const selectDay = (day: Date) => {
    setSelectedDay(day);
    setCalendarAnchor(day);
  };
  const selectToday = () => selectDay(today);
  const addTaskForSelectedDay = () => {
    setEditorTask(null);
    setEditorProjectId(api.currentProjectId ?? null);
    setAddDueAt(rescheduleToDay(selectedDay, null));
    setEditorVisible(true);
  };
  const rescheduleTask = (task: Task, day: Date) => api.setTaskDueAt(task.id, rescheduleToDay(day, task.dueAt));

  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "calendar") return;
    if (tab === "boards") return router.replace("/");
    if (tab === "settings") return router.replace("/settings");
  };

  const editorEntry = useMemo(() => {
    if (!editorTask) return null;
    if (editorProjectId) {
      const entry = entries.find((e) => e.projectId === editorProjectId && e.task.id === editorTask.id);
      if (entry) return entry;
    }
    return entries.find((e) => e.task.id === editorTask.id) ?? null;
  }, [editorProjectId, editorTask, entries]);

  const editorBoards = editorTask ? (editorEntry?.boards ?? []) : api.boards;
  const editorSections = useMemo(() => {
    if (editorTask && editorEntry) {
      const project = api.projects.find((p) => p.id === editorEntry.projectId);
      if (project?.workspace) {
        if (project.id === api.currentProjectId) return api.sections;
        return project.workspace.sections;
      }
      if (editorEntry.projectId === api.currentProjectId) return api.sections;
      return [];
    }
    return api.sections;
  }, [api.currentProjectId, api.projects, api.sections, editorEntry, editorTask]);

  const saveTask = (draft: TaskDraft, sectionId: string | null) => {
    if (editorTask) {
      api.updateTask(editorTask.id, draft);
      if (editorEntry) {
        const currentSectionId = getTaskSectionId(editorTask, editorSections, new Date()) ?? null;
        if (sectionId !== currentSectionId) {
          if (sectionId === null) {
            api.setTaskSectionId(editorTask.id, null);
          } else {
            api.assignTaskToSection(editorTask.id, sectionId);
          }
        }
      }
      toast.success("Task updated");
    } else {
      const projectId = editorEntry?.projectId ?? editorProjectId ?? api.currentProjectId;
      if (projectId && api.switchProject && projectId !== api.currentProjectId) {
        api.switchProject(projectId);
      }
      const task = api.addTask(draft);
      if (sectionId) {
        api.assignTaskToSection(task.id, sectionId);
      }
      toast.success("Task added", { description: draft.title });
    }
    setEditorVisible(false);
    setEditorTask(null);
    setEditorProjectId(null);
    setAddDueAt(null);
  };

  const autoSaveTask = (draft: TaskDraft, sectionId: string | null) => {
    if (!editorTask) return;
    api.updateTask(editorTask.id, draft);
    if (editorEntry) {
      const currentSectionId = getTaskSectionId(editorTask, editorSections, new Date()) ?? null;
      if (sectionId !== currentSectionId) {
        if (sectionId === null) {
          api.setTaskSectionId(editorTask.id, null);
        } else {
          api.assignTaskToSection(editorTask.id, sectionId);
        }
      }
    }
  };

  return (
    <>
      <View style={styles.root}>
        <ThemeAtmosphere />
        <ScreenHeader title="Calendar" showThemeToggle={false} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + mobileBottomNavClearance }]}>
          <CalendarPanel
            anchor={calendarAnchor}
            mode={calendarMode}
            selectedDay={selectedDay}
            tasks={tasks}
            now={today}
            weekStartsOn={calendarWeekStart}
            onModeChange={setCalendarMode}
            onAnchorChange={setCalendarAnchor}
            onSelectDay={selectDay}
            onTaskPress={openTask}
            onTaskLongPress={setCalendarActionTask}
            onToday={selectToday}
          />

          <SectionHeading title={format(selectedDay, "EEEE, MMM d")} right={<Pill label={`${selectedTasks.length} due`} tone="primary" />} style={styles.sectionHeading} />
          <SurfaceCard style={styles.taskCard}>
            {selectedTasks.length ? selectedTasks.map((task) => <CalendarTask key={task.id} task={task} onPress={() => openTask(task)} onToggle={() => api.toggleComplete(task.id)} onMenu={() => setCalendarActionTask(task)} />) : <Text style={[type.body, { color: colors.muted, textAlign: "center", paddingVertical: 18 }]}>Nothing is due on this day.</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel={`Add task for ${format(selectedDay, "MMMM d")}`} onPress={addTaskForSelectedDay} style={styles.addDayButton}><Ionicons name="add" size={18} color={colors.primary} /><Text style={[type.bodyStrong, { color: colors.primary }]}>Add task for this day</Text></Pressable>
          </SurfaceCard>

          <ReferenceMyTasksScreen
            embedded
            tasks={agendaTasks}
            onTaskPress={openTask}
            onTaskLongPress={setCalendarActionTask}
            onToggleComplete={(task) => api.toggleComplete(task.id)}
            onReviewAttention={() => {
              const task = tasks.find((task) => deriveStatus(task, today) === "overdue");
              if (task) openTask(task);
            }}
            onRescheduleAttention={() => {
              const task = tasks.find((task) => deriveStatus(task, today) === "overdue");
              if (task) setCalendarActionTask(task);
            }}
          />
        </ScrollView>
        <ReferenceMobileBottomNav active="calendar" onNavigate={navigate} />
        <CalendarTaskActions task={calendarActionTask} now={today} onClose={() => setCalendarActionTask(null)} onChooseDate={() => { if (calendarActionTask) setCalendarPickerTask(calendarActionTask); }} onToday={() => { if (calendarActionTask) rescheduleTask(calendarActionTask, today); }} onTomorrow={() => { if (calendarActionTask) rescheduleTask(calendarActionTask, addDays(today, 1)); }} onClearDue={() => { if (calendarActionTask) api.setTaskDueAt(calendarActionTask.id, null); }} />
        {calendarPickerTask ? <DateTimePicker value={calendarPickerTask.dueAt ? parseISO(calendarPickerTask.dueAt) : today} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, selected) => { void event; const task = calendarPickerTask; setCalendarPickerTask(null); if (selected) rescheduleTask(task, selected); }} /> : null}
      </View>
      <TaskEditor
        visible={editorVisible}
        task={editorTask}
        initialDueAt={addDueAt}
        boards={editorBoards}
        sections={editorSections}
        onClose={() => {
          setEditorVisible(false);
          setEditorTask(null);
          setEditorProjectId(null);
          setAddDueAt(null);
        }}
        onSave={saveTask}
        onAutoSave={editorTask ? autoSaveTask : undefined}
        onDelete={
          editorTask
            ? () => {
                const before = api.snapshot();
                api.deleteTask(editorTask.id);
                setEditorVisible(false);
                setEditorTask(null);
                setEditorProjectId(null);
                setAddDueAt(null);
                toast.success("Task deleted", { action: { label: "Undo", onPress: () => api.restore(before) } });
              }
            : undefined
        }
        onCancelTask={
          editorTask
            ? () => {
                api.toggleCancel(editorTask.id);
                setEditorVisible(false);
                setEditorTask(null);
                setEditorProjectId(null);
                setAddDueAt(null);
              }
            : undefined
        }
      />
    </>
  );
}

function tasksForDay(tasks: Task[], day: Date): Task[] {
  return tasks.filter((task) => task.dueAt && isValid(parseISO(task.dueAt)) && isSameDay(parseISO(task.dueAt), day)).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
}

function CalendarTaskActions({ task, now, onClose, onChooseDate, onToday, onTomorrow, onClearDue }: { task: Task | null; now: Date; onClose: () => void; onChooseDate: () => void; onToday: () => void; onTomorrow: () => void; onClearDue: () => void }) {
  return <OptionSheet visible={task !== null} title={task?.title ?? "Calendar task"} options={[{ label: "Choose a day", icon: "calendar-outline", onPress: onChooseDate }, { label: `Move to today · ${format(now, "MMM d")}`, icon: "today-outline", onPress: onToday }, { label: `Move to tomorrow · ${format(addDays(now, 1), "MMM d")}`, icon: "arrow-forward-circle-outline", onPress: onTomorrow }, ...(task?.dueAt ? [{ label: "Remove due date", icon: "close-circle-outline" as const, destructive: true, onPress: onClearDue }] : [])]} onClose={onClose} />;
}

function CalendarTask({ task, onPress, onToggle, onMenu }: { task: Task; onPress: () => void; onToggle: () => void; onMenu: () => void }) {
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.taskRow}>
      <Pressable accessibilityRole="checkbox" aria-checked={task.completed} accessibilityState={{ checked: task.completed }} accessibilityLabel={`${task.completed ? "Mark incomplete" : "Complete"} ${task.title}`} onPress={(event) => { event.stopPropagation(); onToggle(); }} style={styles.checkboxHit}><View style={[styles.checkbox, task.completed && styles.checkboxDone]}>{task.completed ? <Text style={styles.checkmark}>✓</Text> : null}</View></Pressable>
      <Pressable style={{ flex: 1, minHeight: 44, justifyContent: "center" }} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={onPress} onLongPress={onMenu}>
        <Text style={[type.bodyStrong, { textDecorationLine: task.completed ? "line-through" : "none", color: task.completed ? colors.muted : colors.text }]}>{task.title || "Untitled task"}</Text>
        <Text style={[type.caption, { color: colors.muted, marginTop: 3 }]}>{task.dueAt ? format(parseISO(task.dueAt), "h:mm a") : "No deadline"} · {task.priority} priority</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${task.title}`} onPress={(event) => { event.stopPropagation(); onMenu(); }} style={styles.taskAction}><Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} /></Pressable>
    </View>
  );
}

function createStyles(colors: ReferenceColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: mobileContentStyle,
  sectionHeading: { marginTop: 16, marginBottom: 9 },
  taskCard: { padding: referenceSpacing.sm },
  taskRow: { minHeight: 62, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant },
  checkboxHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: colors.outline, alignItems: "center", justifyContent: "center" },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkmark: { color: colors.onPrimary, fontWeight: "800" },
  taskAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  addDayButton: { minHeight: 44, marginTop: 8, borderRadius: 10, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
}); }
