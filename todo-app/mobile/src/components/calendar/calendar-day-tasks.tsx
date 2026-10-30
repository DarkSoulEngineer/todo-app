import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import type { Board } from "@/lib/domain/boards";
import type { Task } from "@/lib/domain/types";
import { MobileColumnTaskCard } from "@/components/board/mobile-column-task-card";
import { useTheme } from "@/providers/theme-provider";
import type { ThemeColors } from "@/theme/tokens";

export interface CalendarDayTasksProps {
  day: Date;
  tasks: Task[];
  boards: Board[];
  now: Date;
  onTask: (task: Task) => void;
  onTaskAction: (task: Task, event?: GestureResponderEvent) => void;
  onAddTask: () => void;
}

/**
 * Desktop-only companion to the calendar: the tasks due on the selected day,
 * laid out as a responsive grid underneath the month/week panel.
 */
export function CalendarDayTasks({ day, tasks, boards, now, onTask, onTaskAction, onAddTask }: CalendarDayTasksProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme.colors);
  const [gridWidth, setGridWidth] = useState(0);
  const columns = gridWidth >= 700 ? 3 : 2;
  const done = tasks.filter((task) => task.completed).length;
  const subtitle = tasks.length
    ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} due${done ? ` · ${done} done` : ""}`
    : "Nothing is due on this day yet";

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.eyebrowRow}>
            <Ionicons name="calendar-clear-outline" size={12} color={theme.colors.primary} />
            <Text style={styles.eyebrow}>SELECTED DAY</Text>
          </View>
          <Text accessibilityRole="header" style={styles.title}>{format(day, "EEEE, MMM d")}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

        <View
          testID="calendar-day-task-grid"
          onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
          style={styles.grid}
        >
          {tasks.map((task) => (
            <View key={task.id} style={[styles.cell, { width: `${100 / columns}%` }]}>
              <MobileColumnTaskCard
                task={task}
                board={boards.find((board) => board.id === task.category)}
                now={now}
                selected={false}
                selectionMode={false}
                calendarLayout
                onPress={() => onTask(task)}
                onMenu={(event) => onTaskAction(task, event)}
                onSelect={() => {}}
              />
            </View>
          ))}
          <View style={[styles.cell, { width: `${100 / columns}%` }]}>
            <Pressable
              testID="calendar-add-task-card"
              accessibilityRole="button"
              accessibilityLabel={`Add task for ${format(day, "MMMM d")}`}
              onPress={onAddTask}
              style={({ pressed }) => [styles.addTaskCard, { backgroundColor: pressed ? theme.colors.primarySoft : "transparent" }]}
            >
              <Text style={styles.addText}>Add new task</Text>
            </Pressable>
          </View>
        </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { marginTop: 16, gap: 11 },
    header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
    headerCopy: { flex: 1, minWidth: 0 },
    eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    eyebrow: { color: colors.primary, fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 1 },
    title: { color: colors.foreground, fontSize: 18, lineHeight: 24, fontWeight: "800", letterSpacing: -0.2 },
    subtitle: { color: colors.mutedForeground, fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 1 },
    addText: { color: colors.mutedForeground, fontSize: 15, fontWeight: "500" },
    addTaskCard: { flexGrow: 1, minHeight: 108, borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong, borderRadius: 12, justifyContent: "center", alignItems: "center", padding: 20 },
    grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 10, marginHorizontal: -5 },
    cell: { paddingHorizontal: 5 },
  });
}
