import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BoardSection, ViewMode } from "@/lib/domain/types";
import { getRibbonContext, isRibbonTabAvailable, resolveRibbonTab, type RibbonTab } from "@/lib/features/ribbon-context";
import { useMobileBoardColors } from "./mobile-board-colors";
import { Sheet } from "@/components/ui/sheet";
import { RibbonScrollView } from "@/components/ui/ribbon-scroll-view";

const CONTROL_SIZE = 44;

type Tab = RibbonTab;

const TABS: { value: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "home", label: "Home", icon: "home-outline" },
  { value: "actions", label: "Actions", icon: "options-outline" },
  { value: "filters", label: "Filters", icon: "funnel-outline" },
  { value: "select", label: "Select", icon: "checkbox-outline" },
  { value: "hidden", label: "Hidden", icon: "eye-off-outline" },
];

interface Props {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  query: string;
  onQuery: (query: string) => void;
  onBoards: () => void;
  onSwitchBoard: (event?: GestureResponderEvent) => void;
  onNewTask: () => void;
  onAddSection: () => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  compact: boolean;
  onCompact: () => void;
  showMoveArrows: boolean;
  onShowMoveArrows: () => void;
  focused: boolean;
  onFocused: () => void;
  children: ReactNode;
  filters: ReactNode;
  filtersActive: boolean;
  hiddenSections?: BoardSection[];
  onShowSection?: (section: BoardSection) => void;
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
  const [moreOpen, setMoreOpen] = useState(false);
  const tabLabels: "all" | "active" | "none" = fontScale > 1.2 ? "none" : width >= 480 ? "all" : width >= 360 ? "active" : "none";
  const context = getRibbonContext(props.mode);
  const hiddenSections = props.hiddenSections ?? [];
  const searchVisible = context.search && (searchOpen || props.query.length > 0);

  // Selection mode owns the Select tab. When it ends, fall back to the tab the
  // user was on before opening it without needing to sync state in an effect.
  const resolvedTab = resolveRibbonTab(props.mode, tab, previousTab, props.selecting);
  const shownTab = resolvedTab === "hidden" && hiddenSections.length === 0 ? "home" : resolvedTab;
  const visibleTabs = TABS.filter((item) => isRibbonTabAvailable(item.value, props.mode) && (item.value !== "hidden" || hiddenSections.length > 0));
  const selectionActive = shownTab === "select";
  const ribbonExpanded = expanded || selectionActive;

