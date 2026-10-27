import { Ionicons } from "@expo/vector-icons";
import { format, isValid, parseISO } from "date-fns";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { IconButton } from "@/components/janus-board-ui";
import { ScreenHeader } from "@/components/reference/mobile/reference-primitives";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileSearchField, MobileTopBarAction } from "@/components/ui/mobile-top-bar";
import { SectionHeading } from "@/components/ui/section-heading";
import { useTheme } from "@/providers/theme-provider";
import { getTaskMetrics, type TaskMetrics } from "@/lib/data/manager-state";
import type { JanusProject } from "@/lib/domain/projects";
import { mobileBottomNavClearance, mobileContentStyle } from "@/theme/layout";

interface Props {
  projects: JanusProject[];
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
  onImport: () => void;
  onOpen: (id: string) => void;
  onReopen: (project: JanusProject) => void;
  onPin: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onMenu: (project: JanusProject) => void;
  onSave: (project: JanusProject) => void;
  onDuplicate: (project: JanusProject) => void;
  onRemove: (project: JanusProject) => void;
}

const serif = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" });

export function BoardManagerContent(props: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const [showSearch, setShowSearch] = useState(false);
  return <>
    <ScreenHeader
      title="Janus"
      subtitle="Focused task manager"
      onSearch={() => setShowSearch(prev => !prev)}
      searchActive={showSearch}
      showThemeToggle={false}
      actions={<>
        <MobileTopBarAction icon="download-outline" label="Import board" onPress={props.onImport} />
        <MobileTopBarAction icon="add" label="New board" onPress={props.onCreate} style={[styles.newBoardButton, { backgroundColor: c.card, borderColor: c.border }]} />
      </>}
      search={showSearch ? <MobileSearchField value={props.query} onChangeText={props.onQuery} placeholder="Search boards" accessibilityLabel="Search boards" /> : null}
    />
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + mobileBottomNavClearance }]}>
      <SectionHeading
        title="Your boards"
        subtitle={`${props.totalBoards} active`}
        style={styles.firstSectionHeading}
        right={<Button variant="outline" label={props.editing ? "Done" : "Rearrange"} onPress={() => props.onEdit(!props.editing)} disabled={!props.ready || (!props.editing && props.totalBoards < 2)} style={styles.arrange}>
          <Ionicons name={props.editing ? "checkmark" : "reorder-three-outline"} size={18} color={c.mutedForeground} />
          <Text style={{ color: c.secondaryForeground, fontSize: 12 }}>{props.editing ? "Done" : "Rearrange"}</Text>
        </Button>}
      />
      {props.editing ? <Text style={[styles.editHint, { color: c.primary }]}>Use the arrows to arrange your boards.</Text> : null}
      {props.loading ? <Text accessibilityLiveRegion="polite" style={[styles.editHint, { color: c.mutedForeground }]}>Loading your boards…</Text> : props.projects.length === 0 && props.closedProjects.length === 0 ? <EmptyState icon={props.query ? "search-outline" : "layers-outline"} title={props.query ? "No matching boards" : "No boards yet"} message={props.query ? "Try another name or clear your search." : "Create a board to organize your tasks."} actionLabel={props.query ? "Clear search" : "Create board"} onAction={props.query ? () => props.onQuery("") : props.onCreate} /> : <View style={styles.boards}>{props.projects.map((project, index) => <ManagerCard key={project.id} project={project} accent={index % 2 ? "#EC4899" : c.success} metrics={getTaskMetrics(project.workspace.tasks, props.now)} pinned={props.pinnedIds.has(project.id)} editing={props.editing} ready={props.ready} first={index === 0} last={index === props.projects.length - 1} onOpen={() => props.onOpen(project.id)} onReopen={() => props.onReopen(project)} onPin={() => props.onPin(project.id)} onMove={(direction) => props.onMove(project.id, direction)} onMenu={() => props.onMenu(project)} onSave={() => props.onSave(project)} onDuplicate={() => props.onDuplicate(project)} onRemove={() => props.onRemove(project)} />)}</View>}
      {props.closedProjects.length ? <>
        <SectionHeading title="Closed boards" subtitle={`${props.closedProjects.length} closed`} style={styles.sectionHeading} />
        <Text style={[styles.editHint, { color: c.mutedForeground }]}>Closed boards stay safe with their tasks. Reopen one to keep working on it.</Text>
        <View style={styles.boards}>{props.closedProjects.map((project) => <ManagerCard key={project.id} project={project} accent={c.mutedForeground} metrics={getTaskMetrics(project.workspace.tasks, props.now)} pinned={false} editing={false} ready={props.ready} first={false} last={false} closed onOpen={() => props.onOpen(project.id)} onReopen={() => props.onReopen(project)} onPin={() => undefined} onMove={() => undefined} onMenu={() => props.onMenu(project)} onSave={() => props.onSave(project)} onDuplicate={() => props.onDuplicate(project)} onRemove={() => props.onRemove(project)} />)}</View>
      </> : null}
      <WorkspaceOverview metrics={props.metrics} boards={props.totalBoards} />
    </ScrollView>
  </>;
}

