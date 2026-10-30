import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, isValid, parseISO } from "date-fns";
import { useCallback, createElement, useEffect, useRef, useState, type MouseEvent } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";
import { mobileBottomNavClearance } from "@/theme/layout";
import { useOpenSession } from "@/hooks/use-open-session";
import { AnchoredMenu, anchorFromEvent, useAnchoredMenus, type MenuAnchor, type MenuOption } from "@/components/ui/anchored-menu";
import { RibbonScrollView } from "@/components/ui/ribbon-scroll-view";
import { ribbonLabel } from "@/lib/utils/ribbon-label";
import { BottomSheetModal } from "@/components/ui/bottom-sheet-modal";
import { EditorWindow } from "@/components/ui/editor-window";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InsightsDashboard } from "@/components/insights/insights-dashboard";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PriorityStars } from "@/components/ui/priority-stars";
import { StatusIcon } from "@/components/ui/status-icon";
import { boardColor } from "@/lib/domain/boards";
import { getTaskSectionId } from "@/lib/domain/sections";
import { PRIORITY_META, PRIORITY_ORDER } from "@/lib/domain/constants";
import { describeDue, deriveStatus } from "@/lib/domain/status";
import { classifySpecialCardTag, detectCardTheme, resolveCardDecoration } from "@/lib/features/card-themes";
import { SeasonalCardDecoration } from "@/components/ui/seasonal-card-decoration";
import { SpecialCardTagPicker } from "@/components/ui/special-card-tag-picker";
import { mergeCardTagDraft, normalizeCardTags, toggleCardTag } from "@/lib/features/special-card-tags";
import {
  DEFAULT_FILTERS,
  hasActiveFilters,
  type DateRangePreset,
  type InsightsFilters,
  type PriorityFilterOption,
  type StatusFilterOption,
  windowStartFromPreset,
} from "@/lib/features/insights-filters";
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
  onPress: (event: GestureResponderEvent) => void;
  tone?: "default" | "primary" | "danger";
  size?: number;
}) {
  const { theme } = useTheme();
  const color = tone === "primary" ? theme.colors.primary : tone === "danger" ? theme.colors.destructive : theme.colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={(event) => { event.stopPropagation(); onPress(event); }}
      {...(Platform.OS === "web" ? { onContextMenu: (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); onPress(event as unknown as GestureResponderEvent); } } : {})}
      style={({ pressed }) => [styles.iconButton, { width: size, height: size, opacity: pressed ? 0.65 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const nextScheme = theme.scheme === "dark" ? "light" : "dark";
  return <IconButton icon={theme.scheme === "dark" ? "sunny-outline" : "moon-outline"} label={`Use ${nextScheme} theme`} onPress={toggle} />;
}

function Chip({ label, active, onPress, color, icon }: { label: string; active?: boolean; onPress?: () => void; color?: string; icon?: keyof typeof Ionicons.glyphMap }) {
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
      {icon ? <Ionicons name={icon} size={14} color={active ? theme.colors.accentForeground : theme.colors.secondaryForeground} /> : null}
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
  onLongPress,
  compact = false,
  onActionPress,
}: {
  task: Task;
  boards: Board[];
  now: Date;
  onPress: () => void;
  onLongPress?: (event?: GestureResponderEvent) => void;
  compact?: boolean;
  onActionPress?: (event: GestureResponderEvent) => void;
}) {
  const { theme } = useTheme();
  const due = describeDue(task.dueAt, now);
  const board = boards.find((item) => item.id === task.category);
  const boardTone = board ? boardColor(board.color) : undefined;
  const cardTheme = detectCardTheme(task.title, task.description);
  const doneSubtasks = task.subtasks.filter((item) => item.done).length;
  const status = deriveStatus(task, now);
  const decoration = resolveCardDecoration(task.tags, status);
  const cardTags = (task.tags ?? []).filter((tag) => classifySpecialCardTag(tag)?.group !== "status").sort((a, b) => Number(Boolean(classifySpecialCardTag(b))) - Number(Boolean(classifySpecialCardTag(a))));
  const overdueDuration = status === "overdue" && due ? due.label.replace(/\s+overdue$/i, "") : null;
  const taskAction = onLongPress ?? onPress;
  return (
    <Pressable accessibilityLabel={`${task.canceled ? "Canceled task" : "Edit task"} ${task.title}`} onPress={onPress} onLongPress={onLongPress} // @ts-ignore
    onContextMenu={(event) => { event.preventDefault?.(); onLongPress?.(event.nativeEvent); }} delayLongPress={360} style={styles.taskPressable}>
      <Card style={[styles.taskCard, { backgroundColor: task.canceled ? theme.colors.secondary : theme.colors.card, borderLeftColor: task.canceled ? theme.colors.mutedForeground : status === "completed" ? theme.colors.success : status === "overdue" ? theme.colors.destructive : decoration?.accent ?? cardTheme?.accent ?? theme.colors.primary, borderLeftWidth: 3, padding: compact ? 12 : 14, opacity: task.canceled ? 0.82 : 1 }]}>
        {decoration ? <SeasonalCardDecoration theme={decoration} compact={compact} paused={compact} /> : null}
        <View pointerEvents="box-none">
        <View style={styles.taskTopline}>
          <Text style={[styles.taskTitle, { color: theme.colors.foreground, textDecorationLine: task.completed ? "line-through" : "none" }]} numberOfLines={2}>{task.title}</Text>
           <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${task.title}`} accessibilityHint="Opens task actions" onPress={(event) => { event.stopPropagation(); (onActionPress ?? taskAction)(event); }} style={({ pressed }) => [styles.taskAction, { borderColor: theme.colors.border, backgroundColor: theme.colors.secondary, opacity: pressed ? 0.65 : 1 }]}>
             <Ionicons name="ellipsis-horizontal" size={19} color={theme.colors.mutedForeground} />
           </Pressable>
        </View>
        {!compact && task.description ? <Text style={[styles.taskDescription, { color: theme.colors.mutedForeground, marginLeft: 0 }]} numberOfLines={2}>{task.description}</Text> : null}
        <View pointerEvents="none" style={[styles.metaRow, { marginLeft: 0 }]}>
           {status !== "upcoming" ? <StatusIcon status={status} detail={overdueDuration ? `Overdue by ${overdueDuration}` : undefined} /> : null}
           <PriorityStars priority={task.priority} size={14} />
           {due && !task.canceled && status !== "overdue" ? <View accessible accessibilityLabel={`Due ${due.title}`} style={styles.metaItem}><Ionicons name="time-outline" size={14} color={due.overdue ? theme.colors.destructive : due.today ? theme.colors.warning : theme.colors.mutedForeground} /><Text style={{ color: due.overdue ? theme.colors.destructive : due.today ? theme.colors.warning : theme.colors.mutedForeground, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>{due.label}</Text></View> : null}
             {board && boardTone && classifySpecialCardTag(board.label)?.group !== "status" ? <Chip label={board.label} color={boardTone.dot} /> : null}
             {cardTags.slice(0, 4).map((tag) => <Chip key={tag} label={tag} color={classifySpecialCardTag(tag)?.theme.accent ?? theme.colors.primary} />)}
             {cardTags.length > 4 ? <Text style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>+{cardTags.length - 4}</Text> : null}
            {task.subtasks.length > 0 ? <View style={styles.metaItem}><Ionicons name="list-outline" size={14} color={theme.colors.mutedForeground} /><Text style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>{doneSubtasks}/{task.subtasks.length}</Text></View> : null}
         </View>
         {task.subtasks.length > 0 ? <View accessible accessibilityLabel={`Checklist: ${doneSubtasks} of ${task.subtasks.length} complete`} style={[{ borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 10, gap: 6 }, { borderTopColor: theme.colors.border }]}>
           <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: theme.colors.mutedForeground, fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>CHECKLIST</Text><Text style={{ color: doneSubtasks === task.subtasks.length ? theme.colors.success : theme.colors.mutedForeground, fontSize: 12, fontWeight: "700" }}>{doneSubtasks}/{task.subtasks.length}</Text></View>
           {task.subtasks.slice(0, compact ? 2 : 3).map((subtask) => <View key={subtask.id} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Ionicons name={subtask.done ? "checkmark-circle" : "ellipse-outline"} size={16} color={subtask.done ? theme.colors.success : theme.colors.borderStrong} /><Text style={{ flex: 1, color: subtask.done ? theme.colors.mutedForeground : theme.colors.foreground, fontSize: 12, lineHeight: 17, textDecorationLine: subtask.done ? "line-through" : "none" }} numberOfLines={1}>{subtask.title}</Text></View>)}
           {task.subtasks.length > (compact ? 2 : 3) ? <Text style={{ color: theme.colors.mutedForeground, fontSize: 11, marginLeft: 23 }}>+ {task.subtasks.length - (compact ? 2 : 3)} more</Text> : null}
          </View> : null}
        </View>
      </Card>
    </Pressable>
  );
}

export function TaskEditor({
  visible,
  task,
  initialDueAt,
  initialSectionId,
  boards,
  sections,
  onClose,
  onSave,
  onAutoSave,
  onDelete,
  onCancelTask,
  presentation = "sheet",
}: {
  visible: boolean;
  task: Task | null;
  initialDueAt?: string | null;
  initialSectionId?: string | null;
  boards: Board[];
  sections: BoardSection[];
  onClose: () => void;
  onSave: (draft: TaskDraft, sectionId: string | null) => void;
  onAutoSave?: (draft: TaskDraft, sectionId: string | null) => void;
  onDelete?: () => void;
  onCancelTask?: () => void;
  presentation?: "sheet" | "panel";
}) {
  const session = useOpenSession(visible);
  const editorKey = `${session}:${task?.id ?? "new"}:${initialDueAt ?? ""}:${initialSectionId ?? ""}`;
  return <TaskEditorForm key={editorKey} visible={visible} task={task} initialDueAt={initialDueAt} initialSectionId={initialSectionId} boards={boards} sections={sections} onClose={onClose} onSave={onSave} onAutoSave={onAutoSave} onDelete={onDelete} onCancelTask={onCancelTask} presentation={presentation} />;
}

function TaskEditorForm({
  visible,
  task,
  initialDueAt,
  initialSectionId,
  boards,
  sections,
  onClose,
  onSave,
  onAutoSave,
  onDelete,
  onCancelTask,
  presentation,
}: {
  visible: boolean;
  task: Task | null;
  initialDueAt?: string | null;
  initialSectionId?: string | null;
  boards: Board[];
  sections: BoardSection[];
  onClose: () => void;
  onSave: (draft: TaskDraft, sectionId: string | null) => void;
  onAutoSave?: (draft: TaskDraft, sectionId: string | null) => void;
  onDelete?: () => void;
  onCancelTask?: () => void;
  presentation: "sheet" | "panel";
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const windowed = presentation === "sheet" && width >= 768;
  const wideForm = presentation === "panel" || windowed;
  const [title, setTitle] = useState(() => task?.title ?? "");
  const [description, setDescription] = useState(() => task?.description ?? "");
  const [priority, setPriority] = useState<Priority>(() => task?.priority ?? "medium");
  const [category, setCategory] = useState<string | null>(() => task?.category ?? null);
  const [tags, setTags] = useState<string[]>(() => normalizeCardTags(task?.tags));
  const [tagInput, setTagInput] = useState("");
  const sourceTags = task?.tags;
  const lastSourceTags = useRef(normalizeCardTags(sourceTags));
  useEffect(() => {
    if (!sourceTags) return;
    const previous = lastSourceTags.current;
    const incoming = normalizeCardTags(sourceTags);
    lastSourceTags.current = incoming;
    setTags((current) => mergeCardTagDraft(current, previous, incoming));
  }, [sourceTags]);
  const [sectionId, setSectionId] = useState<string | null>(() => task ? getTaskSectionId(task, sections, new Date()) ?? null : initialSectionId ?? null);
  const [dueAt, setDueAt] = useState<string | null>(() => task?.dueAt ?? initialDueAt ?? null);
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => task?.subtasks.map((item) => ({ ...item })) ?? []);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [picker, setPicker] = useState<"date" | "time" | null>(null);

  const autoSaveRef = useRef(onAutoSave);
  useEffect(() => {
    autoSaveRef.current = onAutoSave;
  }, [onAutoSave]);
  const savedSignatureRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<(() => void) | null>(null);
  // Switching Activity cards replaces the keyed form. Save its last draft with
  // the old task's callback, never the newly selected task's callback.
  useEffect(() => () => pendingSaveRef.current?.(), []);
  const dateValue = dueAt && isValid(parseISO(dueAt)) ? parseISO(dueAt) : new Date();
  const buildDraft = useCallback((): TaskDraft => ({
    title: title.trim(),
    description: description.trim(),
    dueAt,
    priority,
    category,
    tags,
    subtasks: subtasks.map((item) => ({ ...item, title: item.title.trim() })).filter((item) => item.title.length > 0),
  }), [category, description, dueAt, priority, subtasks, tags, title]);
  const save = () => {
    if (!title.trim()) {
      setTitleError("Give your task a title.");
      return;
    }
    onSave(buildDraft(), sectionId);
  };
  const flushAutoSave = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const autoSave = autoSaveRef.current;
    if (!task || !autoSave || !title.trim()) return;
    const draft = buildDraft();
    const signature = JSON.stringify({ draft, sectionId });
    if (signature === savedSignatureRef.current) return;
    autoSave(draft, sectionId);
    savedSignatureRef.current = signature;
  };
  const closeEditor = () => {
    flushAutoSave();
    onClose();
  };
  const cancelTask = () => {
    flushAutoSave();
    onCancelTask?.();
  };
  useEffect(() => {
    const autoSave = autoSaveRef.current;
    if (!task || !autoSave || !title.trim()) return;
    const draft = buildDraft();
    const signature = JSON.stringify({ draft, sectionId });
    pendingSaveRef.current = () => {
      if (signature !== savedSignatureRef.current) {
        autoSave(draft, sectionId);
        savedSignatureRef.current = signature;
      }
    };
    if (savedSignatureRef.current === null) {
      savedSignatureRef.current = signature;
      return;
    }
    if (signature === savedSignatureRef.current) return;
    const timer = setTimeout(() => {
      autoSaveTimerRef.current = null;
      autoSave(draft, sectionId);
      savedSignatureRef.current = signature;
    }, 500);
    autoSaveTimerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (autoSaveTimerRef.current === timer) autoSaveTimerRef.current = null;
    };
  }, [buildDraft, sectionId, task, title]);
  const updateDate = (date: Date) => setDueAt(date.toISOString());
  const addSubtaskLocal = () => {
    if (!subtaskTitle.trim()) return;
    setSubtasks((current) => [...current, { id: `local-${Date.now()}`, title: subtaskTitle.trim(), done: false }]);
    setSubtaskTitle("");
  };
  const footer = <View style={[styles.taskEditorFooter, windowed && styles.taskEditorWindowFooter, { borderTopColor: theme.colors.border, paddingBottom: wideForm ? 12 : Math.max(insets.bottom, 12), backgroundColor: windowed ? theme.colors.backgroundAlt : undefined }]}>
    {task ? <View style={[styles.taskEditorFooterActions, wideForm && styles.taskEditorPanelActions]}>
      <Button variant="secondary" label={task.canceled ? "Restore task" : "Cancel task"} onPress={cancelTask} style={wideForm ? styles.taskEditorPanelPrimary : styles.taskEditorFooterPrimary} />
      <Button variant="ghost" onPress={onDelete ?? (() => undefined)} accessibilityLabel="Delete task" style={styles.taskEditorDeleteButton}>
        <Ionicons name="trash-outline" size={17} color={theme.colors.destructive} />
        <Text style={{ color: theme.colors.destructive, fontSize: 14, fontWeight: "600" }}>Delete</Text>
      </Button>
    </View> : <Button label="Add task" onPress={save} style={windowed ? styles.taskEditorWindowPrimary : undefined} />}
  </View>;
  const priorityControl = (
    <View style={styles.wrapRow}>
      {PRIORITY_ORDER.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityState={{ selected: priority === item }}
          onPress={() => setPriority(item)}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: priority === item ? theme.colors.primarySoft : theme.colors.secondary,
              borderColor: priority === item ? theme.colors.primary : theme.colors.border,
              opacity: pressed ? 0.75 : 1,
              gap: 6,
            },
          ]}
        >
          <PriorityStars priority={item} size={13} zoom={1} />
          <Text style={{ color: priority === item ? theme.colors.accentForeground : theme.colors.secondaryForeground, fontSize: 12, fontWeight: "600" }}>
            {PRIORITY_META[item].label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  const tagChips = boards.filter((item) => !classifySpecialCardTag(item.label)).map((item) => { const tone = boardColor(item.color); return <Chip key={item.id} label={item.label} color={tone.dot} active={category === item.id} onPress={() => setCategory(category === item.id ? null : item.id)} />; });

  const addTag = () => { if (!tagInput.trim()) return; setTags((current) => normalizeCardTags([...current, tagInput])); setTagInput(""); };
  const tagsControl = <View style={{ gap: 10 }}>
    {tagChips.length ? <View testID="task-editor-tags-wrap" style={styles.wrapRow}>{tagChips}</View> : null}
    <SpecialCardTagPicker tags={tags} onChange={setTags} />
    <View style={styles.wrapRow}>{tags.filter((tag) => !classifySpecialCardTag(tag)).map((tag) => <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`Remove tag ${tag}`} onPress={() => setTags((current) => toggleCardTag(current, tag))} style={[styles.chip, { borderColor: theme.colors.border, backgroundColor: theme.colors.secondary }]}><Text style={{ color: theme.colors.foreground, fontSize: 12 }}>{tag} ×</Text></Pressable>)}</View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><TextInput accessibilityLabel="New card tag" placeholder="Add a tag" placeholderTextColor={theme.colors.mutedForeground} value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag} returnKeyType="done" style={{ flex: 1, minWidth: 0, minHeight: 44, color: theme.colors.foreground, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8 }} /><Button label="Add" size="sm" onPress={addTag} disabled={!tagInput.trim()} /></View>
  </View>;

  const content = <>
            {!windowed ? <View style={styles.taskEditorHeader}>
              <View style={styles.taskEditorHeaderCopy}>
                <Text accessibilityRole="header" style={[styles.taskEditorTitle, { color: theme.colors.foreground }]}>{task ? "Task" : "Create"}</Text>
                <Text style={[styles.taskEditorSubtitle, { color: theme.colors.mutedForeground }]}>{task ? "Changes save automatically" : "Start with a title. Details can wait."}</Text>
              </View>
              {presentation === "sheet" ? <IconButton icon="close" label="Close task editor" onPress={closeEditor} size={40} /> : null}
            </View> : null}
            <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={wideForm} style={[styles.taskEditorScroll, wideForm ? { flex: 1 } : null]} contentContainerStyle={[styles.taskEditorContent, presentation === "panel" ? { paddingBottom: mobileBottomNavClearance + insets.bottom } : null]}>
              <View testID="task-editor-title-field">
              <Text style={[styles.taskEditorLabel, { color: theme.colors.mutedForeground }]}>TITLE</Text>
              <TextInput
                autoFocus={!task}
                value={title}
                onChangeText={(value) => { setTitle(value); if (titleError) setTitleError(null); }}
                placeholder="What needs doing?"
                placeholderTextColor={theme.colors.mutedForeground}
                returnKeyType="next"
                accessibilityLabel="Task title"
                accessibilityHint="Required"
                style={[styles.taskEditorTitleInput, windowed && styles.taskEditorWindowInput, { color: theme.colors.foreground, backgroundColor: theme.colors.input, borderColor: titleError ? theme.colors.destructive : theme.colors.border }]}
              />
              {titleError ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.destructive, fontSize: 12, fontWeight: "600", marginTop: 6 }}>{titleError}</Text> : null}
              </View>
              <View style={styles.taskEditorSectionHeading}>
                <Text style={[styles.taskEditorLabel, { color: theme.colors.mutedForeground }]}>LIST</Text>
                <View testID="task-editor-list-choices" style={[styles.wrapRow, { marginTop: 8 }]}>
                  <Chip label="No list" active={sectionId === null} onPress={() => setSectionId(null)} />
                  {sections.filter((section) => !section.hidden || section.id === sectionId).map((section) => <Chip key={section.id} label={section.title} active={sectionId === section.id} onPress={() => setSectionId(section.id)} />)}
                </View>
              </View>
              <View testID="task-editor-notes-field">
              <Text style={[styles.taskEditorLabel, { color: theme.colors.mutedForeground }]}>NOTES</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Add a little context"
                placeholderTextColor={theme.colors.mutedForeground}
                multiline
                style={[styles.taskEditorNotes, wideForm && styles.taskEditorPanelNotes, windowed && styles.taskEditorWindowInput, { color: theme.colors.foreground, backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}
              />
              </View>
              <View testID="task-editor-priority-schedule-row" style={wideForm ? styles.taskEditorPanelRow : undefined}>
              <View testID="task-editor-priority-field" style={wideForm ? styles.taskEditorPanelField : undefined}>
              <Text style={[styles.taskEditorInlineLabel, styles.taskEditorInlineLabelFirst, { color: theme.colors.mutedForeground, marginTop: 18 }]}>{wideForm ? "PRIORITY" : "ORGANIZE"}</Text>
                <View style={[styles.taskEditorSection, windowed && styles.taskEditorWindowInput, { borderColor: theme.colors.border, marginTop: 6 }]}>
                {!wideForm ? <Text style={[styles.taskEditorInlineLabel, styles.taskEditorInlineLabelFirst, { color: theme.colors.mutedForeground }]}>PRIORITY</Text> : null}
                {priorityControl}
                {!wideForm ? <>
                <Text style={[styles.taskEditorInlineLabel, { color: theme.colors.mutedForeground }]}>TAGS</Text>
                {tagsControl}
                </> : null}
              </View>
              </View>
              <View testID="task-editor-schedule-field" style={wideForm ? styles.taskEditorPanelField : undefined}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
                <Text style={[styles.taskEditorInlineLabel, { color: theme.colors.mutedForeground, marginTop: 0, marginBottom: 0 }]}>SCHEDULE</Text>
                <Text style={[styles.taskEditorSectionMeta, { color: theme.colors.mutedForeground }]}>OPTIONAL</Text>
              </View>
              <View style={[styles.taskEditorSection, windowed && styles.taskEditorWindowInput, { borderColor: theme.colors.border, marginTop: 6 }]}>
                <View style={styles.taskEditorDateRow}>
                  <Pressable accessibilityRole="button" accessibilityLabel={dueAt ? `Due ${format(dateValue, "MMMM d, yyyy")}` : "Set due date"} onPress={() => setPicker("date")} style={({ pressed }) => [styles.taskEditorDateField, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 }]}>
                    <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.taskEditorDateText, { color: theme.colors.foreground }]} numberOfLines={1}>{dueAt ? format(dateValue, "MMM d") : "Pick a date"}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={dueAt ? `Due at ${format(dateValue, "h:mm a")}` : "Set due time"} onPress={() => setPicker("time")} style={({ pressed }) => [styles.taskEditorDateField, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 }]}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.taskEditorDateText, { color: theme.colors.foreground }]} numberOfLines={1}>{dueAt ? format(dateValue, "h:mm a") : "Set time"}</Text>
                  </Pressable>
                  {dueAt ? <Pressable accessibilityRole="button" accessibilityLabel="Clear due date" onPress={() => setDueAt(null)} style={({ pressed }) => [styles.taskEditorClearDue, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 }]}><Ionicons name="close" size={18} color={theme.colors.mutedForeground} /></Pressable> : null}
                </View>
                {picker ? (Platform.OS === "web" ? <View style={styles.taskEditorPicker}>
                  {picker === "date" ? createElement("input", {
                    type: "date",
                    value: format(dateValue, "yyyy-MM-dd"),
                    onChange: (event: any) => {
                      const value = event?.target?.value;
                      if (value) {
                        const selected = new Date(`${value}T00:00:00`);
                        if (!Number.isNaN(selected.getTime())) {
                          selected.setHours(dateValue.getHours(), dateValue.getMinutes(), 0, 0);
                          updateDate(selected);
                        }
                      }
                      setPicker(null);
                    },
                    style: { width: "100%", minHeight: 40, paddingHorizontal: 10, borderRadius: 8, border: "1px solid", borderColor: theme.colors.border, backgroundColor: theme.colors.input, color: theme.colors.foreground },
                  }) : createElement("input", {
                    type: "time",
                    value: format(dateValue, "HH:mm"),
                    onChange: (event: any) => {
                      const value = event?.target?.value;
                      if (value) {
                        const [hours, minutes] = value.split(":").map((part: string) => Number(part));
                        const selected = new Date(dateValue);
                        selected.setHours(Number.isNaN(hours) ? 0 : hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
                        updateDate(selected);
                      }
                      setPicker(null);
                    },
                    style: { width: "100%", minHeight: 40, paddingHorizontal: 10, borderRadius: 8, border: "1px solid", borderColor: theme.colors.border, backgroundColor: theme.colors.input, color: theme.colors.foreground },
                  })}
                </View> : <View style={styles.taskEditorPicker}><DateTimePicker value={dateValue} mode={picker} display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, selected) => { setPicker(null); if (selected) updateDate(selected); }} /></View>) : null}
              </View>
              </View>
              </View>
              {wideForm ? <View testID="task-editor-tags-list-row" style={styles.taskEditorPanelRow}>
                <View style={styles.taskEditorPanelField}>
                  <Text style={[styles.taskEditorLabel, { color: theme.colors.mutedForeground }]}>TAGS</Text>
                  <View style={[styles.taskEditorSection, windowed && styles.taskEditorWindowInput, { borderColor: theme.colors.border }]}>{tagsControl}</View>
                </View>
              </View> : null}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
                <Text style={[styles.taskEditorInlineLabel, { color: theme.colors.mutedForeground, marginTop: 0, marginBottom: 0 }]}>CHECKLIST</Text>
                {subtasks.length ? <Text style={[styles.taskEditorSectionMeta, { color: theme.colors.mutedForeground }]}>{subtasks.filter((item) => item.done).length}/{subtasks.length} DONE</Text> : null}
              </View>
              <View style={[styles.taskEditorSection, { borderColor: theme.colors.border, marginTop: 6 }]}>
                {subtasks.length ? <View style={[styles.taskEditorChecklist, { borderColor: theme.colors.border, backgroundColor: theme.colors.input, marginTop: 0 }]}>{subtasks.map((subtask, index) => <View key={subtask.id} style={[styles.taskEditorSubtaskRow, index > 0 ? { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}><Pressable accessibilityRole="checkbox" accessibilityLabel={`${subtask.done ? "Mark incomplete" : "Mark complete"} ${subtask.title}`} accessibilityState={{ checked: subtask.done }} onPress={() => setSubtasks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item))} style={[styles.taskEditorSubtaskCheck, { borderColor: subtask.done ? theme.colors.success : theme.colors.borderStrong, backgroundColor: subtask.done ? theme.colors.success : theme.colors.card }]}>{subtask.done ? <Ionicons name="checkmark" size={13} color={theme.colors.successForeground} /> : null}</Pressable><TextInput value={subtask.title} onChangeText={(value) => setSubtasks((current) => current.map((item) => item.id === subtask.id ? { ...item, title: value } : item))} placeholder={`Checklist item ${index + 1}`} placeholderTextColor={theme.colors.mutedForeground} accessibilityLabel={`Subtask ${index + 1}`} style={[styles.taskEditorSubtaskInput, { color: theme.colors.foreground, textDecorationLine: subtask.done ? "line-through" : "none" }]} /><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${subtask.title || `subtask ${index + 1}`}`} onPress={() => setSubtasks((current) => current.filter((item) => item.id !== subtask.id))} style={({ pressed }) => [styles.taskEditorSubtaskDelete, { opacity: pressed ? 0.6 : 1 }]}><Ionicons name="trash-outline" size={17} color={theme.colors.mutedForeground} /></Pressable></View>)}</View> : null}
                <View style={styles.taskEditorAddSubtask}><TextInput value={subtaskTitle} onChangeText={setSubtaskTitle} onSubmitEditing={addSubtaskLocal} placeholder="Add a step" placeholderTextColor={theme.colors.mutedForeground} returnKeyType="done" style={[styles.taskEditorAddSubtaskInput, { color: theme.colors.foreground, backgroundColor: theme.colors.input, borderColor: theme.colors.border }]} /><Button size="icon-sm" variant="soft" accessibilityLabel="Add subtask" onPress={addSubtaskLocal}><Ionicons name="add" size={19} color={theme.colors.primary} /></Button></View>
              </View>
              {presentation === "panel" ? <View style={{ marginTop: 16 }}>{footer}</View> : null}
            </ScrollView>
            {presentation === "sheet" ? footer : null}
    </>;
  if (presentation === "panel") return visible ? <View style={{ flex: 1, minHeight: 0, paddingTop: 12, backgroundColor: "transparent" }}>{content}</View> : null;
  if (windowed) return <EditorWindow visible={visible} title={task ? "Edit task" : "Create task"} onClose={closeEditor}>{content}</EditorWindow>;
  return <BottomSheetModal visible={visible} onClose={closeEditor} style={styles.taskEditorSheet}>{content}</BottomSheetModal>;
}

