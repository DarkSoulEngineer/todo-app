import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/providers/theme-provider";

/** Keep fields mounted so hiding a section never discards an in-progress draft. */
export function CollapsibleTaskSection({ title, summary, children, style }: {
  title: string;
  summary?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme: { colors: c } } = useTheme();
  const [expanded, setExpanded] = useState(true);
  return <View style={style}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${title} section`} accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setExpanded((current) => !current)} style={({ pressed }) => [styles.heading, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={13} color={c.mutedForeground} />
      <Text style={[styles.title, { color: c.mutedForeground }]}>{title}</Text>
      {summary ? <Text numberOfLines={1} style={[styles.summary, { color: c.mutedForeground }]}>{summary}</Text> : null}
    </Pressable>
    <View testID={`task-section-content-${title.toLowerCase().replace(/\s+/g, "-")}`} style={!expanded ? styles.hidden : undefined} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}>
      {children}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  heading: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7 },
  title: { flex: 1, fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  summary: { flexShrink: 1, maxWidth: "50%", fontSize: 10, fontWeight: "600" },
  hidden: { display: "none" },
});
