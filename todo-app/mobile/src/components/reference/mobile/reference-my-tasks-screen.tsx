import { Ionicons } from "@expo/vector-icons";
import { OptionSheet } from "@/components/janus-board-ui";
import { format, isValid, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Task } from "@/lib/domain/types";
import { deriveStatus, describeDue } from "@/lib/domain/status";
import { useNow } from "@/hooks/use-now";
import { ReferenceMobileBottomNav, type ReferenceMobileTab } from "./reference-mobile-bottom-nav";
import { Pill, ProgressRing, ReferenceTaskInput, resolveReferenceTask, ScreenHeader, SurfaceCard } from "./reference-primitives";
import { useReferenceTheme, type ReferenceColors, type ReferenceType, referenceRadii, referenceSpacing } from "../reference-theme";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { MobileSearchField } from "@/components/ui/mobile-top-bar";
import { SectionHeading } from "@/components/ui/section-heading";
import { mobileBottomNavClearance, mobileContentStyle } from "@/theme/layout";

type AgendaFilter = "None" | "Today" | "Upcoming" | "Overdue" | "Completed";

const AGENDA_FILTERS: AgendaFilter[] = ["None", "Today", "Upcoming", "Overdue", "Completed"];

export interface ReferenceMyTasksScreenProps {
  tasks: ReferenceTaskInput[];
  boardName?: string;
  onTaskPress?: (task: Task, projectId?: string) => void;
  onTaskLongPress?: (task: Task) => void;
  embedded?: boolean;
  onToggleComplete?: (task: Task) => void;
  onReviewAttention?: () => void;
  onRescheduleAttention?: () => void;
  onNavigate?: (tab: ReferenceMobileTab) => void;
  activeTab?: ReferenceMobileTab;
  userName?: string;
}

