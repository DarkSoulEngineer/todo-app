import { Pressable, StyleSheet, Text, View } from "react-native";
import { STATUS_CARD_THEMES, classifySpecialCardTag } from "@/lib/features/card-themes";
import { toggleCardTag } from "@/lib/features/special-card-tags";
import { useTheme } from "@/providers/theme-provider";

/**
 * Status is a property of the card, not an ordinary tag, so it gets its own
 * top-of-page control instead of living inside the Tags section.
 * The neutral state is represented by no selected tag.
 */
export function CardStatusPicker({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { theme: { colors: c } } = useTheme();
  const current = STATUS_CARD_THEMES.find((entry) => tags.some((tag) => classifySpecialCardTag(tag)?.theme.id === entry.id));
  const options = STATUS_CARD_THEMES.map((entry) => ({
    ...entry,
    color: entry.id === "done" ? c.success : entry.id === "overdue" ? c.destructive : c.mutedForeground,
    soft: entry.id === "done" ? c.successSoft : entry.id === "overdue" ? c.destructiveSoft : c.secondary,
  }));
  return <View testID="card-status-picker">
    <View accessibilityRole="radiogroup" accessibilityLabel="Card status tags" style={[styles.track, { backgroundColor: c.secondary, borderColor: c.border }]}>
    {options.map((option) => {
      const selected = current?.id === option.id;
      return <Pressable
        key={option.id}
        accessibilityRole="radio"
        accessibilityLabel={`Status tag ${option.label}`}
        accessibilityHint={selected ? "Tap again to remove this status tag." : `Add the ${option.label} status tag.`}
        accessibilityState={{ checked: selected, selected }}
        onPress={() => onChange(toggleCardTag(tags, option.label))}
        style={({ pressed }) => [styles.segment, { backgroundColor: selected ? option.soft : "transparent", borderColor: selected ? option.color : c.borderStrong }, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text numberOfLines={1} style={[styles.label, { color: selected ? option.color : c.mutedForeground, fontWeight: selected ? "800" : "600" }]}>{option.label}</Text>
      </Pressable>;
    })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", gap: 4, padding: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13 },
  segment: { flex: 1, minWidth: 0, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, borderWidth: 1, borderRadius: 10 },
  label: { fontSize: 12, letterSpacing: 0.1 },
});

export { CardStatusPicker as StatusPicker };
export { CardStatusPicker as default };
