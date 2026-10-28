import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import type { BoardSection, Task } from "@/lib/domain/types";
import { useReferenceTheme, type ReferenceColors } from "@/components/reference/reference-theme";

export type ReferenceInspectorMode = "right" | "bottom";

export interface ReferenceTaskChanges {
  title: string;
  description: string;
}

export interface ReferenceDesktopWorkspaceProps {
  tasks: Task[];
  sections?: BoardSection[];
  boardTitle?: string;
  documentTitle?: string;
  selectedTaskId?: string | null;
  inspectorMode?: ReferenceInspectorMode;
  inspectorVisible?: boolean;
  onSelect?: (task: Task) => void;
  onSelectTask?: (task: Task) => void;
  onComplete?: (taskId: string) => void;
  onCompleteTask?: (taskId: string) => void;
  onOpenInspector?: (task: Task) => void;
  onAddTask?: (section?: BoardSection) => void;
  onSave?: (task: Task, changes?: ReferenceTaskChanges) => void;
  onDiscard?: (task: Task) => void;
  onClose?: () => void;
}

type Column = BoardSection & { accent: string };

function defaultColumns(colors: ReferenceColors): Column[] {
  return [
    { id: "reference-backlog", title: "Backlog", accent: colors.primaryContainer },
    { id: "reference-progress", title: "In Progress", accent: colors.secondaryContainer },
    { id: "reference-review", title: "Review", accent: colors.primaryContainer },
    { id: "reference-completed", title: "Completed", accent: colors.tertiaryContainer },
  ];
}

const iconRailItems = [
  { icon: "grid-outline" as const, label: "Workspace" },
  { icon: "checkmark-circle-outline" as const, label: "Tasks" },
  { icon: "calendar-outline" as const, label: "Calendar" },
  { icon: "bar-chart-outline" as const, label: "Analytics" },
];

function displayDate(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isPastDue(value: string | null): boolean {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function columnForSection(section: BoardSection, index: number, colors: ReferenceColors): Column {
  return { ...section, accent: defaultColumns(colors)[index]?.accent ?? colors.primaryContainer };
}

function getColumns(sections: BoardSection[], colors: ReferenceColors): Column[] {
  const supplied = sections.filter((section) => !section.hidden).slice(0, 4);
  return defaultColumns(colors).map((fallback, index) => columnForSection(supplied[index] ?? fallback, index, colors));
}

function taskColumnIndex(task: Task, columns: Column[]): number {
  const direct = columns.findIndex((column) => column.id === task.sectionId);
  if (direct >= 0) return direct;
  if (task.completed) return 3;
  const sectionKey = (task.sectionId ?? "").toLowerCase();
  const title = columns.map((column) => `${column.title} ${column.id}`.toLowerCase());
  const named = title.findIndex((value) => {
    if (!sectionKey) return false;
    return value.includes(sectionKey) || (sectionKey.includes("progress") && value.includes("in progress")) || (sectionKey.includes("backlog") && value.includes("backlog")) || (sectionKey.includes("review") && value.includes("review")) || (sectionKey.includes("complete") && value.includes("complete"));
  });
  return named >= 0 ? named : 0;
}

function IconButton({
  icon,
  label,
  onPress,
  active = false,
  compact = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress?: () => void;
  active?: boolean;
  compact?: boolean;
}) {
  const { colors } = useReferenceTheme();
  const styles = createStyles(colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        compact ? styles.iconButtonCompact : styles.iconButton,
        active && styles.iconButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={compact ? 15 : 17} color={active ? colors.primaryContainer : colors.onSurfaceVariant} />
    </Pressable>
  );
}

export function ReferenceTitlebar({ boardTitle, documentTitle }: { boardTitle: string; documentTitle: string }) {
  const { colors, toggle, scheme } = useReferenceTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.titlebar}>
      <View style={styles.titlebarBrand}>
        <View style={styles.appMark}><Ionicons name="layers-outline" size={15} color={colors.onPrimary} /></View>
        <Text style={styles.titlebarText} numberOfLines={1}>{boardTitle}</Text>
        <Text style={styles.titlebarSlash}>/</Text>
        <Text style={styles.titlebarMuted} numberOfLines={1}>{documentTitle}</Text>
      </View>
      <View style={styles.titlebarActions}>
        <Text style={styles.syncText}>Local workspace</Text>
        <IconButton icon={scheme === "dark" ? "sunny-outline" : "moon-outline"} label={scheme === "dark" ? "Use light theme" : "Use dark theme"} onPress={toggle} compact />
      </View>
    </View>
  );
}