export function OptionSheet({ visible, title, options, onClose, anchor }: { visible: boolean; title: string; options: MenuOption[]; onClose: () => void; anchor?: MenuAnchor | null }) {
  const { theme } = useTheme();
  const anchoredMenus = useAnchoredMenus();
  // Keep the last visible title/options/anchor through the close animation so
  // callers can clear their selected item without the menu flashing fallbacks.
  const lastVisible = useRef({ title, options, anchor });
  // eslint-disable-next-line react-hooks/refs
  if (visible) lastVisible.current = { title, options, anchor };
  // eslint-disable-next-line react-hooks/refs
  const shown = visible ? { title, options, anchor } : lastVisible.current;
  if (anchoredMenus && shown.anchor) return <AnchoredMenu visible={visible} title={shown.title} options={shown.options} onClose={onClose} anchor={shown.anchor} />;
  return <Sheet visible={visible} onClose={onClose}><Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>{shown.title}</Text>{shown.options.map((option) => <Pressable key={option.label} accessibilityRole="button" onPress={() => { option.onPress(); onClose(); }} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.option, { borderBottomColor: theme.colors.border, backgroundColor: (pressed || hovered) ? theme.colors.secondary : "transparent", opacity: pressed ? 0.85 : 1 }]}><Ionicons name={option.icon ?? "chevron-forward-outline"} size={20} color={option.destructive ? theme.colors.destructive : theme.colors.primary} /><Text style={{ color: option.destructive ? theme.colors.destructive : theme.colors.foreground, fontSize: 15, fontWeight: "600" }}>{option.label}</Text></Pressable>)}</Sheet>;
}

