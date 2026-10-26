import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, isValid, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Attachment, Priority, Subtask, TaskDraft } from "@/lib/domain/types";
import { deriveStatus } from "@/lib/domain/status";
import { useNow } from "@/hooks/use-now";
import { IconButton, Pill, ReferenceActivity, ReferenceTaskInput, resolveReferenceTask, SurfaceCard } from "./reference-primitives";
import { useReferenceTheme, type ReferenceColors, type ReferenceType, referenceRadii, referenceSpacing } from "../reference-theme";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";

export interface ReferenceTaskInspectorScreenProps {
  task: ReferenceTaskInput;
  onBack?: () => void;
  onSave?: (draft: TaskDraft) => void;
  onDiscard?: () => void;
  onCancelTask?: () => void;
  onDelete?: () => void;
  onEditProperty?: (property: "status" | "priority" | "dueDate", value?: Priority | string | null) => void;
  onAddAttachment?: (attachment: Attachment) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
}

export function ReferenceTaskInspectorScreen({ task: taskInput, onBack, onSave, onDiscard, onCancelTask, onDelete, onEditProperty, onAddAttachment, onRemoveAttachment }: ReferenceTaskInspectorScreenProps) {
  const { colors, type, toggle, scheme } = useReferenceTheme();
  const styles = createStyles(colors, type);
  const insets = useSafeAreaInsets();
  const display = useMemo(() => resolveReferenceTask(taskInput), [taskInput]);
  const task = display.task;
  const [title, setTitle] = useState(task.title);
  const [titleHeight, setTitleHeight] = useState(55);
  const [description, setDescription] = useState(task.description);
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks.map((subtask) => ({ ...subtask })));
  const [newSubtask, setNewSubtask] = useState("");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueAt, setDueAt] = useState<string | null>(task.dueAt);
  const [tags, setTags] = useState<string[]>(task.tags ?? []);
  const [newTag, setNewTag] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>(task.attachments ?? []);
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const now = useNow();
  const status = deriveStatus(task, now);
  const done = subtasks.filter((subtask) => subtask.done).length;
  const progress = subtasks.length ? done / subtasks.length : 0;
  const due = dueAt && isValid(parseISO(dueAt)) ? parseISO(dueAt) : null;
  const created = isValid(parseISO(task.createdAt)) ? format(parseISO(task.createdAt), "MMM d") : null;
  const activity: ReferenceActivity[] = display.activity ?? [];
  const notifyProperty = (property: "status" | "priority" | "dueDate", value?: Priority | string | null) => onEditProperty?.(property, value);
  const save = () => onSave?.({ title: title.trim() || task.title, description: description.trim(), dueAt, priority, category: task.category, subtasks, tags });
  const addSubtask = () => {
    const value = newSubtask.trim();
    if (!value) return;
    const local = { id: `reference-${Date.now()}`, title: value, done: false };
    setSubtasks((current) => [...current, local]);
    setNewSubtask("");
  };
  const cyclePriority = () => {
    const next: Priority = priority === "low" ? "medium" : priority === "medium" ? "high" : "low";
    setPriority(next);
    notifyProperty("priority", next);
  };
  const toggleStatus = () => notifyProperty("status", status === "completed" ? "open" : "completed");
  const pickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false, copyToCacheDirectory: false, base64: false });
    if (result.canceled) return;
    const file = result.assets[0];
    if (!file) return;
    const attachment: Attachment = { id: `attachment-${Date.now()}`, name: file.name, url: file.uri, mimeType: file.mimeType, size: file.size };
    setAttachments((current) => [...current, attachment]);
    onAddAttachment?.(attachment);
  };
  const removeAttachment = (attachment: Attachment) => {
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    onRemoveAttachment?.(attachment.id);
  };
  const addTag = () => {
    const value = newTag.trim();
    if (!value || tags.includes(value)) return;
    setTags((current) => [...current, value]);
    setNewTag("");
  };
  const updatePickedDate = (selected: Date | undefined) => {
    setPickerMode(null);
    if (!selected) return;
    const current = due ?? now;
    selected.setHours(current.getHours(), current.getMinutes(), 0, 0);
    const value = selected.toISOString();
    setDueAt(value);
    notifyProperty("dueDate", value);
  };
  const updatePickedTime = (selected: Date | undefined) => {
    setPickerMode(null);
    if (!selected) return;
    const next = new Date(due ?? now);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    const value = next.toISOString();
    setDueAt(value);
    notifyProperty("dueDate", value);
  };

  return (
     <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.root}>
       <ThemeAtmosphere />
        <View style={[styles.topBar, { paddingTop: insets.top }]}><IconButton icon="chevron-back" label="Back" onPress={onBack} /><Text style={[type.title, { flex: 1, fontSize: 18 }]}>Task Inspector</Text><IconButton icon={scheme === "dark" ? "sunny-outline" : "moon-outline"} label={scheme === "dark" ? "Use light theme" : "Use dark theme"} onPress={toggle} /></View>
        <View style={styles.metaRibbon}><View style={styles.metaLeft}><Text style={styles.taskId}>{task.id.slice(0, 8).toUpperCase()}</Text></View><View style={styles.metaActions}><Text style={[type.caption, { color: colors.muted }]}>{attachments.length} attachment{attachments.length === 1 ? "" : "s"}</Text>{onCancelTask ? <Pressable accessibilityRole="button" accessibilityLabel={task.canceled ? "Restore task" : "Cancel task"} onPress={onCancelTask} style={styles.metaActionButton}><Ionicons name={task.canceled ? "refresh-outline" : "close-circle-outline"} size={18} color={task.canceled ? colors.success : colors.error} /></Pressable> : null}{onDelete ? <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${task.title}`} onPress={onDelete} style={styles.metaActionButton}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable> : null}</View></View>
       <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 98 }]}>
         <SurfaceCard style={styles.titleCard}><View style={styles.titleRow}><TextInput accessibilityLabel="Task title" value={title} onChangeText={setTitle} multiline onContentSizeChange={(event) => setTitleHeight(Math.max(55, event.nativeEvent.contentSize.height))} style={[type.title, styles.titleInput, { height: titleHeight }]} /></View><View style={styles.created}><Ionicons name="time-outline" size={14} color={colors.outline} /><Text style={[type.caption, { color: colors.muted }]}>{created ? `Created ${created}` : "Created"}</Text>{display.projectLabel ? <><Text style={[type.caption, { color: colors.muted }]}> in </Text><Text style={[type.caption, { color: colors.primary, fontWeight: "700" }]}>{display.projectLabel}</Text></> : null}</View></SurfaceCard>
           <View style={styles.propertyGrid}><PropertyCard label="Status" onPress={toggleStatus}><View style={styles.propertyValue}><View style={[styles.statusDot, { backgroundColor: status === "overdue" ? colors.error : status === "completed" ? colors.success : status === "canceled" ? colors.muted : colors.primary }]} /><Text style={type.bodyStrong}>{display.statusLabel ?? (status === "overdue" ? "Overdue" : status === "completed" ? "Completed" : status === "canceled" ? "Canceled" : "Open")}</Text></View><Ionicons name="chevron-down" size={16} color={colors.outline} /></PropertyCard><PropertyCard label="Priority" onPress={cyclePriority}><Pill label={priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low"} tone={priority === "high" ? "error" : "neutral"} icon="flag" /><Ionicons name="swap-vertical-outline" size={16} color={colors.outline} /></PropertyCard><PropertyCard label="Due Date" onPress={() => setPickerMode("date")} secondaryAction={due ? <Pressable accessibilityRole="button" accessibilityLabel="Edit due time" onPress={() => setPickerMode("time")} style={styles.metaActionButton}><Ionicons name="time-outline" size={16} color={colors.primary} /></Pressable> : null}><View style={styles.propertyValue}><View style={styles.dateIcon}><Ionicons name="calendar-outline" size={16} color={colors.primary} /></View><View><Text style={type.bodyStrong} numberOfLines={1}>{due ? format(due, "MMM d") : "No due date"}</Text>{due ? <Text style={[type.caption, { color: status === "overdue" ? colors.error : colors.muted }]}>{format(due, "h:mm a")}</Text> : null}</View></View>{!due ? <Ionicons name="chevron-forward" size={16} color={colors.outline} /> : null}</PropertyCard></View>
          {pickerMode ? <DateTimePicker value={due ?? now} mode={pickerMode} display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(_, selected) => pickerMode === "date" ? updatePickedDate(selected) : updatePickedTime(selected)} /> : null}

         <SurfaceCard style={styles.sectionCard}><View style={styles.sectionHeader}><View style={styles.sectionTitle}><Ionicons name="document-text-outline" size={17} color={colors.muted} /><Text style={[type.section, { color: colors.muted }]}>Description</Text></View></View><TextInput accessibilityLabel="Task description" value={description} onChangeText={setDescription} multiline style={[type.body, styles.descriptionInput]} /></SurfaceCard>
         <SurfaceCard style={styles.sectionCard}><View style={styles.sectionHeader}><View style={styles.sectionTitle}><Ionicons name="pricetag-outline" size={18} color={colors.success} /><Text style={type.section}>Tags</Text></View><Text style={[type.caption, { color: colors.muted }]}>{tags.length} saved</Text></View><View style={styles.tags}>{tags.map((tag) => <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`Remove tag ${tag}`} onPress={() => setTags((current) => current.filter((item) => item !== tag))} style={[styles.tag, { backgroundColor: colors.primaryFixed }]}><Text style={[type.caption, { color: colors.primary }]}>{tag}</Text><Ionicons name="close" size={14} color={colors.primary} /></Pressable>)}</View><View style={styles.addTagRow}><TextInput value={newTag} onChangeText={setNewTag} onSubmitEditing={addTag} placeholder="Add a tag" placeholderTextColor={colors.muted} accessibilityLabel="New task tag" style={[type.body, styles.addTagInput]} /><Pressable accessibilityRole="button" accessibilityLabel="Add tag" onPress={addTag} style={styles.addButton}><Text style={[type.caption, { color: colors.primary, fontWeight: "700" }]}>Add</Text></Pressable></View></SurfaceCard>
         <SurfaceCard style={styles.sectionCard}><View style={styles.sectionHeader}><View style={styles.sectionTitle}><Ionicons name="attach-outline" size={18} color={colors.muted} /><Text style={type.section}>Attachments</Text></View><Text style={[type.caption, { color: colors.muted }]}>{attachments.length} saved</Text></View>{attachments.length ? <View style={styles.attachmentList}>{attachments.map((attachment) => <View key={attachment.id} style={styles.attachmentRow}><Ionicons name="document-outline" size={21} color={colors.primary} /><View style={styles.attachmentCopy}><Text style={type.bodyStrong} numberOfLines={1}>{attachment.name}</Text><Text style={[type.caption, { color: colors.muted }]}>{attachment.mimeType ?? "File"}{attachment.size ? ` · ${Math.ceil(attachment.size / 1024)} KB` : ""}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove attachment ${attachment.name}`} onPress={() => removeAttachment(attachment)} style={styles.removeAttachment}><Ionicons name="close-circle-outline" size={20} color={colors.muted} /></Pressable></View>)}</View> : <Text style={[type.body, { color: colors.muted }]}>No files attached yet.</Text>}<Pressable accessibilityRole="button" accessibilityLabel="Choose a file to attach" onPress={() => void pickAttachment()} style={styles.upload}><Ionicons name="attach-outline" size={21} color={colors.primary} /><Text style={[type.bodyStrong, { color: colors.primary }]}>Choose a file</Text><Text style={[type.caption, { color: colors.muted, textAlign: "center" }]}>Saves file details, not file contents.</Text></Pressable></SurfaceCard>

         <SurfaceCard style={styles.sectionCard}><View style={styles.sectionHeader}><View style={styles.sectionTitle}><Ionicons name="checkmark-done-outline" size={18} color={colors.primary} /><Text style={type.section}>Subtasks</Text></View><Pill label={`${done} of ${subtasks.length || 0} completed`} /></View><View style={styles.progressLabels}><Text style={[type.caption, { color: colors.muted }]}>Checklist progress</Text><Text style={[type.caption, { color: colors.primary, fontWeight: "700" }]}>{Math.round(progress * 100)}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} /></View><View style={styles.subtasks}>{subtasks.map((subtask) => <Pressable key={subtask.id} accessibilityRole="checkbox" aria-checked={subtask.done} accessibilityState={{ checked: subtask.done }} onPress={() => setSubtasks((current) => current.map((item) => item.id === subtask.id ? { ...item, done: !item.done } : item))} style={styles.subtaskRow}><Ionicons name={subtask.done ? "checkbox" : "square-outline"} size={20} color={subtask.done ? colors.primary : colors.outline} /><Text style={[type.body, { flex: 1, textDecorationLine: subtask.done ? "line-through" : "none", color: subtask.done ? colors.outline : colors.text }]}>{subtask.title}</Text><Ionicons name={subtask.done ? "checkmark-circle-outline" : "time-outline"} size={16} color={subtask.done ? colors.success : colors.outline} /></Pressable>)}</View><View style={styles.addSubtask}><Ionicons name="add" size={18} color={colors.primary} /><TextInput value={newSubtask} onChangeText={setNewSubtask} onSubmitEditing={addSubtask} placeholder="Add new subtask..." placeholderTextColor={colors.outline} style={[type.body, { flex: 1, minHeight: 42, color: colors.text }]} /><Pressable accessibilityRole="button" onPress={addSubtask} style={styles.addButton}><Text style={[type.caption, { color: colors.primary, fontWeight: "700" }]}>Add</Text></Pressable></View></SurfaceCard>

         <SurfaceCard style={styles.sectionCard}><View style={styles.sectionHeader}><View style={styles.sectionTitle}><Ionicons name="chatbox-ellipses-outline" size={18} color={colors.secondary} /><Text style={type.section}>Activity</Text></View><Text style={[type.caption, { color: colors.muted }]}>{activity.length} event{activity.length === 1 ? "" : "s"}</Text></View>{activity.length ? <View style={styles.timeline}>{activity.map((event, index) => <View key={`${event.time}-${index}`} style={styles.activityRow}><View style={styles.timelineMarker}><View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />{index < activity.length - 1 ? <View style={styles.timelineLine} /> : null}</View><View style={styles.activityBody}><View style={styles.activityHeader}><Text style={[type.caption, { color: colors.outline }]}>{event.time}</Text></View><Text style={[type.body, { color: colors.muted, marginTop: 4 }]}>{event.message}</Text></View></View>)}</View> : <Text style={[type.body, { color: colors.muted }]}>Changes you save will appear here.</Text>}</SurfaceCard>
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}><Pressable accessibilityRole="button" onPress={onDiscard} style={[styles.bottomButton, { backgroundColor: colors.surfaceHigh }]}><Text style={type.bodyStrong}>Close</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Save changes" onPress={save} style={[styles.bottomButton, styles.saveButton]}><Ionicons name="checkmark" size={18} color={colors.onPrimary} /><Text style={[type.bodyStrong, { color: colors.onPrimary }]}>Save changes</Text></Pressable></View>
     </KeyboardAvoidingView>
  );
}

