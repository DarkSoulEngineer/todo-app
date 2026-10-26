import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BoardSection, Task } from "@/lib/domain/types";
import { describeDue, deriveStatus } from "@/lib/domain/status";
import { getTaskSectionId } from "@/lib/domain/sections";
import { useNow } from "@/hooks/use-now";
import { ReferenceMobileBottomNav, type ReferenceMobileTab } from "./reference-mobile-bottom-nav";
import { Pill, ReferenceTaskInput, resolveReferenceTask, ScreenHeader } from "./reference-primitives";
import { useReferenceTheme, type ReferenceColors, type ReferenceType, referenceRadii, referenceSpacing } from "../reference-theme";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";

export type ReferenceKanbanFilter = "All" | "High Priority" | "Due Today";

const UNSORTED_SECTION_ID = "__reference_unsorted__";

export interface ReferenceKanbanScreenProps {
  tasks: ReferenceTaskInput[];
  sections?: BoardSection[];
  title?: string;
  subtitle?: string;
  sprintLabel?: string;
  openCount?: number;
  doneCount?: number;
  activeSectionId?: string;
  onSectionChange?: (sectionId: string) => void;
  activeFilter?: ReferenceKanbanFilter;
  onFilterChange?: (filter: ReferenceKanbanFilter) => void;
  onSearch?: () => void;
  onSort?: () => void;
  onMenu?: () => void;
  onTaskMenu?: (task: Task) => void;
  selectedTaskId?: string;
  onTaskPress?: (task: Task) => void;
  onToggleComplete?: (task: Task) => void;
  onAddTask?: (sectionId?: string) => void;
  onNavigate?: (tab: ReferenceMobileTab) => void;
  activeTab?: ReferenceMobileTab;
}

