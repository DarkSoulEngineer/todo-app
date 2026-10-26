import { Ionicons } from "@expo/vector-icons";
import { format, isValid, parseISO } from "date-fns";
import { useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Task } from "@/lib/domain/types";
import { deriveStatus, describeDue } from "@/lib/domain/status";
import { useNow } from "@/hooks/use-now";
import { ReferenceMobileBottomNav, type ReferenceMobileTab } from "./reference-mobile-bottom-nav";
import { Avatar, Pill, ProgressRing, ReferenceTaskInput, resolveReferenceTask, ScreenHeader, statusLabelFor, SurfaceCard } from "./reference-primitives";
import { useReferenceTheme, type ReferenceColors, type ReferenceType, referenceRadii, referenceSpacing } from "../reference-theme";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";

type AgendaFilter = "Today" | "Upcoming" | "Overdue" | "Completed";

export interface ReferenceMyTasksScreenProps {
  tasks: ReferenceTaskInput[];
  boardName?: string;
  onTaskPress?: (task: Task) => void;
  onToggleComplete?: (task: Task) => void;
  onCreateTask?: () => void;
  onReviewAttention?: () => void;
  onRescheduleAttention?: () => void;
  onNavigate?: (tab: ReferenceMobileTab) => void;
  activeTab?: ReferenceMobileTab;
  userName?: string;
}

