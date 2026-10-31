import { StyleSheet, Text, View } from "react-native";
import { classifySpecialCardTag } from "@/lib/features/card-themes";
import { useActiveEvents } from "@/hooks/use-active-events";
import { toggleCardTag } from "@/lib/features/special-card-tags";
import { useTheme } from "@/providers/theme-provider";
import { CardTagOption } from "@/components/ui/card-tag-option";

/** Event tags stay in the Tags section; status now lives at the top of the editor. */
export function SpecialCardTagPicker({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { theme: { colors: c } } = useTheme();
  const { events } = useActiveEvents();
  if (!events.length) return null;
  return <View testID="special-card-tag-picker" style={styles.group}>
    <Text style={[styles.label, { color: c.mutedForeground }]}>EVENT</Text>
    <View style={styles.options}>{events.map((entry) => {
      const selected = tags.some((tag) => classifySpecialCardTag(tag)?.theme.id === entry.id);
      return <CardTagOption key={entry.id} label={entry.label} color={entry.accent} selected={selected} accessibilityLabel={`Event tag ${entry.label}`} accessibilityHint="Choose at most one event tag. Tap again to remove." onPress={() => onChange(toggleCardTag(tags, entry.label))} />;
    })}</View>
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 9, paddingBottom: 4 },
});
