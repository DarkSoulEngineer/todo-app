import { Ionicons } from "@expo/vector-icons";
import { format, isValid, parseISO } from "date-fns";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent, type ViewStyle } from "react-native";
import { useRef, useState, type MouseEvent } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { IconButton } from "@/components/janus-board-ui";
import { ScreenHeader } from "@/components/reference/mobile/reference-primitives";
import { Button } from "@/components/ui/button";
import { JanusLogo } from "@/components/ui/janus-logo";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileSearchField, MobileTopBarAction } from "@/components/ui/mobile-top-bar";
import { SectionHeading } from "@/components/ui/section-heading";
import { useTheme } from "@/providers/theme-provider";
import { getTaskMetrics, type TaskMetrics } from "@/lib/data/manager-state";
import type { JanusProject } from "@/lib/domain/projects";
import { mobileBottomNavClearance, mobileContentStyle } from "@/theme/layout";
import { getHomeLayout } from "@/lib/features/home-layout";
import { useBoardGridDrag } from "@/hooks/use-board-grid-drag";
import { BoardDragCell } from "./board-drag-cell";
import { BulkSelectionToolbar, type BulkSelectionToolbarProps } from "./bulk-selection-toolbar";

type BoardMenuEvent = { nativeEvent: { pageX: number; pageY: number } };

interface Props {
  projects: JanusProject[];
  statsProjects: JanusProject[];
  closedProjects: JanusProject[];
  totalBoards: number;
  metrics: TaskMetrics;
  pinnedIds: Set<string>;
  ready: boolean;
  loading: boolean;
  editing: boolean;
  query: string;
  now: number;
  onQuery: (query: string) => void;
  onEdit: (editing: boolean) => void;
  onCreate: () => void;
  onCommands?: () => void;
  onImport: () => void;
  onOpen: (id: string) => void;
  onReopen: (project: JanusProject) => void;
  onPin: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onReorder?: (id: string, targetId: string) => void;
  onMenu: (project: JanusProject, event?: BoardMenuEvent) => void;
  onRename?: (project: JanusProject) => void;
  onSave: (project: JanusProject) => void;
  onDuplicate: (project: JanusProject) => void;
  onRemove: (project: JanusProject) => void;
  selecting?: boolean;
  selectedIds?: Set<string>;
  onSelecting?: (selecting: boolean) => void;
  onToggleSelection?: (id: string) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onRemoveSelected?: () => void;
  boardSelectionActions?: BulkSelectionToolbarProps["boardActions"];
}

const serif = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" });

// Browser grid tracks keep the second board beside the first even when measured
// card widths briefly lag behind scrollbar, zoom, or viewport changes.
const webBoardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
} as unknown as ViewStyle;