export function ReferenceMyTasksScreen({ tasks, boardName, onTaskPress, onToggleComplete, onCreateTask, onReviewAttention, onRescheduleAttention, onNavigate, activeTab = "my-tasks" }: ReferenceMyTasksScreenProps) {
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors, type);
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<AgendaFilter>("Today");
  const [query, setQuery] = useState("");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);
  const now = useNow();
  const resolved = useMemo(() => tasks.map((task, index) => resolveReferenceTask(task, index)), [tasks]);
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return resolved.filter(({ task, boardLabel, projectLabel }) => {
      if (assignedOnly && !task.assignee) return false;
      if (!needle) return true;
      const haystack = [task.title, task.description, task.category ?? "", boardLabel ?? "", projectLabel ?? "", task.assignee?.name ?? "", ...(task.tags ?? [])].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [assignedOnly, query, resolved]);
  const counts = useMemo(() => ({
    Today: matching.filter(({ task }) => task.dueAt && isValid(parseISO(task.dueAt)) && parseISO(task.dueAt).toDateString() === now.toDateString() && !task.completed && !task.canceled).length,
    Upcoming: matching.filter(({ task }) => !task.completed && !task.canceled && (!task.dueAt || (isValid(parseISO(task.dueAt)) && parseISO(task.dueAt).getTime() >= now.getTime()))).length,
    Overdue: matching.filter(({ task }) => deriveStatus(task, now) === "overdue").length,
    Completed: matching.filter(({ task }) => task.completed).length,
  }), [matching, now]);
  const summary = useMemo(() => {
    const total = resolved.length;
    const completed = resolved.filter(({ task }) => task.completed).length;
    const canceled = resolved.filter(({ task }) => task.canceled).length;
    const remaining = resolved.filter(({ task }) => !task.completed && !task.canceled).length;
    const overdue = resolved.filter(({ task }) => deriveStatus(task, now) === "overdue").length;
    return { total, completed, remaining, canceled, overdue, progress: total > 0 ? completed / total : 0 };
  }, [now, resolved]);
  const visible = useMemo(() => {
    const filtered = matching.filter(({ task }) => {
      if (filter === "Completed") return task.completed;
      if (filter === "Overdue") return deriveStatus(task, now) === "overdue";
      if (filter === "Upcoming") return !task.completed && !task.canceled && (!task.dueAt || (isValid(parseISO(task.dueAt)) && parseISO(task.dueAt).getTime() >= now.getTime()));
      const dueAt = task.dueAt;
      return !task.completed && !task.canceled && dueAt !== null && isValid(parseISO(dueAt)) && parseISO(dueAt).toDateString() === now.toDateString();
    });
    const direction = sortDirection === "asc" ? 1 : -1;
      return [...filtered].sort((a, b) => {
       const aDue = a.task.dueAt && isValid(parseISO(a.task.dueAt)) ? parseISO(a.task.dueAt).getTime() : Number.POSITIVE_INFINITY;
       const bDue = b.task.dueAt && isValid(parseISO(b.task.dueAt)) ? parseISO(b.task.dueAt).getTime() : Number.POSITIVE_INFINITY;
       if (aDue === bDue) return 0;
       return (aDue - bDue) * direction;
    });
  }, [filter, matching, now, sortDirection]);

  return (
    <View style={styles.root}>
      <ThemeAtmosphere />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 112 }]}> 
       <ScreenHeader title="My tasks" subtitle={boardName ?? "Workspace"} onSearch={() => searchRef.current?.focus()} />
        <View style={styles.searchRow}><View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={colors.muted} /><TextInput ref={searchRef} value={query} onChangeText={setQuery} placeholder="Search tasks, tags or people" placeholderTextColor={colors.muted} accessibilityLabel="Search my tasks" style={[type.body, styles.searchInput]} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear task search" onPress={() => setQuery("")} style={styles.clearSearch}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}</View><Pressable accessibilityRole="switch" aria-checked={assignedOnly} accessibilityState={{ checked: assignedOnly }} accessibilityLabel="Show assigned tasks only" onPress={() => setAssignedOnly((current) => !current)} style={[styles.assignedButton, assignedOnly && styles.assignedButtonActive]}><Ionicons name="person-outline" size={16} color={assignedOnly ? colors.primary : colors.muted} /><Text style={[type.caption, { color: assignedOnly ? colors.primary : colors.muted, fontWeight: "700" }]}>Assigned</Text></Pressable></View>

        <SurfaceCard style={styles.summaryCard}>
          <View style={styles.summaryCopy}>
            <Text style={styles.greeting}>Task overview</Text>
            <Text style={[type.body, { color: colors.muted }]}><Text style={type.bodyStrong}>{summary.completed} of {summary.total}</Text> completed · {summary.remaining} open{summary.canceled ? ` · ${summary.canceled}\u00a0canceled` : ""}</Text>
            <View style={styles.summaryPills}><Pill label={`${summary.remaining} open`} tone="primary" icon="time-outline" />{summary.overdue > 0 ? <Pill label={`${summary.overdue} overdue`} tone="error" icon="alert-circle-outline" /> : null}</View>
          </View>
          <ProgressRing value={summary.progress} />
        </SurfaceCard>

        {summary.overdue > 0 ? (
          <SurfaceCard style={styles.attentionCard}>
            <View style={styles.attentionContent}><View style={styles.warningIcon}><Ionicons name="warning-outline" size={21} color={colors.error} /></View><View style={{ flex: 1 }}><Text style={[type.section, { color: colors.error }]}>{summary.overdue} task{summary.overdue === 1 ? "" : "s"} overdue</Text><Text style={[type.body, { color: colors.error, marginTop: 3 }]}>Reschedule these tasks to keep this board current.</Text></View></View>
            <View style={styles.attentionActions}><Pressable accessibilityRole="button" onPress={onRescheduleAttention} style={styles.lightAction}><Ionicons name="calendar-outline" size={16} color={colors.error} /><Text style={[type.bodyStrong, { color: colors.error }]}>Reschedule</Text></Pressable><Pressable accessibilityRole="button" onPress={onReviewAttention} style={styles.dangerAction}><Text style={[type.bodyStrong, { color: colors.onPrimary }]}>Review Now</Text></Pressable></View>
          </SurfaceCard>
        ) : null}

         <View style={styles.segmented}>{(["Today", "Upcoming", "Overdue", "Completed"] as AgendaFilter[]).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityLabel={`${item} tasks`} aria-selected={filter === item} accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.segment, filter === item && styles.segmentActive]}><Text style={[type.bodyStrong, { color: filter === item ? colors.primary : colors.muted }]}>{item}</Text>{counts[item] > 0 ? <Text style={[styles.count, { color: item === "Overdue" ? colors.error : colors.primary, backgroundColor: item === "Overdue" ? colors.errorContainer : colors.primaryFixed }]}>{counts[item]}</Text> : null}</Pressable>)}</View>

        <View style={styles.scheduleHeading}><View style={styles.headingTitle}><Ionicons name="calendar-outline" size={21} color={colors.primary} /><Text style={[type.title, { fontSize: 18 }]}>{filter === "Today" ? "Today's tasks" : `${filter} tasks`}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={sortDirection === "asc" ? "Sort by due time, earliest first" : "Sort by due time, latest first"} onPress={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")} style={styles.sortButton}><Text style={[type.body, { color: colors.muted }]}>{sortDirection === "asc" ? "Earliest first" : "Latest first"}</Text><Ionicons name={sortDirection === "asc" ? "arrow-up-outline" : "arrow-down-outline"} size={15} color={colors.muted} /></Pressable></View>
          <View style={{ gap: referenceSpacing.sm }}>{visible.length ? visible.map((item, index) => <ScheduleCard key={item.task.id} item={item} index={index} now={now} onPress={() => onTaskPress?.(item.task)} onComplete={() => onToggleComplete?.(item.task)} />) : <EmptyAgendaState filtered={Boolean(query || assignedOnly)} onCreate={onCreateTask} />}</View>
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Create a new task" onPress={onCreateTask} style={styles.fab}><Ionicons name="add-circle-outline" size={23} color={colors.onPrimary} /><Text style={[type.bodyStrong, { color: colors.onPrimary, fontSize: 16 }]}>New task</Text></Pressable>
      <ReferenceMobileBottomNav active={activeTab} onNavigate={onNavigate} />
    </View>
  );
}

