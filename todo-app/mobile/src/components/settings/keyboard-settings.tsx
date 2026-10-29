import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/providers/preferences-provider";
import { useTheme } from "@/providers/theme-provider";

export function KeyboardSettings({ onHelp }: { onHelp: () => void }) {
  const { singleKeyShortcuts, setSingleKeyShortcuts } = usePreferences();
  const { theme: { colors: c } } = useTheme();
  return <View style={styles.root}>
    <Pressable accessibilityRole="switch" accessibilityLabel="Single-key shortcuts" accessibilityState={{ checked: singleKeyShortcuts }} onPress={() => setSingleKeyShortcuts(!singleKeyShortcuts)} style={[styles.row, { borderColor: c.border }]}>
      <View style={{ flex: 1 }}><Text style={{ color: c.foreground, fontWeight: "700" }}>Single-key shortcuts</Text><Text style={[styles.hint, { color: c.mutedForeground }]}>Inside a board: N/B/L/R, 1–4 for views. Shift B opens board selection; [ / ] changes boards. Turn off to avoid accidental actions.</Text></View>
      <Text style={{ color: c.primary, fontWeight: "700" }}>{singleKeyShortcuts ? "On" : "Off"}</Text>
    </Pressable>
    <Text style={[styles.hint, { color: c.mutedForeground }]}>Ctrl/⌘ K: commands · Ctrl/⌘ Shift B: change board · Alt 1/2/3: Home / Top Tasks / Settings. Shortcuts pause in text fields and dialogs; hardware shortcuts are web-only.</Text>
    <Button label="View keyboard shortcuts" variant="outline" onPress={onHelp} />
  </View>;
}

const styles = StyleSheet.create({ root: { gap: 16 }, row: { flexDirection: "row", alignItems: "center", gap: 16, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth }, hint: { fontSize: 13, lineHeight: 20, marginTop: 6 } });
