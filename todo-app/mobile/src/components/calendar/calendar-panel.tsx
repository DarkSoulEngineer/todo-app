import { Ionicons } from "@expo/vector-icons";
import { addDays, addMonths, addWeeks, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { useTheme } from "@/providers/theme-provider";
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
        <Pressable accessibilityRole="button" accessibilityLabel="Jump to today" accessibilityHint={todaySelected ? "Today is already selected" : "Select today and show its calendar period"} accessibilityState={{ disabled: todaySelected, selected: todaySelected }} disabled={todaySelected} onPress={todaySelected ? undefined : onToday} style={({ pressed }) => [styles.todayButton, { opacity: pressed ? 0.6 : 1 }]}>
          <View pointerEvents="none" style={styles.todayFace}><Text style={[styles.todayText, todaySelected && styles.todayTextSelected]}>Today</Text></View>
        </Pressable>
        <View accessibilityLabel="Calendar view" style={styles.modeSwitch}>
          <View pointerEvents="none" style={styles.modeTrack} />
          {(["month", "week"] as CalendarMode[]).map((value) => {
            const active = mode === value;
            return <Pressable key={value} accessibilityRole="tab" aria-selected={active} accessibilityState={{ selected: active }} onPress={() => onModeChange(value)} style={({ pressed }) => [styles.modeOption, { opacity: pressed ? 0.6 : 1 }]}><View pointerEvents="none" style={[styles.modeFace, active && styles.modeOptionActive]}><Text style={[styles.modeText, active && styles.modeTextActive]}>{value === "month" ? "Month" : "Week"}</Text></View></Pressable>;
          })}
        </View>
      </View>

      <View style={styles.legend} accessibilityLabel="Calendar legend">
        {LEGEND.map((item) => <View key={item.label} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors[item.token] }]} /><Text style={styles.legendText}>{item.label}</Text></View>)}
      </View>

      <View testID="calendar-weekdays" style={styles.weekdays}>{weekdayLabels.map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>

      <View testID="main-calendar-grid" style={styles.grid}>
        {days.map((day) => {
          const dayTasks = tasksForDay(tasks, day);
          const taskCount = dayTasks.length > 9 ? "9+" : dayTasks.length ? `+${dayTasks.length}` : null;
          const selected = selectedDay ? isSameDay(selectedDay, day) : false;
          const current = isSameDay(day, now);
          const outside = mode === "month" && !isSameMonth(day, anchor);
          const taskHint = dayTasks.length ? `${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"} due` : null;
          return (
            <View
              key={day.toISOString()}
              testID={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              style={[
                styles.cell,
                mode === "week" && styles.cellWeek,
                outside && styles.cellOutside,
              ]}
            >
              <Pressable accessibilityRole="button" accessibilityLabel={`Select ${format(day, "EEEE, MMMM d")}`} accessibilityHint={[current ? "Today" : null, taskHint].filter(Boolean).join(". ") || undefined} aria-pressed={selected} accessibilityState={{ selected }} onPress={() => onSelectDay(day)} style={StyleSheet.absoluteFill} />
              <View pointerEvents="none" style={styles.cellHeader}>
                <View testID={`calendar-date-${format(day, "yyyy-MM-dd")}`} style={[styles.dayBadge, selected && styles.dayBadgeSelected]}>
                  <Text style={[styles.dayNumber, current && !selected && styles.dayNumberToday]}>{format(day, "d")}</Text>
                </View>
                {taskCount ? <Text testID={`calendar-task-count-${format(day, "yyyy-MM-dd")}`} style={styles.countLabel}>{taskCount}</Text> : null}
            </View>
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
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.5 : 1 }]}><View pointerEvents="none" style={styles.navFace}><Ionicons name={icon} size={16} color={theme.colors.foreground} /></View></Pressable>;
}

function tasksForDay(tasks: Task[], day: Date): Task[] {
  return tasks.filter((task) => task.dueAt && isSameDay(parseISO(task.dueAt), day)).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: { gap: 10 },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 2 },
    titleBlock: { flex: 1, minWidth: 0 },
    navGroup: { flexDirection: "row", alignItems: "center", gap: 0 },
    panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12 },
    navButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navFace: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
    title: { color: colors.foreground, fontSize: 18, lineHeight: 24, fontWeight: "800", letterSpacing: -0.2 },
    eyebrow: { color: colors.mutedForeground, fontSize: 11, lineHeight: 15, fontWeight: "600", marginTop: 1 },
    controlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    todayButton: { height: 44, width: 68, alignItems: "center", justifyContent: "center" },
    todayFace: { height: 30, width: 64, alignItems: "center", justifyContent: "center" },
    todayText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "500" },
    todayTextSelected: { color: colors.primary, fontWeight: "600" },
    modeSwitch: { flexDirection: "row", alignItems: "center", paddingHorizontal: 2 },
    modeTrack: { position: "absolute", left: 0, right: 0, top: 5, height: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundAlt },
    modeOption: { height: 44, width: 58, alignItems: "center", justifyContent: "center" },
    modeFace: { height: 28, width: 56, borderRadius: 6, alignItems: "center", justifyContent: "center" },
    modeOptionActive: { backgroundColor: colors.cardElevated },
    modeText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "700" },
    modeTextActive: { color: colors.foreground },
    legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 11, marginTop: 13, marginBottom: 9 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 7, height: 7, borderRadius: 4 },
    legendText: { color: colors.mutedForeground, fontSize: 10, lineHeight: 13, fontWeight: "700" },
    weekdays: { flexDirection: "row", paddingVertical: 6 },
    weekday: { width: "14.2857%", textAlign: "center", color: colors.mutedForeground, fontSize: 10, lineHeight: 13, fontWeight: "600" },
    grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
    cell: { width: "14.2857%", minHeight: 52, padding: 2, backgroundColor: colors.card },
    cellWeek: { minHeight: 136 },
    cellOutside: { opacity: 0.38 },
    cellHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    dayBadge: { flex: 1, minWidth: 0, height: 44, borderRadius: 10, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
    dayBadgeSelected: { backgroundColor: colors.secondary, borderColor: colors.borderStrong },
    dayNumber: { color: colors.foreground, fontSize: 12, lineHeight: 16, fontWeight: "600" },
    dayNumberToday: { color: colors.success },
    countLabel: { position: "absolute", top: 2, right: 4, zIndex: 1, color: colors.mutedForeground, fontSize: 10, lineHeight: 13, fontWeight: "800" },
  });
}