export function ReferenceKanbanScreen({
  tasks,
  sections = [],
  title = "Board",
  subtitle = "Workspace",
  sprintLabel,
  openCount,
  doneCount,
  activeSectionId,
  onSectionChange,
  activeFilter,
  onFilterChange,
  onSearch,
  onSort,
  onMenu,
  onTaskMenu,
  selectedTaskId,
  onTaskPress,
  onToggleComplete,
  onAddTask,
  onNavigate,
  activeTab = "boards",
}: ReferenceKanbanScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors, type);
  const now = useNow();
  const [query, setQuery] = useState("");
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);
  const resolved = useMemo(() => tasks.map((task) => resolveReferenceTask(task)), [tasks]);
  const hasUnsortedTasks = useMemo(() => resolved.some(({ task }) => !task.sectionId), [resolved]);
  const buckets = useMemo(() => {
    const visibleSections = sections.filter((section) => !section.hidden);
    // Keep tasks without a section visible even when the persisted board has
    // no sections (or has sections alongside those tasks).
    if (visibleSections.length === 0 || hasUnsortedTasks) {
      return [...visibleSections, { id: UNSORTED_SECTION_ID, title: "Unsorted" }];
    }
    return visibleSections;
  }, [hasUnsortedTasks, sections]);
  const [internalSectionId, setInternalSectionId] = useState<string | undefined>();
  const [internalFilter, setInternalFilter] = useState<ReferenceKanbanFilter>("All");
  // Props and sections can hydrate independently. Select the first valid
  // preference without overwriting a still-valid user selection.
  const selectedSectionId = [activeSectionId, internalSectionId].find((sectionId) => sectionId && buckets.some((section) => section.id === sectionId)) ?? buckets[0]?.id;
  const filter = activeFilter ?? internalFilter;
  const activeSection = buckets.find((section) => section.id === selectedSectionId);

  const setSection = (sectionId: string) => {
    if (activeSectionId === undefined) setInternalSectionId(sectionId);
    onSectionChange?.(sectionId);
  };
  const setFilter = (nextFilter: ReferenceKanbanFilter) => {
    if (activeFilter === undefined) setInternalFilter(nextFilter);
    onFilterChange?.(nextFilter);
  };

  const counts = useMemo(() => Object.fromEntries(buckets.map((section) => [
    section.id,
    resolved.filter(({ task }) => getDisplayedTaskSectionId(task, buckets, now) === section.id).length,
  ])), [buckets, now, resolved]);
  const derivedOpenCount = useMemo(() => resolved.filter(({ task }) => !task.completed && !task.canceled).length, [resolved]);
  const derivedDoneCount = useMemo(() => resolved.filter(({ task }) => task.completed).length, [resolved]);
  const activeTasks = useMemo(() => {
    let list = activeSection
      ? resolved.filter(({ task }) => getDisplayedTaskSectionId(task, buckets, now) === activeSection.id)
      : [];

    const needle = query.trim().toLowerCase();
    if (needle) list = list.filter(({ task, boardLabel, sectionLabel }) => [task.title, task.description, task.category ?? "", boardLabel ?? "", sectionLabel ?? "", ...(task.tags ?? [])].join(" ").toLowerCase().includes(needle));
    if (filter === "High Priority") list = list.filter(({ task }) => task.priority === "high");
    if (filter === "Due Today") list = list.filter(({ task }) => task.dueAt ? new Date(task.dueAt).toDateString() === now.toDateString() : false);
    return list;
  }, [activeSection, buckets, filter, now, query, resolved]);
  const emptyMessage = buckets.length === 0
    ? "No sections available."
    : activeSection
      ? filter === "All" ? "No tasks in this section." : `No ${filter.toLowerCase()} tasks in this section.`
      : "Select a section to view its tasks.";

  return (
    <View style={styles.root}>
      <ThemeAtmosphere />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 112 }]}> 
        <ScreenHeader title={title} onSearch={() => { searchRef.current?.focus(); onSearch?.(); }} showThemeToggle={false} />
        <View style={styles.metricStrip}>
          {sprintLabel ? <Pill label={sprintLabel} tone="success" /> : <View />}
          <View style={styles.metricPill}>
            <Text style={[type.bodyStrong, { color: colors.primary }]}>{openCount ?? derivedOpenCount}</Text>
            <Text style={[type.caption, { color: colors.muted }]}> open</Text>
            <Text style={{ color: colors.outlineVariant }}>•</Text>
            <Text style={[type.bodyStrong, { color: colors.success }]}>{doneCount ?? derivedDoneCount}</Text>
            <Text style={[type.caption, { color: colors.muted }]}> done</Text>
          </View>
        </View>
        <View style={styles.searchRow}><View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={colors.muted} /><TextInput ref={searchRef} value={query} onChangeText={setQuery} placeholder="Search this board" placeholderTextColor={colors.muted} accessibilityLabel="Search board tasks" style={[type.body, styles.searchInput]} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear board search" onPress={() => setQuery("")} style={styles.clearSearch}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}</View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bucketTabs}>
          {buckets.map((section) => {
            const selected = section.id === selectedSectionId;
            return <Pressable key={section.id} accessibilityRole="tab" aria-selected={selected} accessibilityState={{ selected }} onPress={() => setSection(section.id)} style={[styles.bucketTab, selected && styles.bucketTabActive]}><Text style={[type.bodyStrong, { color: selected ? colors.onPrimary : colors.muted }]}>{section.title}</Text><Text style={[styles.bucketCount, { backgroundColor: selected ? colors.primaryFixed : colors.surfaceHighest, color: selected ? colors.primary : colors.text }]}>{counts[section.id] ?? 0}</Text></Pressable>;
          })}
        </ScrollView>
        <View style={styles.swipeCue}><View style={styles.cueLong} /><View style={styles.cueShort} /><View style={styles.cueShort} /></View>
         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
            {(["All", "High Priority", "Due Today"] as ReferenceKanbanFilter[]).map((item) => <Pressable key={item} accessibilityRole="button" aria-pressed={filter === item} accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.filterButton, filter === item && styles.filterButtonActive]}>{item !== "All" ? <Ionicons name={item === "High Priority" ? "flag" : "calendar-outline"} size={15} color={item === "High Priority" ? colors.error : colors.muted} /> : null}<Text style={[type.body, { color: filter === item ? colors.text : colors.muted, fontWeight: filter === item ? "700" : "400" }]}>{item}</Text></Pressable>)}
         </ScrollView>
         <View style={styles.quickAddRow}>
           <View style={styles.quickAddCopy}><Ionicons name="add-circle-outline" size={19} color={colors.primary} /><Text style={[type.body, { color: colors.muted }]} numberOfLines={1}>Add a task to {activeSection?.title ?? "this workstream"}</Text></View>
           <Pressable accessibilityRole="button" accessibilityLabel="Create a new task" onPress={() => onAddTask?.(activeSection?.id === UNSORTED_SECTION_ID ? undefined : activeSection?.id)} style={styles.quickAddButton}><Text style={[type.bodyStrong, { color: colors.primary }]}>New task</Text><Ionicons name="arrow-forward" size={15} color={colors.primary} /></Pressable>
         </View>
         <View style={styles.workstreamHeader}>
          <View style={styles.heading}><View style={styles.activeDot} /><Text style={[type.title, { fontSize: 18 }]}>{activeSection?.title ?? "Workstream"}</Text><Text style={[type.body, { color: colors.muted, backgroundColor: colors.surfaceLow, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 }]}>{activeTasks.length} tasks</Text></View>
          {onSort || onMenu ? <View style={styles.headerActions}>{onSort ? <Pressable accessibilityRole="button" accessibilityLabel="Sort tasks" onPress={onSort} style={styles.smallIcon}><Ionicons name="swap-vertical-outline" size={19} color={colors.muted} /></Pressable> : null}{onMenu ? <Pressable accessibilityRole="button" accessibilityLabel="Section actions" onPress={onMenu} style={styles.smallIcon}><Ionicons name="ellipsis-horizontal" size={19} color={colors.muted} /></Pressable> : null}</View> : null}
        </View>
        <View style={{ gap: referenceSpacing.sm }}>
           {activeTasks.map((item) => <KanbanCard key={item.task.id} item={item} now={now} selected={selectedTaskId === item.task.id} onPress={() => onTaskPress?.(item.task)} onMenu={onTaskMenu ? () => onTaskMenu(item.task) : undefined} onToggle={onToggleComplete ? () => onToggleComplete(item.task) : undefined} />)}
           {activeTasks.length === 0 ? <View style={styles.emptyState}><View style={styles.emptyIcon}><Ionicons name={query ? "search-outline" : "layers-outline"} size={22} color={colors.primary} /></View><Text style={[type.section, { fontSize: 16 }]}>{query ? "No tasks match" : "No tasks in this section"}</Text><Text style={[type.body, { color: colors.muted, textAlign: "center" }]}>{query ? "Try a different search." : emptyMessage}</Text><Pressable accessibilityRole="button" accessibilityLabel="Add a task" onPress={() => onAddTask?.(activeSection?.id === UNSORTED_SECTION_ID ? undefined : activeSection?.id)} style={styles.emptyAction}><Ionicons name="add" size={17} color={colors.onPrimary} /><Text style={[type.bodyStrong, { color: colors.onPrimary }]}>Add a task</Text></Pressable></View> : null}
        </View>
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add task to ${activeSection?.title ?? "this section"}`} onPress={() => onAddTask?.(activeSection?.id === UNSORTED_SECTION_ID ? undefined : activeSection?.id)} style={styles.fab}><Ionicons name="add" size={31} color={colors.onPrimary} /></Pressable>
      <ReferenceMobileBottomNav active={activeTab} onNavigate={onNavigate} />
    </View>
  );
}

function getDisplayedTaskSectionId(task: Task, sections: BoardSection[], now: Date): string | undefined {
  const sectionId = getTaskSectionId(task, sections, now);
  if (sectionId) return sectionId;
  return !task.sectionId && sections.some((section) => section.id === UNSORTED_SECTION_ID)
    ? UNSORTED_SECTION_ID
    : undefined;
}

function KanbanCard({ item, now, selected, onPress, onMenu, onToggle }: { item: ReturnType<typeof resolveReferenceTask>; now: Date; selected: boolean; onPress: () => void; onMenu?: () => void; onToggle?: () => void }) {
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors, type);
  const { task } = item;
  const openSurface = <Pressable accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={onPress} style={({ pressed }) => [StyleSheet.absoluteFill, { borderRadius: referenceRadii.md, backgroundColor: pressed ? colors.primaryFixed : "transparent" }]} />;
  const status = deriveStatus(task, now);
  const overdue = status === "overdue";
  const blocked = item.blocked ?? task.canceled;
  const rail = overdue ? colors.error : colors.primaryContainer;
  const label = item.sectionLabel ?? item.tags?.[0] ?? item.boardLabel;
  const due = describeDue(task.dueAt, now);

   if (blocked) return <View style={styles.blockedCard}>{openSurface}<View pointerEvents="box-none" style={styles.blockedTop}><View pointerEvents="none">{label ? <Pill label={label} /> : null}</View>{onMenu ? <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${task.title}`} onPress={(event) => { event.stopPropagation(); onMenu(); }} style={styles.menu}><Ionicons name="ellipsis-vertical" size={18} color={colors.muted} /></Pressable> : <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />}</View><Text pointerEvents="none" style={[type.title, { fontSize: 16, color: colors.muted }]} numberOfLines={2}>{task.title}</Text><View pointerEvents="none" style={styles.blockedFooter}><Text style={[type.caption, { color: colors.muted }]}>{task.canceled ? "Canceled" : "Blocked"}</Text></View></View>;

  const done = task.subtasks.filter((subtask) => subtask.done).length;
    return <View style={[styles.kanbanCard, selected && styles.selectedCard]}>{openSurface}
    <View pointerEvents="none" style={[styles.cardRail, { backgroundColor: rail }]} />
    <View pointerEvents="box-none" style={styles.cardContent}><View pointerEvents="box-none" style={styles.cardTop}><View pointerEvents="none" style={styles.tagRow}>{label ? <Pill label={label} tone={overdue ? "error" : "neutral"} /> : null}<Pill label={overdue ? "Overdue" : task.priority === "high" ? "High" : task.priority === "medium" ? "Medium" : "Low"} tone={overdue ? "error" : task.priority === "high" ? "warning" : "neutral"} icon={task.priority === "high" ? "flag" : undefined} /></View>{onMenu ? <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${task.title}`} onPress={(event) => { event.stopPropagation(); onMenu(); }} style={styles.menu}><Ionicons name="ellipsis-vertical" size={18} color={colors.muted} /></Pressable> : null}</View><Text pointerEvents="none" style={[type.title, { fontSize: 17, lineHeight: 22 }]} numberOfLines={2}>{task.title}</Text>{task.subtasks.length > 0 ? <View pointerEvents="none" style={styles.progressBlock}><View style={styles.progressLabels}><Text style={[type.body, { color: colors.muted }]}><Ionicons name="checkmark-done-outline" size={14} color={colors.primary} /> Checklist Items</Text><Text style={type.bodyStrong}>{done}/{task.subtasks.length} ({Math.round((done / task.subtasks.length) * 100)}%)</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round((done / task.subtasks.length) * 100)}%` }]} /></View></View> : null}<View pointerEvents="box-none" style={styles.cardFooter}><View pointerEvents="none" style={styles.duePill}><Ionicons name={due?.overdue ? "calendar-outline" : "time-outline"} size={14} color={due?.overdue ? colors.error : colors.primary} /><Text style={[type.caption, { color: due?.overdue ? colors.error : colors.primary }]}>{due?.label ?? "No due date"}</Text></View><View pointerEvents="box-none" style={styles.cardActions}><Pressable accessibilityRole="checkbox" aria-checked={task.completed} accessibilityState={{ checked: task.completed }} accessibilityLabel={`${task.completed ? "Mark incomplete" : "Complete"} ${task.title}`} onPress={(event) => { event.stopPropagation(); onToggle?.(); }} style={styles.cardCheck}>{task.completed ? <Ionicons name="checkmark" size={17} color={colors.primary} /> : null}</Pressable></View></View></View>
  </View>;
}

