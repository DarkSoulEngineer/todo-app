import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { setEventOverride } from "@/lib/features/active-events";
import { useActiveEvents } from "@/hooks/use-active-events";
import { useTheme } from "@/providers/theme-provider";

export function EventDebugButton() {
  const { theme: { colors: c } } = useTheme();
  const { override } = useActiveEvents();
  const active = override === "all";

  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Debug events ${active ? "on" : "off"}`}
    accessibilityHint={active ? "Deactivate all event previews" : "Activate all event previews"}
    accessibilityState={{ selected: active }}
    onPress={() => setEventOverride(active ? null : "all")}
    style={({ pressed }) => [styles.control, { opacity: pressed ? 0.75 : 1 }]}
  >
    <Ionicons name="bug-outline" size={19} color={active ? c.primary : c.mutedForeground} />
    <Text style={{ fontSize: 10, color: active ? c.primary : c.mutedForeground }}>Debug events</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  control: { minWidth: 76, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 6 },
});
