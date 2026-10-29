import { Ionicons } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { boardColor, type Board } from "@/lib/domain/boards";
import { PRIORITY_META } from "@/lib/domain/constants";
import { deriveStatus } from "@/lib/domain/status";
import type { Task } from "@/lib/domain/types";
import { PriorityStars } from "@/components/ui/priority-stars";
import { StatusIcon } from "@/components/ui/status-icon";
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
              <CalendarDayTaskTile
                task={task}
                day={day}
                boards={boards}
                now={now}
                onPress={() => onTask(task)}
                onLongPress={(event) => onTaskAction(task, event)}
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

function CalendarDayTaskTile({
  task,
  day,
  boards,
  now,
  onPress,
  onLongPress,
  onActionPress,
}: {
  task: Task;
  day: Date;
  boards: Board[];
  now: Date;
  onPress: () => void;
  onLongPress: (event: GestureResponderEvent) => void;
  onActionPress?: (event: GestureResponderEvent) => void;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme.colors);
  const status = deriveStatus(task, now);
  const priority = PRIORITY_META[task.priority];
  const board = boards.find((item) => item.id === task.category);
  const boardTone = board ? boardColor(board.color) : undefined;
  const done = task.subtasks.filter((subtask) => subtask.done).length;
  const statusColor =
    status === "completed"
      ? theme.colors.success
      : status === "canceled"
        ? theme.colors.mutedForeground
        : status === "overdue"
          ? theme.colors.destructive
          : null;
  const accent = statusColor ?? priority.dot;
  const sameDay = task.dueAt ? parseISO(task.dueAt).toDateString() === day.toDateString() : false;

  return (
    <Pressable
      accessibilityLabel={`${status === "completed" ? "Completed task" : "Edit task"} ${task.title || "Untitled task"}`}
      accessibilityHint="Opens the task editor. Long press for task actions."
      onPress={onPress}
      onLongPress={(event) => { onLongPress(event); }}
      onContextMenu={(event) => { event.preventDefault?.(); onLongPress(event.nativeEvent as unknown as GestureResponderEvent); }}
      delayLongPress={360}
      style={({ pressed }) => [
        styles.tile,
        {
          borderColor: theme.colors.border,
          borderLeftColor: accent,
          backgroundColor: status === "canceled" ? theme.colors.secondary : theme.colors.card,
          opacity: pressed ? 0.72 : task.canceled ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.timePill, { borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundAlt }]}>
          <Ionicons name="time-outline" size={12} color={theme.colors.mutedForeground} />
          <Text style={[styles.timeText, { color: theme.colors.foreground }]}>
            {task.dueAt && sameDay ? format(parseISO(task.dueAt), "h:mm a") : "Any time"}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${task.title}`} onPress={(event) => { event.stopPropagation(); onActionPress?.(event) ?? onLongPress(event); }} style={({ pressed }) => [styles.actionPill, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="ellipsis-horizontal" size={14} color={theme.colors.mutedForeground} />
        </Pressable>
      </View>

      <Text
        numberOfLines={2}
        style={[
          styles.tileTitle,
          {
            color: status === "canceled" ? theme.colors.mutedForeground : theme.colors.foreground,
            textDecorationLine: task.completed ? "line-through" : "none",
          },
        ]}
      >
        {task.title || "Untitled task"}
      </Text>

      <View style={styles.tileMeta}>
        <PriorityStars priority={task.priority} />
        {status !== "upcoming" ? <StatusIcon status={status} /> : null}
        {boardTone ? (
          <View style={styles.boardChip}>
            <View style={[styles.metaDot, { backgroundColor: boardTone.dot }]} />
            <Text numberOfLines={1} style={[styles.boardText, { color: theme.colors.mutedForeground }]}>{board?.label}</Text>
          </View>
        ) : null}
        {task.subtasks.length ? (
          <View style={styles.boardChip}>
            <Ionicons name="list-outline" size={11} color={theme.colors.mutedForeground} />
            <Text style={[styles.boardText, { color: theme.colors.mutedForeground }]}>{done}/{task.subtasks.length}</Text>
          </View>
        ) : null}
      </View>

      {task.subtasks.length ? (
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.backgroundAlt }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round((done / task.subtasks.length) * 100)}%`,
                backgroundColor: done === task.subtasks.length ? theme.colors.success : theme.colors.primary,
              },
            ]}
          />
        </View>
      ) : null}
    </Pressable>
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
    tile: {
      flexGrow: 1,
      minHeight: 108,
      gap: 8,
      padding: 12,
      paddingLeft: 13,
      borderWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: 3,
      borderRadius: 12,
      shadowColor: colors.shadow,
      shadowOpacity: 0.16,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    timePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 6 },
    timeText: { fontSize: 11, lineHeight: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
    tileTitle: { fontSize: 14, lineHeight: 19, fontWeight: "600" },
    tileMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
    metaDot: { width: 6, height: 6, borderRadius: 3 },
    boardChip: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 140 },
    boardText: { flexShrink: 1, fontSize: 10, lineHeight: 14, fontWeight: "600" },
    progressTrack: { height: 3, borderRadius: 2, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 2 },
  });
}
