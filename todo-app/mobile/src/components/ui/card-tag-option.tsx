import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/providers/theme-provider";

/** Card-style dot and label, with an editor-sized touch target. */
export function CardTagOption({ label, color, selected = true, removable = false, onPress, accessibilityLabel = label, accessibilityHint }: {
  label: string;
  color: string;
  selected?: boolean;
  removable?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { theme: { colors: c } } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint ?? (removable ? "Tap to remove this tag." : undefined)} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tag, { opacity: pressed ? 0.55 : selected ? 1 : 0.65 }]}>
    <View style={[styles.dot, { backgroundColor: color }]} />
    <Text numberOfLines={1} style={[styles.label, { color: selected ? c.foreground : c.mutedForeground }]}>{label}</Text>
    {removable ? <Text accessible={false} style={[styles.remove, { color: c.mutedForeground }]}>×</Text> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  tag: { minHeight: 44, maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { flexShrink: 1, fontSize: 12, fontWeight: "600" },
  remove: { fontSize: 16, lineHeight: 20, paddingLeft: 2 },
});