function ScheduleCard({ item, index, now, onPress, onComplete }: { item: ReturnType<typeof resolveReferenceTask>; index: number; now: Date; onPress: () => void; onComplete: () => void }) {
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors, type);
  const { task, assignee } = item;
  const status = deriveStatus(task, now);
  const completed = status === "completed";
  const overdue = status === "overdue";
  const rail = completed ? colors.success : overdue ? colors.error : index === 0 ? colors.secondary : colors.primary;
  const dueInfo = describeDue(task.dueAt, now);
  const dueTime = task.dueAt && isValid(parseISO(task.dueAt)) ? format(parseISO(task.dueAt), "h:mm a") : null;
  const label = statusLabelFor(task, now);
  const title = task.title || "Untitled task";
  const meta = [item.projectLabel, item.boardLabel].filter((value): value is string => Boolean(value)).join(" • ");
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  return <View style={styles.taskCard}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={onPress} style={({ pressed }) => [StyleSheet.absoluteFill, { borderRadius: referenceRadii.md, backgroundColor: pressed ? colors.primaryFixed : "transparent" }]} />
    <View pointerEvents="none" style={[styles.taskRail, { backgroundColor: rail }]} />
    <View pointerEvents="none" style={styles.taskTop}><Text style={[type.bodyStrong, { color: overdue ? colors.error : completed ? colors.muted : colors.primary }]}><Ionicons name={overdue ? "timer-outline" : "time-outline"} size={15} /> {overdue && dueTime ? `${dueTime} • Past due` : dueTime ?? "No due time"}</Text><View style={styles.taskPills}><Pill label={task.priority === "high" ? "High Priority" : task.priority === "medium" ? "Medium" : "Low"} tone={task.priority === "high" ? "purple" : "neutral"} /><Pill label={label} tone={completed ? "success" : overdue ? "error" : "primary"} icon={completed ? "checkmark" : undefined} /></View></View>
    <View pointerEvents="box-none" style={styles.taskMain}><Pressable accessibilityRole="checkbox" aria-checked={task.completed} accessibilityState={{ checked: task.completed }} accessibilityLabel={`${completed ? "Mark incomplete" : "Complete"} ${title}`} onPress={onComplete} style={styles.checkboxHit}><View style={[styles.checkbox, completed && { backgroundColor: colors.success, borderColor: colors.success }]}>{completed ? <Ionicons name="checkmark" size={15} color={colors.onPrimary} /> : null}</View></Pressable><View pointerEvents="none" style={{ flex: 1, minWidth: 0 }}><Text style={[type.title, { fontSize: 16, lineHeight: 21, textDecorationLine: completed ? "line-through" : "none", color: completed ? colors.muted : colors.text }]} numberOfLines={2}>{title}</Text>{meta ? <Text style={[type.body, { color: colors.muted, marginTop: 3 }]} numberOfLines={1}>{meta}</Text> : null}</View>{assignee ? <View pointerEvents="none"><Avatar person={assignee} size={34} /></View> : null}</View>
    <View pointerEvents="none" style={styles.taskFooter}><View style={styles.footerMeta}><Ionicons name={completed ? "checkmark-circle-outline" : "ellipse-outline"} size={15} color={completed ? colors.success : colors.muted} /><Text style={[type.body, { color: completed ? colors.success : colors.muted }]}>{completed ? "Completed" : label}</Text>{task.subtasks.length ? <><Ionicons name="checkmark-done-outline" size={15} color={colors.muted} /><Text style={[type.body, { color: colors.muted }]}>{doneSubtasks}/{task.subtasks.length}</Text></> : null}{item.attachmentCount ? <><Ionicons name="attach-outline" size={15} color={colors.muted} /><Text style={[type.body, { color: colors.muted }]}>{item.attachmentCount} file{item.attachmentCount === 1 ? "" : "s"}</Text></> : null}</View><Text style={[type.body, { color: overdue ? colors.error : colors.muted }]}>{dueInfo?.label ?? "No due date"}</Text></View>
  </View>;
}