export function BoardManagerContent(props: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const layout = getHomeLayout(width, insets.left, insets.right);
  const [showSearch, setShowSearch] = useState(false);
  const [boardPaneWidth, setBoardPaneWidth] = useState<number | null>(null);
  // The viewport includes space a scrollbar can take from the actual panel.
  // Round down so fractional CSS pixels cannot push the second card to a new row.
  const cardWidth = boardPaneWidth !== null ? Math.max(0, Math.floor((boardPaneWidth - (layout.columns - 1) * 16) / layout.columns)) : layout.cardWidth;
  const canDrag = layout.wide && props.editing && !props.selecting && props.ready && Boolean(props.onReorder);
  const gridDrag = useBoardGridDrag(canDrag, props.projects.map((project) => project.id), cardWidth, props.onReorder);
  const Content = layout.sidebar ? View : ScrollView;
  const Pane = layout.sidebar ? ScrollView : View;
  const contentStyle = [styles.content, layout.wide && styles.contentWide, { paddingLeft: layout.padding + insets.left, paddingRight: layout.padding + insets.right, paddingBottom: insets.bottom + mobileBottomNavClearance }];
  return <>
    <ScreenHeader
      title="Janus"
      leading={<JanusLogo size={44} />}
      onSearch={() => setShowSearch(prev => !prev)}
      searchActive={showSearch}
      showThemeToggle={false}
      actions={<>
        {props.onCommands ? <MobileTopBarAction icon="reader-outline" label="Commands" onPress={props.onCommands} /> : null}
        <MobileTopBarAction icon="download-outline" label="Import board" onPress={props.onImport} />
        <MobileTopBarAction icon="add" label="New board" onPress={props.onCreate} style={[styles.newBoardButton, { backgroundColor: c.card, borderColor: c.border }]} />
      </>}
      search={showSearch ? <MobileSearchField autoFocus value={props.query} onChangeText={props.onQuery} placeholder="Search boards" accessibilityLabel="Search boards" /> : null}
    />
    <Content testID="home-content" {...(layout.sidebar ? { style: [contentStyle, styles.desktopViewport] } : { scrollEnabled: !gridDrag.drag, showsVerticalScrollIndicator: false, keyboardShouldPersistTaps: "handled" as const, contentContainerStyle: contentStyle })}>
      <View testID="home-dashboard" style={layout.sidebar ? styles.dashboardWide : undefined}>
      <Pane testID="home-boards-scroll" style={layout.sidebar ? styles.boardsScroll : undefined} {...(layout.sidebar ? { scrollEnabled: !gridDrag.drag, showsVerticalScrollIndicator: true, keyboardShouldPersistTaps: "handled" as const, contentContainerStyle: styles.paneContent } : {})}>
      <View testID="home-boards-pane" onLayout={(event) => {
        const measured = event.nativeEvent.layout.width;
        if (Number.isFinite(measured) && measured > 0) setBoardPaneWidth(measured);
      }} style={layout.sidebar ? styles.boardsPane : undefined}>
      <SectionHeading
        title="Your boards"
        subtitle={`${props.totalBoards} active`}
        style={styles.firstSectionHeading}
        right={<View style={styles.headingActions}>{props.onSelecting ? <Button variant="outline" label={props.selecting ? "Done" : "Select"} accessibilityLabel={props.selecting ? "Finish selecting boards" : "Select boards"} onPress={() => props.onSelecting?.(!props.selecting)} disabled={!props.ready || props.editing} style={[styles.arrange, styles.selectButton]}>
          <Ionicons name={props.selecting ? "checkmark" : "checkbox-outline"} size={18} color={c.mutedForeground} />
          <Text style={{ color: c.secondaryForeground, fontSize: 12 }}>{props.selecting ? "Done" : "Select"}</Text>
        </Button> : null}<Button variant="outline" label={props.editing ? "Done" : "Rearrange"} onPress={() => props.onEdit(!props.editing)} disabled={props.selecting || !props.ready || (!props.editing && props.totalBoards < 2)} style={styles.arrange}>
          <Ionicons name={props.editing ? "checkmark" : "reorder-three-outline"} size={18} color={c.mutedForeground} />
          <Text style={{ color: c.secondaryForeground, fontSize: 12 }}>{props.editing ? "Done" : "Rearrange"}</Text>
        </Button></View>}
      />
      {props.selecting ? <View testID="home-board-selection" style={[styles.selectionToolbar, { backgroundColor: c.card, borderColor: c.border }]}>
        <BulkSelectionToolbar entity="board" selectedCount={props.selectedIds?.size ?? 0} allSelected={props.projects.length + props.closedProjects.length > 0 && [...props.projects, ...props.closedProjects].every((project) => props.selectedIds?.has(project.id))} onSelectAll={props.onSelectAll} onClear={props.onClearSelection} onDelete={props.onRemoveSelected} boardActions={props.boardSelectionActions} disabled={!props.ready} selectAllDisabled={props.projects.length + props.closedProjects.length === 0} />
      </View> : null}
      {props.editing ? <Text style={[styles.editHint, { color: c.primary }]}>{canDrag ? "Drag from anywhere on a card to another grid position, or use the arrows. Pinned boards stay first outside Rearrange." : "Use the arrows to arrange your boards."}</Text> : null}
      {props.loading ? <Text accessibilityLiveRegion="polite" style={[styles.editHint, { color: c.mutedForeground }]}>Loading your boards…</Text> : props.projects.length === 0 && props.closedProjects.length === 0 ? <EmptyState plain={Boolean(props.query)} icon="layers-outline" title={props.query ? "No matching boards" : "No boards yet"} message={props.query ? "Try another name or clear your search." : "Create a board to organize your tasks."} actionLabel={props.query ? "Clear search" : "Create board"} onAction={props.query ? () => props.onQuery("") : props.onCreate} /> : <View testID="home-board-grid" style={[styles.boards, layout.wide && styles.boardGrid, layout.wide && Platform.OS === "web" && webBoardGrid]}>{[...props.projects.map((project, index) => {
        const card = <ManagerCard selecting={props.selecting} selected={props.selectedIds?.has(project.id)} onToggleSelection={props.onToggleSelection ? () => props.onToggleSelection?.(project.id) : undefined} project={project} accent={c.success} metrics={getTaskMetrics(project.workspace.tasks, props.now)} pinned={props.pinnedIds.has(project.id)} editing={props.editing} hideMoveArrows={Boolean(gridDrag.drag)} ready={props.ready} first={index === 0} last={index === props.projects.length - 1} onOpen={() => props.onOpen(project.id)} onReopen={() => props.onReopen(project)} onPin={() => props.onPin(project.id)} onMove={(direction) => props.onMove(project.id, direction)} onMenu={(event) => props.onMenu(project, event)} onRename={props.onRename ? () => props.onRename?.(project) : undefined} onSave={() => props.onSave(project)} onDuplicate={() => props.onDuplicate(project)} onRemove={() => props.onRemove(project)} />;
        return layout.wide ? <BoardDragCell key={project.id} id={project.id} name={project.name} width={cardWidth} enabled={canDrag}
          active={gridDrag.drag?.id === project.id} target={gridDrag.drag?.target === project.id}
          onRegister={gridDrag.register} onStart={gridDrag.start} onMove={gridDrag.move} onDrop={gridDrag.drop} onCancel={gridDrag.cancel}>{card}</BoardDragCell>
          : <View key={project.id}>{card}</View>;
       }), !props.editing && !props.selecting ? <Pressable key="create-board-placeholder" testID="home-add-board-card" accessibilityRole="button" accessibilityLabel="Add new board" accessibilityState={{ disabled: !props.ready }} disabled={!props.ready} onPress={props.onCreate}
        style={({ pressed }) => [styles.addBoardCard, layout.wide && { width: cardWidth }, { borderColor: c.borderStrong, backgroundColor: pressed ? c.primarySoft : "transparent", opacity: props.ready ? 1 : 0.5 }]}>
        <Text style={{ color: c.mutedForeground, fontSize: 15, fontWeight: "500" }}>Add new board</Text>
      </Pressable> : null]}</View>}
      {props.closedProjects.length ? <>
        <SectionHeading title="Closed boards" subtitle={`${props.closedProjects.length} closed`} style={styles.sectionHeading} />
        <Text style={[styles.editHint, { color: c.mutedForeground }]}>Closed boards stay safe with their tasks. Reopen one to keep working on it.</Text>
        <View testID="home-closed-board-grid" style={[styles.boards, layout.wide && styles.boardGrid, layout.wide && Platform.OS === "web" && webBoardGrid]}>{props.closedProjects.map((project) => <View key={project.id} style={layout.wide ? { width: cardWidth, maxWidth: "100%" } : undefined}><ManagerCard selecting={props.selecting} selected={props.selectedIds?.has(project.id)} onToggleSelection={props.onToggleSelection ? () => props.onToggleSelection?.(project.id) : undefined} project={project} accent={c.mutedForeground} metrics={getTaskMetrics(project.workspace.tasks, props.now)} pinned={false} editing={false} ready={props.ready} first={false} last={false} closed onOpen={() => props.onOpen(project.id)} onReopen={() => props.onReopen(project)} onPin={() => undefined} onMove={() => undefined} onMenu={(event) => props.onMenu(project, event)} onRename={props.onRename ? () => props.onRename?.(project) : undefined} onSave={() => props.onSave(project)} onDuplicate={() => props.onDuplicate(project)} onRemove={() => props.onRemove(project)} /></View>)}</View>
      </> : null}
      </View>
      </Pane>
      <Pane testID="home-stats-panel" style={layout.sidebar ? { width: layout.statsWidth, flexGrow: 0, flexShrink: 0, minHeight: 0 } : undefined} {...(layout.sidebar ? { showsVerticalScrollIndicator: true, keyboardShouldPersistTaps: "handled" as const, contentContainerStyle: styles.paneContent } : {})}>
        <WorkspaceOverview metrics={props.metrics} boards={props.totalBoards} projects={props.statsProjects} now={props.now} wide={layout.wide} sidebar={layout.sidebar} chartSize={layout.statsChartSize} />
      </Pane>
      </View>
    </Content>
  </>;
}

