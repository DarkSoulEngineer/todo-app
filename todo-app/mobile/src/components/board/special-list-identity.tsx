import { StyleSheet, Text, View } from "react-native";
import { getSpecialListRule } from "@/lib/features/special-lists";
import { useTheme } from "@/providers/theme-provider";

/** Make a name's special meaning visible before a card is placed in the list. */
export function SpecialListIdentity({ title }: { title: string }) {
  const { theme: { colors: c } } = useTheme();
  const rule = getSpecialListRule(title);
  if (!rule) return null;
  const color = rule.id === "completed" ? c.success : rule.id === "canceled" ? c.destructive : c.info;
  return <View testID="special-list-identity" style={[styles.badge, { borderColor: color }]}>
    <Text style={{ color, fontSize: 13, fontWeight: "700" }}>{rule.symbol}</Text>
    <Text style={{ color: c.foreground, fontSize: 10, flexShrink: 1 }}>{rule.label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderLeftWidth: 2, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 3 },
});
