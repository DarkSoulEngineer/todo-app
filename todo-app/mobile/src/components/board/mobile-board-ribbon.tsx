import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ViewMode } from "@/lib/domain/types";
import { useMobileBoardColors } from "./mobile-board-colors";

const CONTROL_SIZE = 44;

interface Props {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  query: string;
  onQuery: (query: string) => void;
  onBoards: () => void;
  onSwitchBoard: () => void;
  maximized: boolean;
  onNewTask: () => void;
  onSample: () => void;
  onAddSection: () => void;
  onClear: () => void;
  completedCount: number;
  compact: boolean;
  onCompact: () => void;
  showCheckboxes: boolean;
  onShowCheckboxes: () => void;
  showMoveArrows: boolean;
  onShowMoveArrows: () => void;
  focused: boolean;
  onFocused: () => void;
  children: ReactNode;
}

export function MobileBoardRibbon(props: Props) {
  const c = useMobileBoardColors();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [tab, setTab] = useState<"home" | "options">("home");
  const [searchOpen, setSearchOpen] = useState(false);
  const iconOnlyBoards = fontScale > 1.2;
  const searchVisible = !props.maximized && (searchOpen || props.query.length > 0);
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, selected = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} aria-pressed={selected} onPress={onPress} style={styles.icon}><View style={[styles.iconFace, selected && { backgroundColor: c.primary }]}>{label === "Board view" ? <View style={styles.columnsMark}>{[17, 12, 15].map((height, index) => <View key={index} style={[styles.columnMark, { height, borderColor: selected ? c.primaryForeground : c.mutedForeground }]} />)}</View> : <Ionicons name={name} size={19} color={selected ? c.primaryForeground : c.mutedForeground} />}</View></Pressable>;
  const tool = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, selected = false, disabled = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} aria-pressed={selected} disabled={disabled} onPress={onPress} style={[styles.tool, { opacity: disabled ? 0.35 : 1 }]}><Ionicons name={name} size={19} color={selected ? c.primary : c.mutedForeground} /><Text numberOfLines={2} style={[styles.toolText, { color: selected ? c.primary : c.mutedForeground }]}>{label}</Text></Pressable>;
  const group = (label: string, children: ReactNode) => <View accessibilityLabel={label} style={styles.group}><View pointerEvents="none" style={[styles.groupFace, { backgroundColor: c.input, borderColor: c.border }]} />{children}</View>;
  const modeControls = group("Board views", <>
    {icon("list-outline", "List view", () => props.onMode("list"), props.mode === "list")}
    {icon("albums-outline", "Board view", () => props.onMode("board"), props.mode === "board")}
    {icon("calendar-outline", "Calendar view", () => props.onMode("calendar"), props.mode === "calendar")}
  </>);

  return <View style={{ paddingTop: insets.top, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.primary, borderBottomWidth: 1, borderBottomColor: c.border }}>
    <View style={styles.topRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to boards" onPress={props.onBoards} onLongPress={props.onSwitchBoard} style={styles.boards}><View style={[styles.boardsFace, { borderColor: c.border, backgroundColor: c.input }]}><Ionicons name="layers-outline" size={19} color={c.foreground} />{!iconOnlyBoards ? <Text numberOfLines={1} style={{ color: c.foreground, fontSize: 14, fontWeight: "500" }}>Boards</Text> : null}</View></Pressable>
      {!props.maximized ? modeControls : null}
      <View style={styles.spacer} />
      {!props.maximized ? icon("search-outline", "Search tasks", () => setSearchOpen((value) => !value), searchVisible) : null}
    </View>
    {searchVisible ? <View style={styles.searchRow}><View style={[styles.search, { borderColor: c.borderStrong, backgroundColor: c.input }]}><Ionicons name="search-outline" size={16} color={c.mutedForeground} /><TextInput accessibilityLabel="Filter tasks, labels, assignees" value={props.query} onChangeText={props.onQuery} placeholder="Search tasks…" placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground }]} />{props.query ? icon("close", "Clear search", () => props.onQuery("")) : null}</View></View> : null}
    {!props.maximized ? <>
      <View style={[styles.tabRow, { borderColor: c.border }]}>
        {(["home", "options"] as const).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={value === "home" ? "Home tools" : "Options tools"} aria-selected={tab === value} onPress={() => setTab(value)} style={[styles.tab, { borderBottomColor: tab === value ? c.primary : "transparent" }]}><Ionicons name={value === "home" ? "home-outline" : "filter-outline"} size={15} color={tab === value ? c.foreground : c.mutedForeground} /><Text style={{ color: tab === value ? c.foreground : c.mutedForeground, fontSize: 13 }}>{value === "home" ? "Home" : "Options"}</Text></Pressable>)}
      </View>
      {tab === "home" ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tools}>
        <View style={[styles.toolGroup, { borderColor: c.border }]}><View style={styles.toolButtons}>{tool("add", "New card", props.onNewTask)}{tool("add-outline", "Sample", props.onSample)}{props.mode === "board" ? tool("add-circle-outline", "Section", props.onAddSection) : null}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>CREATE</Text></View>
        <View style={[styles.toolGroup, { borderColor: c.border }]}><View style={styles.toolButtons}>{tool("contract-outline", "Compact cards", props.onCompact, props.compact, props.mode !== "board")}{tool("reader-outline", "Focus column", props.onFocused, props.focused, props.mode !== "board")}{tool("swap-horizontal-outline", "Move arrows", props.onShowMoveArrows, props.showMoveArrows, props.mode !== "board")}{tool("checkbox-outline", "Show checkbox", props.onShowCheckboxes, props.showCheckboxes, props.mode !== "board")}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>DISPLAY</Text></View>
        <View style={styles.toolGroup}><View style={styles.toolButtons}>{tool("checkmark-done-outline", "Clear done", props.onClear, false, props.completedCount === 0)}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>TIDY UP</Text></View>
      </ScrollView> : <View style={styles.options}><View style={styles.insightsTool}>{tool("stats-chart-outline", "Insights view", () => props.onMode("insights"), props.mode === "insights")}</View>{props.children}</View>}
    </> : null}
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
  insightsTool: { alignSelf: "flex-start" },
  searchRow: { paddingHorizontal: 12, paddingBottom: 12 }, search: { width: "100%", minHeight: 48, borderWidth: 1, borderRadius: 9, paddingLeft: 12, flexDirection: "row", alignItems: "center", gap: 9 }, input: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 14 },
  tabRow: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, gap: 6 }, tab: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 10, borderBottomWidth: 1 },
  tools: { flexDirection: "row", paddingHorizontal: 10, paddingBottom: 4, paddingTop: 5 }, toolGroup: { borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5, gap: 3 }, toolButtons: { flexDirection: "row" }, tool: { minWidth: 65, minHeight: 45, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 6 }, toolText: { fontSize: 10 }, caption: { textAlign: "center", fontSize: 9, letterSpacing: 0.5 }, options: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
});
