import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useTheme } from "@/providers/theme-provider";
import type { ThemePreference } from "@/theme/tokens";

const APPEARANCE: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
  { value: "system", label: "System", icon: "phone-portrait-outline" },
];

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  maximized: boolean;
  onSwitchBoard: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onCloseBoard: () => void;
}

/** Floating trigger that keeps less-used board controls out of the top bar. */
export function MobileBoardSettingsButton({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;
  return <Pressable accessibilityRole="button" accessibilityLabel="Board settings" accessibilityHint="Opens appearance and board window options." onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 9, left: insets.left + 12, borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.7 : 1 }]}>
    <Ionicons name="settings-outline" size={19} color={c.mutedForeground} />
  </Pressable>;
}

export function MobileBoardSettingsSheet({ visible, onClose, maximized, onSwitchBoard, onMinimize, onMaximize, onCloseBoard }: SettingsSheetProps) {
  const { theme, preference, setPreference } = useTheme();
  const c = theme.colors;
  const action = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, destructive = false) => <Button key={label} variant="outline" size="lg" label={label} onPress={onPress} style={styles.action}><Ionicons name={icon} size={19} color={destructive ? c.destructive : c.mutedForeground} /><Text style={{ color: destructive ? c.destructive : c.foreground, fontSize: 14, fontWeight: "600" }}>{label}</Text></Button>;
  return <Sheet visible={visible} onClose={onClose}>
    <Text style={[styles.title, { color: c.foreground }]}>Board settings</Text>
    <Text style={[styles.copy, { color: c.mutedForeground }]}>{maximized ? "The top ribbon is hidden while maximized. Restore the toolbar to bring it back." : "Appearance and window actions live here. Your board ribbon stays at the top."}</Text>
    <Text style={[styles.label, { color: c.secondaryForeground }]}>APPEARANCE</Text>
    <View style={[styles.segment, { backgroundColor: c.secondary, borderColor: c.border }]}>
      {APPEARANCE.map((option) => {
        const selected = preference === option.value;
        return <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Use ${option.label.toLowerCase()} theme`} onPress={() => setPreference(option.value)} style={[styles.segmentItem, selected && { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name={option.icon} size={17} color={selected ? c.primary : c.mutedForeground} />
          <Text style={{ color: selected ? c.foreground : c.mutedForeground, fontSize: 12, fontWeight: "700" }}>{option.label}</Text>
        </Pressable>;
      })}
    </View>
    <Text style={[styles.label, { color: c.secondaryForeground }]}>BOARD</Text>
    <View style={styles.actions}>
      {action("swap-horizontal-outline", "Switch board", onSwitchBoard)}
      {action(maximized ? "contract-outline" : "expand-outline", maximized ? "Restore toolbar" : "Maximize board", onMaximize)}
      {action("remove-outline", "Minimize board", onMinimize)}
      {action("close-circle-outline", "Close board", onCloseBoard, true)}
    </View>
  </Sheet>;
}

const styles = StyleSheet.create({
  fab: { position: "absolute", width: 44, height: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", zIndex: 20 },
  title: { fontSize: 23, fontWeight: "700" },
  copy: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, marginTop: 20, marginBottom: 8 },
  segment: { flexDirection: "row", borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 3, gap: 3 },
  segmentItem: { flex: 1, minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderColor: "transparent", borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  actions: { gap: 8 },
  action: { justifyContent: "flex-start", paddingHorizontal: 14 },
});
