import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sheet } from "@/components/ui/sheet";
import { SEASONAL_CARD_THEMES } from "@/lib/features/card-themes";
import { setEventOverride } from "@/lib/features/active-events";
import { useActiveEvents } from "@/hooks/use-active-events";
import { useTheme } from "@/providers/theme-provider";

export function EventDebugButton({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { theme: { colors: c } } = useTheme();
  const [open, setOpen] = useState(false);
  const { events, override } = useActiveEvents();
  const changeOpen = (value: boolean) => { setOpen(value); onOpenChange(value); };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Debug events" onPress={() => changeOpen(true)} style={styles.trigger}>
      <Ionicons name="bug-outline" size={19} color={override ? c.primary : c.mutedForeground} />
      <Text style={{ fontSize: 10, color: override ? c.primary : c.mutedForeground }}>Debug events</Text>
    </Pressable>
    <Sheet visible={open} onClose={() => changeOpen(false)}>
      <Text accessibilityRole="header" style={[styles.title, { color: c.foreground }]}>Debug events</Text>
      <Text style={[styles.hint, { color: c.mutedForeground }]}>Trigger one event to reveal its tag. Preview lasts until reset or app reload; saved task tags are unchanged. Birthday is manual; Easter uses the Gregorian calendar.</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.hint, { color: c.primary }]}>{override ? "Preview" : "Automatic"}: {events.map((entry) => entry.label).join(", ") || "No active event"}</Text>
      <View style={styles.options}>
        {SEASONAL_CARD_THEMES.map((entry) => <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`Trigger ${entry.label} event`} accessibilityState={{ selected: override === entry.id }} onPress={() => setEventOverride(entry.id)} style={[styles.option, { borderColor: override === entry.id ? c.primary : c.border, backgroundColor: c.secondary }]}>
          <Text style={{ color: c.foreground }}>{entry.symbol} {entry.label}</Text>
        </Pressable>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset events to automatic dates" onPress={() => setEventOverride(null)} style={[styles.option, { borderColor: c.border, marginTop: 12 }]}><Text style={{ color: c.foreground }}>Reset to automatic dates</Text></Pressable>
    </Sheet>
  </>;
}

const styles = StyleSheet.create({
  trigger: { minWidth: 76, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 6 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderRadius: 9 },
});
