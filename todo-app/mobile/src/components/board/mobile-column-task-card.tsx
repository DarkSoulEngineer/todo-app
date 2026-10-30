import { Ionicons } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { useState, type MouseEvent } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { describeDue, deriveStatus } from "@/lib/domain/status";
import { PRIORITY_META } from "@/lib/domain/constants";
import { boardColor, type Board } from "@/lib/domain/boards";
import { PriorityStars } from "@/components/ui/priority-stars";
import { StatusIcon } from "@/components/ui/status-icon";
import type { Task } from "@/lib/domain/types";
import { classifySpecialCardTag, resolveCardDecoration } from "@/lib/features/card-themes";
import { SeasonalCardDecoration } from "@/components/ui/seasonal-card-decoration";
import { useMobileBoardColors } from "./mobile-board-colors";

interface Props {
  task: Task;
  board?: Board;
  now: Date;
  compact?: boolean;
  zoom?: number;
  selected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onMenu: (event: GestureResponderEvent) => void;
  onSelect: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  hideMoveArrows?: boolean;
  animateSeasonal?: boolean;
  onToggleSubtask: (subtaskId: string) => void;
}

export function MobileColumnTaskCard({ task, board, now, compact, zoom = 1, selected, selectionMode, onPress, onMenu, onSelect, onMoveLeft, onMoveRight, hideMoveArrows, animateSeasonal = true, onToggleSubtask }: Props) {
  const c = useMobileBoardColors();
  const [expanded, setExpanded] = useState(false);
  const due = describeDue(task.dueAt, now);
  const done = task.subtasks.filter((item) => item.done).length;
  const priority = PRIORITY_META[task.priority];
  const derived = deriveStatus(task, now);
  const status = derived === "upcoming" ? null : derived;
  const statusColor = status === "completed" ? c.success : status === "canceled" ? c.mutedForeground : status === "overdue" ? c.destructive : null;
  const accent = statusColor ?? priority.dot;
  const tagTone = board ? boardColor(board.color) : null;
  const settled = task.completed || task.canceled;
  const decoration = resolveCardDecoration(task.tags, status);
  const cardTags = (task.tags ?? []).filter((tag) => classifySpecialCardTag(tag)?.group !== "status").sort((a, b) => Number(Boolean(classifySpecialCardTag(b))) - Number(Boolean(classifySpecialCardTag(a))));
  // A web button cannot contain the menu, move and checklist buttons. Keep the
  // card focusable as a group; Pressable already handles Enter for that group.
  const webCardProps = Platform.OS === "web" ? {
    role: "group" as const,
    tabIndex: 0 as const,
    onKeyDown: (event: {
      key?: string;
      repeat?: boolean;
      target: unknown;
      currentTarget: unknown;
      defaultPrevented?: boolean;
      nativeEvent: { key?: string; isComposing?: boolean };
      preventDefault: () => void;
      stopPropagation: () => void;
    }) => {
      const key = event.key ?? event.nativeEvent.key;
      if ((key === " " || key === "Spacebar") && event.target === event.currentTarget && !event.repeat && !event.defaultPrevented && !event.nativeEvent.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        onPress();
      }
    },
  } : {};
  const contextMenu = (handler: (event: GestureResponderEvent) => void) => Platform.OS === "web" ? { onContextMenu: (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handler(event as unknown as GestureResponderEvent);
  } } : {};
  const action = (name: keyof typeof Ionicons.glyphMap, label: string, handler: (event: GestureResponderEvent) => void) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={(event) => { event.stopPropagation(); handler(event); }} {...contextMenu(handler)} style={({ pressed }) => [styles.action, { opacity: pressed ? 0.5 : 1 }]}><Ionicons name={name} size={15} color={c.mutedForeground} /></Pressable>;
  const title = <Text numberOfLines={2} style={[styles.title, { fontSize: (compact ? 13 : 14) * zoom, lineHeight: (compact ? 18 : 19) * zoom, color: settled ? c.mutedForeground : c.foreground, textDecorationLine: settled ? "line-through" : "none" }]}>{task.title}</Text>;

  return <Pressable testID={`janus-card-${task.id}`} accessibilityRole={Platform.OS === "web" ? undefined : "button"} {...webCardProps} accessibilityLabel={task.title} accessibilityHint={selectionMode ? "Toggles card selection. Long press for task actions." : "Opens the task editor. Long press for task actions."} accessibilityState={{ selected }} onPress={onPress} onLongPress={(event) => { onMenu(event); }} {...contextMenu(onMenu)} style={[styles.card, compact && styles.compactCard, { backgroundColor: selected ? c.primarySoft : c.card, borderColor: selected ? c.primary : decoration?.border ?? c.border, borderLeftColor: statusColor ?? decoration?.accent ?? accent }]}>
    {decoration ? <SeasonalCardDecoration theme={decoration} compact={compact} paused={!animateSeasonal || selectionMode || Boolean(hideMoveArrows) || Boolean(compact)} /> : null}
    <View style={styles.topRow}>
      {selectionMode ? <Pressable accessibilityRole="checkbox" accessibilityLabel={`${selected ? "Deselect" : "Select"} ${task.title}`} aria-checked={selected} onPress={(event) => { event.stopPropagation(); onSelect(); }} hitSlop={6} style={({ pressed }) => [styles.checkbox, { opacity: pressed ? 0.55 : 1 }]}><Ionicons name={selected ? "checkbox" : "square-outline"} size={20} color={selected ? c.primary : c.mutedForeground} /></Pressable> : null}
      <View style={styles.titleArea}>{compact ? title : <View accessible accessibilityLabel={due?.title ?? "No due date"} style={styles.timeBadge}><Text style={[styles.timeText, { color: c.foreground, fontSize: 11 * zoom }]}>{due && task.dueAt ? format(parseISO(task.dueAt), due.today ? "h:mm a" : "MMM d · h:mm a") : "Any time"}</Text></View>}</View>
      <View style={styles.actions}>
        {onMoveLeft || onMoveRight ? <View pointerEvents={hideMoveArrows ? "none" : "auto"} accessibilityElementsHidden={hideMoveArrows} importantForAccessibility={hideMoveArrows ? "no-hide-descendants" : "auto"} style={{ flexDirection: "row", opacity: hideMoveArrows ? 0 : 1 }}>
          {onMoveLeft ? action("arrow-back", `Move ${task.title} to previous column`, onMoveLeft) : null}
          {onMoveRight ? action("arrow-forward", `Move ${task.title} to next column`, onMoveRight) : null}
        </View> : null}
        {action("ellipsis-horizontal", `Actions for ${task.title}`, onMenu)}
      </View>
    </View>
    {!compact ? title : null}
    {!compact ? <View style={styles.meta}>
      <PriorityStars priority={task.priority} zoom={zoom} />
      {status ? <StatusIcon status={status} zoom={zoom} /> : null}
      {board && tagTone && classifySpecialCardTag(board.label)?.group !== "status" ? <View style={styles.tag}><View style={[styles.tagDot, { backgroundColor: tagTone.dot }]} /><Text numberOfLines={1} style={[styles.tagText, { color: c.foreground, fontSize: 10 * zoom }]}>{board.label}</Text></View> : null}
      {cardTags.slice(0, 4).map((tag) => <View key={tag} style={styles.tag}><View style={[styles.tagDot, { backgroundColor: classifySpecialCardTag(tag)?.theme.accent ?? c.mutedForeground }]} /><Text numberOfLines={1} style={[styles.tagText, { color: c.foreground, fontSize: 10 * zoom }]}>{tag}</Text></View>)}
      {cardTags.length > 4 ? <Text style={{ color: c.mutedForeground, fontSize: 10 }}>+{cardTags.length - 4}</Text> : null}
      {task.subtasks.length ? <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel={`Checklist for ${task.title}`} accessibilityHint={`${done} of ${task.subtasks.length} completed. Show or hide checklist.`} aria-expanded={expanded} onPress={(event) => { event.stopPropagation(); setExpanded(!expanded); }} style={styles.checklistToggle}><Ionicons name="list-outline" size={12} color={c.mutedForeground} /><Text style={[styles.tagText, { color: c.mutedForeground, fontSize: 10 * zoom }]}>{done}/{task.subtasks.length}</Text></Pressable> : null}
    </View> : null}
    {!compact && task.subtasks.length ? <View testID={`janus-card-progress-${task.id}`} accessibilityRole="progressbar" accessibilityLabel="Checklist progress" accessibilityValue={{ min: 0, max: task.subtasks.length, now: done, text: `${done} of ${task.subtasks.length} completed` }} style={[styles.progressTrack, { backgroundColor: c.backgroundAlt }]}><View style={[styles.progressFill, { width: `${Math.round(done / task.subtasks.length * 100)}%`, backgroundColor: done === task.subtasks.length ? c.success : c.primary }]} /></View> : null}
    {expanded && !compact ? <View style={[styles.checklist, { borderColor: c.border }]}>{task.subtasks.map((subtask) => <Pressable key={subtask.id} accessibilityRole="checkbox" accessibilityLabel={subtask.title} aria-checked={subtask.done} disabled={selectionMode} onPress={(event) => { event.stopPropagation(); onToggleSubtask(subtask.id); }} style={styles.subtask}><Ionicons name={subtask.done ? "checkbox" : "square-outline"} size={16} color={subtask.done ? c.success : c.mutedForeground} /><Text style={{ color: c.mutedForeground, fontSize: 12, flex: 1, textDecorationLine: subtask.done ? "line-through" : "none" }}>{subtask.title}</Text></Pressable>)}</View> : null}
  </Pressable>;
}

export const taskCardBorderRadius = 12;

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderLeftWidth: 3, borderRadius: taskCardBorderRadius, overflow: "hidden", padding: 12, gap: 8 },
  compactCard: { padding: 9, gap: 0 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: -6, marginBottom: -2 }, titleArea: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center", alignItems: "flex-start" }, checkbox: { width: 36, height: 44, alignItems: "center", justifyContent: "center", flexShrink: 0 }, title: { fontWeight: "600", letterSpacing: -0.2 },
  actions: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", flexShrink: 0, gap: 2 }, action: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 7 },
  timeBadge: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" }, timeText: { flexShrink: 1, fontWeight: "700", fontVariant: ["tabular-nums"] },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }, tagDot: { width: 6, height: 6, borderRadius: 3 }, tag: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%", flexShrink: 1 }, tagText: { flexShrink: 1, fontWeight: "600" }, checklistToggle: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 4 },
  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden" }, progressFill: { height: "100%", borderRadius: 2 },
  checklist: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 2 }, subtask: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: 7 },
});