export function TextEntrySheet({ visible, title, description, placeholder, initialValue = "", actionLabel = "Save", onClose, onSubmit }: { visible: boolean; title: string; description?: string; placeholder?: string; initialValue?: string; actionLabel?: string; onClose: () => void; onSubmit: (value: string) => void }) {
  const session = useOpenSession(visible);
  // Callers often clear the selected item (and its initial value) on close.
  // Retaining it keeps the filled-in form mounted while the sheet exits.
  const lastVisible = useRef({ title, description, placeholder, initialValue, actionLabel });
  // eslint-disable-next-line react-hooks/refs
  if (visible) lastVisible.current = { title, description, placeholder, initialValue, actionLabel };
  // eslint-disable-next-line react-hooks/refs
  const shown = visible ? { title, description, placeholder, initialValue, actionLabel } : lastVisible.current;
  const entryKey = `${session}:${shown.initialValue}`;
  return <TextEntrySheetForm key={entryKey} visible={visible} title={shown.title} description={shown.description} placeholder={shown.placeholder} initialValue={shown.initialValue} actionLabel={shown.actionLabel} onClose={onClose} onSubmit={onSubmit} />;
}

function TextEntrySheetForm({ visible, title, description, placeholder, initialValue = "", actionLabel = "Save", onClose, onSubmit }: { visible: boolean; title: string; description?: string; placeholder?: string; initialValue?: string; actionLabel?: string; onClose: () => void; onSubmit: (value: string) => void }) {
  const { theme } = useTheme();
  const [value, setValue] = useState(() => initialValue);
  const { width } = useWindowDimensions();
  const submit = () => { if (value.trim()) onSubmit(value.trim()); };
  if (width >= 768) return <EditorWindow visible={visible} title={title} icon="pencil-outline" closeLabel={`Close ${title.toLowerCase()}`} testID="text-entry-window" width={560} height={300} onClose={onClose}>
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: 20 }}>
      {description ? <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>{description}</Text> : null}
      <Text style={{ color: theme.colors.mutedForeground, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 }}>{(placeholder ?? "Name").toUpperCase()}</Text>
      <Input autoFocus value={value} onChangeText={setValue} placeholder={placeholder} accessibilityLabel={placeholder ?? title} accessibilityHint="Required" returnKeyType="done" onSubmitEditing={submit} style={{ borderRadius: 6 }} />
    </ScrollView>
    <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, backgroundColor: theme.colors.backgroundAlt }}>
      <Button label="Cancel" variant="secondary" onPress={onClose} style={{ borderRadius: 6 }} />
      <Button label={actionLabel} disabled={!value.trim()} onPress={submit} style={{ minWidth: 120, borderRadius: 6 }} />
    </View>
  </EditorWindow>;
  return <Sheet visible={visible} onClose={onClose}><Text style={[styles.sheetTitle, { color: theme.colors.foreground }]}>{title}</Text>{description ? <Text style={[styles.sheetDescription, { color: theme.colors.mutedForeground }]}>{description}</Text> : null}<Input autoFocus value={value} onChangeText={setValue} placeholder={placeholder} onSubmitEditing={() => { if (value.trim()) onSubmit(value.trim()); }} style={{ marginTop: 12 }} /><Button label={actionLabel} disabled={!value.trim()} onPress={() => { if (value.trim()) onSubmit(value.trim()); }} style={{ marginTop: 14 }} /></Sheet>;
}

