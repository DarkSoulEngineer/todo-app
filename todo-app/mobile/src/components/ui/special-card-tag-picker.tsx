import { Pressable, StyleSheet, Text, View } from "react-native";
import { SEASONAL_CARD_THEMES, STATUS_CARD_THEMES, classifySpecialCardTag } from "@/lib/features/card-themes";
import { toggleCardTag } from "@/lib/features/special-card-tags";
import { useTheme } from "@/providers/theme-provider";

export function SpecialCardTagPicker({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { theme: { colors: c } } = useTheme();
  return <View testID="special-card-tag-picker" style={styles.groups}>
    {([["STATUS", STATUS_CARD_THEMES], ["EVENT", SEASONAL_CARD_THEMES]] as const).map(([group, entries]) => <View key={group} style={styles.group}>
      <Text style={[styles.label, { color: c.mutedForeground }]}>{group}</Text>
      <View style={styles.options}>{entries.map((entry) => {
        const selected = tags.some((tag) => classifySpecialCardTag(tag)?.theme.id === entry.id);
        return <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`${group === "STATUS" ? "Status" : "Event"} tag ${entry.label}`} accessibilityHint={`Choose at most one ${group.toLowerCase()} tag. Tap again to remove.`} accessibilityState={{ selected }} onPress={() => onChange(toggleCardTag(tags, entry.label))} style={[styles.option, { borderColor: selected ? entry.accent : c.border, backgroundColor: selected ? entry.wash : c.secondary }]}>
          <Text style={{ color: entry.accent, fontSize: 14 }}>{entry.symbol}</Text><Text style={{ color: c.foreground, fontSize: 12, fontWeight: selected ? "700" : "500" }}>{entry.label}</Text>
        </Pressable>;
      })}</View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  groups: { gap: 12, marginTop: 12 }, group: { gap: 6 }, label: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  option: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 10, borderWidth: 1, borderRadius: 9 },
});
