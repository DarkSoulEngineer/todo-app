import { Pressable, StyleSheet, Text, View } from "react-native";
import { STATUS_CARD_THEMES, classifySpecialCardTag } from "@/lib/features/card-themes";
import { toggleCardTag } from "@/lib/features/special-card-tags";
import { useTheme } from "@/providers/theme-provider";

/**
 * Status is a property of the card, not an ordinary tag, so it gets its own
 * top-of-page control instead of living inside the Tags section.
 * A single flat rail keeps all four states visible and easy to scan.
 */
export function CardStatusPicker({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { theme: { colors: c } } = useTheme();
  const current = STATUS_CARD_THEMES.find((entry) => tags.some((tag) => classifySpecialCardTag(tag)?.theme.id === entry.id));
  const clearStatus = () => onChange(tags.filter((tag) => classifySpecialCardTag(tag)?.group !== "status"));
  const options = [
    { id: "open", label: "Open", color: c.primary, soft: c.primarySoft },
    ...STATUS_CARD_THEMES.map((entry) => ({
      id: entry.id,
      label: entry.label,
      color: entry.id === "done" ? c.success : entry.id === "overdue" ? c.destructive : c.foreground,
      soft: entry.id === "done" ? c.successSoft : entry.id === "overdue" ? c.destructiveSoft : c.border,
    })),
  ];
  return <View accessibilityRole="radiogroup" accessibilityLabel="Card status" testID="card-status-picker" style={[styles.track, { backgroundColor: c.secondary, borderColor: c.border }]}>
    {options.map((option) => {
      const selected = option.id === "open" ? !current : current?.id === option.id;
      return <Pressable
        key={option.id}
        accessibilityRole="radio"
        accessibilityLabel={`Card status ${option.label}`}
        accessibilityState={{ checked: selected, selected }}
        onPress={() => option.id === "open" ? clearStatus() : onChange(toggleCardTag(tags, option.label))}
        style={({ pressed }) => [styles.segment, { backgroundColor: selected ? option.soft : "transparent", borderColor: selected ? option.color : "transparent" }, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text numberOfLines={1} style={[styles.label, { color: selected ? option.color : c.mutedForeground, fontWeight: selected ? "800" : "600" }]}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", gap: 3, padding: 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  segment: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 1, borderRadius: 9 },
  label: { fontSize: 12, letterSpacing: 0.1 },
});
