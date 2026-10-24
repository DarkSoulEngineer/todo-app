import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";
import type { ViewMode } from "@/lib/domain/types";
import { useMobileBoardColors } from "./mobile-board-colors";

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
  onClear: () => void;
  completedCount: number;
  compact: boolean;
  onCompact: () => void;
  focused: boolean;
  onFocused: () => void;
  children: ReactNode;
}

export function MobileBoardRibbon(props: Props) {
  const c = useMobileBoardColors();
  const { theme, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"home" | "options">("home");
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, selected = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} aria-pressed={selected} onPress={onPress} style={[styles.icon, selected && { backgroundColor: c.primary }]}><Ionicons name={name} size={17} color={selected ? c.primaryForeground : c.mutedForeground} /></Pressable>;
  const tool = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, selected = false, disabled = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} aria-pressed={selected} disabled={disabled} onPress={onPress} style={[styles.tool, { opacity: disabled ? 0.35 : 1 }]}><Ionicons name={name} size={19} color={selected ? c.primary : c.mutedForeground} /><Text style={[styles.toolText, { color: selected ? c.primary : c.mutedForeground }]}>{label}</Text></Pressable>;

  return <View style={{ paddingTop: insets.top, backgroundColor: c.card, borderBottomWidth: 1, borderColor: c.border }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topRail} contentContainerStyle={styles.topRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to boards" onPress={props.onBoards} onLongPress={props.onSwitchBoard} style={[styles.boards, { borderColor: c.border }]}><Ionicons name="layers-outline" size={16} color={c.mutedForeground} /><Text style={{ color: c.mutedForeground, fontSize: 12 }}>Boards</Text></Pressable>
      <View style={[styles.group, { borderColor: c.border }]}>
        {icon("list-outline", "List view", () => props.onMode("list"), props.mode === "list")}
        {icon("albums-outline", "Board view", () => props.onMode("board"), props.mode === "board")}
        {icon("calendar-outline", "Calendar view", () => props.onMode("calendar"), props.mode === "calendar")}
        {icon("stats-chart-outline", "Insights view", () => props.onMode("insights"), props.mode === "insights")}
      </View>
      <View style={[styles.group, { borderColor: c.border }]}>
        {icon("sunny-outline", "Use light theme", () => setPreference("light"), preference !== "system" && theme.scheme === "light")}
        {icon("moon-outline", "Use dark theme", () => setPreference("dark"), preference !== "system" && theme.scheme === "dark")}
        {icon("desktop-outline", "Use system theme", () => setPreference("system"), preference === "system")}
      </View>
      {icon("swap-horizontal-outline", "Switch board", props.onSwitchBoard)}
    </ScrollView>
    <View style={styles.searchRow}><View style={[styles.search, { borderColor: c.borderStrong, backgroundColor: c.input }]}><Ionicons name="search-outline" size={16} color={c.mutedForeground} /><TextInput accessibilityLabel="Filter tasks, labels, assignees" value={props.query} onChangeText={props.onQuery} placeholder="Search tasks…" placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground }]} />{props.query ? icon("close", "Clear search", () => props.onQuery("")) : null}</View></View>
    <View style={[styles.tabRow, { borderColor: c.border }]}>
      {(["home", "options"] as const).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={value === "home" ? "Home tools" : "Options tools"} aria-selected={tab === value} onPress={() => setTab(value)} style={[styles.tab, { borderBottomColor: tab === value ? c.primary : "transparent" }]}><Ionicons name={value === "home" ? "home-outline" : "filter-outline"} size={15} color={tab === value ? c.foreground : c.mutedForeground} /><Text style={{ color: tab === value ? c.foreground : c.mutedForeground, fontSize: 13 }}>{value === "home" ? "Home" : "Options"}</Text></Pressable>)}
    </View>
    {tab === "home" ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tools}>
      <View style={[styles.toolGroup, { borderColor: c.border }]}><View style={styles.toolButtons}>{tool("add", "New card", props.onNewTask)}{tool("add-outline", "Sample", props.onSample)}{props.mode === "board" ? tool("add-circle-outline", "Section", props.onAddSection) : null}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>CREATE</Text></View>
      <View style={[styles.toolGroup, { borderColor: c.border }]}><View style={styles.toolButtons}>{tool("contract-outline", "Compact cards", props.onCompact, props.compact, props.mode !== "board")}{tool("reader-outline", "Focus column", props.onFocused, props.focused, props.mode !== "board")}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>DISPLAY</Text></View>
      <View style={styles.toolGroup}><View style={styles.toolButtons}>{tool("checkmark-done-outline", "Clear done", props.onClear, false, props.completedCount === 0)}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>TIDY UP</Text></View>
    </ScrollView> : <View style={styles.options}>{props.children}</View>}
  </View>;
}

const styles = StyleSheet.create({
  topRail: { flexGrow: 0 }, topRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5 },
  boards: { borderWidth: 1, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 7 },
  group: { borderWidth: 1, borderRadius: 10, flexDirection: "row", padding: 2 },
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  searchRow: { paddingHorizontal: 12, paddingBottom: 6, alignItems: "center" }, search: { width: "100%", maxWidth: 320, minHeight: 34, borderWidth: 1, borderRadius: 8, paddingLeft: 10, flexDirection: "row", alignItems: "center", gap: 7 }, input: { flex: 1, minWidth: 0, height: 34, fontSize: 13 },
  tabRow: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, gap: 6 }, tab: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 7, borderBottomWidth: 1 },
  tools: { flexDirection: "row", paddingHorizontal: 10, paddingBottom: 4, paddingTop: 5 }, toolGroup: { borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5, gap: 3 }, toolButtons: { flexDirection: "row" }, tool: { minWidth: 65, minHeight: 45, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 6 }, toolText: { fontSize: 10 }, caption: { textAlign: "center", fontSize: 9, letterSpacing: 0.5 }, options: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
});
