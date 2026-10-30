import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type MouseEvent } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileBottomNavClearance } from "@/theme/layout";
import { anchorFromEvent, type MenuAnchor } from "@/components/ui/anchored-menu";
import { getTaskSectionId, getDisplaySections, isCustomSection, UNASSIGNED_SECTION_ID } from "@/lib/domain/sections";
import type { Board } from "@/lib/domain/boards";
import type { BoardSection, Task } from "@/lib/domain/types";
import { useMobileBoardColors } from "./mobile-board-colors";
import { MobileColumnTaskCard, taskCardBorderRadius } from "./mobile-column-task-card";
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
  onLongPress: (task: Task, event?: GestureResponderEvent) => void;
  onMove: (task: Task, sectionId: string | null) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onSectionMenu: (section: BoardSection, anchor?: MenuAnchor) => void;
  onRenameSection?: (section: BoardSection) => void;
  onAddSection: () => void;
  onAddTask: (sectionId?: string | null) => void;
  onTaskDrop: (taskId: string, sectionId: string | null, beforeTaskId: string | null) => void;
  onSectionDrop: (sectionId: string, targetId: string) => void;
}

export function MobileTaskColumns(props: MobileTaskColumnsProps) {
  const { onSectionMenu, onRenameSection } = props;
  const c = useMobileBoardColors();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardContentStyle = styles.cards;
  const columnContentStyle = [styles.columns, { paddingBottom: 12 + insets.bottom }];
  const holderContentStyle = [styles.columnContent, { paddingBottom: Math.max(0, mobileBottomNavClearance - 40) + insets.bottom }];
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
  const lastTitlePress = useRef<{ id: string; time: number } | null>(null);
  const columnWidth = (props.compact ? 260 : 288) * zoom;
  const interval = columnWidth + 10;
  const columns = useMemo(() => getDisplaySections(props.tasks, props.sections, props.now), [props.tasks, props.sections, props.now]);
  const grouped = useMemo(() => {
    const buckets = new Map<string, Task[]>(columns.map((section) => [section.id, []]));
    for (const task of props.tasks) {
      const sectionId = getTaskSectionId(task, props.sections, props.now) ?? UNASSIGNED_SECTION_ID;
      if (sectionId) buckets.get(sectionId)?.push(task);
    }
    return buckets;
  }, [columns, props.tasks, props.sections, props.now]);
  const dragColumns = columns.map((section) => ({ id: section.id, taskIds: (grouped.get(section.id) ?? []).map((task) => task.id) }));
  const drag = useJanusDrag(enabled, dragColumns, `${width}:${height}:${columnWidth}:${focused}:${props.compact}`, (source, target) => {
    if (target.kind === "section") props.onSectionDrop(source.slice("section:".length), target.sectionId);
    else props.onTaskDrop(source.slice("task:".length), target.sectionId === UNASSIGNED_SECTION_ID ? null : target.sectionId, target.beforeTaskId);
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
    props.onMove(task, target.id === UNASSIGNED_SECTION_ID ? null : target.id);
  };
  const cards = (section: { id: string; title: string }, index: number) => <>
    {(grouped.get(section.id) ?? []).map((task) => <JanusDragCell key={task.id} id={taskDragId(task.id)} name={task.title} width="100%" borderRadius={taskCardBorderRadius} enabled={enabled} active={drag.drag?.id === taskDragId(task.id)} target={false} floating previewLayer={previewLayer} onRegister={drag.register} onStart={dragStart} onMove={dragMove} onDrop={drag.drop} onCancel={drag.cancel}>
      {drag.drag?.target?.kind === "task" && drag.drag.target.beforeTaskId === task.id ? <View testID={`janus-insert-before-${task.id}`} pointerEvents="none" style={[styles.insertLine, { backgroundColor: c.primary }]} /> : null}
      <MobileColumnTaskCard task={task} board={task.category ? boardsById.get(task.category) : undefined} now={props.now} compact={props.compact} zoom={zoom} selected={props.selectedTaskIds.has(task.id)} selectionMode={props.selectionMode} hideMoveArrows={Boolean(drag.drag)} onPress={() => props.selectionMode ? props.onToggleSelect(task.id) : props.onTask(task)} onMenu={(event)=>props.selectionMode?props.onToggleSelect(task.id):props.onLongPress(task,event)} onSelect={() => props.onToggleSelect(task.id)} onMoveLeft={props.showMoveArrows && !props.selectionMode && index > 0 ? () => move(task, index - 1) : undefined} onMoveRight={props.showMoveArrows && !props.selectionMode && index < columns.length - 1 ? () => move(task, index + 1) : undefined} onToggleSubtask={(subtaskId) => props.onToggleSubtask(task.id, subtaskId)} />
    </JanusDragCell>)}
    {!(grouped.get(section.id)?.length) ? <Text style={[styles.empty, { color: c.mutedForeground, borderColor: c.border }]}>No cards here yet</Text> : null}
  </>;
  const addCard = (section: { id: string; title: string }) => <View testID={`janus-add-card-footer-${section.id}`}>
    {drag.drag?.target?.kind === "task" && drag.drag.target.sectionId === section.id && drag.drag.target.beforeTaskId === null ? <View testID={`janus-insert-end-${section.id}`} pointerEvents="none" style={[styles.insertLine, { backgroundColor: c.primary }]} /> : null}
    {grouped.get(section.id)?.length ? <Pressable accessibilityRole="button" accessibilityLabel={`Add card to ${section.title}`} onPress={() => props.onAddTask(section.id === UNASSIGNED_SECTION_ID ? null : section.id)} style={({ pressed }) => [styles.add, { borderColor: c.borderStrong, backgroundColor: pressed ? c.primarySoft : "transparent" }]}><Ionicons name="add" size={16} color={c.mutedForeground} /><Text style={{ color: c.mutedForeground, fontSize: 15, fontWeight: "500" }}>Add card</Text></Pressable> : null}
  </View>;
  const openSectionMenu = useCallback((section: BoardSection, event: { nativeEvent: { pageX: number; pageY: number } }) => {
    lastTitlePress.current = null;
    onSectionMenu(section, anchorFromEvent(event));
  }, [onSectionMenu]);
  const sectionContextMenu = (section: BoardSection) => Platform.OS === "web" && section.id !== UNASSIGNED_SECTION_ID ? { onContextMenu: (event: MouseEvent) => {
    // Cards have their own menu; do not replace it with the holder's menu.
    if (event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.drag) openSectionMenu(section, event);
  } } : {};
  const pressTitle = useCallback((section: BoardSection, event: GestureResponderEvent) => {
    event.stopPropagation();
    if (drag.drag) return;
    if (!onRenameSection || !isCustomSection(section) || (Platform.OS !== "web" && width < 768)) {
      openSectionMenu(section, event);
      return;
    }
    const now = Date.now();
    const detail = (event.nativeEvent as typeof event.nativeEvent & { detail?: number }).detail;
    if ((Platform.OS === "web" && detail === 0) || (lastTitlePress.current?.id === section.id && now - lastTitlePress.current.time <= 350)) {
      lastTitlePress.current = null;
      onRenameSection(section);
    } else lastTitlePress.current = { id: section.id, time: now };
  }, [drag.drag, openSectionMenu, onRenameSection, width]);
  const heading = (section: BoardSection) => section.id === UNASSIGNED_SECTION_ID ? <View testID="janus-unassigned-header" style={[styles.headerSurface, { backgroundColor: c.backgroundAlt, borderColor: c.border }]}><View style={styles.heading}><View style={styles.columnTools}><Text style={[styles.columnTitle, { color: c.mutedForeground, fontSize: 14 * zoom }]}>No list</Text><Pressable accessibilityRole="button" accessibilityLabel="Add unassigned card" onPress={() => props.onAddTask(null)} style={styles.icon}><Ionicons name="add" size={18} color={c.mutedForeground} /></Pressable></View><Text style={{ color: c.mutedForeground, fontSize: 11 }}>Choose or create a list to organize these cards.</Text></View></View> : <View {...sectionContextMenu(section)} testID={`janus-column-header-${section.id}`} style={[styles.headerSurface, { backgroundColor: c.backgroundAlt, borderColor: c.border }]}><View style={styles.heading}>
    <View style={styles.columnTools}>
      {enabled ? <Ionicons name="reorder-three-outline" size={18} color={c.mutedForeground} style={{ marginRight: 5 }} /> : null}
      <Pressable testID={`janus-column-name-${section.id}`} accessibilityRole="button" accessibilityLabel={`Actions for list ${section.title}`} accessibilityHint={isCustomSection(section) && props.onRenameSection && (Platform.OS === "web" || width >= 768) ? "Double-click or double-tap to rename. Long-press for list actions." : "Shows list actions"} onPress={(event) => pressTitle(section, event)} onLongPress={(event) => openSectionMenu(section, event)} style={styles.columnName}><Text numberOfLines={1} style={[styles.columnTitle, { flex: 0, color: c.foreground, fontSize: 14 * zoom }]}>{section.title}</Text></Pressable>
      <Pressable testID={`janus-add-card-header-${section.id}`} accessibilityRole="button" accessibilityLabel={`Add card to ${section.title}`} onPress={() => props.onAddTask(section.id)} style={styles.icon}><Ionicons name="add" size={18} color={c.mutedForeground} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${section.title}`} onPress={(event) => openSectionMenu(section, event)} style={styles.icon}><Ionicons name="ellipsis-horizontal" size={16} color={c.mutedForeground} /></Pressable>
    </View>
    <View style={{ height: 2, backgroundColor: c.borderStrong, borderRadius: 1 }} />
  </View></View>;
  // Build a visual-only native copy. Reusing the live section subtree would
  // register duplicate draggable cards and steal the real lists' scroll refs.
  const sectionPreview = (section: BoardSection, index: number) => <View style={styles.columnStack}>
    {heading(section)}
    <ScrollView scrollEnabled={false} contentOffset={{ x: 0, y: autoScroll.listOffset(section.id) }} style={styles.cardScroll} contentContainerStyle={holderContentStyle}>
    <View style={[styles.column, { backgroundColor: c.backgroundAlt, borderColor: c.border }]}>
    <View style={cardContentStyle}>
      {(grouped.get(section.id) ?? []).map((task) => <MobileColumnTaskCard key={task.id} task={task} board={task.category ? boardsById.get(task.category) : undefined} now={props.now} compact={props.compact} zoom={zoom} selected={props.selectedTaskIds.has(task.id)} selectionMode={false} onPress={() => {}} onMenu={() => {}} onSelect={() => {}} onToggleSubtask={() => {}} onMoveLeft={props.showMoveArrows && index > 0 ? () => {} : undefined} onMoveRight={props.showMoveArrows && index < columns.length - 1 ? () => {} : undefined} />)}
      {!(grouped.get(section.id)?.length) ? <Text style={[styles.empty, { color: c.mutedForeground, borderColor: c.border }]}>No cards here yet</Text> : null}
    </View>
    </View>{addCard(section)}
    </ScrollView>
  </View>;

  return <View ref={previewHost} collapsable={false} style={styles.root}>
    {focused && active ? <>
      <ScrollView ref={tabs} horizontal onContentSizeChange={scrollToNewColumn} showsHorizontalScrollIndicator={false} style={styles.tabsRail} contentContainerStyle={styles.tabs}>{columns.map((section, index) => <Pressable key={section.id} accessibilityRole="tab" accessibilityLabel={`${section.title}, ${grouped.get(section.id)?.length ?? 0} cards`} aria-selected={index === activeIndex} onPress={() => selectColumn(index)} style={[styles.tab, { backgroundColor: c.backgroundAlt, borderColor: index === activeIndex ? c.primary : c.border }]}><Text style={{ color: index === activeIndex ? c.primary : c.mutedForeground, fontSize: 12, fontWeight: index === activeIndex ? "600" : "400" }}>{section.title}</Text></Pressable>)}</ScrollView>
      <View {...sectionContextMenu(active)} style={[styles.columnStack, styles.focusColumn, { marginBottom: 12 + insets.bottom }]}>{heading(active)}<ScrollView testID="janus-focused-scroll" style={styles.cardScroll} contentContainerStyle={holderContentStyle} keyboardShouldPersistTaps="handled"><View style={[styles.column, { backgroundColor: c.backgroundAlt, borderColor: c.border }]}><View style={cardContentStyle}>{cards(active, activeIndex)}</View></View>{addCard(active)}</ScrollView></View>
    </> : <BoardDropZone id="viewport" register={drag.register} style={styles.root}><BoardColumnCarousel carouselRef={carousel} columns={columns} interval={interval} scrollEnabled={!drag.drag} onContentSizeChange={scrollToNewColumn} onScroll={(event) => {
      autoScroll.trackCarousel(event.nativeEvent.contentOffset.x);
      if (focusRef.current) return;
      const index = Math.min(columns.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / interval)));
      if (columns[index]) setSelectedId(columns[index].id);
    }} style={styles.carousel} contentContainerStyle={columnContentStyle}>
      {columns.map((section, index) => <JanusDragCell key={section.id} id={sectionDragId(section.id)} name={section.title} width={columnWidth} enabled={enabled && section.id !== UNASSIGNED_SECTION_ID} active={drag.drag?.id === sectionDragId(section.id)} target={drag.drag?.target?.kind === "section" && drag.drag.target.sectionId === section.id} floating constrainHeight handleHeight={60} renderPreview={() => sectionPreview(section, index)} previewLayer={previewLayer} onRegister={drag.register} onStart={dragStart} onMove={dragMove} onDrop={drag.drop} onCancel={drag.cancel}>
        <View {...sectionContextMenu(section)} testID={`janus-column-holder-${section.id}`} style={styles.columnStack}>{heading(section)}<ScrollView ref={(node) => autoScroll.registerList(section.id, node)} testID={`janus-column-scroll-${section.id}`} onScroll={(event) => autoScroll.trackList(section.id, event.nativeEvent.contentOffset.y)} scrollEventThrottle={16} scrollEnabled={!drag.drag} nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.cardScroll} contentContainerStyle={holderContentStyle}><View testID={`janus-column-${section.id}`} style={[styles.column, { backgroundColor: c.backgroundAlt, borderColor: drag.drag?.target?.kind === "task" && drag.drag.target.sectionId === section.id ? c.primary : c.border }]}><View style={cardContentStyle}>{cards(section, index)}</View></View>{addCard(section)}</ScrollView></View>
      </JanusDragCell>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Add list" onPress={props.onAddSection} style={[styles.addSection, { width: columnWidth, borderColor: c.border }]}><Ionicons name="add" size={20} color={c.mutedForeground} /><Text style={{ color: c.mutedForeground }}>Add list</Text></Pressable>
    </BoardColumnCarousel></BoardDropZone>}
    {previewOverlay}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 }, carousel: { flex: 1, minHeight: 0 }, columns: { padding: 10, gap: 10, alignItems: "flex-start" },
  columnStack: { flexShrink: 1, minHeight: 0, maxHeight: "100%" },
  columnContent: { gap: 8, paddingBottom: 4 },
  headerSurface: { flexShrink: 0, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingHorizontal: 8, paddingTop: 5 },
  column: { flexShrink: 0, minHeight: 0, borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 8, paddingBottom: 8 }, heading: { gap: 5, marginBottom: 8, paddingHorizontal: 2 }, columnTools: { flexDirection: "row", alignItems: "center" }, icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, columnTitle: { flex: 1, minWidth: 0, fontWeight: "600", paddingHorizontal: 1 },
  columnName: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center" },
  insertLine: { position: "absolute", top: -5, left: 0, right: 0, height: 3, borderRadius: 2, zIndex: 20 },
  // Keep trackpad overscroll from pulling the cards away from the fixed header.
  // Limit only the vertical axis so horizontal board navigation still works.
  cardScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0, ...(Platform.OS === "web" ? { overscrollBehaviorY: "none" as const } : {}) }, cards: { gap: 8, paddingHorizontal: 1, paddingBottom: 4 }, add: { minHeight: 110, borderWidth: 1, borderStyle: "dashed", borderRadius: 20, flexDirection: "row", gap: 6, justifyContent: "center", alignItems: "center", padding: 20 }, empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 8, paddingVertical: 25, paddingHorizontal: 12, textAlign: "center", fontSize: 12 },
  addSection: { alignSelf: "flex-start", borderWidth: 1, borderStyle: "dashed", borderRadius: 12, minHeight: 110, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  tabsRail: { flexGrow: 0, flexShrink: 0, height: 60 }, tabs: { gap: 5, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center" }, tab: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: 7, paddingHorizontal: 10 }, focusColumn: { marginHorizontal: 10, marginBottom: 10 },
});


