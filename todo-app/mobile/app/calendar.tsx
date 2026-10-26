import DateTimePicker from "@react-native-community/datetimepicker";
import { addDays, addMonths, addWeeks, format, isSameDay, isSameMonth, isValid, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OptionSheet } from "@/components/janus-board-ui";
import { ReferenceMobileBottomNav, type ReferenceMobileTab } from "@/components/reference/mobile/reference-mobile-bottom-nav";
import { IconButton, Pill, ScreenHeader, SurfaceCard } from "@/components/reference/mobile/reference-primitives";
import { useReferenceTheme, type ReferenceColors, referenceSpacing } from "@/components/reference/reference-theme";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { useTasksContext } from "@/providers/tasks-provider";
import { rescheduleToDay } from "@/lib/utils/datetime";
import type { Task } from "@/lib/domain/types";

type CalendarMode = "month" | "week";

export default function CalendarRoute() {
  const api = useTasksContext();
  const { colors, type } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const today = startOfDay(new Date());
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [calendarAnchor, setCalendarAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);
  const [calendarActionTask, setCalendarActionTask] = useState<Task | null>(null);
  const [calendarPickerTask, setCalendarPickerTask] = useState<Task | null>(null);

  const firstDay = startOfWeek(calendarMode === "week" ? calendarAnchor : startOfMonth(calendarAnchor), { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: calendarMode === "week" ? 7 : 42 }, (_, index) => addDays(firstDay, index)), [calendarMode, firstDay]);
  const selectedTasks = useMemo(() => tasksForDay(api.tasks, selectedDay), [api.tasks, selectedDay]);
  const unscheduledTasks = useMemo(() => api.tasks.filter((task) => !task.dueAt), [api.tasks]);
  const title = calendarMode === "week"
    ? `${format(days[0], "MMM d")} to ${format(days[6], "MMM d, yyyy")}`
    : format(calendarAnchor, "MMMM yyyy");

  const selectDay = (day: Date) => {
    setSelectedDay(day);
    setCalendarAnchor(day);
  };
  const shiftCalendar = (delta: number) => setCalendarAnchor((current) => calendarMode === "week" ? addWeeks(current, delta) : addMonths(current, delta));
  const selectToday = () => selectDay(today);
  const addTaskForSelectedDay = () => router.push({ pathname: "/task/new", params: { origin: "calendar", dueAt: rescheduleToDay(selectedDay, null) } });
  const rescheduleTask = (task: Task, day: Date) => api.setTaskDueAt(task.id, rescheduleToDay(day, task.dueAt));

  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "calendar") return;
    if (tab === "boards") return router.replace("/");
    if (tab === "my-tasks") return router.replace("/my-tasks");
    if (tab === "settings") return router.replace("/settings");
  };

  return (
    <View style={styles.root}>
      <ThemeAtmosphere />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 112 }]}> 
         <ScreenHeader title="Calendar" subtitle={api.currentProjectName || "Workspace"} onBack={() => router.replace(api.currentProjectId ? `/board/${api.currentProjectId}` : "/")} />
        <View style={styles.headingRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>Plan your {calendarMode}</Text>
            <Text style={[type.body, { color: colors.muted, marginTop: 3 }]}>{title}</Text>
          </View>
           <Pressable accessibilityRole="button" accessibilityLabel="Select today" onPress={selectToday} style={styles.todayButton}><Ionicons name="today-outline" size={16} color={colors.primary} /><Text style={[type.bodyStrong, { color: colors.primary }]}>Today</Text></Pressable>
        </View>

        <View style={styles.calendarToolbar}>
          <View style={styles.calendarNav}>
            <IconButton icon="chevron-back" label={calendarMode === "week" ? "Previous week" : "Previous month"} onPress={() => shiftCalendar(-1)} size={40} />
            <IconButton icon="chevron-forward" label={calendarMode === "week" ? "Next week" : "Next month"} onPress={() => shiftCalendar(1)} size={40} />
          </View>
           <View style={styles.modeSwitch} accessibilityLabel="Calendar view">
             {(["month", "week"] as CalendarMode[]).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: calendarMode === value }} onPress={() => setCalendarMode(value)} style={[styles.modeOption, calendarMode === value && { backgroundColor: colors.primaryContainer }]}><Text style={[type.caption, { color: calendarMode === value ? colors.onPrimaryContainer : colors.muted, fontWeight: "700" }]}>{value === "month" ? "Month" : "Week"}</Text></Pressable>)}
           </View>
         </View>
         <View style={styles.legend} accessibilityLabel="Calendar legend">
           <LegendItem label="Overdue" color={colors.error} />
           <LegendItem label="High" color={colors.warning} />
           <LegendItem label="Done" color={colors.success} />
            <LegendItem label="Canceled" color={colors.muted} />
         </View>

         <View style={styles.calendarGrid}>
          {(["M", "T", "W", "T", "F", "S", "S"] as const).map((day, index) => <Text key={`${day}-${index}`} style={[type.micro, styles.weekday]}>{day}</Text>)}
          {days.map((day) => {
            const dayTasks = tasksForDay(api.tasks, day);
            const selected = isSameDay(day, selectedDay);
            const current = isSameDay(day, today);
            return <View key={day.toISOString()} style={[styles.calendarDay, selected && styles.calendarDaySelected, calendarMode === "month" && !isSameMonth(day, calendarAnchor) && styles.calendarDayOutside]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Select ${format(day, "EEEE, MMMM d")}`} accessibilityState={{ selected }} onPress={() => selectDay(day)} style={styles.calendarDayHeader}><Text style={[type.caption, { color: current || selected ? colors.primary : colors.text, fontWeight: current || selected ? "800" : "600" }]}>{format(day, "d")}</Text>{dayTasks.length > 2 ? <Text style={[type.micro, { color: colors.muted }]}>+{dayTasks.length - 2}</Text> : null}</Pressable>
              {dayTasks.slice(0, calendarMode === "week" ? 5 : 2).map((task) => <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={(event) => { event.stopPropagation(); router.push({ pathname: "/task/[id]", params: { id: task.id, origin: "calendar" } }); }} onLongPress={(event) => { event.stopPropagation(); setCalendarActionTask(task); }} style={styles.calendarTask}><View style={[styles.taskDot, { backgroundColor: taskColor(task, colors) }]} /><Text style={[type.micro, { color: colors.text, flex: 1 }]} numberOfLines={1}>{task.title || "Untitled task"}</Text></Pressable>)}
            </View>;
          })}
        </View>

        <View style={styles.sectionHeading}><Text style={[type.section, { fontSize: 18 }]}>{format(selectedDay, "EEEE, MMM d")}</Text><Pill label={`${selectedTasks.length} due`} tone="primary" /></View>
        <SurfaceCard style={styles.taskCard}>
          {selectedTasks.length ? selectedTasks.map((task) => <CalendarTask key={task.id} task={task} onPress={() => router.push({ pathname: "/task/[id]", params: { id: task.id, origin: "calendar" } })} onToggle={() => api.toggleComplete(task.id)} onMenu={() => setCalendarActionTask(task)} />) : <Text style={[type.body, { color: colors.muted, textAlign: "center", paddingVertical: 18 }]}>Nothing is due on this day.</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={`Add task for ${format(selectedDay, "MMMM d")}`} onPress={addTaskForSelectedDay} style={styles.addDayButton}><Ionicons name="add" size={18} color={colors.primary} /><Text style={[type.bodyStrong, { color: colors.primary }]}>Add task for this day</Text></Pressable>
        </SurfaceCard>

        <View style={styles.unscheduled}><View style={styles.unscheduledHeader}><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Ionicons name="file-tray-outline" size={17} color={colors.muted} /><Text style={[type.bodyStrong, { color: colors.text }]}>Unscheduled</Text><Text style={[type.caption, { color: colors.muted }]}>· {unscheduledTasks.length}</Text></View></View><Text style={[type.caption, { color: colors.muted, lineHeight: 18 }]}>{unscheduledTasks.length ? "Long press a task to choose a day." : "Every task has a due date."}</Text>{unscheduledTasks.slice(0, 8).map((task) => <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={() => router.push({ pathname: "/task/[id]", params: { id: task.id, origin: "calendar" } })} onLongPress={() => setCalendarActionTask(task)} style={styles.unscheduledTask}><View style={[styles.taskDot, { backgroundColor: taskColor(task, colors) }]} /><Text style={[type.body, { flex: 1, color: colors.text }]} numberOfLines={1}>{task.title || "Untitled task"}</Text><Ionicons name="ellipsis-horizontal" size={16} color={colors.muted} /></Pressable>)}</View>
      </ScrollView>
      <ReferenceMobileBottomNav active="calendar" onNavigate={navigate} />
      <CalendarTaskActions task={calendarActionTask} now={today} onClose={() => setCalendarActionTask(null)} onChooseDate={() => { if (calendarActionTask) setCalendarPickerTask(calendarActionTask); }} onToday={() => { if (calendarActionTask) rescheduleTask(calendarActionTask, today); }} onTomorrow={() => { if (calendarActionTask) rescheduleTask(calendarActionTask, addDays(today, 1)); }} onClearDue={() => { if (calendarActionTask) api.setTaskDueAt(calendarActionTask.id, null); }} />
      {calendarPickerTask ? <DateTimePicker value={calendarPickerTask.dueAt ? parseISO(calendarPickerTask.dueAt) : today} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, selected) => { void event; const task = calendarPickerTask; setCalendarPickerTask(null); if (selected && task) rescheduleTask(task, selected); }} /> : null}
    </View>
  );
}

function tasksForDay(tasks: Task[], day: Date): Task[] {
  return tasks.filter((task) => task.dueAt && isValid(parseISO(task.dueAt)) && isSameDay(parseISO(task.dueAt), day)).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
}

function taskColor(task: Task, colors: ReferenceColors): string {
  if (task.canceled) return colors.muted;
  if (task.completed) return colors.success;
  if (task.priority === "high") return colors.warning;
  return colors.primary;
}

function CalendarTaskActions({ task, now, onClose, onChooseDate, onToday, onTomorrow, onClearDue }: { task: Task | null; now: Date; onClose: () => void; onChooseDate: () => void; onToday: () => void; onTomorrow: () => void; onClearDue: () => void }) {
  return <OptionSheet visible={task !== null} title={task?.title ?? "Calendar task"} options={[{ label: "Choose a day", icon: "calendar-outline", onPress: onChooseDate }, { label: `Move to today · ${format(now, "MMM d")}`, icon: "today-outline", onPress: onToday }, { label: `Move to tomorrow · ${format(addDays(now, 1), "MMM d")}`, icon: "arrow-forward-circle-outline", onPress: onTomorrow }, ...(task?.dueAt ? [{ label: "Remove due date", icon: "close-circle-outline" as const, destructive: true, onPress: onClearDue }] : [])]} onClose={onClose} />;
}

function LegendItem({ label, color }: { label: string; color: string }) {
  const { type } = useReferenceTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} /><Text style={[type.micro, { color: color }]}>{label}</Text></View>;
}

function CalendarTask({ task, onPress, onToggle, onMenu }: { task: Task; onPress: () => void; onToggle: () => void; onMenu: () => void }) {
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.taskRow}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} accessibilityLabel={`${task.completed ? "Mark incomplete" : "Complete"} ${task.title}`} onPress={(event) => { event.stopPropagation(); onToggle(); }} style={[styles.checkbox, task.completed && styles.checkboxDone]}>{task.completed ? <Text style={styles.checkmark}>✓</Text> : null}</Pressable>
      <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={onPress} onLongPress={onMenu}>
        <Text style={[type.bodyStrong, { textDecorationLine: task.completed ? "line-through" : "none", color: task.completed ? colors.muted : colors.text }]}>{task.title || "Untitled task"}</Text>
        <Text style={[type.caption, { color: colors.muted, marginTop: 3 }]}>{task.dueAt ? format(parseISO(task.dueAt), "h:mm a") : "No deadline"} · {task.priority} priority</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${task.title}`} onPress={(event) => { event.stopPropagation(); onMenu(); }} style={styles.taskAction}><Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} /></Pressable>
    </View>
  );
}