function ManagerCard({ project, accent, metrics, pinned, editing, ready, first, last, closed = false, onOpen, onReopen, onPin, onMove, onMenu, onSave, onDuplicate, onRemove }: { project: JanusProject; accent: string; metrics: TaskMetrics; pinned: boolean; editing: boolean; ready: boolean; first: boolean; last: boolean; closed?: boolean; onOpen: () => void; onReopen: () => void; onPin: () => void; onMove: (direction: -1 | 1) => void; onMenu: () => void; onSave: () => void; onDuplicate: () => void; onRemove: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const date = parseISO(project.createdAt);
  return <View testID={`manager-board-${project.id}`} style={[styles.board, { backgroundColor: c.card, borderColor: c.border }]}>
    {/* A sibling hit surface opens every non-control area without nesting buttons. */}
    <Pressable accessibilityRole="button" accessibilityLabel={closed ? `${project.name}, closed board` : `Open ${project.name}`} accessibilityHint={closed ? "Shows options to reopen this board" : "Opens board view"} disabled={editing} onPress={onOpen} onLongPress={onMenu} style={({ pressed }) => [StyleSheet.absoluteFill, { borderRadius: 20, backgroundColor: pressed ? c.primarySoft : "transparent" }]} />
    <View pointerEvents="box-none" style={styles.cardHeader}><View pointerEvents="none" style={styles.cardTitleArea}><Text style={[styles.boardTitle, { color: c.foreground }]} numberOfLines={2}>{project.name}</Text>{closed ? <View style={[styles.closedBadge, { backgroundColor: c.secondary, borderColor: c.border }]}><Ionicons name="lock-closed" size={10} color={c.mutedForeground} /><Text style={{ color: c.mutedForeground, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>CLOSED</Text></View> : null}{isValid(date) ? <Text style={[styles.created, { color: c.mutedForeground }]}>Created {format(date, "dd MMM yyyy")}</Text> : null}</View>{closed ? null : <Pressable accessibilityRole="button" accessibilityLabel={`${pinned ? "Unpin" : "Pin"} ${project.name}`} accessibilityState={{ selected: pinned, disabled: !ready }} disabled={!ready} onPress={onPin} style={styles.pin}><Ionicons name={pinned ? "star" : "star-outline"} size={21} color={pinned ? c.primary : c.borderStrong} /></Pressable>}</View>
    {editing ? <View pointerEvents="box-none" style={styles.reorder}><Button variant="outline" label="Move up" disabled={first} onPress={() => onMove(-1)} /><Button variant="outline" label="Move down" disabled={last} onPress={() => onMove(1)} /></View> : null}
    <View pointerEvents="none" style={styles.progressArea}>
      <View style={styles.progressMeta}><View style={styles.inline}><Ionicons name="ellipse-outline" size={11} color={c.mutedForeground} /><Text style={{ color: c.secondaryForeground, fontSize: 13 }}>{metrics.open} open</Text></View><View style={styles.inline}><Ionicons name="checkmark" size={17} color={accent} /><Text style={{ color: accent, fontSize: 13 }}>{metrics.done} done</Text></View><Text style={[styles.percent, { color: c.mutedForeground }]}>{metrics.completionPercent}%</Text></View>
      <View style={[styles.track, { backgroundColor: c.secondary }]}><View style={{ height: "100%", width: `${metrics.completionPercent}%`, backgroundColor: accent, borderRadius: 5 }} /></View>
    </View>
    <View pointerEvents="none" style={styles.signals}><View style={styles.inline}><Ionicons name="warning-outline" size={14} color={c.destructive} /><Text style={{ color: c.destructive, fontSize: 12 }}>{metrics.overdue} overdue</Text></View><View style={styles.inline}><Ionicons name="time-outline" size={14} color={c.info} /><Text style={{ color: c.info, fontSize: 12 }}>{metrics.dueSoon} due soon</Text></View></View>
    <View pointerEvents="box-none" style={[styles.cardFooter, { borderColor: c.border }]}>{closed ? <><CardAction icon="refresh-outline" label="Reopen" onPress={onReopen} /><View pointerEvents="none" style={{ flex: 1 }} /><CardAction label="Remove" onPress={onRemove} destructive disabled={!ready} /><IconButton icon="ellipsis-horizontal" label={`Actions for ${project.name}`} onPress={onMenu} size={44} /></> : <><CardAction icon="download-outline" label="Save" onPress={onSave} /><CardAction icon="copy-outline" label="Duplicate" onPress={onDuplicate} /><View pointerEvents="none" style={{ flex: 1 }} /><CardAction label="Remove" onPress={onRemove} destructive disabled={!ready} /><IconButton icon="ellipsis-horizontal" label={`Actions for ${project.name}`} onPress={onMenu} size={44} /></>}</View>
  </View>;
}

function CardAction({ icon, label, onPress, destructive, disabled }: { icon?: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; destructive?: boolean; disabled?: boolean }) {
  const { theme } = useTheme();
  const color = destructive ? theme.colors.destructive : theme.colors.mutedForeground;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.cardAction, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}>{icon ? <Ionicons name={icon} size={15} color={color} /> : null}<Text style={{ color, fontSize: 12, fontWeight: "500" }}>{label}</Text></Pressable>;
}

function WorkspaceOverview({ metrics, boards }: { metrics: TaskMetrics; boards: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  // Overdue is a subset of open tasks: do not count it twice in the donut.
  const slices = [{ label: "Completed", value: metrics.done, color: c.success }, { label: "Overdue", value: metrics.overdue, color: c.destructive }, { label: "Open (not overdue)", value: metrics.open - metrics.overdue, color: c.info }, { label: "Canceled", value: metrics.canceled, color: c.mutedForeground }];
  const circumference = 2 * Math.PI * 48;
  const strokeWidth = 11;
  const segmentCount = slices.filter((slice) => slice.value > 0).length;
  let offset = 0;
  return <View style={styles.overviewSection}>
    <SectionHeading title="Board stats" subtitle="Across open boards · includes canceled tasks" style={styles.overviewHeading} />
    <View style={[styles.overview, { backgroundColor: c.card, borderColor: c.border, shadowColor: c.shadow }]}>
      <View style={styles.statsContent}>
      <View accessible accessibilityLabel={`${metrics.total} tasks: ${metrics.done} completed, ${metrics.overdue} overdue, ${metrics.open - metrics.overdue} open and not overdue, ${metrics.canceled} canceled`} style={styles.donut}>
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
      <View style={[styles.statsTotal, { borderColor: c.border, backgroundColor: c.backgroundAlt }]}><View style={{ flexShrink: 1 }}><Text style={[styles.totalLabel, { color: c.mutedForeground }]}>TOTAL TASKS</Text><Text style={[styles.totalValue, { color: c.foreground, fontFamily: serif }]}>{metrics.total}</Text></View><Text style={[styles.boardCount, { color: c.mutedForeground }]}>across {boards} {boards === 1 ? "board" : "boards"}</Text></View>
        <View style={[styles.legend, { borderColor: c.border }]}>{slices.map((slice) => <View key={slice.label} style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: slice.color }]} /><Text style={[styles.legendLabel, { color: c.secondaryForeground }]}>{slice.label}</Text><Text style={[styles.legendValue, { color: c.foreground }]}>{slice.value}</Text><Text style={[styles.legendPercent, { color: c.mutedForeground }]}>{metrics.total ? Math.round(slice.value / metrics.total * 100) : 0}%</Text></View>)}</View>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  newBoardButton: { width: 44, height: 44, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  themeSwitch: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 2 }, themeButton: { width: 44, height: 44, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  content: mobileContentStyle,
  arrange: { paddingHorizontal: 10, borderRadius: 13 },
  sectionHeading: { marginTop: 24, marginBottom: 10 }, firstSectionHeading: { marginBottom: 10 }, editHint: { fontSize: 12, marginBottom: 12 }, boards: { gap: 16 },
  board: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 17, paddingTop: 14, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }, cardHeader: { flexDirection: "row", alignItems: "flex-start" }, cardTitleArea: { flex: 1, paddingVertical: 4, minHeight: 44 }, boardTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.4 }, closedBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, height: 20, paddingHorizontal: 6, borderWidth: 1, borderRadius: 7 }, created: { fontSize: 12, marginTop: 4 }, pin: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10, marginTop: -5 }, reorder: { flexDirection: "row", gap: 8, marginTop: 12 },
  progressArea: { paddingTop: 18, paddingBottom: 8 }, progressMeta: { flexDirection: "row", alignItems: "center", gap: 16 }, inline: { flexDirection: "row", alignItems: "center", gap: 5 }, percent: { marginLeft: "auto", fontSize: 12, fontWeight: "600" }, track: { height: 6, borderRadius: 5, marginTop: 8, overflow: "hidden" }, signals: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, minHeight: 47, paddingVertical: 9 },
  cardFooter: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, gap: 12, marginTop: 4, minHeight: 45 }, cardAction: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 },
  overviewSection: { marginTop: 34 },
  overviewHeading: { marginBottom: 12 },
  overview: { borderRadius: 20, borderWidth: 1, padding: 16, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  statsContent: { paddingTop: 4 },
  statsTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 16, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14 },
  totalLabel: { fontSize: 11 },
  totalValue: { fontSize: 39, lineHeight: 44, marginTop: 4 },
  boardCount: { flexShrink: 1, maxWidth: "50%", textAlign: "right", fontSize: 12, lineHeight: 18, paddingBottom: 4 },
  donut: { width: "100%", maxWidth: 260, aspectRatio: 1, alignSelf: "center", marginBottom: 24 },
  donutLabel: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  donutValue: { fontSize: 38, fontWeight: "700", fontVariant: ["tabular-nums"] },
  legend: { gap: 16, alignSelf: "stretch", marginTop: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19 },
  legendValue: { fontSize: 16, textAlign: "right", fontVariant: ["tabular-nums"] },
  legendPercent: { width: 38, textAlign: "right", fontSize: 12, fontVariant: ["tabular-nums"] },
});
