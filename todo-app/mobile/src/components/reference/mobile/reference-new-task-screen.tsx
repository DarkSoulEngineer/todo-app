import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { addDays, addWeeks, format, isValid, parseISO } from "date-fns";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Attachment, Priority, Subtask, TaskDraft } from "@/lib/domain/types";
import { useNow } from "@/hooks/use-now";
import { useTasksContext } from "@/providers/tasks-provider";
import { boardColor } from "@/lib/domain/boards";
import { IconButton, Pill, SurfaceCard } from "./reference-primitives";
import { useReferenceTheme, type ReferenceColors, referenceRadii, referenceSpacing } from "../reference-theme";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { SectionHeading } from "@/components/ui/section-heading";

type ReferencePriority = Priority;

export interface ReferenceNewTaskScreenProps {
  initialDraft?: Partial<TaskDraft>;
  boardLabel?: string;
  sectionLabel?: string;
  initialTags?: string[];
  onCancel?: () => void;
  onSubmit: (draft: TaskDraft, attachments: Attachment[]) => void;
  onChangeBoard?: () => void;
}

export function ReferenceNewTaskScreen({ initialDraft, boardLabel = "Current board", sectionLabel = "Unscheduled", initialTags = [], onCancel, onSubmit, onChangeBoard }: ReferenceNewTaskScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, type, toggle, scheme } = useReferenceTheme();
  const styles = createStyles(colors);
  const now = useNow();
  const { boards } = useTasksContext();
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [titleHeight, setTitleHeight] = useState(32);
  const [titleError, setTitleError] = useState(false);
  const [description, setDescription] = useState(initialDraft?.description ?? "");
  const [priority, setPriority] = useState<ReferencePriority>(initialDraft?.priority ?? "medium");
  const [dueAt, setDueAt] = useState<string | null>(initialDraft?.dueAt ?? null);
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => initialDraft?.subtasks?.map((subtask) => ({ ...subtask })) ?? []);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [tags, setTags] = useState(initialDraft?.tags ?? initialTags);
  const [category, setCategory] = useState<string | null>(initialDraft?.category ?? null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const due = dueAt && isValid(parseISO(dueAt)) ? parseISO(dueAt) : null;
  const tomorrow = addDays(now, 1);
  const tomorrowSelected = due?.toDateString() === tomorrow.toDateString();
  const done = subtasks.filter((subtask) => subtask.done).length;
  const submit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError(true);
      return;
    }
     onSubmit({ title: trimmedTitle, description: description.trim(), dueAt, priority, category, subtasks, tags }, attachments);
  };
  const addSubtask = () => {
    if (!subtaskTitle.trim()) return;
    setSubtasks((current) => [...current, { id: `reference-${Date.now()}`, title: subtaskTitle.trim(), done: false }]);
    setSubtaskTitle("");
  };
  const quickDue = (date: Date) => setDueAt(date.toISOString());
  const updatePickedDate = (selected: Date | undefined) => {
    setPickerMode(null);
    if (!selected) return;
    const current = due ?? now;
    selected.setHours(current.getHours(), current.getMinutes(), 0, 0);
    setDueAt(selected.toISOString());
  };
  const updatePickedTime = (selected: Date | undefined) => {
    setPickerMode(null);
    if (!selected) return;
    const next = new Date(due ?? now);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setDueAt(next.toISOString());
  };
  const pickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false, copyToCacheDirectory: false, base64: false });
    if (result.canceled) return;
    const file = result.assets[0];
    if (!file) return;
    setAttachments((current) => [...current, { id: `pending-${Date.now()}`, name: file.name, url: file.uri, mimeType: file.mimeType, size: file.size }]);
  };
  const selectedBoard = boards.find((board) => board.id === category);
  const targetBoardLabel = boardLabel;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
      <ThemeAtmosphere />
      <View style={[styles.topBar, { paddingTop: insets.top }]}><IconButton icon="chevron-back" label="Cancel new task" onPress={onCancel} /><Text style={[type.title, { flex: 1, fontSize: 18 }]}>Create</Text><IconButton icon={scheme === "dark" ? "sunny-outline" : "moon-outline"} label={scheme === "dark" ? "Use light theme" : "Use dark theme"} onPress={toggle} /></View>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
        <SurfaceCard style={styles.contextCard}><View style={styles.folderIcon}><Ionicons name="folder-open-outline" size={19} color={colors.primary} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={[type.micro, { color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8 }]}>Board &amp; section</Text><View style={styles.contextLabels}><Text style={[type.bodyStrong, { flexBasis: "100%", flexShrink: 1 }]} numberOfLines={2}>{targetBoardLabel}</Text><Ionicons name="chevron-forward" size={14} color={colors.outline} /><Text style={[type.bodyStrong, { color: colors.primary }]} numberOfLines={1}>{sectionLabel}</Text></View></View>{onChangeBoard ? <IconButton icon="swap-horizontal-outline" label="Change board and section" size={40} color={colors.outline} onPress={onChangeBoard} /> : null}</SurfaceCard>
          <View style={styles.sectionBlock}>
            <SectionHeading title="Board" subtitle="Choose where this task belongs" right={<Pill label={selectedBoard?.label ?? "None"} tone={selectedBoard ? "primary" : "neutral"} />} />
            <SurfaceCard style={styles.boardCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardOptions}>
              <Pressable accessibilityRole="button" aria-pressed={category === null} accessibilityState={{ selected: category === null }} onPress={() => setCategory(null)} style={[styles.boardOption, category === null && styles.boardOptionSelected]}>
                <View style={[styles.boardSwatch, { backgroundColor: colors.surfaceContainerHigh }]}><Ionicons name="remove-outline" size={15} color={colors.muted} /></View>
                <Text style={[type.caption, { color: category === null ? colors.text : colors.muted, fontWeight: category === null ? "700" : "500" }]}>None</Text>
              </Pressable>
              {boards.map((board) => {
                const tone = boardColor(board.color);
                const active = category === board.id;
                return <Pressable key={board.id} accessibilityRole="button" aria-pressed={active} accessibilityState={{ selected: active }} onPress={() => setCategory(active ? null : board.id)} style={[styles.boardOption, active && { backgroundColor: tone.tint, borderColor: tone.ring }]}>
                  <View style={[styles.boardSwatch, { backgroundColor: tone.dot }]}><Ionicons name={active ? "checkmark" : "layers-outline"} size={14} color="#fff" /></View>
                  <Text style={[type.caption, { color: active ? tone.ink : colors.text, fontWeight: active ? "700" : "500" }]} numberOfLines={1}>{board.label}</Text>
                </Pressable>;
              })}
            </ScrollView>
            </SurfaceCard>
          </View>
         <SurfaceCard style={styles.detailsCard}><View style={styles.titleWrap}><TextInput autoFocus multiline numberOfLines={1} onContentSizeChange={(event) => setTitleHeight(Math.max(32, event.nativeEvent.contentSize.height))} value={title} onChangeText={(value) => { setTitle(value); if (value.trim()) setTitleError(false); }} placeholder="What needs to be done?" placeholderTextColor={colors.outline} accessibilityLabel="Task title, required" style={[type.title, { color: colors.text, padding: 0, height: titleHeight, textAlignVertical: "top" }]} /><View style={styles.titleUnderline} />{titleError ? <Text style={[type.caption, { color: colors.error, marginTop: 4 }]}>A title is required.</Text> : null}</View><View style={styles.notesWrap}><TextInput value={description} onChangeText={setDescription} multiline numberOfLines={3} accessibilityLabel="Task notes" placeholder="Add notes (optional)" placeholderTextColor={colors.muted} style={[type.body, styles.notesInput]} /></View></SurfaceCard>

         <View style={styles.sectionBlock}>
           <SectionHeading title="Due date" right={<Pill label={due ? format(due, "MMM d") : "No deadline"} tone="primary" />} />
           <SurfaceCard style={styles.sectionCard}>
           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickDates}><Pressable accessibilityRole="button" aria-pressed={tomorrowSelected} accessibilityState={{ selected: tomorrowSelected }} onPress={() => quickDue(tomorrow)} style={tomorrowSelected ? styles.quickDateActive : styles.quickDate}><Text style={[type.caption, { color: tomorrowSelected ? colors.onPrimary : colors.text, fontWeight: "700" }]}>Tomorrow, {format(tomorrow, "MMM d")}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => quickDue(addDays(due ?? now, 1))} style={styles.quickDate}><Text style={type.caption}>+1 Day</Text></Pressable><Pressable accessibilityRole="button" onPress={() => quickDue(addWeeks(now, 1))} style={styles.quickDate}><Text style={type.caption}>Next Week</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setPickerMode("date")} style={styles.quickDate}><Ionicons name="calendar-outline" size={14} color={colors.muted} /><Text style={type.caption}>Pick Date</Text></Pressable>{due ? <Pressable accessibilityRole="button" onPress={() => setDueAt(null)} style={styles.quickDate}><Text style={[type.caption, { color: colors.error }]}>Clear</Text></Pressable> : null}</ScrollView>{due ? <View style={styles.timeRow}><Text style={[type.caption, { color: colors.muted }]}>Time</Text><Pressable accessibilityRole="button" onPress={() => setPickerMode("time")} style={styles.quickDate}><Ionicons name="time-outline" size={14} color={colors.muted} /><Text style={type.caption}>{format(due, "h:mm a")}</Text></Pressable></View> : null}{pickerMode ? <DateTimePicker value={due ?? now} mode={pickerMode} display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(_, selected) => pickerMode === "date" ? updatePickedDate(selected) : updatePickedTime(selected)} /> : null}</SurfaceCard>
         </View>

        <View style={styles.sectionBlock}>
          <SectionHeading title="Priority level" right={<Text style={[type.caption, { color: priority === "high" ? colors.error : colors.muted }]}><Text style={styles.priorityDot}>●</Text> {priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low"}</Text>} />
          <SurfaceCard style={styles.sectionCard}>
          <View style={styles.priorityBar}>{(["low", "medium", "high"] as ReferencePriority[]).map((value) => <Pressable key={value} accessibilityRole="button" aria-pressed={priority === value} accessibilityState={{ selected: priority === value }} onPress={() => setPriority(value)} style={[styles.priorityOption, priority === value && styles.prioritySelected]}><Text style={[type.caption, { color: priority === value ? colors.text : colors.muted, fontWeight: priority === value ? "700" : "400" }]}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}</View></SurfaceCard>
        </View>


        <View style={styles.sectionBlock}>
          <SectionHeading title="Category tags" right={<Text style={[type.caption, { color: colors.outline }]}>{tags.length} selected</Text>} />
          <SurfaceCard style={styles.sectionCard}>
          <View style={styles.tags}>{tags.map((tag, index) => <Pressable key={tag} accessibilityRole="button" onPress={() => setTags((current) => current.filter((item) => item !== tag))} style={[styles.tag, { backgroundColor: index % 2 ? colors.primaryFixed : colors.secondaryFixed }]}><View style={[styles.tagDot, { backgroundColor: index % 2 ? colors.primary : colors.secondary }]} /><Text style={type.caption}>{tag}</Text><Ionicons name="close" size={14} color={colors.muted} /></Pressable>)}{["Operations", "QA"].map((tag) => <Pressable key={tag} accessibilityRole="button" onPress={() => setTags((current) => current.includes(tag) ? current : [...current, tag])} style={[styles.tag, { backgroundColor: colors.surfaceLow }]}><Text style={[type.caption, { color: colors.muted }]}>{tag}</Text></Pressable>)}<Pressable accessibilityRole="button" onPress={() => setTags((current) => current.includes("New tag") ? current : [...current, "New tag"])} style={[styles.tag, { backgroundColor: colors.surface }]}><Ionicons name="add" size={14} color={colors.primary} /><Text style={[type.caption, { color: colors.primary }]}>Tag</Text></Pressable></View></SurfaceCard>
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeading title="Subtasks" right={<Text style={[type.caption, { color: colors.muted }]}>{done}/{subtasks.length} done</Text>} />
          <SurfaceCard style={styles.sectionCard}>
          <View style={styles.subtaskList}>{subtasks.map((subtask) => <View key={subtask.id} style={styles.builderRow}><Pressable accessibilityRole="checkbox" aria-checked={subtask.done} accessibilityState={{ checked: subtask.done }} onPress={() => setSubtasks((current) => current.map((item) => item.id === subtask.id ? { ...item, done: !item.done } : item))}><Ionicons name={subtask.done ? "checkbox" : "square-outline"} size={19} color={subtask.done ? colors.success : colors.outline} /></Pressable><Text style={[type.body, { flex: 1, color: subtask.done ? colors.outline : colors.text, textDecorationLine: subtask.done ? "line-through" : "none" }]} numberOfLines={1}>{subtask.title}</Text><Pressable accessibilityRole="button" onPress={() => setSubtasks((current) => current.filter((item) => item.id !== subtask.id))}><Ionicons name="remove-circle-outline" size={17} color={colors.outline} /></Pressable></View>)}</View><View style={styles.addRow}><Ionicons name="add" size={18} color={colors.primary} /><TextInput value={subtaskTitle} onChangeText={setSubtaskTitle} onSubmitEditing={addSubtask} placeholder="Add subtask item..." placeholderTextColor={colors.muted} style={[type.body, { flex: 1, minHeight: 42, color: colors.text }]} /><Pressable accessibilityRole="button" onPress={addSubtask} style={styles.addButton}><Text style={[type.caption, { color: colors.primary, fontWeight: "700" }]}>Add</Text></Pressable></View></SurfaceCard>
        </View>

         <View style={styles.sectionBlock}>
           <SectionHeading title="Attachments" right={<Text style={[type.caption, { color: colors.outline }]}>{attachments.length} selected</Text>} />
           <SurfaceCard style={styles.sectionCard}>
           {attachments.length ? <View style={styles.attachmentList}>{attachments.map((attachment) => <View key={attachment.id} style={styles.attachmentRow}><Ionicons name="document-outline" size={22} color={colors.primary} /><View style={styles.attachmentCopy}><Text style={type.bodyStrong} numberOfLines={1}>{attachment.name}</Text><Text style={[type.caption, { color: colors.muted }]}>{attachment.mimeType ?? "File"}{attachment.size ? ` · ${Math.ceil(attachment.size / 1024)} KB` : ""}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${attachment.name}`} onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} style={styles.removeAttachment}><Ionicons name="close-circle-outline" size={20} color={colors.muted} /></Pressable></View>)}</View> : null}<Pressable accessibilityRole="button" accessibilityLabel="Choose a file to attach" onPress={() => void pickAttachment()} style={styles.upload}><View style={styles.uploadIcons}><Ionicons name="attach-outline" size={23} color={colors.primary} /><Ionicons name="document-outline" size={23} color={colors.primary} /></View><Text style={type.bodyStrong}>Choose a file</Text><Text style={[type.caption, { color: colors.muted, textAlign: "center" }]}>Saves file details, not file contents.</Text></Pressable></SurfaceCard>
         </View>
      </ScrollView>
       <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}><Pressable accessibilityRole="button" accessibilityLabel="Add task" onPress={submit} style={styles.submit}><Ionicons name="add-circle-outline" size={20} color={colors.onPrimary} /><Text style={[type.bodyStrong, { color: colors.onPrimary }]}>Add task</Text></Pressable></View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReferenceColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { minHeight: 56, paddingHorizontal: 8, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 4 },
  content: { paddingHorizontal: referenceSpacing.md, paddingTop: referenceSpacing.md, gap: referenceSpacing.md, maxWidth: 600, width: "100%", alignSelf: "center" },
  contextCard: { minHeight: 58, padding: referenceSpacing.sm, flexDirection: "row", alignItems: "center", gap: referenceSpacing.sm },
  boardCard: { padding: referenceSpacing.md },
  folderIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.primaryFixed, alignItems: "center", justifyContent: "center" },
   contextLabels: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 2 },
  boardOptions: { gap: 8, paddingTop: 2, paddingBottom: 2 },
  boardOption: { minWidth: 84, minHeight: 66, paddingHorizontal: 9, paddingVertical: 8, borderRadius: referenceRadii.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceLow, alignItems: "center", justifyContent: "center", gap: 5 },
  boardOptionSelected: { backgroundColor: colors.primaryFixed, borderColor: colors.primary },
  boardSwatch: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  detailsCard: { padding: referenceSpacing.md, gap: 10 },
  titleWrap: { minHeight: 47 },
  titleUnderline: { width: 48, height: 2, marginTop: 6, borderRadius: 2, backgroundColor: colors.primary },
  notesWrap: { borderRadius: 8, backgroundColor: colors.surfaceLow, overflow: "hidden" },
  notesInput: { minHeight: 92, padding: 10, color: colors.text, textAlignVertical: "top" },
  sectionCard: { padding: referenceSpacing.md },
  sectionBlock: { gap: 8 },
  quickDates: { gap: 6, paddingVertical: 2 },
  timeRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  quickDateActive: { minHeight: 44, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  quickDate: { minHeight: 44, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  priorityDot: { color: colors.error },
  priorityBar: { padding: 4, borderRadius: 8, backgroundColor: colors.surfaceLow, flexDirection: "row", gap: 2 },
  priorityOption: { minHeight: 44, flex: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  prioritySelected: { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { minHeight: 32, paddingHorizontal: 9, borderRadius: referenceRadii.pill, flexDirection: "row", alignItems: "center", gap: 5 },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  subtaskList: { gap: 6 },
  builderRow: { minHeight: 42, paddingHorizontal: 8, borderRadius: 7, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 7 },
  addRow: { minHeight: 44, marginTop: 5, paddingHorizontal: 7, borderRadius: 7, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 6 },
  addButton: { minWidth: 44, minHeight: 36, paddingHorizontal: 8, borderRadius: 7, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
   attachmentList: { gap: 6, marginBottom: 6 },
   attachmentRow: { minHeight: 52, paddingHorizontal: 9, borderRadius: 8, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 8 },
   attachmentCopy: { flex: 1, minWidth: 0, gap: 2 },
   removeAttachment: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  upload: { minHeight: 104, borderRadius: referenceRadii.lg, backgroundColor: colors.surfaceLow, alignItems: "center", justifyContent: "center", gap: 4 },
  uploadIcons: { flexDirection: "row", gap: 6 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: referenceSpacing.md, paddingTop: 9, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
  submit: { minHeight: 48, borderRadius: referenceRadii.lg, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
});
} 