function PropertyCard({ label, children, onPress, secondaryAction }: { label: string; children: React.ReactNode; onPress?: () => void; secondaryAction?: React.ReactNode }) {
  const { colors, type, card } = useReferenceTheme();
  const styles = createStyles(colors, type);
  return <View style={[card, styles.propertyCard]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Change ${label.toLowerCase()}`} onPress={onPress} style={[StyleSheet.absoluteFill, { borderRadius: referenceRadii.md }]} />
    <Text pointerEvents="none" style={[type.micro, { color: colors.outline, textTransform: "uppercase", letterSpacing: 0.8 }]}>{label}</Text>
    <View pointerEvents="none" style={[styles.propertyBottom, secondaryAction ? { paddingRight: 32 } : null]}>{children}</View>
    {secondaryAction ? <View style={{ position: "absolute", right: 4, bottom: 6 }}>{secondaryAction}</View> : null}
  </View>;
}

function createStyles(colors: ReferenceColors, type: ReferenceType) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { minHeight: 56, paddingHorizontal: 8, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface },
  metaRibbon: { minHeight: 48, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant, backgroundColor: colors.surfaceLow, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 8 },
  metaLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  taskId: { ...type.micro, color: colors.primary, backgroundColor: colors.primaryFixed, paddingHorizontal: 8, paddingVertical: 4, borderRadius: referenceRadii.pill },
   metaActions: { flexDirection: "row", alignItems: "center", gap: 5 },
    metaActionButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { padding: referenceSpacing.md, gap: referenceSpacing.md, maxWidth: 600, width: "100%", alignSelf: "center" },
  titleCard: { padding: referenceSpacing.md },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
   titleInput: { flex: 1, minHeight: 55, color: colors.text, padding: 0, textAlignVertical: "top" },
  created: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 7 },
  propertyGrid: { flexDirection: "row", flexWrap: "wrap", gap: referenceSpacing.sm },
  propertyCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: referenceRadii.md, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1, width: "48.4%", minHeight: 86, padding: referenceSpacing.md, justifyContent: "space-between" },
  propertyBottom: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
   propertyValue: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  dateIcon: { width: 30, height: 30, borderRadius: 7, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  sectionCard: { padding: referenceSpacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
   descriptionInput: { minHeight: 106, padding: 0, color: colors.muted, textAlignVertical: "top" },
   tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: { minHeight: 44, paddingHorizontal: 9, borderRadius: referenceRadii.pill, flexDirection: "row", alignItems: "center", gap: 5 },
   addTagRow: { minHeight: 44, marginTop: 8, paddingHorizontal: 7, borderRadius: 7, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 6 },
   addTagInput: { flex: 1, minHeight: 42, color: colors.text },
   attachmentList: { gap: 6, marginBottom: 7 },
   attachmentRow: { minHeight: 52, paddingHorizontal: 9, borderRadius: 8, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 8 },
   attachmentCopy: { flex: 1, minWidth: 0, gap: 2 },
    removeAttachment: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
   upload: { minHeight: 76, borderRadius: referenceRadii.lg, backgroundColor: colors.surfaceLow, alignItems: "center", justifyContent: "center", gap: 3, marginTop: 8, paddingHorizontal: 12 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden", marginBottom: 9 },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.primary },
  subtasks: { gap: 2 },
  subtaskRow: { minHeight: 44, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  addSubtask: { minHeight: 44, paddingHorizontal: 7, borderRadius: 7, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
   addButton: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderRadius: 7 },
  timeline: { gap: 10 },
  activityRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  timelineMarker: { alignItems: "center", width: 30, paddingTop: 10 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { position: "absolute", top: 20, bottom: -16, width: 2, backgroundColor: colors.surfaceHigh },
  activityBody: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: colors.surfaceLow },
  activityHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: referenceSpacing.md, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant, flexDirection: "row", gap: referenceSpacing.sm, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: -3 }, elevation: 8 },
  bottomButton: { minHeight: 44, flex: 1, borderRadius: referenceRadii.lg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  saveButton: { flex: 2, backgroundColor: colors.primary },
});
} 
