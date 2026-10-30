import { Pressable, StyleSheet, Text, View } from "react-native";
import { classifySpecialCardTag } from "@/lib/features/card-themes";
import { useActiveEvents } from "@/hooks/use-active-events";
import { toggleCardTag } from "@/lib/features/special-card-tags";
import { useTheme } from "@/providers/theme-provider";

/** Event tags stay in the Tags section; status now lives at the top of the editor. */
export function SpecialCardTagPicker({ tags, onChange, showLabel = true }: { tags: string[]; onChange: (tags: string[]) => void; showLabel?: boolean }) {
  const { theme: { colors: c } } = useTheme();
  const { events } = useActiveEvents();
  if (!events.length) return null;
  return <View testID="special-card-tag-picker" style={styles.group}>
    {showLabel ? <Text style={[styles.label, { color: c.mutedForeground }]}>EVENT</Text> : null}
    <View style={styles.options}>{events.map((entry) => {
      const selected = tags.some((tag) => classifySpecialCardTag(tag)?.theme.id === entry.id);
      return <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`Event tag ${entry.label}`} accessibilityHint="Choose at most one event tag. Tap again to remove." accessibilityState={{ selected }} onPress={() => onChange(toggleCardTag(tags, entry.label))} style={({ pressed }) => [styles.option, { borderColor: selected ? c.borderStrong : c.border, backgroundColor: selected ? c.cardElevated : c.secondary }]}>
        <Text style={{ color: c.foreground, fontSize: 12, fontWeight: "600" }}>{entry.label}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 9, paddingBottom: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
});