  const AUTO_HIDE_DELAY_MS = 4000;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (!pinned && expanded && !selectionActive && !moreOpen) {
      hideTimerRef.current = setTimeout(() => {
        setExpanded(false);
      }, AUTO_HIDE_DELAY_MS);
    }
  }, [expanded, moreOpen, pinned, selectionActive]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [resetHideTimer]);

  const openTab = (next: Tab) => {
    if (!isRibbonTabAvailable(next, props.mode) || (next === "hidden" && hiddenSections.length === 0)) return;
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
    resetHideTimer();
  };
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, selected = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} aria-pressed={selected} onPress={() => { onPress(); resetHideTimer(); }} style={styles.icon}><View style={[styles.iconFace, selected && { backgroundColor: c.primary }]}>{<Ionicons name={name} size={19} color={selected ? c.primaryForeground : c.mutedForeground} />}</View></Pressable>;
  const tool = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, selected = false, disabled = false, accessibilityLabel = label) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={accessibilityLabel} aria-pressed={selected} disabled={disabled} onPress={() => { onPress(); resetHideTimer(); }} style={[styles.tool, { opacity: disabled ? 0.35 : 1 }]}><Ionicons name={name} size={19} color={selected ? c.primary : c.mutedForeground} /><Text numberOfLines={2} style={[styles.toolText, { color: selected ? c.primary : c.mutedForeground }]}>{label}</Text></Pressable>;

  return <View onTouchStartCapture={resetHideTimer} onPointerDown={resetHideTimer} style={{ paddingTop: insets.top, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.primary, borderBottomWidth: 1, borderBottomColor: c.border }}>
    <View style={[styles.tabRow, { borderColor: c.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to boards" onPress={props.onBoards} onLongPress={props.onSwitchBoard} style={styles.tabAction}>
        <Ionicons name="arrow-back" size={20} color={c.foreground} />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabList} contentContainerStyle={styles.tabs}>
        {visibleTabs.map((item) => <Pressable key={item.value} accessibilityRole="tab" accessibilityLabel={item.value === "select" ? "Select tasks" : item.value === "filters" && props.filtersActive ? "Filters tools, filter active" : item.value === "hidden" && hiddenSections.length ? `Hidden tools, ${hiddenSections.length} hidden ${hiddenSections.length === 1 ? "list" : "lists"}` : `${item.label} tools`} aria-selected={shownTab === item.value} onPress={() => openTab(item.value)} style={[styles.tab, { borderBottomColor: shownTab === item.value ? c.primary : "transparent" }]}><View style={styles.tabIcon}><Ionicons name={item.icon} size={15} color={shownTab === item.value ? c.foreground : c.mutedForeground} />{item.value === "filters" && props.filtersActive ? <View testID="board-filter-indicator" pointerEvents="none" style={[styles.filterDot, { backgroundColor: c.primary, borderColor: c.card }]} /> : item.value === "hidden" && hiddenSections.length ? <View testID="board-hidden-indicator" pointerEvents="none" style={[styles.filterDot, { backgroundColor: c.primary, borderColor: c.card }]} /> : null}</View>{tabLabels === "all" || (tabLabels === "active" && shownTab === item.value) ? <Text numberOfLines={1} style={{ color: shownTab === item.value ? c.foreground : c.mutedForeground, fontSize: 13 }}>{item.label}</Text> : null}</Pressable>)}
      </ScrollView>
      {width < 768 ? <Pressable accessibilityRole="button" accessibilityLabel="More ribbon tabs" accessibilityHint="Shows every available ribbon tab with its name" accessibilityState={{ expanded: moreOpen }} onPress={() => setMoreOpen(true)} style={styles.tabAction}><Ionicons name="ellipsis-horizontal" size={20} color={c.foreground} /></Pressable> : null}
      {context.search ? <Pressable accessibilityRole="button" accessibilityLabel="Search tasks" onPress={() => { setSearchOpen((value) => !value); resetHideTimer(); }} style={[styles.tabAction, searchVisible && { backgroundColor: c.input }]}>
        <Ionicons name="search-outline" size={18} color={searchVisible ? c.primary : c.foreground} />
      </Pressable> : null}
      <Pressable accessibilityRole="switch" accessibilityLabel={pinned ? "Unpin ribbon" : "Pin ribbon open"} accessibilityHint={pinned ? "The ribbon will auto-hide after some seconds of inactivity." : "The ribbon will stay open continuously."} accessibilityState={{ checked: pinned }} onPress={() => { if (pinned) { setPinned(false); resetHideTimer(); } else { setPinned(true); setExpanded(true); if (hideTimerRef.current) clearTimeout(hideTimerRef.current); } }} style={styles.tabAction}>{pinned ? <MaterialCommunityIcons name="pin" size={18} color={c.primary} /> : <MaterialCommunityIcons name="pin-off-outline" size={18} color={c.mutedForeground} />}</Pressable>
    </View>
    {searchVisible ? <View style={styles.searchRow}><View style={[styles.search, { borderColor: c.borderStrong, backgroundColor: c.input }]}><Ionicons name="search-outline" size={16} color={c.mutedForeground} /><TextInput accessibilityLabel="Filter tasks and labels" value={props.query} onChangeText={props.onQuery} placeholder="Search tasks…" placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground }]} />{props.query ? icon("close", "Clear search", () => props.onQuery("")) : null}</View></View> : null}
    {ribbonExpanded ? (shownTab === "home" ? <RibbonScrollView accessibilityLabel="Home ribbon tools" onInteraction={resetHideTimer} contentContainerStyle={styles.tools}>
      <View style={[styles.toolGroup, { borderColor: c.border }]}><View style={styles.toolButtons}>{tool("add", "New card", props.onNewTask)}{props.mode === "board" ? tool("add-circle-outline", "List", props.onAddSection) : null}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>CREATE</Text></View>
      {context.boardDisplay ? <>
        <View style={[styles.toolGroup, { borderColor: c.border }]}><View style={styles.toolButtons}>{tool("contract-outline", "Compact cards", props.onCompact, props.compact)}{tool("reader-outline", "Focus column", props.onFocused, props.focused)}{tool("swap-horizontal-outline", "Move arrows", props.onShowMoveArrows, props.showMoveArrows)}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>DISPLAY</Text></View>
        <View style={styles.toolGroup}><View style={styles.toolButtons}>{tool("remove", "Zoom out", () => props.onZoom(props.zoom - 0.1), false, props.zoom <= 0.7)}{tool("refresh-outline", `${Math.round(props.zoom * 100)}%`, () => props.onZoom(1), false, false, `Reset zoom to 100% (currently ${Math.round(props.zoom * 100)}%)`)}{tool("add", "Zoom in", () => props.onZoom(props.zoom + 0.1), false, props.zoom >= 1.3)}</View><Text style={[styles.caption, { color: c.mutedForeground }]}>ZOOM</Text></View>
      </> : null}
    </RibbonScrollView> : shownTab === "hidden" ? <RibbonScrollView accessibilityLabel="Hidden list tools" onInteraction={resetHideTimer} contentContainerStyle={styles.tools}>
      <View style={styles.toolGroup}><View style={styles.toolButtons}>
        {hiddenSections.map((section) => <View key={section.id} style={{ maxWidth: 180 }}>{tool("eye-outline", section.title, () => { if (hiddenSections.length === 1) setTab("home"); props.onShowSection?.(section); }, false, false, `Show ${section.title}`)}</View>)}
      </View><Text style={[styles.caption, { color: c.mutedForeground }]}>HIDDEN LISTS · {hiddenSections.length}</Text></View>
    </RibbonScrollView> : shownTab === "filters" ? props.filters : shownTab === "select" ? (props.selection ?? props.children) : props.children) : null}
    <Sheet visible={moreOpen && width < 768} onClose={() => setMoreOpen(false)}>
      <Text accessibilityRole="header" style={[styles.moreTitle, { color: c.foreground }]}>Ribbon tabs</Text>
      <Text style={[styles.moreHint, { color: c.mutedForeground }]}>Choose a tab. Swipe tool rows or use their arrows for more options.</Text>
      {visibleTabs.map((item) => <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={`Show ${item.label} ribbon tab`} accessibilityState={{ selected: shownTab === item.value }} onPress={() => { openTab(item.value); setMoreOpen(false); }} style={[styles.moreOption, { backgroundColor: shownTab === item.value ? c.primarySoft : "transparent" }]}>
        <Ionicons name={item.icon} size={20} color={c.foreground} />
        <Text style={{ flex: 1, color: c.foreground, fontSize: 15 }}>{item.label}{item.value === "hidden" ? ` (${hiddenSections.length})` : item.value === "filters" && props.filtersActive ? " · Active" : ""}</Text>
        {shownTab === item.value ? <Ionicons name="checkmark" size={20} color={c.primary} /> : null}
      </Pressable>)}
    </Sheet>
  </View>;
}

