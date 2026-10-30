import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTheme } from "@/providers/theme-provider";
import { JanusLogo } from "@/components/ui/janus-logo";

/** Match Calendar's quiet, logo-based empty canvas rather than an alert banner. */
export function InsightsNoResults() {
  const { theme: { colors: c } } = useTheme();
  const { width } = useWindowDimensions();
  return <View testID="insights-empty-results" style={styles.canvas}>
    <View testID="insights-empty-watermark" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.watermark}>
      <JanusLogo size={Math.min(320, width * 0.55)} color={c.foreground} surfaceColor={c.background} shadow />
    </View>
    <View style={styles.centeredCopy}>
      <Text accessibilityRole="header" style={[styles.title, { color: c.foreground }]}>No insights to show yet</Text>
      <Text style={[styles.description, styles.centeredText, { color: c.mutedForeground }]}>No tasks match these filters. Try another category, priority, or status in Filters.</Text>
    </View>
  </View>;
}

/** Content-sized alternative to a chart with no observations. */
export function InsightsEmptyState({ title, description, icon = "analytics-outline", testID }: {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}) {
  const { theme: { colors: c } } = useTheme();
  return <View testID={testID} style={styles.empty}>
    <View style={[styles.icon, { backgroundColor: c.primarySoft }]}><Ionicons name={icon} size={22} color={c.primary} /></View>
    <View style={styles.copy}><Text accessibilityRole="header" style={[styles.title, { color: c.foreground }]}>{title}</Text><Text style={[styles.description, { color: c.mutedForeground }]}>{description}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  canvas: { alignItems: "center", justifyContent: "center", paddingVertical: 32, paddingHorizontal: 20, gap: 12 },
  watermark: { opacity: 0.08 },
  centeredCopy: { alignItems: "center", gap: 8, maxWidth: 360 },
  centeredText: { textAlign: "center" },
  empty: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontSize: 15, fontWeight: "700" },
  description: { fontSize: 12, lineHeight: 18 },
});
