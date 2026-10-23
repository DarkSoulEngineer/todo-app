import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, isValid, parseISO } from "date-fns";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "@/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { boardColor } from "@/lib/domain/boards";
import { PRIORITY_META, PRIORITY_ORDER } from "@/lib/domain/constants";
import { describeDue } from "@/lib/domain/status";
import { detectCardTheme } from "@/lib/features/card-themes";
import { computeInsightsForWindow } from "@/lib/features/insights";
import { getWeekdayCompletionCounts, windowEndFromPreset, windowStartFromPreset } from "@/lib/features/insights-filters";
import type { Board } from "@/lib/domain/boards";
import type { BoardSection, Priority, Subtask, Task, TaskDraft } from "@/lib/domain/types";

export function IconButton({
  icon,
  label,
  onPress,
  tone = "default",
  size = 44,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "default" | "primary" | "danger";
  size?: number;
}) {
  const { theme } = useTheme();
  const color = tone === "primary" ? theme.colors.primary : tone === "danger" ? theme.colors.destructive : theme.colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { width: size, height: size, opacity: pressed ? 0.65 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return <IconButton icon={theme.scheme === "dark" ? "sunny-outline" : "moon-outline"} label="Toggle theme" onPress={toggle} />;
}

function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? theme.colors.primarySoft : theme.colors.secondary, borderColor: active ? theme.colors.primary : theme.colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={{ color: active ? theme.colors.accentForeground : theme.colors.secondaryForeground, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function TaskCard({
  task,
  boards,
  now,
  onPress,
  onComplete,
  onLongPress,
  compact = false,
}: {
  task: Task;
  boards: Board[];
  now: Date;
  onPress: () => void;
  onComplete: () => void;
  onLongPress?: () => void;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const due = describeDue(task.dueAt, now);
  const board = boards.find((item) => item.id === task.category);
  const boardTone = board ? boardColor(board.color) : undefined;
  const cardTheme = detectCardTheme(task.title, task.description);
  const doneSubtasks = task.subtasks.filter((item) => item.done).length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit task ${task.title}`}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={360}
      style={({ pressed }) => [styles.taskPressable, { opacity: pressed ? 0.86 : 1 }]}
    >
      <Card style={[styles.taskCard, { borderLeftColor: cardTheme?.accent ?? theme.colors.primary, borderLeftWidth: 3, padding: compact ? 12 : 14 }]}>
        <View style={styles.taskTopline}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`${task.completed ? "Mark incomplete" : "Complete"} ${task.title}`}
            accessibilityState={{ checked: task.completed }}
            onPress={(event) => { event.stopPropagation(); onComplete(); }}
            style={[styles.check, { borderColor: task.completed ? theme.colors.success : theme.colors.borderStrong, backgroundColor: task.completed ? theme.colors.success : "transparent" }]}
          >
            {task.completed ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
          </Pressable>
          <Text style={[styles.taskTitle, { color: theme.colors.foreground, textDecorationLine: task.completed ? "line-through" : "none" }]} numberOfLines={2}>{task.title}</Text>
          <View style={[styles.priorityDot, { backgroundColor: PRIORITY_META[task.priority].dot }]} />
        </View>
        {!compact && task.description ? <Text style={[styles.taskDescription, { color: theme.colors.mutedForeground }]} numberOfLines={2}>{task.description}</Text> : null}
        <View style={styles.metaRow}>
          {due ? <View style={styles.metaItem}><Ionicons name="time-outline" size={14} color={due.overdue ? theme.colors.destructive : due.today ? theme.colors.warning : theme.colors.mutedForeground} /><Text style={{ color: due.overdue ? theme.colors.destructive : theme.colors.mutedForeground, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>{due.label}</Text></View> : null}
          {board && boardTone ? <Chip label={board.label} color={boardTone.dot} /> : null}
          {task.subtasks.length > 0 ? <View style={styles.metaItem}><Ionicons name="list-outline" size={14} color={theme.colors.mutedForeground} /><Text style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>{doneSubtasks}/{task.subtasks.length}</Text></View> : null}
        </View>
      </Card>
    </Pressable>
  );
}

export function TaskEditor({
  visible,
  task,
  initialDueAt,
  boards,
  sections,
  onClose,
  onSave,
  onDelete,
  onCancelTask,
}: {
  visible: boolean;
  task: Task | null;
  initialDueAt?: string | null;
  boards: Board[];
  sections: BoardSection[];
  onClose: () => void;
  onSave: (draft: TaskDraft, sectionId: string | null) => void;
  onDelete?: () => void;
  onCancelTask?: () => void;
}) {
  const editorKey = `${visible ? "open" : "closed"}:${task?.id ?? "new"}:${initialDueAt ?? ""}`;
  return <TaskEditorForm key={editorKey} visible={visible} task={task} initialDueAt={initialDueAt} boards={boards} sections={sections} onClose={onClose} onSave={onSave} onDelete={onDelete} onCancelTask={onCancelTask} />;
}

function TaskEditorForm({
  visible,
  task,
  initialDueAt,
  boards,
  sections,
  onClose,
  onSave,
  onDelete,
  onCancelTask,
}: {
  visible: boolean;
  task: Task | null;
  initialDueAt?: string | null;
  boards: Board[];
  sections: BoardSection[];
  onClose: () => void;
  onSave: (draft: TaskDraft, sectionId: string | null) => void;
  onDelete?: () => void;
  onCancelTask?: () => void;
}) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(() => task?.title ?? "");
  const [description, setDescription] = useState(() => task?.description ?? "");
  const [priority, setPriority] = useState<Priority>(() => task?.priority ?? "medium");
  const [category, setCategory] = useState<string | null>(() => task?.category ?? null);
  const [sectionId, setSectionId] = useState<string | null>(() => task?.sectionId ?? null);
  const [dueAt, setDueAt] = useState<string | null>(() => task?.dueAt ?? initialDueAt ?? null);
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => task?.subtasks.map((item) => ({ ...item })) ?? []);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [picker, setPicker] = useState<"date" | "time" | null>(null);

  const dateValue = dueAt && isValid(parseISO(dueAt)) ? parseISO(dueAt) : new Date();
  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({ title: trimmed, description: description.trim(), dueAt, priority, category, subtasks }, sectionId);
  };
  const updateDate = (date: Date) => setDueAt(date.toISOString());
  const addSubtaskLocal = () => {
    if (!subtaskTitle.trim()) return;
    setSubtasks((current) => [...current, { id: `local-${Date.now()}`, title: subtaskTitle.trim(), done: false }]);
    setSubtaskTitle("");
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalKeyboard}>
          <View style={[styles.editor, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.editorHeader}><View><Text style={[styles.editorEyebrow, { color: theme.colors.primary }]}>{task ? "REFINE TASK" : "NEW TASK"}</Text><Text style={[styles.editorTitle, { color: theme.colors.foreground }]}>{task ? "Edit task" : "Add a task"}</Text></View><IconButton icon="close" label="Close task editor" onPress={onClose} /></View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground }]}>TITLE</Text>
              <Input autoFocus={!task} value={title} onChangeText={setTitle} placeholder="What needs your attention?" returnKeyType="next" />
              <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground }]}>DESCRIPTION</Text>
              <TextInput value={description} onChangeText={setDescription} placeholder="Add a little context" placeholderTextColor={theme.colors.mutedForeground} multiline style={[styles.textArea, { color: theme.colors.foreground, backgroundColor: theme.colors.input, borderColor: theme.colors.border }]} />
              <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground }]}>PRIORITY</Text>
              <View style={styles.wrapRow}>{PRIORITY_ORDER.map((item) => <Chip key={item} label={PRIORITY_META[item].label} active={priority === item} color={PRIORITY_META[item].dot} onPress={() => setPriority(item)} />)}</View>
              <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground }]}>BOARD</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wrapRow}>{boards.map((item) => { const tone = boardColor(item.color); return <Chip key={item.id} label={item.label} color={tone.dot} active={category === item.id} onPress={() => setCategory(category === item.id ? null : item.id)} />; })}</ScrollView>
              <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground }]}>WHEN</Text>
              <View style={styles.dateRow}><Button variant="secondary" label={dueAt ? format(dateValue, "MMM d") : "No deadline"} onPress={() => setPicker("date")} style={{ flex: 1 }} /><Button variant="secondary" label={dueAt ? format(dateValue, "h:mm a") : "Set time"} onPress={() => setPicker("time")} style={{ flex: 1 }} /><Button size="icon" variant="ghost" accessibilityLabel="Clear due date" onPress={() => setDueAt(null)}><Ionicons name="close-circle-outline" size={20} color={theme.colors.mutedForeground} /></Button></View>
              {picker ? <DateTimePicker value={dateValue} mode={picker} display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, selected) => { setPicker(null); if (selected) updateDate(selected); }} /> : null}
              <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground }]}>SECTION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wrapRow}><Chip label="Unsorted" active={!sectionId} onPress={() => setSectionId(null)} />{sections.map((section) => <Chip key={section.id} label={section.title} active={sectionId === section.id} onPress={() => setSectionId(section.id)} />)}</ScrollView>
              <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground }]}>SUBTASKS</Text>
              {subtasks.map((subtask, index) => <View key={subtask.id} style={styles.subtaskRow}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: subtask.done }} onPress={() => setSubtasks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item))} style={[styles.subtaskCheck, { borderColor: subtask.done ? theme.colors.success : theme.colors.borderStrong, backgroundColor: subtask.done ? theme.colors.success : "transparent" }]}>{subtask.done ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}</Pressable><Text style={[styles.subtaskText, { color: theme.colors.foreground, textDecorationLine: subtask.done ? "line-through" : "none" }]} numberOfLines={2}>{subtask.title}</Text><IconButton size={36} icon="trash-outline" label={`Remove ${subtask.title}`} onPress={() => setSubtasks((current) => current.filter((_, itemIndex) => itemIndex !== index))} tone="danger" /></View>)}
              <View style={styles.addSubtask}><TextInput value={subtaskTitle} onChangeText={setSubtaskTitle} onSubmitEditing={addSubtaskLocal} placeholder="Add a subtask" placeholderTextColor={theme.colors.mutedForeground} style={[styles.subtaskInput, { color: theme.colors.foreground, borderColor: theme.colors.border, backgroundColor: theme.colors.input }]} /><Button size="icon-sm" variant="soft" accessibilityLabel="Add subtask" onPress={addSubtaskLocal}><Ionicons name="add" size={19} color={theme.colors.primary} /></Button></View>
              <Button label={task ? "Save changes" : "Create task"} onPress={save} disabled={!title.trim()} style={{ marginTop: 18 }} />
              {task ? <View style={styles.editorActions}><Button variant="soft" label={task.canceled ? "Restore task" : "Cancel task"} onPress={onCancelTask ?? (() => undefined)} /><Button variant="ghost" label="Delete" onPress={onDelete ?? (() => undefined)} /></View> : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function OptionSheet({ visible, title, options, onClose }: { visible: boolean; title: string; options: { label: string; icon?: keyof typeof Ionicons.glyphMap; destructive?: boolean; onPress: () => void }[]; onClose: () => void }) {
  const { theme } = useTheme();
  return <Sheet visible={visible} onClose={onClose}><Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>{title}</Text>{options.map((option) => <Pressable key={option.label} accessibilityRole="button" onPress={() => { option.onPress(); onClose(); }} style={({ pressed }) => [styles.option, { borderBottomColor: theme.colors.border, opacity: pressed ? 0.65 : 1 }]}><Ionicons name={option.icon ?? "chevron-forward-outline"} size={20} color={option.destructive ? theme.colors.destructive : theme.colors.primary} /><Text style={{ color: option.destructive ? theme.colors.destructive : theme.colors.foreground, fontSize: 15, fontWeight: "600" }}>{option.label}</Text></Pressable>)}</Sheet>;
}

export function TextEntrySheet({ visible, title, description, placeholder, initialValue = "", actionLabel = "Save", onClose, onSubmit }: { visible: boolean; title: string; description?: string; placeholder?: string; initialValue?: string; actionLabel?: string; onClose: () => void; onSubmit: (value: string) => void }) {
  const entryKey = `${visible ? "open" : "closed"}:${initialValue}`;
  return <TextEntrySheetForm key={entryKey} visible={visible} title={title} description={description} placeholder={placeholder} initialValue={initialValue} actionLabel={actionLabel} onClose={onClose} onSubmit={onSubmit} />;
}

function TextEntrySheetForm({ visible, title, description, placeholder, initialValue = "", actionLabel = "Save", onClose, onSubmit }: { visible: boolean; title: string; description?: string; placeholder?: string; initialValue?: string; actionLabel?: string; onClose: () => void; onSubmit: (value: string) => void }) {
  const { theme } = useTheme();
  const [value, setValue] = useState(() => initialValue);
  return <Sheet visible={visible} onClose={onClose}><Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>{title}</Text>{description ? <Text style={[styles.sheetDescription, { color: theme.colors.mutedForeground }]}>{description}</Text> : null}<Input autoFocus value={value} onChangeText={setValue} placeholder={placeholder} onSubmitEditing={() => { if (value.trim()) onSubmit(value.trim()); }} style={{ marginTop: 12 }} /><Button label={actionLabel} disabled={!value.trim()} onPress={() => { if (value.trim()) onSubmit(value.trim()); }} style={{ marginTop: 14 }} /></Sheet>;
}

export function BoardCard({ label, count, completed, color, onPress, onMenu }: { label: string; count: number; completed: number; color: string; onPress: () => void; onMenu: () => void }) {
  const { theme } = useTheme();
  const progress = count === 0 ? 0 : completed / count;
  return <Card style={styles.boardCard}><Pressable accessibilityRole="button" accessibilityLabel={`Open ${label}`} onPress={onPress} style={styles.boardCardBody}><View style={[styles.boardGlyph, { backgroundColor: `${color}20` }]}><Ionicons name="layers-outline" size={22} color={color} /></View><View style={styles.boardCardCopy}><Text style={[styles.boardName, { color: theme.colors.foreground }]} numberOfLines={1}>{label}</Text><Text style={[styles.boardMeta, { color: theme.colors.mutedForeground }]}>{count} tasks · {completed} done</Text></View></Pressable><IconButton icon="ellipsis-horizontal" label={`Actions for ${label}`} onPress={onMenu} size={44} /><View style={[styles.progressTrack, { backgroundColor: theme.colors.secondary }]}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: color }]} /></View></Card>;
}

export function InsightsPanel({ tasks, boards, now }: { tasks: Task[]; boards: Board[]; now: Date }) {
  const { theme } = useTheme();
  const [window, setWindow] = useState<7 | 30 | 90>(7);
  const preset = `${window}d` as "7d" | "30d" | "90d";
  const period = computeInsightsForWindow(tasks, windowStartFromPreset(now, preset, null), windowEndFromPreset(now, preset, null));
  const completions = period.windowTotal;
  const priority = PRIORITY_ORDER.map((key) => ({ key, value: tasks.filter((task) => task.priority === key).length }));
  const maxPriority = Math.max(1, ...priority.map((item) => item.value));
  const boardCounts = boards.map((board) => ({ board, value: tasks.filter((task) => task.category === board.id).length })).filter((item) => item.value > 0);
  const maxDay = Math.max(1, period.best);
  const weekday = getWeekdayCompletionCounts(tasks, period.windowStart, period.windowEnd);
  const maxWeekday = Math.max(1, ...weekday);
  return <View style={{ gap: 14 }}><View style={styles.insightSwitch}>{([7, 30, 90] as const).map((item) => <Chip key={item} label={`${item} days`} active={window === item} onPress={() => setWindow(item)} />)}</View><View style={styles.statsGrid}><Stat label="Completed" value={completions.toString()} accent={theme.colors.success} /><Stat label="Streak" value={`${period.streak}d`} accent={theme.colors.primary} /><Stat label="Best day" value={period.best.toString()} accent={theme.colors.warning} /><Stat label="Period change" value={period.periodChange === null ? "—" : `${period.periodChange > 0 ? "+" : ""}${period.periodChange}%`} accent={theme.colors.info} /></View><Card style={styles.insightCard}><Text style={[styles.insightTitle, { color: theme.colors.foreground }]}>Daily completions</Text><View style={styles.chart}>{period.points.slice(-14).map((point) => <View key={point.key} style={styles.chartPoint}><View style={[styles.chartBar, { height: Math.max(5, (point.count / maxDay) * 76), backgroundColor: point.count ? theme.colors.primary : theme.colors.secondary }]} /><Text style={[styles.chartLabel, { color: theme.colors.mutedForeground }]}>{point.label}</Text></View>)}</View></Card><Card style={styles.insightCard}><Text style={[styles.insightTitle, { color: theme.colors.foreground }]}>Completion rhythm</Text><View style={styles.weekBars}>{weekday.map((value, index) => <View key={index} style={styles.weekBarItem}><View style={[styles.weekBar, { height: Math.max(5, (value / maxWeekday) * 56), backgroundColor: value ? theme.colors.info : theme.colors.secondary }]} /><Text style={[styles.chartLabel, { color: theme.colors.mutedForeground }]}>{["M", "T", "W", "T", "F", "S", "S"][index]}</Text></View>)}</View></Card><Card style={styles.insightCard}><Text style={[styles.insightTitle, { color: theme.colors.foreground }]}>Priority split</Text>{priority.map((item) => <View key={item.key} style={styles.barRow}><Text style={[styles.barLabel, { color: theme.colors.mutedForeground }]}>{PRIORITY_META[item.key].label}</Text><View style={[styles.barTrack, { backgroundColor: theme.colors.secondary }]}><View style={[styles.barFill, { width: `${(item.value / maxPriority) * 100}%`, backgroundColor: PRIORITY_META[item.key].dot }]} /></View><Text style={{ color: theme.colors.foreground, width: 26, textAlign: "right", fontWeight: "700" }}>{item.value}</Text></View>)}</Card>{boardCounts.length ? <Card style={styles.insightCard}><Text style={[styles.insightTitle, { color: theme.colors.foreground }]}>Where your work lives</Text>{boardCounts.map(({ board, value }) => { const tone = boardColor(board.color); return <View key={board.id} style={styles.barRow}><Text style={[styles.barLabel, { color: theme.colors.mutedForeground }]} numberOfLines={1}>{board.label}</Text><View style={[styles.barTrack, { backgroundColor: theme.colors.secondary }]}><View style={[styles.barFill, { width: `${(value / Math.max(1, ...boardCounts.map((item) => item.value))) * 100}%`, backgroundColor: tone.dot }]} /></View><Text style={{ color: theme.colors.foreground, width: 26, textAlign: "right", fontWeight: "700" }}>{value}</Text></View>; })}</Card> : null}</View>;
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) { const { theme } = useTheme(); return <View style={[styles.stat, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}><View style={[styles.statAccent, { backgroundColor: accent }]} /><Text style={[styles.statValue, { color: theme.colors.foreground }]}>{value}</Text><Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>{label}</Text></View>; }

const styles = StyleSheet.create({
  iconButton: { alignItems: "center", justifyContent: "center", borderRadius: 14 },
  chip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  taskPressable: { marginBottom: 10 }, taskCard: { borderRadius: 16, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, taskTopline: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, check: { width: 23, height: 23, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 }, taskTitle: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "700" }, priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 }, taskDescription: { fontSize: 13, lineHeight: 18, marginTop: 8, marginLeft: 33 }, metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 11, marginLeft: 33 }, metaItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "75%" }, modalBackdrop: { flex: 1, justifyContent: "flex-end" }, modalKeyboard: { maxHeight: "94%" }, editor: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 16, maxHeight: "100%" }, editorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }, editorEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.3 }, editorTitle: { fontSize: 23, lineHeight: 28, fontWeight: "700", marginTop: 2 }, fieldLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 16, marginBottom: 7 }, textArea: { minHeight: 78, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, textAlignVertical: "top", fontSize: 14 }, wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, dateRow: { flexDirection: "row", alignItems: "center", gap: 4 }, subtaskRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 44 }, subtaskCheck: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" }, subtaskText: { flex: 1, fontSize: 14, lineHeight: 19 }, addSubtask: { flexDirection: "row", alignItems: "center", gap: 8 }, subtaskInput: { flex: 1, height: 42, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 }, editorActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 }, sheetTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 }, sheetDescription: { fontSize: 14, lineHeight: 20 }, option: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth }, boardCard: { borderRadius: 20, padding: 14, minHeight: 150 }, boardCardBody: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }, boardGlyph: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" }, boardCardCopy: { flex: 1 }, boardName: { fontSize: 16, fontWeight: "700" }, boardMeta: { fontSize: 12, marginTop: 4 }, progressTrack: { height: 5, borderRadius: 3, marginTop: 15, overflow: "hidden" }, progressFill: { height: "100%", borderRadius: 3 }, insightSwitch: { flexDirection: "row", gap: 8 }, statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, stat: { width: "48%", minHeight: 92, borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, padding: 13, overflow: "hidden" }, statAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 }, statValue: { fontSize: 24, fontWeight: "800" }, statLabel: { fontSize: 12, marginTop: 4, fontWeight: "600" }, insightCard: { borderRadius: 19, padding: 16 }, insightTitle: { fontSize: 16, fontWeight: "700", marginBottom: 14 }, chart: { height: 105, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 3 }, chartPoint: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 5 }, chartBar: { width: "65%", minWidth: 4, borderRadius: 4 }, chartLabel: { fontSize: 9 }, weekBars: { height: 84, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 7 }, weekBarItem: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 6 }, weekBar: { width: "58%", minWidth: 5, borderRadius: 5 }, barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 11 }, barLabel: { width: 66, fontSize: 12, fontWeight: "600" }, barTrack: { flex: 1, height: 9, borderRadius: 6, overflow: "hidden" }, barFill: { height: "100%", borderRadius: 6 },
});
