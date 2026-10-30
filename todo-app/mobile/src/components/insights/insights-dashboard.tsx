import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { InsightsPanelProps } from "@/components/janus-board-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AreaDiagram, DonutDiagram, ProgressRing, RadialDiagram, WeekdayDiagram, type ChartSlice } from "./insights-charts";
import { exportWorkspaceCsv } from "@/lib/data/transfer";
import { computeStats } from "@/lib/domain/tasks-selectors";
import { PRIORITY_META, PRIORITY_ORDER } from "@/lib/domain/constants";
import { computeInsightsForWindow } from "@/lib/features/insights";
import { bucketChartPoints, ringFraction } from "@/lib/features/insights-chart-geometry";
import { DEFAULT_FILTERS, filterTasksByFilters, getPriorityCounts, getWeekdayCompletionCounts, hasActiveFilters, windowEndFromPreset, windowStartFromPreset } from "@/lib/features/insights-filters";
import { useTheme } from "@/providers/theme-provider";
import { InsightsModuleGrid } from "./insights-module-grid";
import { InsightsEmptyState, InsightsNoResults } from "./insights-empty-state";

export function InsightsDashboard({ tasks, boards, now, filters = DEFAULT_FILTERS, onExport }: InsightsPanelProps) {
  const { theme: { colors: c } } = useTheme();
  const { width } = useWindowDimensions();
  const desktop = width >= 1100, tablet = width >= 700;
  const showCompletions = filters.status === "all" || filters.status === "completed";
  const showStatusBreakdown = filters.status === "all";
  const showCategories = filters.boardId === "all";
  const showPriorities = filters.priority === "all";
  const [selection, setSelection] = useState<{ key: string; period: string } | null>(null);
  const filtered = useMemo(() => filterTasksByFilters(tasks, filters, now, boards), [tasks, filters, now, boards]);
  const start = windowStartFromPreset(now, filters.dateRange, filters.customStart);
  const end = windowEndFromPreset(now, filters.dateRange, filters.customEnd);
  const period = useMemo(() => computeInsightsForWindow(filtered, start, end, { trendTasks: [...filtered], metricsTasks: filtered, now }), [filtered, start, end, now]);
  const stats = useMemo(() => computeStats(filtered, now), [filtered, now]);
  const points = bucketChartPoints(period.points, tablet ? 12 : 6);
  const previous = bucketChartPoints(period.previousPoints, tablet ? 12 : 6);
  const periodKey = `${format(start, "yyyy-MM-dd")}:${format(end, "yyyy-MM-dd")}`;
  const selectedIndex = selection?.period === periodKey ? points.findIndex((point) => point.key === selection.key) : -1;
  const selected = selectedIndex < 0 ? null : points[selectedIndex];
  const weekday = getWeekdayCompletionCounts(filtered, start, end);
  const priorityCounts = getPriorityCounts(filtered);
  const priorityColors = { critical: c.destructive, high: c.warning, medium: c.primary, low: c.info };
  const priorities: ChartSlice[] = PRIORITY_ORDER.map((key) => ({ label: PRIORITY_META[key].label, value: priorityCounts[key], color: priorityColors[key] }));
  const palette = [c.primary, c.info, c.success, c.warning];
  const categories = boards.map((board) => ({ label: board.label, value: filtered.filter((task) => task.category === board.id).length }));
  const uncategorized = filtered.filter((task) => !boards.some((board) => board.id === task.category)).length;
  if (uncategorized) categories.push({ label: "Uncategorized", value: uncategorized });
  const ranked = categories.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const visibleCategories = ranked.length > 5 ? [...ranked.slice(0, 4), { label: "Other categories", value: ranked.slice(4).reduce((sum, item) => sum + item.value, 0) }] : ranked;
  const balance: ChartSlice[] = [
    { label: "Completed", value: stats.completed, color: c.primary },
    { label: "Upcoming", value: stats.upcoming, color: c.info },
    { label: "Overdue", value: stats.overdue, color: c.warning },
    { label: "Canceled", value: stats.canceled, color: c.mutedForeground },
  ];
  const exportFiltered = () => {
    if (onExport) { void onExport(filtered, boards); return; }
    void exportWorkspaceCsv({ tasks: filtered, boards, sections: [] }, "insights-export");
  };
  const dateLabel = `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  const average = (period.windowTotal / Math.max(1, period.points.length)).toFixed(1);
  const hasTasks = filtered.length > 0;
  const hasTrend = period.windowTotal > 0 || period.previousWindowTotal > 0;
  const hasDistribution = showCategories || showPriorities;
  const fullOverview = showStatusBreakdown && showCategories && showPriorities && hasTrend;
  const balancedRow = desktop && fullOverview;
  const moduleStyle = balancedRow ? { flexGrow: 1 } : undefined;

  return <View testID="insights-dashboard" style={styles.dashboard}>
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 5 }}><Text style={[styles.eyebrow, { color: c.primary }]}>PRODUCTIVITY ANALYTICS</Text><Text accessibilityRole="header" style={[styles.title, { color: c.foreground }]}>Your work at a glance</Text><Text style={[styles.subtitle, { color: c.mutedForeground }]}>{dateLabel}</Text></View>
      <Button variant="outline" size={tablet ? "md" : "sm"} label={tablet ? "Export report" : "Export"} accessibilityLabel="Export filtered tasks as CSV" onPress={exportFiltered} disabled={!filtered.length} />
    </View>

    {!hasTasks ? <InsightsNoResults /> : <>
    {showCompletions ? <View testID="insights-top-row" style={[styles.row, desktop && styles.horizontal, desktop && !fullOverview && styles.contentSized]}>
      <View testID="insights-summary-column" style={[styles.summaryColumn, desktop ? { flex: 0.85 } : tablet && styles.horizontal]}>
        <DiagramCard title="Completed tasks" caption="THIS PERIOD" testID="insights-completed-card" style={tablet && !desktop ? { flex: 1 } : undefined}>
          <View style={styles.summaryMetric}><Text style={[styles.bigNumber, { color: c.foreground }]}>{period.windowTotal}</Text><ChangeBadge change={period.periodChange} /></View>
          {hasTrend ? <AreaDiagram compact points={points} /> : <Text style={[styles.small, { color: c.mutedForeground, marginVertical: 12 }]}>No completions in this period</Text>}
          <View style={styles.split}><Text style={[styles.small, { color: c.mutedForeground }]}>Previous period</Text><Text style={[styles.small, { color: c.foreground, fontWeight: "700" }]}>{period.previousWindowTotal} completed</Text></View>
        </DiagramCard>
        {showStatusBreakdown ? <Card testID="insights-health-rings" style={[styles.healthCard, tablet && !desktop && { flex: 1, alignItems: "center" }]}>
          <ProgressRing value={stats.completed} total={stats.total} color={c.primary} label="Completed" />
          <ProgressRing value={stats.active} total={stats.total} color={c.info} label="Active" />
          <ProgressRing value={stats.canceled} total={stats.total} color={c.mutedForeground} label="Canceled" />
        </Card> : null}
      </View>

      <DiagramCard title="Performance overview" caption={`${period.points.length} DAYS`} testID="insights-performance" style={desktop ? { flex: 2 } : undefined}>
        <View style={styles.performanceMeta}>
          <View style={{ gap: 4 }}><Text style={[styles.performanceValue, { color: c.foreground }]}>{average}<Text style={{ color: c.mutedForeground, fontSize: 12, fontWeight: "500" }}> / day</Text></Text><Text style={[styles.small, { color: c.mutedForeground }]}>Average completions</Text></View>
          <View style={{ gap: 8 }}><LegendDot label="Current period" color={c.primary} /><LegendDot label="Previous period" color={c.info} dashed /></View>
        </View>
        {hasTrend ? <AreaDiagram points={points} previous={previous} selected={selectedIndex < 0 ? null : selectedIndex} onSelect={(index) => setSelection({ key: points[index].key, period: periodKey })} /> : <InsightsEmptyState title="No completions in this period" description="Choose a wider date range in Filters, or complete a task to start your trend." />}
        <View style={[styles.chartFooter, { borderColor: c.border }]}>
          {selected ? <Pressable testID="insights-trend-detail" accessibilityRole="button" accessibilityLabel="Dismiss trend detail" onPress={() => setSelection(null)} style={styles.selectedDetail}><Text accessibilityLiveRegion="polite" style={[styles.small, { flex: 1, color: c.foreground }]}>{selected.label} · {selected.count} current / {previous[selectedIndex]?.count ?? 0} previous</Text><Ionicons name="close" size={16} color={c.mutedForeground} /></Pressable> : <Text style={[styles.small, { color: c.mutedForeground }]}>{period.windowTotal || period.previousWindowTotal ? "Tap a date to compare periods" : "No completions in this period"}</Text>}
        </View>
      </DiagramCard>
    </View> : null}

    <InsightsModuleGrid testID="insights-bottom-row" columns={desktop ? 3 : tablet ? 2 : 1} equalHeight={balancedRow}>
      {showStatusBreakdown ? <DiagramCard title="Task balance" caption="ALL MATCHING TASKS" testID="insights-balance" style={moduleStyle}>
        <RadialDiagram slices={balance} total={stats.total} />
        <View style={styles.balanceLegend}>{balance.map((slice) => <View key={slice.label} style={styles.split}><LegendDot label={slice.label} color={slice.color} /><Text style={[styles.small, { color: c.foreground, fontWeight: "700" }]}>{slice.value}<Text style={{ color: c.mutedForeground, fontWeight: "400" }}> / {stats.total}</Text></Text></View>)}</View>
        <View style={[styles.chartFooter, { borderColor: c.border }]}><Text style={[styles.small, { color: c.mutedForeground }]}>{Math.round(stats.completionRate * 100)}% of matching tasks completed</Text></View>
      </DiagramCard> : null}

      {showCompletions ? <DiagramCard title="Weekly rhythm" caption="COMPLETIONS" testID="insights-weekly" style={moduleStyle}>
        {period.windowTotal > 0 ? <View style={balancedRow ? { flexGrow: 1, justifyContent: "center" } : undefined}><WeekdayDiagram values={weekday} height={balancedRow ? 270 : 190} /></View> : <InsightsEmptyState title="A fresh start for this period" description="Your weekly rhythm will appear as you complete tasks." icon="calendar-outline" />}
        <View style={[styles.rhythmMetrics, { borderColor: c.border }]}>
          <RhythmMetric icon="flame-outline" label="Current streak" value={`${period.streak} days`} color={c.warning} />
          <RhythmMetric icon="trophy-outline" label="Best day" value={`${period.best} done`} color={c.primary} />
        </View>
      </DiagramCard> : null}

      {hasDistribution ? <DiagramCard title="Task distribution" caption={showCategories && showPriorities ? "CATEGORIES & PRIORITY" : showCategories ? "CATEGORIES" : "PRIORITY"} testID="insights-distribution" style={moduleStyle}>
        {showCategories ? <View testID="insights-category-bars" style={styles.categoryList}>{visibleCategories.length ? visibleCategories.map((item, index) => <View key={item.label} testID="insights-category-item" style={{ gap: 6 }}><View style={styles.split}><Text numberOfLines={1} style={[styles.small, { flex: 1, color: c.foreground }]}>{item.label}</Text><Text style={[styles.small, { color: c.mutedForeground }]}>{item.value} · {Math.round(ringFraction(item.value, stats.total) * 100)}%</Text></View><View style={[styles.categoryTrack, { backgroundColor: c.secondary }]}><View style={{ height: "100%", width: `${ringFraction(item.value, stats.total) * 100}%`, backgroundColor: palette[index % palette.length], borderRadius: 4 }} /></View></View>) : <Text style={[styles.small, { color: c.mutedForeground }]}>No category data for these filters</Text>}</View> : null}
        {showPriorities ? <View style={[styles.prioritySection, !showCategories && styles.standalonePriority, { borderColor: c.border }]}><DonutDiagram slices={priorities} total={stats.total} /><View style={{ flex: 1, gap: 10 }}>{priorities.map((slice) => <View key={slice.label} style={styles.split}><LegendDot label={slice.label} color={slice.color} /><Text style={[styles.small, { color: c.foreground }]}>{slice.value}</Text></View>)}</View></View> : null}
      </DiagramCard> : null}
      {!showCompletions && !showStatusBreakdown ? <DiagramCard title="Filtered task summary" caption="CURRENT SELECTION" testID="insights-filtered-summary">
        <Text style={[styles.bigNumber, { color: c.foreground }]}>{stats.total}</Text>
        <Text style={[styles.small, { color: c.mutedForeground }]}>Matching {filters.status} task{stats.total === 1 ? "" : "s"}</Text>
        <View style={[styles.chartFooter, { borderColor: c.border }]}><Text style={[styles.small, { color: c.mutedForeground }]}>Completion charts are hidden for this status. Choose All statuses in Filters to see the full overview.</Text></View>
      </DiagramCard> : null}
    </InsightsModuleGrid>
    </>}
    <View style={[styles.split, { flexWrap: "wrap" }]}>{hasActiveFilters(filters) ? <View testID="insights-filter-count" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Ionicons name="funnel-outline" size={12} color={c.mutedForeground} /><Text style={[styles.small, { color: c.mutedForeground }]}>{filtered.length} task{filtered.length === 1 ? "" : "s"} match current filters</Text></View> : null}<Text style={[styles.small, { color: c.mutedForeground, marginLeft: "auto" }]}>Updated {format(now, "HH:mm")}</Text></View>
  </View>;
}

function DiagramCard({ title, caption, children, style, testID }: { title: string; caption: string; children: ReactNode; style?: React.ComponentProps<typeof View>["style"]; testID?: string }) {
  const { theme: { colors: c } } = useTheme();
  return <Card testID={testID} style={[styles.diagramCard, style]}><View style={styles.cardHeader}><Text accessibilityRole="header" style={[styles.cardTitle, { color: c.foreground }]}>{title}</Text><Text style={[styles.caption, { color: c.mutedForeground }]}>{caption}</Text></View>{children}</Card>;
}

function LegendDot({ label, color, dashed = false }: { label: string; color: string; dashed?: boolean }) {
  const { theme: { colors: c } } = useTheme();
  return <View style={styles.legend}><View style={dashed ? { width: 12, borderTopWidth: 2, borderStyle: "dashed", borderColor: color } : { width: 7, height: 7, borderRadius: 4, backgroundColor: color }} /><Text style={[styles.small, { color: c.mutedForeground }]}>{label}</Text></View>;
}

function ChangeBadge({ change }: { change: number | null }) {
  const { theme: { colors: c } } = useTheme();
  const positive = change !== null && change >= 0;
  return <View style={[styles.changeBadge, { backgroundColor: change === null ? c.secondary : positive ? c.successSoft : c.destructiveSoft }]}><Ionicons name={change === null ? "remove-outline" : positive ? "trending-up-outline" : "trending-down-outline"} size={13} color={change === null ? c.mutedForeground : positive ? c.success : c.destructive} /><Text style={{ color: change === null ? c.mutedForeground : positive ? c.success : c.destructive, fontSize: 10, fontWeight: "700" }}>{change === null ? "No comparison" : `${change > 0 ? "+" : ""}${change}% vs prev`}</Text></View>;
}

function RhythmMetric({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  const { theme: { colors: c } } = useTheme();
  return <View style={{ flex: 1, gap: 7 }}><Ionicons name={icon} size={19} color={color} /><Text style={[styles.small, { color: c.mutedForeground }]}>{label}</Text><Text style={{ color: c.foreground, fontSize: 18, fontWeight: "800" }}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  dashboard: { width: "100%", maxWidth: 1500, alignSelf: "center", minWidth: 0, gap: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 6, marginBottom: 4 },
  eyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1.6 },
  title: { fontSize: 25, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { fontSize: 12 },
  row: { gap: 16 },
  horizontal: { flexDirection: "row", alignItems: "stretch" },
  contentSized: { alignItems: "flex-start" },
  summaryColumn: { gap: 14, minWidth: 0 },
  diagramCard: { padding: 18, borderRadius: 16, minWidth: 0 },
  cardHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 18 },
  cardTitle: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },
  caption: { fontSize: 8, fontWeight: "700", letterSpacing: 0.6 },
  small: { fontSize: 11, lineHeight: 16 },
  summaryMetric: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  bigNumber: { fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  split: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  healthCard: { paddingHorizontal: 10, paddingVertical: 14, borderRadius: 16, flexDirection: "row", gap: 4 },
  performanceMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  performanceValue: { fontSize: 26, fontWeight: "800" },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  chartFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12 },
  selectedDetail: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 30 },
  balanceLegend: { gap: 12, marginTop: 10 },
  rhythmMetrics: { flexDirection: "row", gap: 20, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 18, marginTop: 18 },
  changeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  categoryList: { gap: 13 },
  categoryTrack: { height: 6, borderRadius: 4, overflow: "hidden" },
  prioritySection: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 16 },
  standalonePriority: { borderTopWidth: 0, marginTop: 0, paddingTop: 0 },
});