export function ReferenceMyTasksScreen({ tasks, boardName, onTaskPress, onTaskLongPress, embedded = false, onToggleComplete, onReviewAttention, onRescheduleAttention, onNavigate, activeTab = "top-tasks" }: ReferenceMyTasksScreenProps) {
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors, type);
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<AgendaFilter>("None");
  const [query, setQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showSearch, setShowSearch] = useState(false);
  const [filterMenu, setFilterMenu] = useState(false);
  const now = useNow();
  const Content = embedded ? View : ScrollView;
  const resolved = useMemo(() => tasks.map((task, index) => resolveReferenceTask(task, index)), [tasks]);
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return resolved.filter(({ task, boardLabel, projectLabel }) => {
      if (!needle) return true;
      const haystack = [task.title, task.description, task.category ?? "", boardLabel ?? "", projectLabel ?? "", ...(task.tags ?? [])].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, resolved]);
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
      if (filter === "None") return !task.completed && !task.canceled;
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
    <View style={embedded ? styles.embeddedRoot : styles.root}>
      {embedded ? null : <ThemeAtmosphere />}
      {embedded ? null : <ScreenHeader
        title="My tasks"
        onSearch={() => setShowSearch(prev => !prev)}
        searchActive={showSearch}
        onMore={() => setFilterMenu(true)}
        moreIcon="funnel-outline"
        moreLabel="Filter tasks"
        showThemeToggle={false}
        search={showSearch ? <MobileSearchField value={query} onChangeText={setQuery} placeholder="Search tasks or tags" accessibilityLabel="Search my tasks" /> : null}
      />}
      <OptionSheet
        visible={filterMenu}
        title="Filter tasks"
        options={AGENDA_FILTERS.map((option) => ({
          label: option,
          icon: filter === option ? "checkmark-circle" : "radio-button-off-outline",
          onPress: () => setFilter(option),
        }))}
        onClose={() => setFilterMenu(false)}
      />
      <Content {...(embedded ? {} : { showsVerticalScrollIndicator: false, contentContainerStyle: [styles.content, { paddingBottom: insets.bottom + mobileBottomNavClearance }] })}>

        <SectionHeading title={embedded ? "My tasks" : "Task overview"} subtitle={embedded ? "Across all open boards · long press a task to reschedule" : undefined} style={styles.overviewHeading} right={embedded ? <Pressable accessibilityRole="button" accessibilityLabel="Filter my tasks" onPress={() => setFilterMenu(true)} style={styles.sortButton}><Ionicons name="funnel-outline" size={17} color={colors.primary} /><Text style={[type.caption, { color: colors.primary }]}>{filter === "None" ? "Filter" : filter}</Text></Pressable> : undefined} />
        {embedded ? <View style={styles.embeddedSearch}><MobileSearchField value={query} onChangeText={setQuery} placeholder="Search tasks or boards" accessibilityLabel="Search my tasks" /></View> : null}
        <SurfaceCard style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryCopy}>
              <Text style={[type.caption, styles.summaryEyebrow, { color: colors.muted }]}>COMPLETED</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{summary.completed}<Text style={[styles.summaryTotal, { color: colors.muted }]}> / {summary.total}</Text></Text>
              <View style={styles.summaryMeta}>
                <View style={styles.summaryMetaItem}><Ionicons name="ellipse-outline" size={13} color={colors.primary} /><Text style={[type.caption, { color: colors.muted }]}>{summary.remaining} open</Text></View>
                {summary.canceled ? <View style={styles.summaryMetaItem}><Ionicons name="close-circle-outline" size={14} color={colors.muted} /><Text style={[type.caption, { color: colors.muted }]}>{summary.canceled} canceled</Text></View> : null}
              </View>
            </View>
            <ProgressRing value={summary.progress} />
          </View>
          {summary.overdue > 0 ? (
            <View style={styles.summaryAttention}>
              <View style={styles.attentionContent}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
                <View style={styles.attentionCopy}>
                  <Text style={[type.bodyStrong, { color: colors.text }]}>{summary.overdue} overdue task{summary.overdue === 1 ? "" : "s"}</Text>
                  <Text style={[type.caption, { color: colors.muted, marginTop: 4 }]}>Choose a new date or review the details.</Text>
                </View>
              </View>
              <View style={styles.attentionActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Reschedule overdue tasks" onPress={onRescheduleAttention} style={({ pressed }) => [styles.attentionAction, { opacity: pressed ? 0.6 : 1 }]}><Ionicons name="calendar-outline" size={17} color={colors.primary} /><Text style={[type.bodyStrong, { color: colors.primary }]}>Reschedule</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Review overdue tasks" onPress={onReviewAttention} style={({ pressed }) => [styles.attentionAction, { opacity: pressed ? 0.6 : 1 }]}><Text style={[type.bodyStrong, { color: colors.muted }]}>Review</Text><Ionicons name="arrow-forward" size={16} color={colors.muted} /></Pressable>
              </View>
            </View>
          ) : null}
        </SurfaceCard>

        <SectionHeading
          title={filter === "None" ? "All tasks" : filter === "Today" ? "Today's tasks" : `${filter} tasks`}
          style={styles.scheduleHeading}
          right={<Pressable accessibilityRole="button" accessibilityLabel={sortDirection === "asc" ? "Sort by due time, earliest first" : "Sort by due time, latest first"} onPress={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")} style={styles.sortButton}><Text style={[type.body, { color: colors.muted }]}>{sortDirection === "asc" ? "Earliest first" : "Latest first"}</Text><Ionicons name={sortDirection === "asc" ? "arrow-up-outline" : "arrow-down-outline"} size={15} color={colors.muted} /></Pressable>}
        />
        <View style={{ gap: referenceSpacing.sm }}>{visible.length ? visible.map((item, index) => <ScheduleCard key={`${item.projectId ?? ""}:${item.task.id}`} item={item} index={index} now={now} onPress={() => onTaskPress?.(item.task, item.projectId)} onLongPress={() => onTaskLongPress?.(item.task)} onComplete={() => onToggleComplete?.(item.task)} />) : <EmptyAgendaState filtered={Boolean(query) || filter !== "None"} />}</View>
      </Content>
      {embedded ? null : <ReferenceMobileBottomNav active={activeTab} onNavigate={onNavigate} />}
    </View>
  );
}

function ScheduleCard({ item, index, now, onPress, onLongPress, onComplete }: { item: ReturnType<typeof resolveReferenceTask>; index: number; now: Date; onPress: () => void; onLongPress: () => void; onComplete: () => void }) {
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors, type);
  const { task } = item;
  const status = deriveStatus(task, now);
  const completed = status === "completed";
  const overdue = status === "overdue";
  const rail = completed ? colors.success : overdue ? colors.error : index === 0 ? colors.secondary : colors.primary;
  const dueInfo = describeDue(task.dueAt, now);
  const dueTime = task.dueAt && isValid(parseISO(task.dueAt)) ? format(parseISO(task.dueAt), "h:mm a") : null;
  const title = task.title || "Untitled task";
  const meta = [item.projectLabel, item.boardLabel].filter((value): value is string => Boolean(value)).join(" • ");
  const overdueLabel = dueInfo?.label && dueInfo.label.includes("overdue") ? dueInfo.label : null;
  const overdueDaysOnly = overdueLabel ? overdueLabel.match(/(\d+[hdwmy]?|\d+)\s*overdue/i)?.[1] ?? null : null;
  const topLine = dueTime && overdue && overdueDaysOnly ? `${dueTime} • ${overdueDaysOnly}` : dueTime && overdue ? `${dueTime} • Overdue` : dueTime ? dueTime : (dueInfo?.label ?? "No due time");
  return <View style={styles.taskCard}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [StyleSheet.absoluteFill, { borderRadius: referenceRadii.md, backgroundColor: pressed ? colors.primaryFixed : "transparent" }]} />
    <View pointerEvents="none" style={[styles.taskRail, { backgroundColor: rail }]} />
    <View pointerEvents="none" style={styles.taskTop}>
      <Text style={[type.bodyStrong, { color: overdue ? colors.error : completed ? colors.muted : colors.primary }]} numberOfLines={1}>
        <Ionicons name={overdue ? "timer-outline" : "time-outline"} size={15} /> {topLine}
      </Text>
      <View style={styles.taskPills}>
        <Pill label={task.priority === "high" ? "High" : task.priority === "medium" ? "Medium" : "Low"} tone={task.priority === "high" ? "purple" : "neutral"} />
        {overdue ? <Pill label="Overdue" tone="error" /> : null}
        {completed ? <Pill label="Completed" tone="success" icon="checkmark" /> : null}
      </View>
    </View>
    <View pointerEvents="box-none" style={styles.taskMain}>
      <Pressable accessibilityRole="checkbox" aria-checked={task.completed} accessibilityState={{ checked: task.completed }} accessibilityLabel={`${completed ? "Mark incomplete" : "Complete"} ${title}`} onPress={onComplete} style={styles.checkboxHit}>
        <View style={[styles.checkbox, completed && { backgroundColor: colors.success, borderColor: colors.success }]}>{completed ? <Ionicons name="checkmark" size={15} color={colors.onPrimary} /> : null}</View>
      </Pressable>
      <View pointerEvents="none" style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.title, { fontSize: 16, lineHeight: 21, textDecorationLine: completed ? "line-through" : "none", color: completed ? colors.muted : colors.text }]} numberOfLines={2}>{title}</Text>
        {meta ? <Text style={[type.body, { color: colors.muted, marginTop: 3 }]} numberOfLines={1}>{meta}</Text> : null}
      </View>
    </View>
  </View>;
}