export function BoardCard({ label, count, completed, createdAt, overdue = 0, dueSoon = 0, color, onPress, onMenu }: { label: string; count: number; completed: number; createdAt?: string; overdue?: number; dueSoon?: number; color: string; onPress: () => void; onMenu: () => void }) {
  const { theme } = useTheme();
  const progress = count === 0 ? 0 : completed / count;
  const createdLabel = createdAt && isValid(parseISO(createdAt)) ? `Created ${format(parseISO(createdAt), "MMM d, yyyy")}` : null;
  const openCount = Math.max(0, count - completed);
  
  return (
    <View style={[styles.boardCardNew, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <Pressable onPress={onPress} style={styles.boardCardNewPressable}>
        <View style={styles.boardCardNewHeader}>
          <View style={styles.boardCardNewTitleRow}>
            <Text style={[styles.boardCardNewTitle, { color: theme.colors.foreground }]} numberOfLines={1}>{label}</Text>
            <TouchableOpacity onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {createdLabel ? <Text style={[styles.boardCardNewMeta, { color: theme.colors.mutedForeground }]}>{createdLabel}</Text> : null}
        </View>
        
        <View style={styles.boardCardNewProgress}>
          <View style={styles.boardCardNewProgressHeader}>
            <View style={styles.boardCardNewCounts}>
              <View style={styles.boardCardNewCountItem}>
                <View style={[styles.boardCardNewDot, { borderColor: theme.colors.mutedForeground }]} />
                <Text style={[styles.boardCardNewCountText, { color: theme.colors.foreground }]}><Text style={{ fontWeight: "600" }}>{openCount}</Text> open</Text>
              </View>
              <View style={styles.boardCardNewCountItem}>
                <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
                <Text style={[styles.boardCardNewCountText, { color: theme.colors.success }]}><Text style={{ fontWeight: "600" }}>{completed}</Text> done</Text>
              </View>
            </View>
            <Text style={[styles.boardCardNewPct, { color: theme.colors.mutedForeground }]}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={[styles.boardCardNewProgressBar, { backgroundColor: theme.colors.secondary }]}>
            <View style={[styles.boardCardNewProgressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.colors.success }]} />
          </View>
        </View>
        
        <View style={styles.boardCardNewAlerts}>
          <View style={styles.boardCardNewAlertsLeft}>
            {overdue > 0 ? (
              <View style={styles.boardCardNewAlertItem}>
                <Ionicons name="warning-outline" size={12} color={theme.colors.destructive} />
                <Text style={[styles.boardCardNewAlertText, { color: theme.colors.destructive }]}>{overdue} overdue</Text>
              </View>
            ) : null}
            {dueSoon > 0 ? (
              <View style={styles.boardCardNewAlertItem}>
                <Ionicons name="time-outline" size={12} color={theme.colors.info} />
                <Text style={[styles.boardCardNewAlertText, { color: theme.colors.info }]}>{dueSoon} due soon</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
      
      <View style={[styles.boardCardNewFooter, { borderTopColor: theme.colors.border }]}>
        <View style={styles.boardCardNewFooterLeft}>
          <TouchableOpacity style={styles.boardCardNewFooterBtn}>
            <Ionicons name="download-outline" size={14} color={theme.colors.mutedForeground} />
            <Text style={[styles.boardCardNewFooterBtnText, { color: theme.colors.mutedForeground }]}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boardCardNewFooterBtn}>
            <Ionicons name="copy-outline" size={14} color={theme.colors.mutedForeground} />
            <Text style={[styles.boardCardNewFooterBtnText, { color: theme.colors.mutedForeground }]}>Duplicate</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity>
          <Text style={[styles.boardCardNewRemoveText, { color: theme.colors.destructive }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export interface InsightsPanelProps {
  tasks: Task[];
  boards: Board[];
  now: Date;
  filters?: InsightsFilters;
  onReset?: () => void;
  onExport?: (tasks: Task[], boards: Board[]) => void | Promise<void>;
}

const INSIGHTS_DATE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "custom", label: "Custom" },
];

const INSIGHTS_STATUS_OPTIONS: { value: StatusFilterOption; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "completed", label: "Completed" },
  { value: "overdue", label: "Overdue" },
  { value: "canceled", label: "Canceled" },
];

const INSIGHTS_PRIORITY_OPTIONS: { value: PriorityFilterOption; label: string }[] = [
  { value: "all", label: "All priority" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function InsightsFiltersRibbon({ filters, onChange, boards, now, onOverlayChange }: {
  filters: InsightsFilters;
  onChange: (filters: InsightsFilters) => void;
  boards: Board[];
  now: Date;
  onOverlayChange?: (open: boolean) => void;
}) {
  const { theme: { colors } } = useTheme();
  const { width } = useWindowDimensions();
  const compact = Platform.OS === "web" && width >= 768;
  const [menu, setMenu] = useState<{ title: string; options: MenuOption[]; anchor: MenuAnchor } | null>(null);
  const [picker, setPicker] = useState<"start" | "end" | null>(null);
  const overlayOpen = menu !== null || picker !== null;
  useEffect(() => { onOverlayChange?.(overlayOpen); }, [onOverlayChange, overlayOpen]);
  useEffect(() => () => onOverlayChange?.(false), [onOverlayChange]);
  const update = (patch: Partial<InsightsFilters>) => onChange({ ...filters, ...patch });
  const chooseDate = (date: Date) => {
    if (picker === "start") update({ dateRange: "custom", customStart: date, customEnd: filters.customEnd && filters.customEnd >= date ? filters.customEnd : date });
    else update({ dateRange: "custom", customStart: filters.customStart && filters.customStart <= date ? filters.customStart : date, customEnd: date });
    setPicker(null);
  };
  const dateValue = picker === "start"
    ? filters.customStart ?? windowStartFromPreset(now, filters.dateRange, null)
    : filters.customEnd ?? now;
  const options = <T extends string,>(items: { value: T; label: string }[], selected: T, choose: (value: T) => void): MenuOption[] => items.map((item) => ({
    label: item.label, icon: selected === item.value ? "checkmark-circle" : "radio-button-off-outline", onPress: () => { choose(item.value); setMenu(null); },
  }));
  const dropdown = (caption: string, label: string, items: MenuOption[], icon: keyof typeof Ionicons.glyphMap) => <View style={[styles.insightRibbonGroup, { borderColor: colors.border }]}>
    <View style={styles.insightRibbonControlRow}><Pressable accessibilityRole="button" accessibilityLabel={`Insights ${caption.toLowerCase()}: ${label}`} onPress={(event) => setMenu({ title: caption, options: items, anchor: anchorFromEvent(event) })} style={[styles.insightRibbonDropdown, compact && styles.insightRibbonDropdownCompact, { width: caption === "BOARD" ? 132 : caption === "PERIOD" ? 100 : 116, borderColor: colors.border, backgroundColor: colors.input }]}>
      <Ionicons name={icon} size={14} color={colors.mutedForeground} /><Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0, color: colors.foreground, fontSize: 12 }}>{ribbonLabel(label)}</Text><Ionicons name="chevron-down" size={13} color={colors.mutedForeground} />
    </Pressable></View><Text style={[styles.insightRibbonCaption, { color: colors.mutedForeground }]}>{caption}</Text>
  </View>;
  return <>
    <RibbonScrollView accessibilityLabel="Insights filters" contentContainerStyle={styles.insightRibbonTools}>
      {dropdown("PERIOD", INSIGHTS_DATE_OPTIONS.find((item) => item.value === filters.dateRange)!.label, options(INSIGHTS_DATE_OPTIONS, filters.dateRange, (dateRange) => { update({ dateRange }); if (dateRange === "custom" && !filters.customStart) setPicker("start"); }), "calendar-outline")}
      {filters.dateRange === "custom" ? <View style={[styles.insightRibbonGroup, { borderColor: colors.border }]}>
        <View style={[styles.insightRibbonControlRow, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
          <Button variant="secondary" size={compact ? "sm" : "md"} style={styles.insightRibbonDate} label={filters.customStart ? format(filters.customStart, "MMM d, yyyy") : "Start date"} accessibilityLabel="Insights start date" onPress={() => setPicker("start")} />
          <Button variant="secondary" size={compact ? "sm" : "md"} style={styles.insightRibbonDate} label={filters.customEnd ? format(filters.customEnd, "MMM d, yyyy") : "End date"} accessibilityLabel="Insights end date" onPress={() => setPicker("end")} />
        </View><Text style={[styles.insightRibbonCaption, { color: colors.mutedForeground }]}>CUSTOM RANGE</Text>
      </View> : null}
      {dropdown("STATUS", INSIGHTS_STATUS_OPTIONS.find((item) => item.value === filters.status)!.label, options(INSIGHTS_STATUS_OPTIONS, filters.status, (status) => update({ status })), "checkmark-circle-outline")}
      {dropdown("PRIORITY", INSIGHTS_PRIORITY_OPTIONS.find((item) => item.value === filters.priority)!.label, options(INSIGHTS_PRIORITY_OPTIONS, filters.priority, (priority) => update({ priority })), "flag-outline")}
      {dropdown("BOARD", boards.find((board) => board.id === filters.boardId)?.label ?? "All boards", options([{ value: "all", label: "All boards" }, ...boards.map((board) => ({ value: board.id, label: board.label }))], filters.boardId, (boardId) => update({ boardId })), "pricetag-outline")}
      {hasActiveFilters(filters) ? <Button variant="ghost" size={compact ? "sm" : "md"} label="Reset" accessibilityLabel="Reset insights filters" onPress={() => { onChange({ ...DEFAULT_FILTERS }); setPicker(null); }} /> : null}
    </RibbonScrollView>
    <OptionSheet visible={menu !== null} title={menu?.title ?? "Insights filters"} options={menu?.options ?? []} anchor={menu?.anchor} onClose={() => setMenu(null)} />
    <Sheet visible={picker !== null} onClose={() => setPicker(null)}>
      <Text style={{ color: colors.foreground, fontWeight: "700", marginBottom: 12 }}>{picker === "start" ? "Start date" : "End date"}</Text>
      {picker ? Platform.OS === "web" ? createElement("input", {
        type: "date", "aria-label": `Insights ${picker} date`, value: format(dateValue, "yyyy-MM-dd"), max: format(now, "yyyy-MM-dd"),
        onChange: (event: { target: { value: string } }) => { const selected = new Date(`${event.target.value}T00:00:00`); if (isValid(selected)) chooseDate(selected); },
        style: { boxSizing: "border-box", width: "100%", minHeight: 44, padding: 10, borderRadius: 8, border: `1px solid ${colors.border}`, backgroundColor: colors.input, color: colors.foreground },
      }) : <DateTimePicker value={dateValue} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} maximumDate={now} onChange={(_, selected) => { if (selected) chooseDate(selected); else setPicker(null); }} /> : null}
    </Sheet>
  </>;
}

export function InsightsPanel(props: InsightsPanelProps) {
  return <InsightsDashboard {...props} />;
}

const styles = StyleSheet.create({
  insightRibbonTools: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingTop: 5, paddingBottom: 4 },
  insightRibbonGroup: { borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5, gap: 3 },
  insightRibbonControlRow: { minHeight: 48, justifyContent: "center" },
  insightRibbonDropdown: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 6 },
  insightRibbonDropdownCompact: { minHeight: 36 },
  insightRibbonDate: { width: 128, paddingHorizontal: 8, borderRadius: 6 },
  insightRibbonCaption: { textAlign: "center", fontSize: 9, letterSpacing: 0.5 },
  iconButton: { alignItems: "center", justifyContent: "center", borderRadius: 14 },
  boardCardNew: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  boardCardNewPressable: { padding: 16, gap: 12 },
  boardCardNewHeader: { gap: 2 },
  boardCardNewTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  boardCardNewTitle: { fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  boardCardNewMeta: { fontSize: 11 },
  boardCardNewProgress: { gap: 6 },
  boardCardNewProgressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  boardCardNewCounts: { flexDirection: "row", alignItems: "center", gap: 12 },
  boardCardNewCountItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  boardCardNewDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  boardCardNewCountText: { fontSize: 12 },
  boardCardNewPct: { fontSize: 11, fontFamily: "monospace" },
  boardCardNewProgressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  boardCardNewProgressFill: { height: "100%", borderRadius: 3 },
  boardCardNewAlerts: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  boardCardNewAlertsLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  boardCardNewAlertItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  boardCardNewAlertText: { fontSize: 11, fontWeight: "500" },
  boardCardNewFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  boardCardNewFooterLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  boardCardNewFooterBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  boardCardNewFooterBtnText: { fontSize: 12 },
  boardCardNewRemoveText: { fontSize: 12, fontWeight: "500" },
  taskEditorSheet: { paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowRadius: 22, shadowOffset: { width: 0, height: -8 }, elevation: 16 },
  taskEditorWindowFooter: { flexShrink: 0, alignItems: "flex-end" },
  taskEditorWindowPrimary: { minWidth: 140, borderRadius: 6 },
  taskEditorWindowInput: { borderRadius: 6, fontSize: 15 },
  taskEditorHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 18, paddingBottom: 4 },
  taskEditorHeaderCopy: { flex: 1, minWidth: 0 },
  taskEditorTitle: { fontSize: 24, lineHeight: 30, fontWeight: "700", letterSpacing: -0.3 },
  taskEditorSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  taskEditorScroll: { flexShrink: 1, minHeight: 0 },
  taskEditorContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 20 },
  taskEditorLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 16, marginBottom: 7 },
  taskEditorTitleInput: { height: 56, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 0, fontSize: 19, lineHeight: 25, fontWeight: "700", textAlignVertical: "center" },
  taskEditorNotes: { minHeight: 88, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 14, lineHeight: 20, textAlignVertical: "top" },
  taskEditorSectionHeading: { marginTop: 20, marginBottom: 8 },
  taskEditorSection: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  taskEditorSectionTitle: { fontSize: 16, lineHeight: 22, fontWeight: "700", letterSpacing: -0.1 },
  taskEditorSectionMeta: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  taskEditorInlineLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1, marginTop: 14, marginBottom: 7 },
  taskEditorInlineLabelFirst: { marginTop: 0 },
  taskEditorChipRow: { flexDirection: "row", gap: 8, paddingRight: 4, paddingBottom: 2 },
  taskEditorDateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  taskEditorDateField: { flex: 1, minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  taskEditorDateText: { flex: 1, fontSize: 13, fontWeight: "600" },
  taskEditorClearDue: { width: 44, height: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  taskEditorPicker: { marginTop: 10 },
  taskEditorChecklist: { marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: "hidden" },
  taskEditorSubtaskRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 48, paddingLeft: 12, paddingRight: 4 },
  taskEditorSubtaskCheck: { width: 21, height: 21, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  taskEditorSubtaskInput: { flex: 1, fontSize: 14, lineHeight: 19, paddingVertical: 8, paddingHorizontal: 0 },
  taskEditorSubtaskDelete: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  taskEditorAddSubtask: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  taskEditorAddSubtaskInput: { flex: 1, height: 42, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  taskEditorFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 12 },
  taskEditorFooterActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  taskEditorFooterPrimary: { flex: 1 },
  taskEditorPanelRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", columnGap: 16 },
  taskEditorPanelField: { flexGrow: 1, flexBasis: 240, minWidth: 0 },
  taskEditorPanelNotes: { minHeight: 104 },
  taskEditorPanelActions: { justifyContent: "flex-end", flexWrap: "wrap" },
  taskEditorPanelPrimary: { minWidth: 140 },
  taskEditorDeleteButton: { height: 44, paddingHorizontal: 14, borderRadius: 16 },
  chip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  taskPressable: { marginBottom: 10 }, taskCard: { borderRadius: 16, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, taskTopline: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, check: { width: 23, height: 23, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 }, taskTitle: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "700" }, taskAction: { width: 44, height: 44, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", marginTop: -10, marginRight: -6 }, taskDescription: { fontSize: 13, lineHeight: 18, marginTop: 8, marginLeft: 33 }, metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 11, marginLeft: 33 }, metaItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "75%" }, modalBackdrop: { flex: 1, justifyContent: "flex-end" }, modalKeyboard: { maxHeight: "94%" }, editor: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 16, maxHeight: "100%" }, editorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }, editorEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.3 }, editorTitle: { fontSize: 23, lineHeight: 28, fontWeight: "700", marginTop: 2 }, fieldLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 16, marginBottom: 7 }, textArea: { minHeight: 78, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, textAlignVertical: "top", fontSize: 14 }, wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, dateRow: { flexDirection: "row", alignItems: "center", gap: 4 }, subtaskRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 44 }, subtaskCheck: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" }, subtaskText: { flex: 1, fontSize: 14, lineHeight: 19 }, addSubtask: { flexDirection: "row", alignItems: "center", gap: 8 }, subtaskInput: { flex: 1, height: 42, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 }, editorActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 }, sheetTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 }, sheetDescription: { fontSize: 14, lineHeight: 20 }, option: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth }, boardCard: { borderRadius: 20, padding: 14, minHeight: 150 }, boardCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 }, boardCardBody: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minHeight: 44 }, boardGlyph: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" }, boardCardCopy: { flex: 1 }, boardName: { fontSize: 16, fontWeight: "700" }, boardMeta: { fontSize: 12, marginTop: 4 }, boardCreated: { fontSize: 10, marginTop: 2 }, boardSignals: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 12 }, boardSignal: { fontSize: 11, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 }, progressTrack: { height: 5, borderRadius: 3, marginTop: 14, overflow: "hidden" }, progressFill: { height: "100%", borderRadius: 3 }, progressLabel: { fontSize: 11, fontWeight: "600", marginTop: 6 }, insightSwitch: { flexDirection: "row", gap: 8 }, statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, stat: { width: "48%", minHeight: 92, borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, padding: 13, overflow: "hidden" }, statAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 }, statValue: { fontSize: 24, fontWeight: "800" }, statLabel: { fontSize: 12, marginTop: 4, fontWeight: "600" }, insightCard: { borderRadius: 19, padding: 16 }, insightTitle: { fontSize: 16, fontWeight: "700", marginBottom: 14 }, chart: { height: 105, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 3 }, chartPoint: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 5 }, chartBar: { width: "42%", minWidth: 4, borderRadius: 4 }, chartLabel: { fontSize: 9 }, weekBars: { height: 84, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 7 }, weekBarItem: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 6 }, weekBar: { width: "58%", minWidth: 5, borderRadius: 5 }, barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 11 }, barLabel: { width: 66, fontSize: 12, fontWeight: "600" }, barTrack: { flex: 1, height: 9, borderRadius: 6, overflow: "hidden" }, barFill: { height: "100%", borderRadius: 6 },
  overviewHeader: { flexDirection: "row", alignItems: "center", gap: 12 }, completionRing: { width: 62, height: 62, alignItems: "center", justifyContent: "center" }, completionRingLabel: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" }, completionRingValue: { fontSize: 13, fontWeight: "800" }, overviewCopy: { marginTop: 10 }, overviewMain: { fontSize: 20, fontWeight: "800" }, overviewTrack: { height: 8, borderRadius: 8, overflow: "hidden", marginTop: 12 }, overviewFill: { height: "100%", borderRadius: 8 }, overviewFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 }, trendMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: -8, marginBottom: 12 }, legend: { flexDirection: "row", alignItems: "center", gap: 4 }, legendDot: { width: 7, height: 7, borderRadius: 4 }, legendDash: { width: 16, borderTopWidth: 2, borderStyle: "dashed" }, chartValuePair: { minHeight: 18, alignItems: "center", justifyContent: "flex-end", gap: 1 }, chartBars: { width: "100%", flexDirection: "row", alignItems: "flex-end", justifyContent: "center", height: 76 }, chartBarButton: { width: "42%", alignItems: "center", justifyContent: "flex-end" }, chartPreviousOverlay: { position: "absolute", bottom: 0, left: "29%", width: "42%", borderTopWidth: 2, borderStyle: "dashed", opacity: 0.62 }, trendDetail: { minHeight: 34, borderRadius: 10, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }, comparisonCallout: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(127,127,127,0.22)" }, comparisonValue: { flexDirection: "row", alignItems: "center", gap: 3 }, productivityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, productivityTabs: { gap: 7, paddingVertical: 12 }, productivityBody: { minHeight: 88 }, emptyChartText: { color: "#8a8f9d", textAlign: "center", paddingVertical: 18, fontSize: 13 }, chartHint: { color: "#8a8f9d", fontSize: 12, lineHeight: 17 }, miniTrend: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18 }, miniTrendValue: { fontSize: 28, fontWeight: "800" }, miniTrendDivider: { width: 1, height: 34, backgroundColor: "#d2d6df", marginHorizontal: 6 },
});
