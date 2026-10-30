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
  }));
  return <View testID="card-status-picker" accessibilityRole="radiogroup" accessibilityLabel="Card status tags" style={styles.track}>
    {options.map((option) => {
      const selected = current?.id === option.id;
      return <Pressable
        key={option.id}
        accessibilityRole="radio"
        accessibilityLabel={`Status tag ${option.label}`}
        accessibilityHint={selected ? "Tap again to remove this status tag." : `Add the ${option.label} status tag.`}
        accessibilityState={{ checked: selected, selected }}
        onPress={() => onChange(toggleCardTag(tags, option.label))}
        style={styles.segment}
      >
        {({ pressed }) => <>
          <View style={[styles.statusDot, { backgroundColor: option.color, opacity: pressed ? 1 : 0.7 }]} />
          <Text numberOfLines={1} style={[styles.label, { color: selected ? option.color : c.mutedForeground }]}>{option.label}</Text>
        </>}
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", gap: 8 },
  segment: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderRadius: 999 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 12, letterSpacing: 0.1, fontWeight: "600" },
});

export { CardStatusPicker as StatusPicker };
export { CardStatusPicker as default };
