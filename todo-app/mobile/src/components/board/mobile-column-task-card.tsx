import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/providers/theme-provider";
import { describeDue } from "@/lib/domain/status";
import { detectCardTheme } from "@/lib/features/card-themes";
import type { Task } from "@/lib/domain/types";
import { useMobileBoardColors } from "./mobile-board-colors";

interface Props {
  task: Task;
  now: Date;
  compact?: boolean;
  zoom?: number;
  selected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onMenu: () => void;
  onComplete: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onToggleSubtask: (subtaskId: string) => void;
}

export function MobileColumnTaskCard({ task, now, compact, zoom = 1, selected, selectionMode, onPress, onMenu, onComplete, onMoveLeft, onMoveRight, onToggleSubtask }: Props) {
  const c = useMobileBoardColors();
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const due = describeDue(task.dueAt, now);
  const done = task.subtasks.filter((item) => item.done).length;
  const cardTheme = detectCardTheme(task.title, task.description);
  const accent = task.canceled ? c.mutedForeground : task.completed ? c.success : due?.overdue ? c.destructive : cardTheme?.accent ?? c.primary;
  const priorityColor = task.priority === "low" ? c.info : task.priority === "high" ? "#F97316" : "#F59E0B";
  const priorityInk = theme.scheme === "light" ? task.priority === "high" ? "#9A3412" : task.priority === "medium" ? c.warning : c.info : priorityColor;
  const settled = task.completed || task.canceled;
  const action = (name: keyof typeof Ionicons.glyphMap, label: string, handler: () => void, checked?: boolean) => <Pressable key={label} accessibilityRole={checked === undefined ? "button" : "checkbox"} accessibilityLabel={label} aria-checked={checked} onPress={handler} style={({ pressed }) => [styles.action, name === "checkmark" && { borderWidth: 1, borderColor: c.border }, { opacity: pressed ? 0.5 : 1, backgroundColor: checked ? `${c.success}20` : "transparent" }]}><Ionicons name={name} size={15} color={checked ? c.success : c.mutedForeground} /></Pressable>;

  return <View testID={`kanban-card-${task.id}`} style={[styles.card, { backgroundColor: c.card, borderColor: selected ? c.primary : `${accent}55`, borderLeftColor: accent }]}>
    <LinearGradient pointerEvents="none" colors={["transparent", task.priority === "high" ? "#F9731618" : task.priority === "medium" ? "#F59E0B18" : `${cardTheme?.accent ?? c.info}10`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <View style={styles.topRow}>
      <Pressable accessibilityRole={selectionMode ? "checkbox" : "button"} accessibilityLabel={task.title} aria-checked={selectionMode ? selected : undefined} onPress={onPress} onLongPress={onMenu} style={styles.titleArea}><Text numberOfLines={2} style={[styles.title, { fontSize: 13 * zoom, lineHeight: 18 * zoom, color: settled ? c.mutedForeground : c.foreground, textDecorationLine: settled ? "line-through" : "none" }]}>{selectionMode ? `${selected ? "☑" : "☐"} ` : ""}{task.title}</Text></Pressable>
      <View style={styles.actions}>
        {action("checkmark", `${selectionMode ? selected ? "Deselect" : "Select" : task.completed ? "Reopen" : "Complete"} ${task.title}`, onComplete, selectionMode ? selected : task.completed)}
        {onMoveLeft ? action("arrow-back", `Move ${task.title} to previous column`, onMoveLeft) : null}
        {onMoveRight ? action("arrow-forward", `Move ${task.title} to next column`, onMoveRight) : null}
        {action("ellipsis-horizontal", `Actions for ${task.title}`, onMenu)}
      </View>
    </View>
    {!compact && task.description ? <Pressable accessibilityRole="button" accessibilityLabel={`Edit notes for ${task.title}`} onPress={onPress}><Text numberOfLines={2} style={[styles.description, { color: c.mutedForeground, fontSize: 12 * zoom, lineHeight: 18 * zoom }]}>{task.description}</Text></Pressable> : null}
    {!compact ? <View style={styles.meta}>
      {due && !task.canceled ? <View style={[styles.pill, { backgroundColor: due.overdue ? `${c.destructive}18` : c.secondary, borderColor: due.overdue ? `${c.destructive}44` : c.border }]}><Text style={[styles.pillText, { color: due.overdue ? c.destructive : c.mutedForeground }]}>{due.label}</Text></View> : null}
      <View style={[styles.pill, { backgroundColor: `${priorityColor}12`, borderColor: `${priorityColor}44` }]}><Text style={[styles.pillText, { color: priorityInk, textTransform: "capitalize" }]}>{task.priority}</Text></View>
      {settled ? <View style={[styles.pill, { borderColor: c.border }]}><Text style={[styles.pillText, { color: task.canceled ? c.mutedForeground : c.success }]}>{task.canceled ? "Canceled" : "Done"}</Text></View> : null}
      {task.subtasks.length ? <Pressable accessibilityRole="button" accessibilityLabel={`Checklist for ${task.title}`} aria-expanded={expanded} onPress={() => setExpanded(!expanded)} style={[styles.pill, styles.checklistToggle, { borderColor: c.border }]}><Ionicons name="list-outline" size={12} color={c.mutedForeground} /><Text style={[styles.pillText, { color: c.mutedForeground }]}>{done}/{task.subtasks.length}</Text><Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={11} color={c.mutedForeground} /></Pressable> : null}
    </View> : null}
    {expanded && !compact ? <View style={[styles.checklist, { borderColor: c.border }]}>{task.subtasks.map((subtask) => <Pressable key={subtask.id} accessibilityRole="checkbox" accessibilityLabel={subtask.title} aria-checked={subtask.done} disabled={selectionMode} onPress={() => onToggleSubtask(subtask.id)} style={styles.subtask}><Ionicons name={subtask.done ? "checkbox" : "square-outline"} size={16} color={subtask.done ? c.success : c.mutedForeground} /><Text style={{ color: c.mutedForeground, fontSize: 12, flex: 1, textDecorationLine: subtask.done ? "line-through" : "none" }}>{subtask.title}</Text></Pressable>)}</View> : null}
    {theme.scheme === "light" ? null : <View pointerEvents="none" style={[styles.rail, { backgroundColor: accent }]} />}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderLeftWidth: 3, borderRadius: 9, overflow: "hidden", padding: 9 },
  topRow: { gap: 2 }, titleArea: { minWidth: 0, minHeight: 44, justifyContent: "center" }, title: { fontWeight: "600", letterSpacing: -0.2 },
  actions: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", gap: 2 }, action: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 7 },
  description: { marginTop: 6, marginBottom: 9 }, meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, marginTop: 4 }, pill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, minHeight: 19, flexDirection: "row", alignItems: "center", gap: 4 }, pillText: { fontSize: 10, lineHeight: 15, fontWeight: "500" }, checklistToggle: { marginLeft: "auto", minHeight: 44 },
  checklist: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 8, gap: 2 }, subtask: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: 7 }, rail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 1, opacity: 0.3 },
});