function EmptyAgendaState({ filtered }: { filtered: boolean }) {
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors, type);
  return <SurfaceCard style={styles.emptyState}>
    <View style={styles.emptyIcon}><Ionicons name={filtered ? "search-outline" : "sunny-outline"} size={23} color={colors.primary} /></View>
    <Text style={[type.section, styles.emptyTitle]}>{filtered ? "No tasks match" : "A clear schedule"}</Text>
    <Text style={[type.body, { color: colors.muted, textAlign: "center" }]}>{filtered ? "Try a different search or filter." : "There is nothing due in this view yet."}</Text>
  </SurfaceCard>;
}

function createStyles(colors: ReferenceColors, type: ReferenceType) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    embeddedRoot: { marginTop: 24 },
    embeddedSearch: { marginBottom: referenceSpacing.md },
    content: mobileContentStyle,
    summaryCard: { padding: referenceSpacing.lg, overflow: "hidden" },
    summaryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: referenceSpacing.sm },
    summaryCopy: { flex: 1, minWidth: 0 },
    overviewHeading: { marginBottom: 10 },
    summaryEyebrow: { letterSpacing: 1.1, fontSize: 10 },
    summaryValue: { fontSize: 34, lineHeight: 44, fontWeight: "700", fontVariant: ["tabular-nums"], marginTop: 3 },
    summaryTotal: { fontSize: 19, fontWeight: "400" },
    summaryMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 7 },
    summaryMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    summaryAttention: { marginTop: referenceSpacing.lg, paddingTop: referenceSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
    attentionContent: { flexDirection: "row", alignItems: "flex-start", gap: referenceSpacing.sm },
    attentionCopy: { flex: 1, minWidth: 0 },
    attentionActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: referenceSpacing.sm, marginTop: 6 },
    attentionAction: { minHeight: 44, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 7, justifyContent: "center" },
    scheduleHeading: { marginTop: 23, marginBottom: 10 },
    sortButton: { minHeight: 44, paddingLeft: 8, flexDirection: "row", alignItems: "center", gap: 2 },
    taskCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: referenceRadii.md, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1, minHeight: 110, padding: referenceSpacing.md, paddingLeft: 18, overflow: "hidden" },
    taskRail: { position: "absolute", top: 0, bottom: 0, left: 0, width: 5 },
    taskTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
    taskPills: { flexShrink: 0, flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 4 },
    taskMain: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 8 },
    checkboxHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, 
    checkbox: { width: 28, height: 28, borderRadius: 7, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.outline, alignItems: "center", justifyContent: "center" },
    emptyState: { minHeight: 174, padding: referenceSpacing.lg, alignItems: "center", justifyContent: "center", gap: 7, borderStyle: "dashed" },
    emptyIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.primaryFixed, alignItems: "center", justifyContent: "center", marginBottom: 2 },
    emptyTitle: { fontSize: 16, textAlign: "center" },
  });
}
