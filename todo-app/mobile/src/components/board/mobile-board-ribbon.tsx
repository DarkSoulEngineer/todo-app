import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ViewMode } from "@/lib/domain/types";
import { useMobileBoardColors } from "./mobile-board-colors";

const CONTROL_SIZE = 44;

type Tab = "home" | "actions" | "filters" | "select";

const TABS: { value: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "home", label: "Home", icon: "home-outline" },
  { value: "actions", label: "Actions", icon: "options-outline" },
  { value: "filters", label: "Filters", icon: "funnel-outline" },
  { value: "select", label: "Select", icon: "checkbox-outline" },
];

interface Props {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  query: string;
  onQuery: (query: string) => void;
  onBoards: () => void;
  onSwitchBoard: () => void;
  onNewTask: () => void;
  onSample: () => void;
  onAddSection: () => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  compact: boolean;
  onCompact: () => void;
  showCheckboxes: boolean;
  onShowCheckboxes: () => void;
  showMoveArrows: boolean;
  onShowMoveArrows: () => void;
  focused: boolean;
  onFocused: () => void;
  children: ReactNode;
  filters: ReactNode;
  /** True while tasks are being selected on the board. */
  selecting: boolean;
  /** Called when the Select tab is opened. */
  onSelect: () => void;
  /** Called when the ribbon leaves the Select tab. */
  onDeselect: () => void;
  /** Selection tool strip, shown while the Select tab is active. */
  selection?: ReactNode;
}

