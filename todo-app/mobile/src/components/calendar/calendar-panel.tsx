import { Ionicons } from "@expo/vector-icons";
import { addDays, addMonths, addWeeks, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { useMemo, type MouseEvent } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { useTheme } from "@/providers/theme-provider";
import { deriveStatus } from "@/lib/domain/status";
import type { Task } from "@/lib/domain/types";
import type { ThemeColors } from "@/theme/tokens";

export type CalendarMode = "month" | "week";

interface CalendarPanelProps {
  anchor: Date;
  mode: CalendarMode;
  selectedDay: Date | null;
  tasks: Task[];
  now: Date;
  weekStartsOn?: 0 | 1;
  /** Small calendar chips select the whole day instead of opening an editor. */
  daySelectionOnly?: boolean;
  onModeChange: (mode: CalendarMode) => void;
  onAnchorChange: (date: Date) => void;
  onSelectDay: (day: Date) => void;
  onTaskPress: (task: Task) => void;
  onTaskLongPress?: (task: Task, event?: GestureResponderEvent) => void;
  onToday: () => void;
}

const LEGEND = [
  { label: "Overdue", token: "destructive" as const },
  { label: "High", token: "warning" as const },
  { label: "Done", token: "success" as const },
  { label: "Canceled", token: "mutedForeground" as const },
];

export function CalendarPanel({ anchor, mode, selectedDay, tasks, now, weekStartsOn = 1, daySelectionOnly = false, onModeChange, onAnchorChange, onSelectDay, onTaskPress, onTaskLongPress, onToday }: CalendarPanelProps) {
  const { theme } = useTheme();
  const colors = theme.colors;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const firstDay = useMemo(() => startOfWeek(mode === "week" ? anchor : startOfMonth(anchor), { weekStartsOn }), [anchor, mode, weekStartsOn]);
  const days = useMemo(() => Array.from({ length: mode === "week" ? 7 : 42 }, (_, index) => addDays(firstDay, index)), [firstDay, mode]);
  const weekdayLabels = weekStartsOn === 1 ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];
  const title = mode === "week" ? `${format(days[0], "MMM d")} to ${format(days[6], "MMM d, yyyy")}` : format(anchor, "MMMM yyyy");
  const shift = (delta: number) => onAnchorChange(mode === "week" ? addWeeks(anchor, delta) : addMonths(anchor, delta));
  const showingToday = mode === "month" ? isSameMonth(anchor, now) : isSameDay(firstDay, startOfWeek(now, { weekStartsOn }));
  const todaySelected = showingToday && selectedDay !== null && isSameDay(selectedDay, now);

  return (
    <View style={styles.wrapper}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <Text style={styles.eyebrow}>{mode === "week" ? "Week view" : "Month view"}</Text>
        </View>
        <View style={styles.navGroup}>
          <NavButton icon="chevron-back" label={mode === "week" ? "Previous week" : "Previous month"} onPress={() => shift(-1)} />
          <NavButton icon="chevron-forward" label={mode === "week" ? "Next week" : "Next month"} onPress={() => shift(1)} />
        </View>
      </View>

      <View style={styles.panel}>
      <View style={styles.controlsRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Jump to today" accessibilityHint={todaySelected ? "Today is already selected" : "Select today and show its calendar period"} accessibilityState={{ disabled: todaySelected, selected: todaySelected }} disabled={todaySelected} onPress={todaySelected ? undefined : onToday} style={({ pressed }) => [styles.todayButton, todaySelected && styles.todayButtonSelected, { opacity: pressed ? 0.65 : 1 }]}>
          <Ionicons name={todaySelected ? "checkmark-circle" : "today-outline"} size={15} color={colors.primary} />
          <Text accessibilityLiveRegion="polite" style={styles.todayText}>{todaySelected ? "Today selected" : "Today"}</Text>
        </Pressable>
        <View accessibilityLabel="Calendar view" style={styles.modeSwitch}>
          {(["month", "week"] as CalendarMode[]).map((value) => {
            const active = mode === value;
            return <Pressable key={value} accessibilityRole="tab" aria-selected={active} accessibilityState={{ selected: active }} onPress={() => onModeChange(value)} style={[styles.modeOption, active && styles.modeOptionActive]}><Text style={[styles.modeText, active && styles.modeTextActive]}>{value === "month" ? "Month" : "Week"}</Text></Pressable>;
          })}
        </View>
      </View>

      <View style={styles.legend} accessibilityLabel="Calendar legend">
        {LEGEND.map((item) => <View key={item.label} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors[item.token] }]} /><Text style={styles.legendText}>{item.label}</Text></View>)}
      </View>

      <View style={styles.weekdays}>{weekdayLabels.map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>

      <View style={styles.grid}>
        {days.map((day, index) => {
          const dayTasks = tasksForDay(tasks, day);
          const selected = selectedDay ? isSameDay(selectedDay, day) : false;
          const current = isSameDay(day, now);
          const outside = mode === "month" && !isSameMonth(day, anchor);
          return (
            <View
              key={day.toISOString()}
              testID={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              style={[
                styles.cell,
                mode === "week" && styles.cellWeek,
                outside && styles.cellOutside,
                index % 7 === 6 && styles.cellLastColumn,
                index >= days.length - 7 && styles.cellLastRow,
              ]}
            >
              <Pressable accessibilityRole="button" accessibilityLabel={`Select ${format(day, "EEEE, MMMM d")}`} accessibilityHint={current ? "Today" : undefined} aria-pressed={selected} accessibilityState={{ selected }} onPress={() => onSelectDay(day)} style={StyleSheet.absoluteFill} />
              <View pointerEvents="none" style={styles.cellHeader}>
                <View testID={`calendar-date-${format(day, "yyyy-MM-dd")}`} style={[styles.dayBadge, current && !selected && styles.dayBadgeToday, selected && styles.dayBadgeSelected]}>
                  <Text style={[styles.dayNumber, current && !selected && styles.dayNumberToday, selected && styles.dayNumberSelected]}>{format(day, "d")}</Text>
                </View>
                {dayTasks.length > (mode === "week" ? 5 : 2) ? <Text style={styles.moreLabel}>+{dayTasks.length - (mode === "week" ? 5 : 2)}</Text> : null}
              </View>
              {dayTasks.slice(0, mode === "week" ? 5 : 2).map((task) => {
                const color = taskColor(task, colors, now);
                const contextMenu = Platform.OS === "web" && !daySelectionOnly && onTaskLongPress ? { onContextMenu: (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); onTaskLongPress(task, event as unknown as GestureResponderEvent); } } : {};
                return <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={daySelectionOnly ? `View tasks for ${format(day, "EEEE, MMMM d")}` : `Open ${task.title}`} onPress={(event) => { event.stopPropagation(); if (daySelectionOnly) onSelectDay(day); else onTaskPress(task); }} onLongPress={!daySelectionOnly && onTaskLongPress ? (event) => { event.stopPropagation(); onTaskLongPress(task, event); } : undefined} {...contextMenu} style={({ pressed }) => [styles.taskChip, { opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={[styles.taskText, { color }, task.completed && styles.taskTextDone]} numberOfLines={1}>{task.title || "Untitled task"}</Text>
                </Pressable>;
              })}
            </View>
          );
        })}
      </View>
      </View>
    </View>
  );
}

function NavButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.6 : 1 }]}><Ionicons name={icon} size={19} color={theme.colors.foreground} /></Pressable>;
}

