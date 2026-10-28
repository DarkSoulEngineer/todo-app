import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { getTaskSectionId } from "@/lib/domain/sections";
import type { Board } from "@/lib/domain/boards";
import type { BoardSection, Task } from "@/lib/domain/types";
import { useMobileBoardColors } from "./mobile-board-colors";
import { MobileColumnTaskCard } from "./mobile-column-task-card";
import { BoardColumnCarousel } from "./board-column-carousel";
import { JanusDragCell } from "./janus-drag-cell";
import { BoardDropZone } from "./board-drop-zone";
import { useNativeDragPreview } from "./use-native-drag-preview";
import { useJanusDrag } from "@/hooks/use-janus-drag";
import { useNativeJanusAutoScroll } from "@/hooks/use-native-janus-auto-scroll";
import { sectionDragId, taskDragId } from "@/lib/features/janus-drag";

export interface MobileTaskColumnsProps {
  tasks: Task[];
  sections: BoardSection[];
  boards: Board[];
  now: Date;
  selectionMode: boolean;
  selectedTaskIds: Set<string>;
  focused: boolean;
  compact: boolean;
  showMoveArrows: boolean;
  dragEnabled?: boolean;
  zoom: number;
  onToggleSelect: (id: string) => void;
  onTask: (task: Task) => void;
  onLongPress: (task: Task) => void;
  onMove: (task: Task, sectionId: string | null) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onSectionMenu: (section: BoardSection) => void;
  onAddSection: () => void;
  onAddTask: (sectionId?: string | null) => void;
  onTaskDrop: (taskId: string, sectionId: string, beforeTaskId: string | null) => void;
  onSectionDrop: (sectionId: string, targetId: string) => void;
}

