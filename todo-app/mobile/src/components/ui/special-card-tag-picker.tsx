import { Pressable, StyleSheet, Text, View } from "react-native";
import { STATUS_CARD_THEMES, classifySpecialCardTag } from "@/lib/features/card-themes";
import { useActiveEvents } from "@/hooks/use-active-events";
import { toggleCardTag } from "@/lib/features/special-card-tags";
import { useTheme } from "@/providers/theme-provider";
import { tactileSurface } from "./tactile";

export function SpecialCardTagPicker({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { theme: { colors: c, scheme } } = useTheme();
  const { events } = useActiveEvents();
  return <View testID="special-card-tag-picker" style={styles.groups}>
    {([["STATUS", STATUS_CARD_THEMES], ["EVENT", events]] as const).filter(([, entries]) => entries.length > 0).map(([group, entries]) => <View key={group} style={styles.group}>
      <Text style={[styles.label, { color: c.mutedForeground }]}>{group}</Text>
      <View style={styles.options}>{entries.map((entry) => {
        const selected = tags.some((tag) => classifySpecialCardTag(tag)?.theme.id === entry.id);
        return <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`${group === "STATUS" ? "Status" : "Event"} tag ${entry.label}`} accessibilityHint={`Choose at most one ${group.toLowerCase()} tag. Tap again to remove.`} accessibilityState={{ selected }} onPress={() => onChange(toggleCardTag(tags, entry.label))} style={({ pressed }) => [styles.option, { borderColor: selected ? entry.accent : c.border, backgroundColor: selected ? entry.wash : c.secondary }, tactileSurface({ pressed, selected, accent: entry.accent, dark: scheme === "dark" })]}>
          {group === "EVENT" ? <Text style={{ color: entry.accent, fontSize: 14 }}>{entry.symbol}</Text> : null}<Text style={{ color: c.foreground, fontSize: 12, fontWeight: selected ? "700" : "500" }}>{entry.label}</Text>
          {selected && group === "EVENT" ? <Text accessibilityElementsHidden importantForAccessibility="no" style={{ color: entry.accent, fontSize: 13, fontWeight: "700" }}>✓</Text> : null}
        </Pressable>;
      })}</View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  groups: { gap: 12, marginTop: 12 }, group: { gap: 6 }, label: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 9, paddingBottom: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
});