export function ReferenceRibbon({ onAddTask, onToggleInspector, canFocus = false }: { onAddTask: () => void; onToggleInspector: () => void; canFocus?: boolean }) {
  const { colors } = useReferenceTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.ribbon}>
      <View style={styles.ribbonTabs}>
        <View accessibilityLabel="Home" style={[styles.ribbonTab, styles.ribbonTabActive]}>
          <Ionicons name="home-outline" size={14} color={colors.primaryContainer} />
          <Text style={[styles.ribbonTabText, styles.ribbonTabTextActive]}>Home</Text>
        </View>
      </View>
      <View style={styles.ribbonBody}>
        <RibbonGroup label="Create">
          <RibbonAction icon="add" label="New task" large onPress={onAddTask} />
        </RibbonGroup>
        {canFocus ? (
          <>
            <RibbonDivider />
            <RibbonGroup label="Workspace">
              <RibbonAction icon="expand-outline" label="Focus" onPress={onToggleInspector} />
            </RibbonGroup>
          </>
        ) : null}
      </View>
    </View>
  );
}

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useReferenceTheme();
  const styles = createStyles(colors);
  return <View style={styles.ribbonGroup}><View style={styles.ribbonGroupActions}>{children}</View><Text style={styles.ribbonGroupLabel}>{label}</Text></View>;
}

function RibbonDivider() { const { colors } = useReferenceTheme(); const styles = createStyles(colors); return <View style={styles.ribbonDivider} />; }

function RibbonAction({ icon, label, large = false, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; large?: boolean; onPress?: () => void }) {
  const { colors } = useReferenceTheme();
  const styles = createStyles(colors);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [large ? styles.ribbonActionLarge : styles.ribbonAction, pressed && styles.pressed]}><Ionicons name={icon} size={large ? 21 : 16} color={colors.onSurfaceVariant} /><Text style={large ? styles.ribbonActionLargeText : styles.ribbonActionText}>{label}</Text></Pressable>;
}

export function ReferenceIconRail({ activeIndex = 0, onSelect }: { activeIndex?: number; onSelect?: (index: number) => void }) {
  const { colors } = useReferenceTheme();
  const styles = createStyles(colors);
  return <View style={styles.iconRail}>{iconRailItems.map((item, index) => <IconButton key={item.label} icon={item.icon} label={item.label} active={index === activeIndex} onPress={() => onSelect?.(index)} />)}</View>;
}