const styles = StyleSheet.create({
  moreTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  moreHint: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  moreOption: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: 10 },
  tabList: { flex: 1, minWidth: 0 },
  tabs: { flexDirection: "row", gap: 4 },
  tabIcon: { position: "relative" },
  filterDot: { position: "absolute", top: -3, right: -4, width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  icon: { width: CONTROL_SIZE, height: CONTROL_SIZE, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  iconFace: { width: 36, height: 36, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  searchRow: { paddingHorizontal: 12, paddingVertical: 8 }, search: { width: "100%", minHeight: 44, borderWidth: 1, borderRadius: 9, paddingLeft: 12, flexDirection: "row", alignItems: "center", gap: 9 }, input: { flex: 1, minWidth: 0, minHeight: 44, fontSize: 14 },
  tabRow: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, gap: 4 }, tab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 44, minHeight: 44, paddingHorizontal: 6, borderBottomWidth: 1 }, tabAction: { width: CONTROL_SIZE, height: CONTROL_SIZE, alignItems: "center", justifyContent: "center", borderRadius: 7 },
  tools: { flexDirection: "row", paddingHorizontal: 10, paddingBottom: 4, paddingTop: 5 }, toolGroup: { borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5, gap: 3 }, toolButtons: { flexDirection: "row" }, tool: { minWidth: 65, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 6 }, toolText: { fontSize: 10 }, caption: { textAlign: "center", fontSize: 9, letterSpacing: 0.5 },
});