function ManagerCard({ project, accent, metrics, pinned, editing, hideMoveArrows = false, ready, first, last, closed = false, selecting = false, selected = false, onToggleSelection, onOpen, onReopen, onPin, onMove, onMenu, onRename, onSave, onDuplicate, onRemove }: { project: JanusProject; accent: string; metrics: TaskMetrics; pinned: boolean; editing: boolean; hideMoveArrows?: boolean; ready: boolean; first: boolean; last: boolean; closed?: boolean; selecting?: boolean; selected?: boolean; onToggleSelection?: () => void; onOpen: () => void; onReopen: () => void; onPin: () => void; onMove: (direction: -1 | 1) => void; onMenu: (event?: BoardMenuEvent) => void; onRename?: () => void; onSave: () => void; onDuplicate: () => void; onRemove: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width } = useWindowDimensions();
  const lastNamePress = useRef<number | null>(null);
  const canRenameName = Boolean(onRename) && (Platform.OS === "web" || width >= 768);
  const pressName = (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!ready || editing) return;
    if (selecting) { onToggleSelection?.(); return; }
    if (!canRenameName) { onOpen(); return; }
    // Keyboard activation is immediate; pointer users double-click/double-tap.
    const detail = (event.nativeEvent as typeof event.nativeEvent & { detail?: number }).detail;
    const now = Date.now();
    if ((Platform.OS === "web" && detail === 0) || (lastNamePress.current !== null && now - lastNamePress.current <= 350)) {
      lastNamePress.current = null;
      onRename?.();
    } else lastNamePress.current = now;
  };
  const webContextMenu = Platform.OS === "web" ? { onContextMenu: (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    lastNamePress.current = null;
    if (ready && !editing && !selecting) onMenu(event);
  } } : {};
  const date = parseISO(project.createdAt);
  return <View {...webContextMenu} testID={`manager-board-${project.id}`} style={[styles.board, { flexGrow: 1, backgroundColor: selected ? c.primarySoft : c.card, borderColor: selected ? c.primary : c.border }]}>
    {/* A sibling hit surface opens every non-control area without nesting buttons. */}
    <Pressable accessibilityRole="button" accessibilityLabel={selecting ? `Toggle selection for ${project.name}` : closed ? `${project.name}, closed board` : `Open ${project.name}`} accessibilityHint={selecting ? "Selects or deselects this board without opening it" : closed ? "Shows options to reopen this board" : "Opens board view"} disabled={editing || !ready} onPress={selecting ? onToggleSelection : onOpen} onLongPress={selecting ? onToggleSelection : onMenu} style={({ pressed }) => [StyleSheet.absoluteFill, { borderRadius: 20, backgroundColor: pressed ? c.primarySoft : "transparent" }]} />
    <View pointerEvents="box-none" style={styles.cardHeader}>
      <View pointerEvents="box-none" style={styles.cardTitleArea}><Pressable testID={`board-name-${project.id}`} accessibilityRole="button" accessibilityLabel={selecting ? `Toggle selection for ${project.name}` : canRenameName ? `Rename ${project.name}` : `Open ${project.name}`} accessibilityHint={selecting ? "Selects or deselects this board" : canRenameName ? "Double-click or double-tap to rename. Long-press for board actions." : "Opens board view"} disabled={!ready || editing} onPress={pressName} onLongPress={(event) => { lastNamePress.current = null; if (selecting) onToggleSelection?.(); else onMenu(event); }}><Text style={[styles.boardTitle, { color: c.foreground }]} numberOfLines={2}>{project.name}</Text></Pressable>{closed ? <View pointerEvents="none" style={[styles.closedBadge, { backgroundColor: c.secondary, borderColor: c.border }]}><Ionicons name="lock-closed" size={10} color={c.mutedForeground} /><Text style={{ color: c.mutedForeground, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>CLOSED</Text></View> : null}{isValid(date) ? <Text pointerEvents="none" style={[styles.created, { color: c.mutedForeground }]}>Created {format(date, "dd MMM yyyy")}</Text> : null}</View>
      <View pointerEvents="box-none" style={styles.headerActions}>
        {selecting && !editing && onToggleSelection ? <Pressable accessibilityRole="checkbox" accessibilityLabel={`Select ${project.name}`} accessibilityState={{ checked: selected, disabled: !ready }} disabled={!ready} onPress={onToggleSelection} style={styles.reorderButton}><Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? c.primary : c.mutedForeground} /></Pressable> : null}
      {!closed && !selecting ? <>
        {editing ? <View testID={`board-move-arrows-${project.id}`} pointerEvents={hideMoveArrows ? "none" : "box-none"} accessibilityElementsHidden={hideMoveArrows} importantForAccessibility={hideMoveArrows ? "no-hide-descendants" : "auto"} style={[styles.moveArrows, { opacity: hideMoveArrows ? 0 : 1 }]}>
          <BoardMoveButton direction="up" boardName={project.name} disabled={first || !ready} onPress={() => onMove(-1)} />
          <BoardMoveButton direction="down" boardName={project.name} disabled={last || !ready} onPress={() => onMove(1)} />
        </View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`${pinned ? "Unpin" : "Pin"} ${project.name}`} accessibilityState={{ selected: pinned, disabled: !ready }} disabled={!ready} onPress={onPin} style={styles.reorderButton}><Ionicons name={pinned ? "star" : "star-outline"} size={21} color={pinned ? c.primary : c.borderStrong} /></Pressable>
      </> : null}</View>
    </View>
    <View pointerEvents="none" style={styles.progressArea}>
      <View style={styles.progressMeta}><View style={styles.inline}><Ionicons name="ellipse-outline" size={11} color={c.mutedForeground} /><Text style={{ color: c.secondaryForeground, fontSize: 13 }}>{metrics.open} open</Text></View><View style={styles.inline}><Ionicons name="checkmark" size={17} color={accent} /><Text style={{ color: accent, fontSize: 13 }}>{metrics.done} done</Text></View><Text style={[styles.percent, { color: c.mutedForeground }]}>{metrics.completionPercent}%</Text></View>
      <View style={[styles.track, { backgroundColor: c.secondary }]}><View style={{ height: "100%", width: `${metrics.completionPercent}%`, backgroundColor: accent, borderRadius: 5 }} /></View>
    </View>
    <View pointerEvents="none" style={styles.signals}><View style={styles.inline}><Ionicons name="warning-outline" size={14} color={c.destructive} /><Text style={{ color: c.destructive, fontSize: 12 }}>{metrics.overdue} overdue</Text></View><View style={styles.inline}><Ionicons name="time-outline" size={14} color={c.info} /><Text style={{ color: c.info, fontSize: 12 }}>{metrics.dueSoon} due soon</Text></View></View>
    {!selecting ? <View pointerEvents="box-none" style={[styles.cardFooter, { borderColor: c.border }]}>{closed ? <><CardAction icon="refresh-outline" label="Reopen" onPress={onReopen} /><View pointerEvents="none" style={{ flex: 1 }} /><CardAction label="Remove" onPress={onRemove} destructive disabled={!ready} /><IconButton icon="ellipsis-horizontal" label={`Actions for ${project.name}`} onPress={onMenu} size={44} /></> : <><CardAction icon="download-outline" label="Save" onPress={onSave} /><CardAction icon="copy-outline" label="Duplicate" onPress={onDuplicate} /><View pointerEvents="none" style={{ flex: 1 }} /><CardAction label="Remove" onPress={onRemove} destructive disabled={!ready} /><IconButton icon="ellipsis-horizontal" label={`Actions for ${project.name}`} onPress={onMenu} size={44} /></>}</View> : null}
  </View>;
}