function TaskCard({ task, selected, onSelect, onComplete, onOpenInspector }: { task: Task; selected: boolean; onSelect: () => void; onComplete: () => void; onOpenInspector: () => void }) {
  const { colors } = useReferenceTheme();
  const styles = createStyles(colors);
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  const hasDueDate = Boolean(task.dueAt);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={onSelect} style={({ pressed }) => [styles.taskCard, selected && styles.taskCardSelected, pressed && styles.taskCardPressed]}>
      <View style={[styles.priorityRail, { backgroundColor: task.priority === "high" ? colors.tertiaryContainer : task.priority === "medium" ? colors.secondaryContainer : colors.primaryContainer }]} />
      <View style={styles.taskCardContent}>
        <View style={styles.cardTopline}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} accessibilityLabel={`${task.completed ? "Mark incomplete" : "Complete"} ${task.title}`} onPress={(event) => { event.stopPropagation(); onComplete(); }} style={[styles.checkbox, task.completed && styles.checkboxChecked]}>
            {task.completed ? <Ionicons name="checkmark" size={12} color={colors.onPrimary} /> : null}
          </Pressable>
          <Text style={[styles.cardTitle, task.completed && styles.cardTitleDone]} numberOfLines={2}>{task.title || "Untitled task"}</Text>
          <IconButton icon="open-outline" label={`Open inspector for ${task.title}`} compact onPress={onOpenInspector} />
        </View>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMeta}>{task.priority === "high" ? "High priority" : task.priority === "medium" ? "Medium priority" : "Normal priority"}</Text>
          {task.subtasks.length > 0 ? <Text style={styles.cardMeta}>{completedSubtasks}/{task.subtasks.length} checklist</Text> : null}
        </View>
        <View style={styles.cardFooter}>
          <Text style={[styles.dueChip, isPastDue(task.dueAt) && !task.completed && styles.dueChipPast]}>{hasDueDate ? displayDate(task.dueAt) : "No due date"}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function JanusColumn({ column, tasks, selectedTaskId, onSelect, onComplete, onOpenInspector, onAddTask }: { column: Column; tasks: Task[]; selectedTaskId?: string | null; onSelect: (task: Task) => void; onComplete: (task: Task) => void; onOpenInspector: (task: Task) => void; onAddTask: (column?: BoardSection) => void }) {
  const { colors } = useReferenceTheme();
  const styles = createStyles(colors);
  return <View style={styles.column}><View style={[styles.columnAccent, { backgroundColor: column.accent }]} /><View style={styles.columnHeader}><View style={styles.columnHeading}><Text style={styles.columnTitle}>{column.title}</Text><Text style={styles.countBadge}>{tasks.length}</Text></View><IconButton icon="add" label={`Add task to ${column.title}`} compact onPress={() => onAddTask(column)} /></View><ScrollView style={styles.columnScroll} contentContainerStyle={styles.columnContent} showsVerticalScrollIndicator={false}>{tasks.length ? tasks.map((task) => <TaskCard key={task.id} task={task} selected={task.id === selectedTaskId} onSelect={() => onSelect(task)} onComplete={() => onComplete(task)} onOpenInspector={() => onOpenInspector(task)} />) : <View style={styles.emptyColumn}><Ionicons name="checkmark-circle-outline" size={20} color={colors.muted} /><Text style={styles.emptyColumnText}>Nothing here yet</Text></View>}</ScrollView><Pressable accessibilityRole="button" accessibilityLabel={`Add task to ${column.title}`} onPress={() => onAddTask(column)} style={styles.addTaskButton}><Ionicons name="add" size={14} color={colors.primaryContainer} /><Text style={styles.addTaskText}>Add task</Text></Pressable></View>;
}

function Inspector({ task, mode, onClose, onModeChange, onSave, onDiscard }: { task: Task; mode: ReferenceInspectorMode; onClose: () => void; onModeChange: (mode: ReferenceInspectorMode) => void; onSave: (title: string, description: string) => void; onDiscard: () => void }) {
  const { colors } = useReferenceTheme();
  const styles = createStyles(colors);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  return <View style={[styles.inspector, mode === "bottom" && styles.inspectorBottom]}><View style={styles.inspectorHeader}><View><Text style={styles.inspectorEyebrow}>TASK INSPECTOR</Text><Text style={styles.inspectorTitle}>Details</Text></View><View style={styles.inspectorActions}><Text style={styles.savedStamp}>Local workspace</Text><IconButton icon={mode === "right" ? "chevron-down-outline" : "chevron-forward-outline"} label={mode === "right" ? "Dock inspector bottom" : "Dock inspector right"} compact onPress={() => onModeChange(mode === "right" ? "bottom" : "right")} /><IconButton icon="close-outline" label="Close inspector" compact onPress={onClose} /></View></View><ScrollView style={styles.inspectorScroll} contentContainerStyle={styles.inspectorContent}><View style={styles.inspectorSection}><Text style={styles.inspectorLabel}>Title</Text><TextInput value={title} onChangeText={setTitle} style={styles.inspectorInput} placeholderTextColor={colors.muted} /></View><View style={styles.inspectorSection}><Text style={styles.inspectorLabel}>Notes</Text><TextInput value={description} onChangeText={setDescription} multiline textAlignVertical="top" style={[styles.inspectorInput, styles.notesInput]} placeholder="Add a note" placeholderTextColor={colors.muted} /></View><View style={styles.inspectorGrid}><InspectorDetail icon="flag-outline" label="Priority" value={task.priority === "high" ? "High" : task.priority === "medium" ? "Medium" : "Normal"} /><InspectorDetail icon="calendar-outline" label="Due date" value={displayDate(task.dueAt)} /><InspectorDetail icon="list-outline" label="Checklist" value={`${task.subtasks.filter((subtask) => subtask.done).length}/${task.subtasks.length}`} /></View><View style={styles.inspectorCallout}><Ionicons name="information-circle-outline" size={16} color={colors.primaryContainer} /><Text style={styles.calloutText}>Changes stay local until you save this task.</Text></View></ScrollView><View style={styles.inspectorFooter}><Pressable accessibilityRole="button" onPress={onDiscard} style={styles.discardButton}><Text style={styles.discardText}>Discard</Text></Pressable><Pressable accessibilityRole="button" onPress={() => onSave(title, description)} style={styles.saveButton}><Ionicons name="checkmark" size={15} color={colors.onPrimary} /><Text style={styles.saveText}>Save changes</Text></Pressable></View></View>;
}