export function MobileBoardRibbon(props: Props) {
  const c = useMobileBoardColors();
  const insets = useSafeAreaInsets();
  const { fontScale, width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>("home");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [previousTab, setPreviousTab] = useState<Tab>("home");
  const iconOnlyBoards = fontScale > 1.2 || width < 380;
  const tabLabels: "all" | "active" | "none" = fontScale > 1.2 ? "none" : width >= 480 ? "all" : width >= 360 ? "active" : "none";
  const searchVisible = searchOpen || props.query.length > 0;

  // Selection mode owns the Select tab. When it ends, fall back to the tab the
  // user was on before opening it without needing to sync state in an effect.
  const shownTab: Tab = props.selecting ? "select" : tab === "select" ? previousTab : tab;

  const openTab = (next: Tab) => {
    if (next === "select") {
      if (shownTab !== "select") {
        setPreviousTab(shownTab);
        props.onSelect();
      }
    } else if (shownTab === "select") {
      props.onDeselect();
    }
    setTab(next);
    setExpanded(true);
  };
  const hideAfterUse = () => { if (!pinned) setExpanded(false); };
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, selected = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} aria-pressed={selected} onPress={onPress} style={styles.icon}><View style={[styles.iconFace, selected && { backgroundColor: c.primary }]}>{label === "Board view" ? <View style={styles.columnsMark}>{[17, 12, 15].map((height, index) => <View key={index} style={[styles.columnMark, { height, borderColor: selected ? c.primaryForeground : c.mutedForeground }]} />)}</View> : <Ionicons name={name} size={19} color={selected ? c.primaryForeground : c.mutedForeground} />}</View></Pressable>;
  const tool = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, selected = false, disabled = false, accessibilityLabel = label) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={accessibilityLabel} aria-pressed={selected} disabled={disabled} onPress={() => { onPress(); hideAfterUse(); }} style={[styles.tool, { opacity: disabled ? 0.35 : 1 }]}><Ionicons name={name} size={19} color={selected ? c.primary : c.mutedForeground} /><Text numberOfLines={2} style={[styles.toolText, { color: selected ? c.primary : c.mutedForeground }]}>{label}</Text></Pressable>;
  const group = (label: string, children: ReactNode) => <View accessibilityLabel={label} style={styles.group}><View pointerEvents="none" style={[styles.groupFace, { backgroundColor: c.input, borderColor: c.border }]} />{children}</View>;
  const modeControls = group("Board views", <>
    {icon("list-outline", "List view", () => { props.onMode("list"); hideAfterUse(); }, props.mode === "list")}
    {icon("albums-outline", "Board view", () => { props.onMode("board"); hideAfterUse(); }, props.mode === "board")}
    {icon("calendar-outline", "Calendar view", () => { props.onMode("calendar"); hideAfterUse(); }, props.mode === "calendar")}
    {icon("stats-chart-outline", "Insights view", () => { props.onMode("insights"); hideAfterUse(); }, props.mode === "insights")}
  </>);

  return <View style={{ paddingTop: insets.top, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.primary, borderBottomWidth: 1, borderBottomColor: c.border }}>
    <View style={styles.topRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to boards" onPress={props.onBoards} onLongPress={props.onSwitchBoard} style={styles.boards}><View style={[styles.boardsFace, { borderColor: c.border, backgroundColor: c.input }]}><Ionicons name="layers-outline" size={19} color={c.foreground} />{!iconOnlyBoards ? <Text numberOfLines={1} style={{ color: c.foreground, fontSize: 14, fontWeight: "500" }}>Boards</Text> : null}</View></Pressable>
      {modeControls}
      <View style={styles.spacer} />
      {icon("search-outline", "Search tasks", () => setSearchOpen((value) => !value), searchVisible)}
    </View>
    {searchVisible ? <View style={styles.searchRow}><View style={[styles.search, { borderColor: c.borderStrong, backgroundColor: c.input }]}><Ionicons name="search-outline" size={16} color={c.mutedForeground} /><TextInput accessibilityLabel="Filter tasks, labels, assignees" value={props.query} onChangeText={props.onQuery} placeholder="Search tasks…" placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground }]} />{props.query ? icon("close", "Clear search", () => props.onQuery("")) : null}</View></View> : null}
    <View style={[styles.tabRow, { borderColor: c.border }]}>
      {TABS.map((item) => <Pressable key={item.value} accessibilityRole="tab" accessibilityLabel={item.value === "select" ? "Select tasks" : `${item.label} tools`} aria-selected={shownTab === item.value} onPress={() => openTab(item.value)} style={[styles.tab, { borderBottomColor: shownTab === item.value ? c.primary : "transparent" }]}><Ionicons name={item.icon} size={15} color={shownTab === item.value ? c.foreground : c.mutedForeground} />{tabLabels === "all" || (tabLabels === "active" && shownTab === item.value) ? <Text numberOfLines={1} style={{ color: shownTab === item.value ? c.foreground : c.mutedForeground, fontSize: 13 }}>{item.label}</Text> : null}</Pressable>)}
      <View style={styles.spacer} />
      <Pressable accessibilityRole="switch" accessibilityLabel={pinned ? "Unpin ribbon" : "Pin ribbon open"} accessibilityHint={pinned ? "The ribbon will auto-hide after you pick an option." : "The ribbon will stay open after you pick an option."} accessibilityState={{ checked: pinned }} onPress={() => { if (pinned) { setPinned(false); setExpanded(false); } else { setPinned(true); setExpanded(true); } }} style={styles.tabAction}>{pinned ? <MaterialCommunityIcons name="pin" size={18} color={c.primary} /> : <MaterialCommunityIcons name="pin-off-outline" size={18} color={c.mutedForeground} />}</Pressable>
    </View>
    {expanded ? (shownTab === "home" ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tools}>
      <View style={[styles.toolGroup, { borderColor: c.border }]}><View style={styles.toolButtons}>{tool("add", "New card", props.onNewTask)}{tool("add-outline", "Sample", props.onSample)}{props.mode === "board" ? tool("add-circle-outline", "Section", props.onAddSection) : null}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>CREATE</Text></View>
      <View style={[styles.toolGroup, { borderColor: c.border }]}><View style={styles.toolButtons}>{tool("contract-outline", "Compact cards", props.onCompact, props.compact, props.mode !== "board")}{tool("reader-outline", "Focus column", props.onFocused, props.focused, props.mode !== "board")}{tool("swap-horizontal-outline", "Move arrows", props.onShowMoveArrows, props.showMoveArrows, props.mode !== "board")}{tool("checkbox-outline", "Show checkbox", props.onShowCheckboxes, props.showCheckboxes, props.mode !== "board")}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>DISPLAY</Text></View>
      <View style={styles.toolGroup}><View style={styles.toolButtons}>{tool("remove", "Zoom out", () => props.onZoom(props.zoom - 0.1), false, props.mode !== "board" || props.zoom <= 0.7)}{tool("refresh-outline", `${Math.round(props.zoom * 100)}%`, () => props.onZoom(1), false, props.mode !== "board", `Reset zoom to 100% (currently ${Math.round(props.zoom * 100)}%)`)}{tool("add", "Zoom in", () => props.onZoom(props.zoom + 0.1), false, props.mode !== "board" || props.zoom >= 1.3)}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>ZOOM</Text></View>
    </ScrollView> : shownTab === "filters" ? props.filters : shownTab === "select" ? (props.selection ?? props.children) : props.children) : null}
  </View>;
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  boards: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  boardsFace: { minHeight: 44, minWidth: 44, borderWidth: 1, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  spacer: { flex: 1 },
  group: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  groupFace: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, borderWidth: 1, borderRadius: 9 },
  icon: { width: CONTROL_SIZE, height: CONTROL_SIZE, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  iconFace: { width: 36, height: 36, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  columnsMark: { flexDirection: "row", gap: 2, height: 17, alignItems: "flex-start" },
  columnMark: { width: 5, borderWidth: 1, borderRadius: 1 },
  searchRow: { paddingHorizontal: 12, paddingBottom: 12 }, search: { width: "100%", minHeight: 48, borderWidth: 1, borderRadius: 9, paddingLeft: 12, flexDirection: "row", alignItems: "center", gap: 9 }, input: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 14 },
  tabRow: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, gap: 4 }, tab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 44, minHeight: 44, paddingHorizontal: 6, borderBottomWidth: 1 }, tabAction: { width: CONTROL_SIZE, height: CONTROL_SIZE, alignItems: "center", justifyContent: "center", borderRadius: 7 },
  tools: { flexDirection: "row", paddingHorizontal: 10, paddingBottom: 4, paddingTop: 5 }, toolGroup: { borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5, gap: 3 }, toolButtons: { flexDirection: "row" }, tool: { minWidth: 65, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 6 }, toolText: { fontSize: 10 }, caption: { textAlign: "center", fontSize: 9, letterSpacing: 0.5 },
});