function BoardMoveButton({ direction, boardName, disabled, onPress }: { direction: "up" | "down"; boardName: string; disabled: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Move ${boardName} ${direction}`}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.reorderButton, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}
  >
    <Ionicons name={direction === "up" ? "arrow-up" : "arrow-down"} size={22} color={disabled ? c.mutedForeground : c.primary} />
  </Pressable>;
}

function CardAction({ icon, label, onPress, destructive, disabled }: { icon?: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; destructive?: boolean; disabled?: boolean }) {
  const { theme } = useTheme();
  const color = destructive ? theme.colors.destructive : theme.colors.mutedForeground;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.cardAction, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}>{icon ? <Ionicons name={icon} size={15} color={color} /> : null}<Text style={{ color, fontSize: 12, fontWeight: "500" }}>{label}</Text></Pressable>;
}

function WorkspaceOverview({ metrics, boards, projects = [], now, wide = false, sidebar = false, chartSize = 240 }: { metrics: TaskMetrics; boards: number; projects?: JanusProject[]; now?: number; wide?: boolean; sidebar?: boolean; chartSize?: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  // Overdue is a subset of open tasks: do not count it twice in the donut.
  const slices = [{ label: "Completed", value: metrics.done, color: c.success }, { label: "Overdue", value: metrics.overdue, color: c.destructive }, { label: "Open (not overdue)", value: metrics.open - metrics.overdue, color: c.info }, { label: "Canceled", value: metrics.canceled, color: theme.scheme === "dark" ? "#9CA3AF" : "#6B7280" }];
  const circumference = 2 * Math.PI * 48;
  const strokeWidth = 11;
  const segmentCount = slices.filter((slice) => slice.value > 0).length;
  let offset = 0;
  return <View style={[styles.overviewSection, sidebar && styles.overviewSidebar]}>
    <SectionHeading title="Board stats" subtitle="Across open boards · includes canceled tasks" style={styles.overviewHeading} />
    <View testID="home-stats-surface" style={[styles.overview, sidebar && styles.overviewCardSidebar]}>
      <View testID="home-stats-layout" style={[styles.statsContent, wide && !sidebar && styles.statsContentWide]}>
      <View accessible accessibilityLabel={`${metrics.total} tasks: ${metrics.done} completed, ${metrics.overdue} overdue, ${metrics.open - metrics.overdue} open and not overdue, ${metrics.canceled} canceled`} style={[styles.donut, wide && styles.donutWide, sidebar && [styles.donutSidebar, { width: chartSize, maxWidth: chartSize }]]}>
        <Svg width="100%" height="100%" viewBox="0 0 120 120">
          <Circle cx={60} cy={60} r={48} fill="none" stroke={c.border} strokeWidth={strokeWidth} />
          {slices.map((slice) => {
            const length = metrics.total ? slice.value / metrics.total * circumference : 0;
            const start = offset;
            offset += length;
            // Caps stay inside each task share; tiny shares retain their exact length.
            const rounded = segmentCount > 1 && length > strokeWidth + 2;
            const trim = rounded ? strokeWidth / 2 + 1 : 0;
            return length > 0 ? <Circle key={slice.label} cx={60} cy={60} r={48} fill="none" stroke={slice.color} strokeWidth={strokeWidth} strokeDasharray={`${length - trim * 2} ${circumference}`} strokeDashoffset={-(start + trim)} strokeLinecap={rounded ? "round" : "butt"} transform="rotate(-90 60 60)" /> : null;
          })}
        </Svg>
        <View style={styles.donutLabel}><Text style={[styles.donutValue, { color: c.foreground }]}>{metrics.total}</Text><Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: 5 }}>TASKS</Text></View>
      </View>
      {sidebar ? <Text style={[styles.statsBoardCount, { color: c.mutedForeground }]}>Across {boards} {boards === 1 ? "board" : "boards"}</Text> : <View style={[styles.statsTotal, wide && styles.statsTotalWide]}><View style={{ flexShrink: 1 }}><Text style={[styles.totalLabel, { color: c.mutedForeground }]}>TOTAL TASKS</Text><Text style={[styles.totalValue, { color: c.foreground, fontFamily: serif }]}>{metrics.total}</Text></View><Text style={[styles.boardCount, wide && styles.boardCountWide, { color: c.mutedForeground }]}>across {boards} {boards === 1 ? "board" : "boards"}</Text></View>}
        <View style={[styles.legend, { borderColor: c.border }, wide && !sidebar && styles.legendWide, sidebar && styles.legendSidebar]}>{slices.map((slice) => {
          const share = metrics.total ? Math.max(0, Math.min(1, slice.value / metrics.total)) : 0;
          const percent = Math.round(share * 100);
          return <View key={slice.label} accessible accessibilityRole="progressbar" accessibilityLabel={slice.label} accessibilityValue={{ min: 0, max: 100, now: percent, text: `${slice.value} tasks, ${percent}%` }} style={styles.legendRow}>
            <View style={styles.legendMeta}>
              <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
              <Text style={[styles.legendLabel, { color: c.secondaryForeground }]}>{slice.label}</Text>
              <Text style={[styles.legendValue, { color: slice.color }]}>{slice.value}</Text>
              <Text style={[styles.legendPercent, { color: slice.color }]}>{percent}%</Text>
            </View>
            <View style={[styles.legendTrack, { backgroundColor: `${slice.color}18` }]}>
              <View style={[styles.legendFill, { width: `${share * 100}%`, backgroundColor: slice.color }]} />
            </View>
          </View>;
        })}</View>
      </View>
      <View testID="home-board-comparison" style={[styles.comparison, { borderColor: c.border }]}>
        <SectionHeading title="Board progress" subtitle="Completed tasks / total tasks" style={styles.comparisonHeading} />
        <View testID="home-board-progress-list" accessibilityLabel="Board progress" style={styles.comparisonList}>
        {projects.length ? projects.map((project) => {
          const boardMetrics = getTaskMetrics(project.workspace.tasks, now);
          const values = [boardMetrics.done, boardMetrics.overdue, boardMetrics.open - boardMetrics.overdue, boardMetrics.canceled];
          return <View key={project.id} testID={`board-progress-${project.id}`} accessible accessibilityLabel={`${project.name}: ${boardMetrics.done} of ${boardMetrics.total} tasks completed, ${boardMetrics.completionPercent}%, ${boardMetrics.overdue} overdue`} style={styles.comparisonRow}>
            <View style={styles.legendMeta}>
              <Text numberOfLines={1} style={[styles.legendLabel, { color: c.secondaryForeground }]}>{project.name}</Text>
              <Text style={[styles.comparisonCount, { color: c.mutedForeground }]}>{boardMetrics.done} / {boardMetrics.total}</Text>
              <Text style={[styles.legendPercent, { color: c.success }]}>{boardMetrics.completionPercent}%</Text>
            </View>
            <View style={[styles.comparisonTrack, { backgroundColor: c.border }]}>
              {values.map((value, index) => <View key={slices[index].label} style={{ height: "100%", width: `${boardMetrics.total ? value / boardMetrics.total * 100 : 0}%`, backgroundColor: slices[index].color }} />)}
            </View>
          </View>;
        }) : <Text style={[styles.comparisonEmpty, { color: c.mutedForeground }]}>Create a board to start tracking progress.</Text>}
        </View>
        <Text style={[styles.comparisonNote, { color: c.mutedForeground }]}>Task status colors match the chart above.</Text>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  headingActions: { flexDirection: "row", gap: 6 },
  selectButton: { width: 88 },
  selectionToolbar: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 4, marginBottom: 12 },
  newBoardButton: { width: 44, height: 44, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  themeSwitch: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 2 }, themeButton: { width: 44, height: 44, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  content: mobileContentStyle,
   contentWide: { maxWidth: "100%", paddingTop: 24, flexGrow: 1 },
  desktopViewport: { flex: 1, minHeight: 0 },
  boardsScroll: { flex: 1, minWidth: 0, minHeight: 0 },
  paneContent: { paddingRight: 8, paddingBottom: 8 },
  boardGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" },
  addBoardCard: { maxWidth: "100%", minHeight: 220, borderWidth: 1, borderStyle: "dashed", borderRadius: 20, justifyContent: "center", alignItems: "center", padding: 20 },
   dashboardWide: { flexDirection: "row", alignItems: "stretch", gap: 24, flex: 1, minHeight: 0 },
  boardsPane: { minWidth: 0, width: "100%" },
   overviewSidebar: { marginTop: 0 },
  donutSidebar: { marginTop: 8, marginBottom: 20 },
   overviewCardSidebar: { paddingHorizontal: 0, paddingVertical: 8, gap: 28 },
  legendSidebar: { marginTop: 24, paddingTop: 24, gap: 20 },
  statsBoardCount: { fontSize: 13, textAlign: "center", marginBottom: 8 },
  arrange: { paddingHorizontal: 10, borderRadius: 13 },
  sectionHeading: { marginTop: 24, marginBottom: 10 }, firstSectionHeading: { marginBottom: 10 }, editHint: { fontSize: 12, marginBottom: 12 }, boards: { gap: 16 },
  board: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 17, paddingTop: 14, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }, cardHeader: { flexDirection: "row", alignItems: "flex-start" }, cardTitleArea: { flex: 1, paddingVertical: 4, minHeight: 44 }, boardTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.4 }, closedBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, height: 20, paddingHorizontal: 6, borderWidth: 1, borderRadius: 7 }, created: { fontSize: 12, marginTop: 4 }, pin: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10, marginTop: -5 },
  headerActions: { flexDirection: "row", alignItems: "center", marginTop: -5, marginRight: -10 },
  moveArrows: { flexDirection: "row" },
  reorderButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  progressArea: { paddingTop: 18, paddingBottom: 8 }, progressMeta: { flexDirection: "row", alignItems: "center", gap: 16 }, inline: { flexDirection: "row", alignItems: "center", gap: 5 }, percent: { marginLeft: "auto", fontSize: 12, fontWeight: "600" }, track: { height: 6, borderRadius: 5, marginTop: 8, overflow: "hidden" }, signals: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, minHeight: 47, paddingVertical: 9 },
  cardFooter: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, gap: 12, marginTop: "auto", paddingTop: 4, minHeight: 45 }, cardAction: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 },
  overviewSection: { marginTop: 34 },
  overviewHeading: { marginBottom: 12 },
  overview: { padding: 16 },
  statsContent: { paddingTop: 4 },
  statsContentWide: { flexDirection: "row", alignItems: "center", gap: 24 },
  donutWide: { width: 200, maxWidth: 200, marginBottom: 0 },
  statsTotalWide: { width: 100, padding: 0, flexDirection: "column", alignItems: "flex-start", gap: 8 },
  boardCountWide: { maxWidth: "100%", textAlign: "left", paddingBottom: 0 },
  legendWide: { flex: 1, minWidth: 0, marginTop: 0, paddingTop: 0, borderTopWidth: 0, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 24 },
  statsTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 16, padding: 14 },
  totalLabel: { fontSize: 11 },
  totalValue: { fontSize: 39, lineHeight: 44, marginTop: 4 },
  boardCount: { flexShrink: 1, maxWidth: "50%", textAlign: "right", fontSize: 12, lineHeight: 18, paddingBottom: 4 },
  donut: { width: "100%", maxWidth: 260, aspectRatio: 1, alignSelf: "center", marginBottom: 24 },
  donutLabel: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  donutValue: { fontSize: 38, fontWeight: "700", fontVariant: ["tabular-nums"] },
  legend: { gap: 16, alignSelf: "stretch", marginTop: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  legendRow: { gap: 8 },
  legendMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendTrack: { height: 9, borderRadius: 6, overflow: "hidden" },
  legendFill: { height: "100%", borderRadius: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19 },
  legendValue: { fontSize: 16, fontWeight: "700", textAlign: "right", fontVariant: ["tabular-nums"] },
   legendPercent: { width: 38, textAlign: "right", fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
   comparison: { marginTop: 24, paddingTop: 24, borderTopWidth: StyleSheet.hairlineWidth, gap: 18 },
   comparisonHeading: { marginBottom: 2 },
   comparisonRow: { gap: 10 },
    comparisonList: { gap: 18 },
   comparisonCount: { fontSize: 12, fontVariant: ["tabular-nums"] },
   comparisonTrack: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden" },
   comparisonEmpty: { fontSize: 13, lineHeight: 20 },
   comparisonNote: { fontSize: 11, lineHeight: 16 },
});