function InspectorDetail({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }) { const { colors } = useReferenceTheme(); const styles = createStyles(colors); return <View style={styles.inspectorDetail}><Ionicons name={icon} size={16} color={colors.muted} /><View><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View></View>; }

export function ReferenceStatusbar({ tasks }: { tasks: Task[] }) {
  const { colors } = useReferenceTheme();
  const styles = createStyles(colors);
  const completed = tasks.filter((task) => task.completed).length;
  const overdue = tasks.filter((task) => !task.completed && isPastDue(task.dueAt)).length;
  return <View style={styles.statusbar}><View style={styles.statusMetrics}><Text style={styles.statusText}>{tasks.length} Tasks</Text><Text style={styles.statusText}>{overdue} Overdue</Text><Text style={styles.statusText}>{completed} Completed</Text></View></View>;
}

export function ReferenceDesktopWorkspace({ tasks, sections = [], boardTitle = "Stride Workspace", documentTitle = "Q4 Product Operations", selectedTaskId: selectedTaskIdProp, inspectorMode: inspectorModeProp, inspectorVisible: inspectorVisibleProp, onSelect, onSelectTask, onComplete, onCompleteTask, onOpenInspector, onAddTask, onSave, onDiscard, onClose }: ReferenceDesktopWorkspaceProps) {
  const { width, height } = useWindowDimensions();
  const { colors } = useReferenceTheme();
  const styles = createStyles(colors);
  const isDesktop = width >= 900;
  const [internalSelectedTaskId, setInternalSelectedTaskId] = useState<string | null>(selectedTaskIdProp ?? null);
  const [internalInspectorMode, setInternalInspectorMode] = useState<ReferenceInspectorMode>(inspectorModeProp ?? "right");
  const [internalInspectorOpen, setInternalInspectorOpen] = useState(Boolean(selectedTaskIdProp));
  const columns = useMemo(() => getColumns(sections, colors), [sections, colors]);
  const selectedTaskId = selectedTaskIdProp !== undefined ? selectedTaskIdProp : internalSelectedTaskId;
  const inspectorMode = inspectorModeProp ?? internalInspectorMode;
  const inspectorOpen = inspectorVisibleProp ?? internalInspectorOpen;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  const selectTask = (task: Task) => { setInternalSelectedTaskId(task.id); setInternalInspectorOpen(true); onSelect?.(task); onSelectTask?.(task); };
  const completeTask = (task: Task) => { onComplete?.(task.id); onCompleteTask?.(task.id); };
  const openTaskInspector = (task: Task) => { selectTask(task); setInternalInspectorOpen(true); onOpenInspector?.(task); };
  const persistedSectionIds = useMemo(() => new Set(sections.map((section) => section.id)), [sections]);
  const addTask = (column?: BoardSection) => onAddTask?.(column && persistedSectionIds.has(column.id) ? column : undefined);
  const effectiveMode: ReferenceInspectorMode = !isDesktop ? "bottom" : inspectorMode;
  const boardHeight = Math.max(220, Math.round(height * 0.35));

  return <View style={styles.root}><ReferenceTitlebar boardTitle={boardTitle} documentTitle={documentTitle} /><ReferenceRibbon onAddTask={() => addTask(columns[0])} canFocus={Boolean(selectedTask)} onToggleInspector={() => setInternalInspectorOpen((value) => !value)} /><View style={[styles.workspace, effectiveMode === "bottom" && styles.workspaceBottom]}><View style={styles.mainArea}><View style={styles.canvasHeader}><View><Text style={styles.canvasEyebrow}>OPERATIONS BOARD</Text><Text style={styles.canvasTitle}>{boardTitle}</Text></View><View style={styles.canvasTools}><Text style={styles.canvasCount}>{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</Text></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.boardScroll} contentContainerStyle={styles.boardContent}>{columns.map((column, index) => <JanusColumn key={column.id || `column-${index}`} column={column} tasks={tasks.filter((task) => taskColumnIndex(task, columns) === index)} selectedTaskId={selectedTaskId} onSelect={selectTask} onComplete={completeTask} onOpenInspector={openTaskInspector} onAddTask={addTask} />)}</ScrollView></View>{inspectorOpen && selectedTask ? <View style={effectiveMode === "right" ? styles.rightInspector : [styles.bottomInspector, { height: boardHeight }]}><Inspector key={selectedTask.id} task={selectedTask} mode={effectiveMode} onClose={() => { setInternalInspectorOpen(false); onClose?.(); }} onModeChange={setInternalInspectorMode} onSave={(title, description) => onSave?.(selectedTask, { title, description })} onDiscard={() => { setInternalInspectorOpen(false); onDiscard?.(selectedTask); }} /></View> : null}</View><ReferenceStatusbar tasks={tasks} /></View>;
}