function createStyles(colors: ReferenceColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: referenceSpacing.md, maxWidth: 640, width: "100%", alignSelf: "center" },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  todayButton: { minHeight: 40, paddingHorizontal: 11, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.outlineVariant, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 5 },
  calendarToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  calendarNav: { flexDirection: "row", alignItems: "center", gap: 2 },
  modeSwitch: { flexDirection: "row", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceLow, borderRadius: 11, padding: 3, gap: 2 },
  modeOption: { minHeight: 34, paddingHorizontal: 11, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  legend: { minHeight: 30, marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 11 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.outlineVariant },
  weekday: { width: "14.2857%", textAlign: "center", color: colors.muted, paddingVertical: 7 },
  calendarDay: { width: "14.2857%", minHeight: 82, padding: 5, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.outlineVariant, backgroundColor: colors.surface },
  calendarDaySelected: { backgroundColor: colors.primaryContainer },
  calendarDayOutside: { opacity: 0.45 },
  calendarDayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  calendarTask: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 2 },
  taskDot: { width: 6, height: 6, borderRadius: 3 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 9 },
  taskCard: { padding: referenceSpacing.sm },
  taskRow: { minHeight: 62, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant },
  checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: "center", justifyContent: "center" },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkmark: { color: colors.onPrimary, fontWeight: "800" },
  taskAction: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  addDayButton: { minHeight: 44, marginTop: 8, borderRadius: 10, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  unscheduled: { marginTop: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.outlineVariant, borderStyle: "dashed", backgroundColor: colors.surfaceLow, padding: 13 },
  unscheduledHeader: { marginBottom: 5 },
  unscheduledTask: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant },
}); }