function EmptyAgendaState({ filtered, onCreate }: { filtered: boolean; onCreate?: () => void }) {
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors, type);
  return <SurfaceCard style={styles.emptyState}>
    <View style={styles.emptyIcon}><Ionicons name={filtered ? "search-outline" : "sunny-outline"} size={23} color={colors.primary} /></View>
    <Text style={[type.section, styles.emptyTitle]}>{filtered ? "No tasks match" : "A clear schedule"}</Text>
    <Text style={[type.body, { color: colors.muted, textAlign: "center" }]}>{filtered ? "Try a different search or switch the assigned filter off." : "There is nothing due in this view yet."}</Text>
    {onCreate ? <Pressable accessibilityRole="button" accessibilityLabel="Create a new task" onPress={onCreate} style={styles.emptyAction}><Ionicons name="add" size={17} color={colors.onPrimary} /><Text style={[type.bodyStrong, { color: colors.onPrimary }]}>Create a task</Text></Pressable> : null}
  </SurfaceCard>;
}

function createStyles(colors: ReferenceColors, type: ReferenceType) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: referenceSpacing.md, paddingTop: 4, maxWidth: 600, width: "100%", alignSelf: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  searchBox: { flex: 1, minHeight: 44, paddingHorizontal: 11, borderRadius: referenceRadii.md, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 7 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: colors.text },
  clearSearch: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  assignedButton: { minHeight: 44, paddingHorizontal: 10, borderRadius: referenceRadii.md, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 5 },
  assignedButtonActive: { backgroundColor: colors.primaryFixed },
  summaryCard: { minHeight: 158, padding: referenceSpacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", overflow: "hidden" },
  summaryCopy: { flex: 1, minWidth: 0 },
  greeting: { ...type.title, fontSize: 24, lineHeight: 29, marginTop: 5 },
  summaryPills: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 14 },
  attentionCard: { marginTop: referenceSpacing.md, padding: referenceSpacing.md, backgroundColor: colors.errorContainer, borderColor: "transparent", borderLeftWidth: 7, borderLeftColor: colors.error },
  attentionContent: { flexDirection: "row", alignItems: "flex-start", gap: referenceSpacing.sm },
  warningIcon: { width: 38, height: 38, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  attentionActions: { flexDirection: "row", justifyContent: "flex-end", gap: referenceSpacing.sm, marginTop: 12 },
  lightAction: { minHeight: 44, paddingHorizontal: 14, borderRadius: referenceRadii.lg, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 5, justifyContent: "center" },
  dangerAction: { minHeight: 44, paddingHorizontal: 17, borderRadius: referenceRadii.lg, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  segmented: { marginTop: referenceSpacing.md, padding: 4, borderRadius: referenceRadii.lg, backgroundColor: colors.surfaceLow, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  segment: { flexGrow: 1, flexBasis: "45%", minHeight: 44, paddingHorizontal: 4, borderRadius: referenceRadii.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 },
  segmentActive: { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  count: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, textAlign: "center", ...type.micro, lineHeight: 20 },
  scheduleHeading: { marginTop: 23, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headingTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  sortButton: { minHeight: 44, paddingLeft: 8, flexDirection: "row", alignItems: "center", gap: 2 },
  taskCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: referenceRadii.md, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1, minHeight: 150, padding: referenceSpacing.md, paddingLeft: 18, overflow: "hidden" },
  taskRail: { position: "absolute", top: 0, bottom: 0, left: 0, width: 5 },
  taskTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  taskPills: { flex: 1, flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 4 },
  taskMain: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 10 },
  checkboxHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  checkbox: { width: 28, height: 28, borderRadius: 7, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.outline, alignItems: "center", justifyContent: "center" },
  taskFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12, paddingLeft: 40 },
  footerMeta: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
  emptyState: { minHeight: 174, padding: referenceSpacing.lg, alignItems: "center", justifyContent: "center", gap: 7, borderStyle: "dashed" },
  emptyIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.primaryFixed, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  emptyTitle: { fontSize: 16, textAlign: "center" },
  emptyAction: { minHeight: 44, marginTop: 6, paddingHorizontal: 15, borderRadius: referenceRadii.lg, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: 5 },
  fab: { position: "absolute", right: 18, bottom: 84, minHeight: 56, paddingHorizontal: 18, borderRadius: 30, backgroundColor: colors.primaryContainer, flexDirection: "row", alignItems: "center", gap: 6, shadowColor: colors.primary, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
});
}
