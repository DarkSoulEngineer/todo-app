import { Ionicons } from "@expo/vector-icons";
import { format, isValid, parseISO } from "date-fns";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { IconButton } from "@/components/janus-board-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useTheme } from "@/providers/theme-provider";
import { getTaskMetrics, type TaskMetrics } from "@/lib/data/manager-state";
import type { JanusProject } from "@/lib/domain/projects";

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
  onMore: () => void;
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
  const { theme, setPreference } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  return <>
    <View style={[styles.header, { backgroundColor: c.card, borderColor: c.border, paddingTop: insets.top + 12 }]}>
      <View style={styles.identity}><Text style={[styles.brand, { color: c.foreground }]}>Janus</Text><Text style={[styles.subtitle, { color: c.mutedForeground }]}>Focused task manager</Text></View>
      <View style={[styles.themeSwitch, { backgroundColor: c.secondary, borderColor: c.border }]}>
        {(["light", "dark"] as const).map((scheme) => <Pressable key={scheme} accessibilityRole="button" accessibilityLabel={`Use ${scheme} theme`} aria-pressed={theme.scheme === scheme} accessibilityState={{ selected: theme.scheme === scheme }} onPress={() => setPreference(scheme)} style={[styles.themeButton, theme.scheme === scheme && { backgroundColor: c.cardElevated }]}><Ionicons name={scheme === "light" ? "sunny-outline" : "moon"} size={18} color={theme.scheme === scheme ? scheme === "light" ? "#D97706" : c.primary : c.mutedForeground} /></Pressable>)}
      </View>
      <IconButton icon="ellipsis-horizontal" label="Workspace options" onPress={props.onMore} size={44} />
    </View>
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110, paddingLeft: Math.max(insets.left, 18), paddingRight: Math.max(insets.right, 18) }]}>
      <Text style={[styles.breadcrumb, { color: c.primary }]}>HOME <Text style={{ color: c.borderStrong }}>/</Text> BOARDS</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: c.foreground, fontFamily: serif }]}>Board manager</Text>
      <Text style={[styles.intro, { color: c.mutedForeground }]}>All your boards in one place.</Text>
      <View style={styles.actions}>
        <Button variant="outline" label="Import board" onPress={props.onImport} style={styles.mainAction}><Ionicons name="push-outline" size={17} color={c.mutedForeground} /><Text style={{ color: c.secondaryForeground, fontWeight: "500" }}>Import board</Text></Button>
        <Button label="New board" onPress={props.onCreate} style={styles.mainAction}><Ionicons name="add" size={21} color={c.primaryForeground} /><Text style={{ color: c.primaryForeground, fontWeight: "600" }}>New board</Text></Button>
      </View>
      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}><Ionicons name="search-outline" size={19} color={c.mutedForeground} /><TextInput value={props.query} onChangeText={props.onQuery} placeholder="Search boards" accessibilityLabel="Search boards" placeholderTextColor={c.mutedForeground} style={[styles.searchInput, { color: c.foreground }]} />{props.query ? <IconButton icon="close-circle-outline" label="Clear search" onPress={() => props.onQuery("")} size={36} /> : null}</View>
        <Button variant="outline" label={props.editing ? "Done" : "Rearrange"} onPress={() => props.onEdit(!props.editing)} disabled={!props.ready || (!props.editing && props.totalBoards < 2)} style={styles.arrange}><Ionicons name={props.editing ? "checkmark" : "reorder-three-outline"} size={18} color={c.mutedForeground} /><Text style={{ color: c.secondaryForeground, fontSize: 12 }}>{props.editing ? "Done" : "Rearrange"}</Text></Button>
      </View>
      <View style={styles.sectionHeader}><View style={styles.sectionCopy}><Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.secondaryForeground }]}>YOUR BOARDS</Text><Text style={{ color: c.mutedForeground, fontSize: 12 }}>{props.totalBoards} active</Text></View><IconButton icon="ellipsis-horizontal" label="Board options" onPress={props.onMore} size={44} /></View>
      {props.editing ? <Text style={[styles.editHint, { color: c.primary }]}>Use the arrows to arrange your boards.</Text> : null}
      {props.loading ? <Text accessibilityLiveRegion="polite" style={[styles.editHint, { color: c.mutedForeground }]}>Loading your boards…</Text> : props.projects.length === 0 && props.closedProjects.length === 0 ? <EmptyState icon={props.query ? "search-outline" : "layers-outline"} title={props.query ? "No matching boards" : "No boards yet"} message={props.query ? "Try another name or clear your search." : "Create a board to organize your tasks."} actionLabel={props.query ? "Clear search" : "Create board"} onAction={props.query ? () => props.onQuery("") : props.onCreate} /> : <View style={styles.boards}>{props.projects.map((project, index) => <ManagerCard key={project.id} project={project} accent={index % 2 ? "#EC4899" : c.success} metrics={getTaskMetrics(project.workspace.tasks, props.now)} pinned={props.pinnedIds.has(project.id)} editing={props.editing} ready={props.ready} first={index === 0} last={index === props.projects.length - 1} onOpen={() => props.onOpen(project.id)} onReopen={() => props.onReopen(project)} onPin={() => props.onPin(project.id)} onMove={(direction) => props.onMove(project.id, direction)} onMenu={() => props.onMenu(project)} onSave={() => props.onSave(project)} onDuplicate={() => props.onDuplicate(project)} onRemove={() => props.onRemove(project)} />)}</View>}
      {props.closedProjects.length ? <>
        <View style={styles.sectionHeader}><View style={styles.sectionCopy}><Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.secondaryForeground }]}>CLOSED BOARDS</Text><Text style={{ color: c.mutedForeground, fontSize: 12 }}>{props.closedProjects.length} closed</Text></View></View>
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
  const assignees = [...new Map(project.workspace.tasks.filter((task) => task.assignee).map((task) => [task.assignee!.id, task.assignee!])).values()];
  return <View testID={`manager-board-${project.id}`} style={[styles.board, { backgroundColor: c.card, borderColor: c.border }]}>
    {/* A sibling hit surface opens every non-control area without nesting buttons. */}
    <Pressable accessibilityRole="button" accessibilityLabel={closed ? `${project.name}, closed board` : `Open ${project.name}`} accessibilityHint={closed ? "Shows options to reopen this board" : "Opens board view"} disabled={editing} onPress={onOpen} onLongPress={onMenu} style={({ pressed }) => [StyleSheet.absoluteFill, { borderRadius: 20, backgroundColor: pressed ? c.primarySoft : "transparent" }]} />
    <View pointerEvents="box-none" style={styles.cardHeader}><View pointerEvents="none" style={styles.cardTitleArea}><Text style={[styles.boardTitle, { color: c.foreground }]} numberOfLines={2}>{project.name}</Text>{closed ? <View style={[styles.closedBadge, { backgroundColor: c.secondary, borderColor: c.border }]}><Ionicons name="lock-closed" size={10} color={c.mutedForeground} /><Text style={{ color: c.mutedForeground, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>CLOSED</Text></View> : null}{isValid(date) ? <Text style={[styles.created, { color: c.mutedForeground }]}>Created {format(date, "dd MMM yyyy")}</Text> : null}</View>{closed ? null : <Pressable accessibilityRole="button" accessibilityLabel={`${pinned ? "Unpin" : "Pin"} ${project.name}`} accessibilityState={{ selected: pinned, disabled: !ready }} disabled={!ready} onPress={onPin} style={styles.pin}><Ionicons name={pinned ? "star" : "star-outline"} size={21} color={pinned ? c.primary : c.borderStrong} /></Pressable>}</View>
    {editing ? <View pointerEvents="box-none" style={styles.reorder}><Button variant="outline" label="Move up" disabled={first} onPress={() => onMove(-1)} /><Button variant="outline" label="Move down" disabled={last} onPress={() => onMove(1)} /></View> : null}
    <View pointerEvents="none" style={styles.progressArea}>
      <View style={styles.progressMeta}><View style={styles.inline}><Ionicons name="ellipse-outline" size={11} color={c.mutedForeground} /><Text style={{ color: c.secondaryForeground, fontSize: 13 }}>{metrics.open} open</Text></View><View style={styles.inline}><Ionicons name="checkmark" size={17} color={accent} /><Text style={{ color: accent, fontSize: 13 }}>{metrics.done} done</Text></View><Text style={[styles.percent, { color: c.mutedForeground }]}>{metrics.completionPercent}%</Text></View>
      <View style={[styles.track, { backgroundColor: c.secondary }]}><View style={{ height: "100%", width: `${metrics.completionPercent}%`, backgroundColor: accent, borderRadius: 5 }} /></View>
    </View>
    <View pointerEvents="none" style={styles.signals}><View style={styles.inline}><Ionicons name="warning-outline" size={14} color={c.destructive} /><Text style={{ color: c.destructive, fontSize: 12 }}>{metrics.overdue} overdue</Text></View><View style={styles.inline}><Ionicons name="time-outline" size={14} color={c.info} /><Text style={{ color: c.info, fontSize: 12 }}>{metrics.dueSoon} due soon</Text></View>{assignees.length ? <View style={styles.avatars}>{assignees.slice(0, 3).map((person, i) => <View key={person.id} accessible accessibilityLabel={person.name} style={[styles.avatar, { backgroundColor: ["#EC4899", "#6366F1", "#14B8A6"][i], borderColor: c.card }]}><Text style={styles.avatarText}>{person.initials || person.name.slice(0, 1)}</Text></View>)}{assignees.length > 3 ? <Text style={{ color: c.mutedForeground, fontSize: 10 }}>+{assignees.length - 3}</Text> : null}</View> : null}</View>
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
  return <View style={styles.overview}>
    <View style={styles.overviewHeading}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.secondaryForeground }]}>BOARD STATS</Text><Text style={[styles.overviewHint, { color: c.mutedForeground }]}>Across open boards · includes canceled tasks</Text></View></View>
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
      <View style={[styles.statsTotal, { borderColor: c.border }]}><View style={{ flexShrink: 1 }}><Text style={[styles.totalLabel, { color: c.mutedForeground }]}>TOTAL TASKS</Text><Text style={[styles.totalValue, { color: c.foreground, fontFamily: serif }]}>{metrics.total}</Text></View><Text style={[styles.boardCount, { color: c.mutedForeground }]}>across {boards} {boards === 1 ? "board" : "boards"}</Text></View>
      <View style={styles.legend}>{slices.map((slice) => <View key={slice.label} style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: slice.color }]} /><Text style={[styles.legendLabel, { color: c.secondaryForeground }]}>{slice.label}</Text><Text style={[styles.legendValue, { color: c.foreground }]}>{slice.value}</Text><Text style={[styles.legendPercent, { color: c.mutedForeground }]}>{metrics.total ? Math.round(slice.value / metrics.total * 100) : 0}%</Text></View>)}</View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 14, gap: 6, borderBottomWidth: 1 },
  identity: { flex: 1 }, brand: { fontSize: 17, fontWeight: "700", letterSpacing: -0.5 }, subtitle: { fontSize: 11, marginTop: 5 },
  themeSwitch: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 2 }, themeButton: { width: 44, height: 44, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  content: { width: "100%", maxWidth: 680, alignSelf: "center", paddingTop: 24 }, breadcrumb: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 }, title: { fontSize: 34, fontWeight: "400", letterSpacing: -1.2, marginTop: 10 }, intro: { fontSize: 13, lineHeight: 21, marginTop: 10 }, actions: { flexDirection: "row", gap: 10, marginTop: 24 }, mainAction: { flex: 1, height: 44, borderRadius: 14, paddingHorizontal: 8 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 20 }, search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 13, paddingLeft: 12, minHeight: 44 }, searchInput: { flex: 1, minWidth: 0, fontSize: 13, paddingVertical: 10 }, arrange: { paddingHorizontal: 10, borderRadius: 13 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 12 }, sectionCopy: { flexDirection: "row", alignItems: "center", gap: 10 }, sectionTitle: { fontSize: 14, fontWeight: "700", letterSpacing: 0.7 }, editHint: { fontSize: 12, marginBottom: 12 }, boards: { gap: 16 },
  board: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 17, paddingTop: 14, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }, cardHeader: { flexDirection: "row", alignItems: "flex-start" }, cardTitleArea: { flex: 1, paddingVertical: 4, minHeight: 44 }, boardTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.4 }, closedBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, height: 20, paddingHorizontal: 6, borderWidth: 1, borderRadius: 7 }, created: { fontSize: 12, marginTop: 4 }, pin: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10, marginTop: -5 }, reorder: { flexDirection: "row", gap: 8, marginTop: 12 },
  progressArea: { paddingTop: 18, paddingBottom: 8 }, progressMeta: { flexDirection: "row", alignItems: "center", gap: 16 }, inline: { flexDirection: "row", alignItems: "center", gap: 5 }, percent: { marginLeft: "auto", fontSize: 12, fontWeight: "600" }, track: { height: 6, borderRadius: 5, marginTop: 8, overflow: "hidden" }, signals: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, minHeight: 47, paddingVertical: 9 }, avatars: { flexDirection: "row", alignItems: "center", marginLeft: "auto", paddingLeft: 5 }, avatar: { width: 23, height: 23, borderRadius: 12, borderWidth: 2, marginLeft: -5, alignItems: "center", justifyContent: "center" }, avatarText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  cardFooter: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, gap: 12, marginTop: 4, minHeight: 45 }, cardAction: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 },
  overview: { marginTop: 34 },
  overviewHeading: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  overviewHint: { fontSize: 11, lineHeight: 17, marginTop: 4 },
  statsContent: { paddingTop: 8, paddingBottom: 12 },
  statsTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 16, paddingBottom: 22, borderBottomWidth: StyleSheet.hairlineWidth },
  totalLabel: { fontSize: 11 },
  totalValue: { fontSize: 39, lineHeight: 44, marginTop: 4 },
  boardCount: { flexShrink: 1, maxWidth: "50%", textAlign: "right", fontSize: 12, lineHeight: 18, paddingBottom: 4 },
  donut: { width: "100%", maxWidth: 260, aspectRatio: 1, alignSelf: "center", marginBottom: 28 },
  donutLabel: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  donutValue: { fontSize: 38, fontWeight: "700", fontVariant: ["tabular-nums"] },
  legend: { gap: 20, alignSelf: "stretch", marginTop: 24 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19 },
  legendValue: { fontSize: 16, textAlign: "right", fontVariant: ["tabular-nums"] },
  legendPercent: { width: 38, textAlign: "right", fontSize: 12, fontVariant: ["tabular-nums"] },
});