export function MobileTaskColumns(props: MobileTaskColumnsProps) {
  const c = useMobileBoardColors();
  const { width, height } = useWindowDimensions();
  const focused = props.focused;
  const enabled = width >= 768 && (props.dragEnabled ?? true) && !props.selectionMode && !focused;
  const { host: previewHost, layer: previewLayer, overlay: previewOverlay } = useNativeDragPreview();
  const zoom = props.zoom;
  const boardsById = useMemo(() => new Map(props.boards.map((board) => [board.id, board])), [props.boards]);
  const [selectedId, setSelectedId] = useState<string>();
  const carousel = useRef<ComponentRef<typeof ScrollView>>(null);
  const tabs = useRef<ComponentRef<typeof ScrollView>>(null);
  const previousSectionIds = useRef(new Set(props.sections.map((section) => section.id)));
  const pendingScrollId = useRef<string | null>(null);
  const columnWidth = (props.compact ? 260 : 288) * zoom;
  const interval = columnWidth + 10;
  const columns = useMemo(() => props.sections.filter((section) => !section.hidden), [props.sections]);
  const grouped = useMemo(() => {
    const buckets = new Map<string, Task[]>(columns.map((section) => [section.id, []]));
    for (const task of props.tasks) {
      const sectionId = getTaskSectionId(task, props.sections, props.now);
      if (sectionId) buckets.get(sectionId)?.push(task);
    }
    return buckets;
  }, [columns, props.tasks, props.sections, props.now]);
  const dragColumns = columns.map((section) => ({ id: section.id, taskIds: (grouped.get(section.id) ?? []).map((task) => task.id) }));
  const drag = useJanusDrag(enabled, dragColumns, `${width}:${height}:${columnWidth}:${focused}:${props.compact}`, (source, target) => {
    if (target.kind === "section") props.onSectionDrop(source.slice("section:".length), target.sectionId);
    else props.onTaskDrop(source.slice("task:".length), target.sectionId, target.beforeTaskId);
  });
  const autoScroll = useNativeJanusAutoScroll(Boolean(drag.drag), carousel, drag.move);
  const dragStart = (id: string, pointer: { x: number; y: number }) => { autoScroll.trackPointer(pointer.x, pointer.y); drag.start(id, pointer); };
  const dragMove = (x: number, y: number) => { autoScroll.trackPointer(x, y); drag.move(x, y); };
  const activeIndex = Math.max(0, columns.findIndex((section) => section.id === selectedId));
  const active = columns[activeIndex];
  const activeRef = useRef(activeIndex);
  const focusRef = useRef(focused);
  useEffect(() => { activeRef.current = activeIndex; }, [activeIndex]);
  useEffect(() => { focusRef.current = focused; }, [focused]);
  const columnIds = columns.map((column) => column.id).join("\0");
  useEffect(() => {
    const added = props.sections.filter((section) => !section.hidden && !previousSectionIds.current.has(section.id)).at(-1);
    previousSectionIds.current = new Set(props.sections.map((section) => section.id));
    const index = added ? columnIds.split("\0").indexOf(added.id) : activeRef.current;
    if (added) {
      setSelectedId(added.id);
      activeRef.current = index;
      pendingScrollId.current = added.id;
      tabs.current?.scrollToEnd({ animated: false });
    }
    if (!focused) carousel.current?.scrollTo({ x: index * interval, animated: false });
  }, [focused, interval, columnIds, props.sections]);

  const scrollToNewColumn = () => {
    const index = columns.findIndex((column) => column.id === pendingScrollId.current);
    if (index < 0) return;
    carousel.current?.scrollTo({ x: index * interval, animated: false });
    tabs.current?.scrollToEnd({ animated: false });
    pendingScrollId.current = null;
  };

  const selectColumn = (index: number) => {
    pendingScrollId.current = null;
    setSelectedId(columns[index].id);
    if (!focused) carousel.current?.scrollTo({ x: index * interval, animated: false });
  };
  const move = (task: Task, index: number) => {
    const target = columns[index];
    props.onMove(task, target.id);
  };
  const cards = (section: { id: string; title: string }, index: number) => <>
    {(grouped.get(section.id) ?? []).map((task) => <JanusDragCell key={task.id} id={taskDragId(task.id)} name={task.title} width="100%" enabled={enabled} active={drag.drag?.id === taskDragId(task.id)} target={false} floating previewLayer={previewLayer} onRegister={drag.register} onStart={dragStart} onMove={dragMove} onDrop={drag.drop} onCancel={drag.cancel}>
      {drag.drag?.target?.kind === "task" && drag.drag.target.beforeTaskId === task.id ? <View testID={`janus-insert-before-${task.id}`} pointerEvents="none" style={[styles.insertLine, { backgroundColor: c.primary }]} /> : null}
      <MobileColumnTaskCard task={task} board={task.category ? boardsById.get(task.category) : undefined} now={props.now} compact={props.compact} zoom={zoom} selected={props.selectedTaskIds.has(task.id)} selectionMode={props.selectionMode} hideMoveArrows={Boolean(drag.drag)} onPress={() => props.selectionMode ? props.onToggleSelect(task.id) : props.onTask(task)} onMenu={() => props.selectionMode ? props.onToggleSelect(task.id) : props.onLongPress(task)} onSelect={() => props.onToggleSelect(task.id)} onMoveLeft={props.showMoveArrows && !props.selectionMode && index > 0 ? () => move(task, index - 1) : undefined} onMoveRight={props.showMoveArrows && !props.selectionMode && index < columns.length - 1 ? () => move(task, index + 1) : undefined} onToggleSubtask={(subtaskId) => props.onToggleSubtask(task.id, subtaskId)} />
    </JanusDragCell>)}
    {!(grouped.get(section.id)?.length) ? <Text style={[styles.empty, { color: c.mutedForeground, borderColor: c.border }]}>No cards here yet</Text> : null}
  </>;
  const addCard = (section: { id: string; title: string }) => <View>
    {drag.drag?.target?.kind === "task" && drag.drag.target.sectionId === section.id && drag.drag.target.beforeTaskId === null ? <View testID={`janus-insert-end-${section.id}`} pointerEvents="none" style={[styles.insertLine, { backgroundColor: c.primary }]} /> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={`Add card to ${section.title}`} onPress={() => props.onAddTask(section.id)} style={styles.add}><Ionicons name="add" size={18} color={c.mutedForeground} /><Text style={{ color: c.mutedForeground, fontSize: 13 }}>Add card</Text></Pressable>
  </View>;
  const heading = (section: { id: string; title: string }) => <View style={styles.heading}>
    <View style={styles.columnTools}>
      {enabled ? <Ionicons name="reorder-three-outline" size={18} color={c.mutedForeground} style={{ marginRight: 5 }} /> : null}
      <Text numberOfLines={1} style={[styles.columnTitle, { color: c.foreground, fontSize: 14 * zoom }]}>{section.title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${section.title}`} onPress={() => props.onSectionMenu(section as BoardSection)} style={styles.icon}><Ionicons name="ellipsis-horizontal" size={16} color={c.mutedForeground} /></Pressable>
    </View>
    <View style={{ height: 2, backgroundColor: c.borderStrong, borderRadius: 1 }} />
  </View>;
  // Build a visual-only native copy. Reusing the live section subtree would
  // register duplicate draggable cards and steal the real lists' scroll refs.
  const sectionPreview = (section: BoardSection, index: number) => <View style={[styles.column, { backgroundColor: c.backgroundAlt, borderColor: c.border }]}>
    {heading(section)}
    <ScrollView scrollEnabled={false} contentOffset={{ x: 0, y: autoScroll.listOffset(section.id) }} style={styles.cardScroll} contentContainerStyle={styles.cards}>
      {(grouped.get(section.id) ?? []).map((task) => <MobileColumnTaskCard key={task.id} task={task} board={task.category ? boardsById.get(task.category) : undefined} now={props.now} compact={props.compact} zoom={zoom} selected={props.selectedTaskIds.has(task.id)} selectionMode={false} onPress={() => {}} onMenu={() => {}} onSelect={() => {}} onToggleSubtask={() => {}} onMoveLeft={props.showMoveArrows && index > 0 ? () => {} : undefined} onMoveRight={props.showMoveArrows && index < columns.length - 1 ? () => {} : undefined} />)}
      {!(grouped.get(section.id)?.length) ? <Text style={[styles.empty, { color: c.mutedForeground, borderColor: c.border }]}>No cards here yet</Text> : null}
    </ScrollView>
    {addCard(section)}
  </View>;

  return <View ref={previewHost} collapsable={false} style={styles.root}>
    {focused && active ? <>
      <ScrollView ref={tabs} horizontal onContentSizeChange={scrollToNewColumn} showsHorizontalScrollIndicator={false} style={styles.tabsRail} contentContainerStyle={styles.tabs}>{columns.map((section, index) => <Pressable key={section.id} accessibilityRole="tab" accessibilityLabel={`${section.title}, ${grouped.get(section.id)?.length ?? 0} cards`} aria-selected={index === activeIndex} onPress={() => selectColumn(index)} style={[styles.tab, { backgroundColor: c.backgroundAlt, borderColor: index === activeIndex ? c.primary : c.border }]}><Text style={{ color: index === activeIndex ? c.primary : c.mutedForeground, fontSize: 12, fontWeight: index === activeIndex ? "600" : "400" }}>{section.title}</Text></Pressable>)}</ScrollView>
      <View style={[styles.focusColumn, { backgroundColor: c.backgroundAlt, borderColor: c.border }]}>{heading(active)}<ScrollView testID="janus-focused-scroll" style={styles.cardScroll} contentContainerStyle={styles.cards} keyboardShouldPersistTaps="handled">{cards(active, activeIndex)}</ScrollView>{addCard(active)}</View>
    </> : <BoardDropZone id="viewport" register={drag.register} style={styles.root}><BoardColumnCarousel carouselRef={carousel} columns={columns} interval={interval} scrollEnabled={!drag.drag} onContentSizeChange={scrollToNewColumn} onScroll={(event) => {
      autoScroll.trackCarousel(event.nativeEvent.contentOffset.x);
      if (focusRef.current) return;
      const index = Math.min(columns.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / interval)));
      if (columns[index]) setSelectedId(columns[index].id);
    }} style={styles.carousel} contentContainerStyle={styles.columns}>
      {columns.map((section, index) => <JanusDragCell key={section.id} id={sectionDragId(section.id)} name={section.title} width={columnWidth} enabled={enabled} active={drag.drag?.id === sectionDragId(section.id)} target={drag.drag?.target?.kind === "section" && drag.drag.target.sectionId === section.id} floating constrainHeight handleHeight={60} renderPreview={() => sectionPreview(section, index)} previewLayer={previewLayer} onRegister={drag.register} onStart={dragStart} onMove={dragMove} onDrop={drag.drop} onCancel={drag.cancel}>
        <View testID={`janus-column-${section.id}`} style={[styles.column, { backgroundColor: c.backgroundAlt, borderColor: drag.drag?.target?.kind === "task" && drag.drag.target.sectionId === section.id ? c.primary : c.border }]}>{heading(section)}<ScrollView ref={(node) => autoScroll.registerList(section.id, node)} testID={`janus-column-scroll-${section.id}`} onScroll={(event) => autoScroll.trackList(section.id, event.nativeEvent.contentOffset.y)} scrollEventThrottle={16} scrollEnabled={!drag.drag} nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.cardScroll} contentContainerStyle={styles.cards}>{cards(section, index)}</ScrollView>{addCard(section)}</View>
      </JanusDragCell>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Add list" onPress={props.onAddSection} style={[styles.addSection, { width: columnWidth, borderColor: c.border }]}><Ionicons name="add" size={20} color={c.mutedForeground} /><Text style={{ color: c.mutedForeground }}>Add list</Text></Pressable>
    </BoardColumnCarousel></BoardDropZone>}
    {previewOverlay}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 }, carousel: { flex: 1, minHeight: 0 }, columns: { padding: 10, gap: 10, alignItems: "flex-start" },
  column: { maxHeight: "100%", minHeight: 220, flexShrink: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingTop: 5, paddingBottom: 20 }, heading: { gap: 5, marginBottom: 8, paddingHorizontal: 2 }, columnTools: { flexDirection: "row", alignItems: "center" }, icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, columnTitle: { flex: 1, minWidth: 0, fontWeight: "600", paddingHorizontal: 1 },
  insertLine: { position: "absolute", top: -5, left: 0, right: 0, height: 3, borderRadius: 2, zIndex: 20 },
  cardScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 }, cards: { gap: 8, paddingHorizontal: 1, paddingBottom: 4 }, add: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 7 }, empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 8, paddingVertical: 25, paddingHorizontal: 12, textAlign: "center", fontSize: 12 },
  addSection: { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, minHeight: 110, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  tabsRail: { flexGrow: 0, maxHeight: 45 }, tabs: { gap: 5, padding: 8 }, tab: { minHeight: 30, justifyContent: "center", borderWidth: 1, borderRadius: 7, paddingHorizontal: 10 }, focusColumn: { flex: 1, minHeight: 0, margin: 10, paddingHorizontal: 8, borderWidth: 1, borderRadius: 12 },
});