function tasksForDay(tasks: Task[], day: Date): Task[] {
  return tasks.filter((task) => task.dueAt && isSameDay(parseISO(task.dueAt), day)).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
}

function taskColor(task: Task, colors: ThemeColors, now: Date): string {
  const status = deriveStatus(task, now);
  if (status === "canceled") return colors.mutedForeground;
  if (status === "completed") return colors.success;
  if (status === "overdue") return colors.destructive;
  if (task.priority === "critical") return colors.destructive;
  if (task.priority === "high") return colors.warning;
  return colors.primary;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: { gap: 10 },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 2 },
    titleBlock: { flex: 1, minWidth: 0 },
    navGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
    panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 12, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    navButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundAlt, alignItems: "center", justifyContent: "center" },
    title: { color: colors.foreground, fontSize: 18, lineHeight: 24, fontWeight: "800", letterSpacing: -0.2 },
    eyebrow: { color: colors.mutedForeground, fontSize: 11, lineHeight: 15, fontWeight: "600", marginTop: 1 },
    controlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 },
    todayButton: { minHeight: 40, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundAlt, flexDirection: "row", alignItems: "center", gap: 6 },
    todayButtonSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    todayText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
    modeSwitch: { flexDirection: "row", alignItems: "center", gap: 2, padding: 3, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundAlt },
    modeOption: { minHeight: 34, minWidth: 62, paddingHorizontal: 12, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    modeOptionActive: { backgroundColor: colors.primary },
    modeText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "700" },
    modeTextActive: { color: colors.primaryForeground },
    legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 11, marginTop: 13, marginBottom: 9 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 7, height: 7, borderRadius: 4 },
    legendText: { color: colors.mutedForeground, fontSize: 10, lineHeight: 13, fontWeight: "700" },
    weekdays: { flexDirection: "row", paddingVertical: 6, borderRadius: 10, backgroundColor: colors.backgroundAlt },
    weekday: { width: "14.2857%", textAlign: "center", color: colors.mutedForeground, fontSize: 10, lineHeight: 13, fontWeight: "800" },
    grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: "hidden", backgroundColor: colors.card },
    cell: { width: "14.2857%", minHeight: 84, padding: 5, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.card },
    cellWeek: { minHeight: 136 },
    cellOutside: { opacity: 0.42 },
    cellLastColumn: { borderRightWidth: 0 },
    cellLastRow: { borderBottomWidth: 0 },
    cellHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    dayBadge: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
    dayBadgeToday: { borderColor: colors.primary },
    dayBadgeSelected: { backgroundColor: colors.primary },
    dayNumber: { color: colors.foreground, fontSize: 12, lineHeight: 16, fontWeight: "700" },
    dayNumberToday: { color: colors.primary, fontWeight: "800" },
    dayNumberSelected: { color: colors.primaryForeground, fontWeight: "800" },
    moreLabel: { color: colors.mutedForeground, fontSize: 10, lineHeight: 13, fontWeight: "700" },
    taskChip: { minWidth: 0, paddingVertical: 3, marginTop: 3 },
    taskText: { flex: 1, color: colors.foreground, fontSize: 10, lineHeight: 13, fontWeight: "700" },
    taskTextDone: { textDecorationLine: "line-through", color: colors.mutedForeground },
  });
}