function createStyles(colors: ReferenceColors, type: ReferenceType) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
   content: { paddingHorizontal: referenceSpacing.md, paddingTop: 4, maxWidth: 600, width: "100%", alignSelf: "center" },
  metricStrip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2, marginBottom: 7 },
  metricPill: { minHeight: 32, paddingHorizontal: 10, borderRadius: referenceRadii.pill, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 3 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  searchBox: { flex: 1, minHeight: 44, paddingHorizontal: 11, borderRadius: referenceRadii.md, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 7 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: colors.text },
  clearSearch: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  bucketTabs: { gap: 6, paddingVertical: 5 },
  bucketTab: { minHeight: 44, paddingHorizontal: 17, borderRadius: 24, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 7 },
  bucketTabActive: { backgroundColor: colors.primaryContainer },
  bucketCount: { minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, textAlign: "center", ...type.caption, lineHeight: 22 },
  swipeCue: { height: 9, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 3, opacity: 0.5 },
  cueLong: { width: 34, height: 3, borderRadius: 2, backgroundColor: colors.muted },
  cueShort: { width: 8, height: 3, borderRadius: 2, backgroundColor: colors.muted },
  filterRail: { gap: 7, paddingVertical: 7 },
   filterButton: { minHeight: 44, paddingHorizontal: 13, borderRadius: 10, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
   filterButtonActive: { backgroundColor: colors.surfaceHigh },
   quickAddRow: { minHeight: 52, marginTop: 4, paddingHorizontal: 11, borderRadius: referenceRadii.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.outlineVariant, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
   quickAddCopy: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 },
   quickAddButton: { minHeight: 40, paddingHorizontal: 9, borderRadius: 8, backgroundColor: colors.primaryFixed, flexDirection: "row", alignItems: "center", gap: 4 },
  workstreamHeader: { marginTop: 14, marginBottom: 10, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  activeDot: { width: 15, height: 15, borderRadius: 8, backgroundColor: colors.primaryContainer },
  headerActions: { flexDirection: "row", alignItems: "center" },
  smallIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  kanbanCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: referenceRadii.md, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1, minHeight: 145, padding: referenceSpacing.md, paddingLeft: 19, overflow: "hidden" },
  selectedCard: { borderWidth: 2, borderColor: colors.primary, paddingLeft: 18 },
  cardRail: { position: "absolute", top: 0, bottom: 0, left: 0, width: 5 },
  cardContent: { gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  tagRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 5 },
  menu: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginTop: -8, marginRight: -7 },
  progressBlock: { gap: 5 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.primaryContainer },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 1 },
  duePill: { minHeight: 32, paddingHorizontal: 9, borderRadius: 6, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 5 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardCheck: { width: 44, height: 44, borderRadius: 6, borderWidth: 1, borderColor: colors.outline, alignItems: "center", justifyContent: "center" },
  blockedCard: { backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: referenceRadii.md, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1, minHeight: 130, padding: referenceSpacing.md, borderStyle: "dashed", gap: 10 },
  blockedTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  blockedFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  emptyState: { minHeight: 174, padding: referenceSpacing.lg, alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderStyle: "dashed", borderColor: colors.outlineVariant, borderRadius: referenceRadii.lg, backgroundColor: colors.surfaceLow },
  emptyIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.primaryFixed, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  emptyAction: { minHeight: 44, marginTop: 5, paddingHorizontal: 15, borderRadius: referenceRadii.lg, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: 5 },
  fab: { position: "absolute", right: 18, bottom: 88, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center", shadowColor: colors.primary, shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
});
} 
