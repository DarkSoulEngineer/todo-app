import { useId } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Svg, Text as SvgText } from "react-native-svg";
import { chartCoordinates, ringFraction, smoothChartPath } from "@/lib/features/insights-chart-geometry";
import type { DailyPoint } from "@/lib/features/insights";
import { useTheme } from "@/providers/theme-provider";

export interface ChartSlice { label: string; value: number; color: string }

export function AreaDiagram({ points, previous = [], compact = false, selected = null, onSelect }: {
  points: DailyPoint[];
  previous?: DailyPoint[];
  compact?: boolean;
  selected?: number | null;
  onSelect?: (index: number) => void;
}) {
  const { theme: { colors: c, fontFamily } } = useTheme();
  const id = useId().replace(/:/g, "");
  const width = 600, height = compact ? 100 : 200;
  const observedMax = Math.max(1, ...points.map((point) => point.count), ...previous.map((point) => point.count));
  const max = observedMax > 4 ? Math.ceil(observedMax / 4) * 4 : observedMax;
  const ticks = Array.from({ length: Math.min(4, max) + 1 }, (_, index) => index / Math.min(4, max));
  const currentCoords = chartCoordinates(points.map((point) => point.count), width, height, max);
  const previousCoords = chartCoordinates(previous.map((point) => point.count), width, height, max);
  const currentPath = smoothChartPath(currentCoords);
  const previousPath = smoothChartPath(previousCoords);
  const fillPath = (path: string, coords: typeof currentCoords) => coords.length > 1 ? `${path} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z` : "";
  const active = selected === null ? null : currentCoords[selected];
  return <View testID={compact ? "insights-sparkline" : "insights-area-diagram"}>
    <View accessible accessibilityRole="image" accessibilityLabel={`Completion chart. ${points.map((point, index) => `${point.label}: ${point.count} current${previous[index] ? `, ${previous[index].count} previous` : ""}`).join("; ")}`}>
      <Svg fontFamily={fontFamily || undefined} width="100%" height={compact ? 120 : 180} viewBox={`-32 -12 ${width + 44} ${height + 30}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`${id}-current`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.primary} stopOpacity={0.65} /><Stop offset="1" stopColor={c.primary} stopOpacity={0.08} /></LinearGradient>
          <LinearGradient id={`${id}-previous`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.info} stopOpacity={0.45} /><Stop offset="1" stopColor={c.info} stopOpacity={0.06} /></LinearGradient>
        </Defs>
        {ticks.map((fraction) => <G key={fraction}><Line x1={0} x2={width} y1={height * fraction} y2={height * fraction} stroke={c.border} strokeWidth={0.7} />{!compact ? <SvgText x={-8} y={height * fraction + 3} fontSize={9} textAnchor="end" fill={c.mutedForeground}>{Math.round(max * (1 - fraction))}</SvgText> : null}</G>)}
        {points.map((point, index) => <Line key={point.key} x1={currentCoords[index].x} x2={currentCoords[index].x} y1={0} y2={height} stroke={c.border} strokeWidth={0.5} strokeOpacity={0.5} />)}
        {previousPath ? <><Path d={fillPath(previousPath, previousCoords)} fill={`url(#${id}-previous)`} /><Path d={previousPath} stroke={c.info} strokeWidth={2} fill="none" strokeDasharray="5 4" /></> : null}
        {currentPath ? <><Path d={fillPath(currentPath, currentCoords)} fill={`url(#${id}-current)`} /><Path d={currentPath} stroke={c.primary} strokeWidth={2.5} fill="none" /></> : null}
        {compact || currentCoords.length === 1 ? currentCoords.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r={3} fill={c.primary} stroke={c.card} strokeWidth={1.5} />) : null}
        {active ? <><Line x1={active.x} x2={active.x} y1={0} y2={height} stroke={c.foreground} strokeDasharray="3 4" strokeOpacity={0.4} /><Circle cx={active.x} cy={active.y} r={4} fill={c.primary} stroke={c.card} strokeWidth={2} /></> : null}
      </Svg>
    </View>
    {!compact ? <View style={styles.dateRow}>{points.map((point, index) => <Pressable key={point.key} accessibilityRole="button" accessibilityLabel={`${point.label}: ${point.count} completed, ${previous[index]?.count ?? 0} previous period`} accessibilityState={{ selected: index === selected }} onPress={() => onSelect?.(index)} style={[styles.dateButton, index === selected && { backgroundColor: c.primarySoft }]}><Text numberOfLines={1} style={{ color: index === selected ? c.primary : c.mutedForeground, fontSize: 9 }}>{point.label}</Text></Pressable>)}</View> : null}
  </View>;
}

export function ProgressRing({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const { theme: { colors: c } } = useTheme();
  const fraction = ringFraction(value, total), radius = 30, length = 2 * Math.PI * radius;
  return <View style={styles.smallRing} accessible accessibilityLabel={`${label}: ${value} of ${total}, ${Math.round(fraction * 100)} percent`}>
    <Svg width={76} height={76} viewBox="0 0 76 76"><Circle cx={38} cy={38} r={radius} fill="none" stroke={c.secondary} strokeWidth={6} />{fraction > 0 ? <Circle cx={38} cy={38} r={radius} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeDasharray={[length * fraction, length]} transform="rotate(-90 38 38)" /> : null}</Svg>
    <View style={styles.ringCenter}><Text style={{ color: c.foreground, fontSize: 16, fontWeight: "800" }}>{Math.round(fraction * 100)}%</Text></View>
    <Text style={{ color: c.mutedForeground, fontSize: 10, marginTop: 3 }}>{label}</Text>
  </View>;
}

export function RadialDiagram({ slices, total }: { slices: ChartSlice[]; total: number }) {
  const { theme: { colors: c, fontFamily } } = useTheme();
  return <View testID="insights-radial-diagram" style={styles.radial} accessible accessibilityRole="image" accessibilityLabel={`Task balance: ${slices.map((slice) => `${slice.label} ${slice.value} of ${total}`).join(", ")}`}>
    <Svg fontFamily={fontFamily || undefined} width="100%" height={235} viewBox="0 0 240 240">
      {slices.map((slice, index) => {
        const radius = 103 - index * 17, length = Math.PI * 2 * radius, fraction = ringFraction(slice.value, total);
        return <G key={slice.label}><Circle cx={120} cy={120} r={radius} fill="none" stroke={c.secondary} strokeWidth={9} />{fraction > 0 ? <Circle cx={120} cy={120} r={radius} fill="none" stroke={slice.color} strokeWidth={9} strokeLinecap="round" strokeDasharray={[length * fraction, length]} transform="rotate(-90 120 120)" /> : null}</G>;
      })}
      <SvgText x={120} y={122} textAnchor="middle" fill={c.foreground} fontSize={30} fontWeight="800">{total}</SvgText>
      <SvgText x={120} y={141} textAnchor="middle" fill={c.mutedForeground} fontSize={11}>total tasks</SvgText>
    </Svg>
  </View>;
}

export function WeekdayDiagram({ values, height = 190 }: { values: number[]; height?: number }) {
  const { theme: { colors: c, fontFamily } } = useTheme();
  const observedMax = Math.max(1, ...values);
  const max = observedMax > 4 ? Math.ceil(observedMax / 4) * 4 : observedMax;
  const ticks = Array.from({ length: Math.min(4, max) + 1 }, (_, index) => index / Math.min(4, max));
  const palette = [c.success, c.info, c.primary, c.warning, c.primary, c.info, c.success];
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return <View testID="insights-weekday-diagram" accessible accessibilityRole="image" accessibilityLabel={`Completions by weekday: ${values.map((value, index) => `${labels[index]} ${value}`).join(", ")}`}>
    <Svg fontFamily={fontFamily || undefined} width="100%" height={height} viewBox="0 0 350 190" preserveAspectRatio="none">
      {ticks.map((fraction) => <G key={fraction}><Line x1={28} x2={348} y1={18 + fraction * 140} y2={18 + fraction * 140} stroke={c.border} strokeWidth={0.6} /><SvgText x={20} y={21 + fraction * 140} textAnchor="end" fontSize={9} fill={c.mutedForeground}>{Math.round(max * (1 - fraction))}</SvgText></G>)}
      {values.map((value, index) => <G key={index}><Rect x={38 + index * 44} y={18} width={24} height={140} rx={4} fill={c.secondary} fillOpacity={0.6} /><Rect x={38 + index * 44} y={158 - (value / max) * 140} width={24} height={Math.max(0, (value / max) * 140)} rx={4} fill={palette[index]} /><SvgText x={50 + index * 44} y={178} textAnchor="middle" fontSize={9} fill={c.mutedForeground}>{labels[index]}</SvgText>{value ? <SvgText x={50 + index * 44} y={Math.max(11, 151 - (value / max) * 140)} textAnchor="middle" fontSize={9} fill={c.foreground}>{value}</SvgText> : null}</G>)}
    </Svg>
  </View>;
}

export function DonutDiagram({ slices, total }: { slices: ChartSlice[]; total: number }) {
  const { theme: { colors: c, fontFamily } } = useTheme();
  const length = 2 * Math.PI * 44;
  return <View testID="insights-priority-donut" accessible accessibilityRole="image" accessibilityLabel={`Priorities: ${slices.map((slice) => `${slice.label} ${slice.value}`).join(", ")}`}>
    <Svg fontFamily={fontFamily || undefined} width={128} height={128} viewBox="0 0 128 128"><Circle cx={64} cy={64} r={44} fill="none" stroke={c.secondary} strokeWidth={19} />{slices.map((slice, index) => {
      const segment = ringFraction(slice.value, total) * length;
      const start = slices.slice(0, index).reduce((sum, item) => sum + ringFraction(item.value, total) * length, 0);
      return segment > 0 ? <Circle key={slice.label} cx={64} cy={64} r={44} fill="none" stroke={slice.color} strokeWidth={19} strokeDasharray={[Math.max(0, segment - 2), length]} strokeDashoffset={-start} transform="rotate(-90 64 64)" /> : null;
    })}<SvgText x={64} y={65} textAnchor="middle" fill={c.foreground} fontSize={22} fontWeight="800">{total}</SvgText><SvgText x={64} y={82} textAnchor="middle" fill={c.mutedForeground} fontSize={9}>tasks</SvgText></Svg>
  </View>;
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: "row", paddingLeft: 16 },
  dateButton: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 6, paddingHorizontal: 1 },
  smallRing: { flex: 1, alignItems: "center", minWidth: 0 },
  ringCenter: { position: "absolute", top: 0, width: 76, height: 76, alignItems: "center", justifyContent: "center" },
  radial: { alignItems: "center" },
});
