import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getTaskSectionId } from "@/lib/domain/sections";
import type { BoardSection, Task } from "@/lib/domain/types";
import { useMobileBoardColors } from "./mobile-board-colors";
import { MobileColumnTaskCard } from "./mobile-column-task-card";

export interface MobileTaskColumnsProps {
  tasks: Task[];
  sections: BoardSection[];
  now: Date;
  hiddenSections: BoardSection[];
  selectionMode: boolean;
  selectedTaskIds: Set<string>;
  focused: boolean;
  compact: boolean;
  showCheckboxes: boolean;
  showMoveArrows: boolean;
  onToggleSelect: (id: string) => void;
  onShowSection: (section: BoardSection) => void;
  onTask: (task: Task) => void;
  onComplete: (id: string) => void;
  onLongPress: (task: Task) => void;
  onMove: (task: Task, sectionId: string | null) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onSectionMenu: (section: BoardSection) => void;
  onAddSection: () => void;
  onAddTask: (sectionId?: string | null) => void;
}

const UNSORTED = "__unsorted";

export function MobileTaskColumns(props: MobileTaskColumnsProps) {
  const c = useMobileBoardColors();
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  const carousel = useRef<ComponentRef<typeof ScrollView>>(null);
  const columnWidth = (props.compact ? 260 : 288) * zoom;
  const interval = columnWidth + 10;
  const columns = useMemo(() => {
    const visible = props.sections.filter((section) => !section.hidden);
    const hasUnsorted = props.tasks.some((task) => !getTaskSectionId(task, props.sections, props.now));
    return [...visible, ...(hasUnsorted || !visible.length ? [{ id: UNSORTED, title: "Unsorted" }] : [])];
  }, [props.tasks, props.sections, props.now]);
  const grouped = useMemo(() => {
    const buckets = new Map<string, Task[]>(columns.map((section) => [section.id, []]));
    for (const task of props.tasks) buckets.get(getTaskSectionId(task, props.sections, props.now) ?? UNSORTED)?.push(task);
    return buckets;
  }, [columns, props.tasks, props.sections, props.now]);
  const activeIndex = Math.max(0, columns.findIndex((section) => section.id === selectedId));
  const active = columns[activeIndex];
  const activeRef = useRef(activeIndex);
  const focusRef = useRef(props.focused);
  useEffect(() => { activeRef.current = activeIndex; }, [activeIndex]);
  useEffect(() => { focusRef.current = props.focused; }, [props.focused]);
  const columnIds = columns.map((column) => column.id).join("\0");
  useEffect(() => {
    if (!props.focused) carousel.current?.scrollTo({ x: activeRef.current * interval, animated: false });
  }, [props.focused, interval, columnIds]);

  const selectColumn = (index: number) => {
    setSelectedId(columns[index].id);
    if (!props.focused) carousel.current?.scrollTo({ x: index * interval, animated: false });
  };
  const move = (task: Task, index: number) => {
    const target = columns[index];
    props.onMove(task, target.id === UNSORTED ? null : target.id);
  };
  const cards = (section: { id: string; title: string }, index: number) => <>
    {(grouped.get(section.id) ?? []).map((task) => <MobileColumnTaskCard key={task.id} task={task} now={props.now} compact={props.compact} zoom={zoom} selected={props.selectedTaskIds.has(task.id)} selectionMode={props.selectionMode} showCheckbox={props.showCheckboxes} onPress={() => props.selectionMode ? props.onToggleSelect(task.id) : props.onTask(task)} onMenu={() => props.selectionMode ? props.onToggleSelect(task.id) : props.onLongPress(task)} onComplete={() => props.selectionMode ? props.onToggleSelect(task.id) : props.onComplete(task.id)} onMoveLeft={props.showMoveArrows && !props.selectionMode && index > 0 ? () => move(task, index - 1) : undefined} onMoveRight={props.showMoveArrows && !props.selectionMode && index < columns.length - 1 ? () => move(task, index + 1) : undefined} onToggleSubtask={(subtaskId) => props.onToggleSubtask(task.id, subtaskId)} />)}
    {!(grouped.get(section.id)?.length) ? <Text style={[styles.empty, { color: c.mutedForeground, borderColor: c.border }]}>No cards here yet</Text> : null}
  </>;
  const addCard = (section: { id: string; title: string }) => <Pressable accessibilityRole="button" accessibilityLabel={`Add card to ${section.title}`} onPress={() => props.onAddTask(section.id === UNSORTED ? null : section.id)} style={styles.add}><Ionicons name="add" size={18} color={c.mutedForeground} /><Text style={{ color: c.mutedForeground, fontSize: 13 }}>Add card</Text></Pressable>;
  const heading = (section: { id: string; title: string }) => <View style={styles.heading}>
    <View style={styles.columnTools}>
      <Text numberOfLines={1} style={[styles.columnTitle, { color: c.foreground, fontSize: 14 * zoom }]}>{section.title}</Text>
      <Text style={[styles.count, { color: c.mutedForeground, borderColor: c.border, backgroundColor: c.card }]}>{grouped.get(section.id)?.length ?? 0}</Text>
      {section.id !== UNSORTED ? <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${section.title}`} onPress={() => props.onSectionMenu(section as BoardSection)} style={styles.icon}><Ionicons name="ellipsis-horizontal" size={16} color={c.mutedForeground} /></Pressable> : null}
    </View>
    <View style={{ height: 2, backgroundColor: c.borderStrong, borderRadius: 1 }} />
  </View>;

  return <View style={styles.root}>
    {props.hiddenSections.length ? <ScrollView horizontal style={styles.hiddenRail} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hiddenContent}>{props.hiddenSections.map((section) => <Pressable key={section.id} accessibilityRole="button" accessibilityLabel={`Show ${section.title}`} onPress={() => props.onShowSection(section)} style={[styles.hiddenChip, { borderColor: c.border, backgroundColor: c.card }]}><Ionicons name="eye-outline" size={13} color={c.primary} /><Text style={{ color: c.mutedForeground, fontSize: 11 }}>{section.title}</Text></Pressable>)}</ScrollView> : null}
    {props.focused ? <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRail} contentContainerStyle={styles.tabs}>{columns.map((section, index) => <Pressable key={section.id} accessibilityRole="tab" accessibilityLabel={`${section.title}, ${grouped.get(section.id)?.length ?? 0} cards`} aria-selected={index === activeIndex} onPress={() => selectColumn(index)} style={[styles.tab, { backgroundColor: index === activeIndex ? c.primarySoft : c.backgroundAlt, borderColor: c.border }]}><Text style={{ color: index === activeIndex ? c.primary : c.mutedForeground, fontSize: 12 }}>{section.title}</Text></Pressable>)}</ScrollView>
      <View style={[styles.focusColumn, { backgroundColor: c.backgroundAlt, borderColor: c.border }]}>{heading(active)}<ScrollView testID="kanban-focused-scroll" style={styles.cardScroll} contentContainerStyle={styles.cards} keyboardShouldPersistTaps="handled">{cards(active, activeIndex)}</ScrollView>{addCard(active)}</View>
    </> : <ScrollView ref={carousel} testID="kanban-carousel" horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={32} onScroll={(event) => {
      if (focusRef.current) return;
      const index = Math.min(columns.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / interval)));
      if (columns[index]) setSelectedId(columns[index].id);
    }} style={styles.carousel} contentContainerStyle={styles.columns}>
      {columns.map((section, index) => <View key={section.id} testID={`kanban-column-${section.id}`} style={[styles.column, { width: columnWidth, backgroundColor: c.backgroundAlt, borderColor: c.border }]}>{heading(section)}<ScrollView testID={`kanban-column-scroll-${section.id}`} nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.cardScroll} contentContainerStyle={styles.cards}>{cards(section, index)}</ScrollView>{addCard(section)}</View>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Add section" onPress={props.onAddSection} style={[styles.addSection, { width: columnWidth, borderColor: c.border }]}><Ionicons name="add" size={20} color={c.mutedForeground} /><Text style={{ color: c.mutedForeground }}>Add section</Text></Pressable>
    </ScrollView>}
    <View style={[styles.zoom, { borderColor: c.border, backgroundColor: c.card }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" disabled={zoom <= 0.7} onPress={() => setZoom((value) => Math.max(0.7, Math.round((value - 0.1) * 10) / 10))} style={styles.zoomButton}><Ionicons name="remove" size={16} color={c.mutedForeground} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset board zoom" onPress={() => setZoom(1)} style={styles.zoomButton}><Text style={{ color: c.mutedForeground, fontSize: 11 }}>{Math.round(zoom * 100)}%</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" disabled={zoom >= 1.3} onPress={() => setZoom((value) => Math.min(1.3, Math.round((value + 0.1) * 10) / 10))} style={styles.zoomButton}><Ionicons name="add" size={16} color={c.mutedForeground} /></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 }, carousel: { flex: 1, minHeight: 0 }, columns: { padding: 10, paddingBottom: 68, gap: 10, alignItems: "flex-start" },
  column: { maxHeight: "100%", minHeight: 220, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingTop: 5 }, heading: { gap: 5, marginBottom: 8, paddingHorizontal: 2 }, columnTools: { flexDirection: "row", alignItems: "center" }, icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, count: { fontSize: 11, borderWidth: 1, borderRadius: 10, paddingHorizontal: 5, marginRight: 5 }, columnTitle: { flex: 1, minWidth: 0, fontWeight: "600", paddingHorizontal: 1 },
  cardScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 }, cards: { gap: 8, paddingHorizontal: 1, paddingBottom: 4 }, add: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 7 }, empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 8, paddingVertical: 25, paddingHorizontal: 12, textAlign: "center", fontSize: 12 },
  addSection: { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, minHeight: 110, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, zoom: { position: "absolute", bottom: 9, right: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 3 }, zoomButton: { minWidth: 44, height: 44, alignItems: "center", justifyContent: "center" },
  hiddenRail: { flexGrow: 0, maxHeight: 44 }, hiddenContent: { paddingHorizontal: 12, paddingVertical: 5, gap: 7 }, hiddenChip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32, paddingHorizontal: 9, borderWidth: 1, borderRadius: 8 }, tabsRail: { flexGrow: 0, maxHeight: 45 }, tabs: { gap: 5, padding: 8 }, tab: { minHeight: 30, justifyContent: "center", borderWidth: 1, borderRadius: 7, paddingHorizontal: 10 }, focusColumn: { flex: 1, minHeight: 0, margin: 10, marginBottom: 68, paddingHorizontal: 8, borderWidth: 1, borderRadius: 12 },
});
