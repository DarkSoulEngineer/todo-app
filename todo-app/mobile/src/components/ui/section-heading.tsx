import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useTheme } from "@/providers/theme-provider";

/**
 * Plain section title for content groups. The title sits on the page canvas;
 * only the controls or rows underneath belong to a card.
 */
export function SectionHeading({
  title,
  subtitle,
  right,
  style,
  titleStyle,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.foreground }, titleStyle]}>
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: "700", letterSpacing: -0.2 },
  subtitle: { fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 2 },
  right: { flexShrink: 0, flexDirection: "row", alignItems: "center" },
});