export default ReferenceDesktopWorkspace;

function createStyles(colors: ReferenceColors) { return StyleSheet.create({
  root: { flex: 1, minHeight: 480, backgroundColor: colors.canvas, color: colors.onSurface },
  titlebar: { height: 32, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, backgroundColor: colors.surfaceContainerLowest, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  titlebarBrand: { flex: 1, maxWidth: 315, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 },
  appMark: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: colors.primaryContainer },
  titlebarText: { flexShrink: 1, color: colors.onSurface, fontSize: 12, fontWeight: "500", fontFamily: "Inter" },
  titlebarSlash: { color: colors.outlineVariant, fontSize: 12 },
  titlebarMuted: { flexShrink: 1, color: colors.onSurfaceVariant, fontSize: 12, fontFamily: "Inter" },
  titlebarActions: { flex: 1, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 2 },
  syncText: { color: colors.muted, fontSize: 10, marginRight: 7, fontFamily: "Inter" },
  profile: { width: 22, height: 22, alignItems: "center", justifyContent: "center", marginHorizontal: 5, borderRadius: 11, backgroundColor: colors.secondaryContainer },
  profileText: { color: colors.onSecondary, fontSize: 9, fontWeight: "600" },
  iconButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 4 },
  iconButtonCompact: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 4 },
  iconButtonActive: { backgroundColor: colors.surfaceContainer },
  pressed: { opacity: 0.58, backgroundColor: colors.surfaceContainerLow },
  ribbon: { height: 92, backgroundColor: colors.surfaceContainerLowest, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  ribbonTabs: { height: 32, flexDirection: "row", alignItems: "stretch", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  ribbonTab: { height: 32, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, borderBottomWidth: 2, borderBottomColor: "transparent" },
  ribbonTabActive: { borderBottomColor: colors.primaryContainer },
  ribbonTabText: { color: colors.onSurfaceVariant, fontSize: 12, fontWeight: "600", fontFamily: "Inter" },
  ribbonTabTextActive: { color: colors.primaryContainer },
  ribbonBody: { height: 60, flexDirection: "row", alignItems: "stretch", paddingHorizontal: 12 },
  ribbonGroup: { justifyContent: "space-between", minWidth: 92, paddingVertical: 4 },
  ribbonGroupActions: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  ribbonGroupLabel: { alignSelf: "center", color: colors.outline, fontSize: 10, lineHeight: 12, letterSpacing: 0.3, fontFamily: "Inter" },
  ribbonDivider: { width: StyleSheet.hairlineWidth, height: 42, marginTop: 7, marginHorizontal: 10, backgroundColor: colors.hairline },
  ribbonAction: { minWidth: 44, height: 37, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 4, paddingHorizontal: 4 },
  ribbonActionLarge: { width: 58, height: 48, alignItems: "center", justifyContent: "center", gap: 1, borderRadius: 4 },
  ribbonActionText: { color: colors.onSurfaceVariant, fontSize: 11, lineHeight: 14, fontFamily: "Inter" },
  ribbonActionLargeText: { color: colors.onSurfaceVariant, fontSize: 11, lineHeight: 14, fontFamily: "Inter" },
  workspace: { flex: 1, minHeight: 0, flexDirection: "row" },
  workspaceBottom: { flexDirection: "column" },
  iconRail: { width: 56, alignItems: "center", paddingTop: 12, gap: 7, backgroundColor: colors.surfaceContainerLowest, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.hairline },
  mainArea: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.workspace },
  canvasHeader: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  canvasEyebrow: { color: colors.primaryContainer, fontSize: 10, fontWeight: "600", letterSpacing: 0.8, fontFamily: "Inter" },
  canvasTitle: { color: colors.onSurface, fontSize: 18, lineHeight: 23, fontWeight: "600", fontFamily: "Inter" },
  canvasTools: { flexDirection: "row", alignItems: "center", gap: 3 },
  canvasCount: { color: colors.onSurfaceVariant, fontSize: 11, marginRight: 8, fontFamily: "Inter" },
  boardScroll: { flex: 1 },
  boardContent: { gap: 16, padding: 16, alignItems: "stretch" },
  column: { width: 298, minWidth: 290, maxWidth: 305, minHeight: 300, overflow: "hidden", backgroundColor: colors.surfaceContainerLow, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, borderRadius: 8 },
  columnAccent: { height: 3, width: "100%" },
  columnHeader: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, backgroundColor: colors.surfaceContainerLowest },
  columnHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  columnTitle: { color: colors.onSurface, fontSize: 14, lineHeight: 20, fontWeight: "600", fontFamily: "Inter" },
  countBadge: { minWidth: 21, paddingHorizontal: 6, paddingVertical: 2, textAlign: "center", overflow: "hidden", borderRadius: 10, backgroundColor: colors.surfaceContainerLow, color: colors.onSurfaceVariant, fontSize: 11, fontWeight: "600", fontVariant: ["tabular-nums"] },
  columnScroll: { flex: 1 },
  columnContent: { padding: 8, gap: 8 },
  taskCard: { minHeight: 96, flexDirection: "row", overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, borderRadius: 8, backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.shadow, shadowOpacity: 0.28, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  taskCardSelected: { borderColor: colors.primaryContainer, shadowColor: colors.primaryContainer, shadowOpacity: 0.18, shadowRadius: 5, elevation: 2 },
  taskCardPressed: { opacity: 0.78 },
  priorityRail: { width: 4 },
  taskCardContent: { flex: 1, minWidth: 0, padding: 10 },
  cardTopline: { minHeight: 22, flexDirection: "row", alignItems: "flex-start", gap: 7 },
  checkbox: { width: 16, height: 16, alignItems: "center", justifyContent: "center", marginTop: 1, borderWidth: 1.5, borderColor: colors.outline, borderRadius: 4 },
  checkboxChecked: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
  cardTitle: { flex: 1, color: colors.onSurface, fontSize: 13, lineHeight: 18, fontWeight: "500", fontFamily: "Inter" },
  cardTitleDone: { color: colors.outline, textDecorationLine: "line-through" },
  cardMetaRow: { flexDirection: "row", gap: 10, paddingLeft: 23, paddingTop: 4 },
  cardMeta: { color: colors.onSurfaceVariant, fontSize: 11, lineHeight: 14, fontFamily: "Inter" },
  cardFooter: { flexDirection: "row", alignItems: "center", paddingTop: 10 },
  dueChip: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, color: colors.onSurfaceVariant, backgroundColor: colors.surfaceContainerLow, fontSize: 10, fontFamily: "Inter" },
  dueChipPast: { color: colors.error, backgroundColor: colors.errorContainer },
  emptyColumn: { alignItems: "center", justifyContent: "center", minHeight: 100, gap: 6 },
  emptyColumnText: { color: colors.muted, fontSize: 11, fontFamily: "Inter" },
  addTaskButton: { height: 34, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, backgroundColor: colors.surfaceContainerLowest },
  addTaskText: { color: colors.primaryContainer, fontSize: 12, fontWeight: "600", fontFamily: "Inter" },
  rightInspector: { width: 390, minWidth: 280, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.hairline, backgroundColor: colors.surfaceContainerLowest },
  bottomInspector: { width: "100%", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, backgroundColor: colors.surfaceContainerLowest },
  inspector: { flex: 1, minHeight: 0, backgroundColor: colors.surfaceContainerLowest },
  inspectorBottom: { width: "100%" },
  inspectorHeader: { height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  inspectorEyebrow: { color: colors.primaryContainer, fontSize: 10, fontWeight: "600", letterSpacing: 0.8, fontFamily: "Inter" },
  inspectorTitle: { color: colors.onSurface, fontSize: 18, lineHeight: 24, fontWeight: "600", fontFamily: "Inter" },
  inspectorActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  savedStamp: { color: colors.muted, fontSize: 10, marginRight: 5, fontFamily: "Inter" },
  inspectorScroll: { flex: 1 },
  inspectorContent: { padding: 16, gap: 16 },
  inspectorSection: { gap: 6 },
  inspectorLabel: { color: colors.onSurfaceVariant, fontSize: 11, fontWeight: "600", fontFamily: "Inter" },
  inspectorInput: { height: 34, paddingHorizontal: 9, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.selectedBorder, borderRadius: 4, backgroundColor: colors.surfaceContainerLowest, color: colors.onSurface, fontSize: 13, fontFamily: "Inter" },
  notesInput: { height: 84 },
  inspectorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, borderRadius: 6 },
  inspectorDetail: { width: "49.8%", minHeight: 58, flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: colors.surfaceContainerLow },
  detailLabel: { color: colors.muted, fontSize: 10, fontFamily: "Inter" },
  detailValue: { color: colors.onSurface, fontSize: 12, fontWeight: "600", marginTop: 2, fontFamily: "Inter" },
  inspectorCallout: { flexDirection: "row", alignItems: "center", gap: 7, padding: 10, borderRadius: 5, backgroundColor: colors.surfaceContainerLow },
  calloutText: { flex: 1, color: colors.onSurfaceVariant, fontSize: 11, lineHeight: 15, fontFamily: "Inter" },
  inspectorFooter: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  discardButton: { height: 32, justifyContent: "center", paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.outlineVariant, borderRadius: 4 },
  discardText: { color: colors.onSurfaceVariant, fontSize: 12, fontWeight: "600", fontFamily: "Inter" },
  saveButton: { height: 32, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, borderRadius: 4, backgroundColor: colors.primaryContainer },
  saveText: { color: colors.onPrimary, fontSize: 12, fontWeight: "600", fontFamily: "Inter" },
  statusbar: { height: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, backgroundColor: colors.surfaceContainerLow, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  statusMetrics: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusText: { color: colors.onSurfaceVariant, fontSize: 11, fontFamily: "Inter", fontVariant: ["tabular-nums"] },
});
} 
