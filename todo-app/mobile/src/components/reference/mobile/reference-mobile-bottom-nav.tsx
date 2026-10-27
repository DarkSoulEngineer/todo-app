import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReferenceTheme, type ReferenceColors } from "../reference-theme";

export type ReferenceMobileTab = "boards" | "calendar" | "settings";

const tabs: { key: ReferenceMobileTab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "boards", label: "Home", icon: "home-outline", activeIcon: "home" },
  { key: "calendar", label: "Calendar", icon: "calendar-outline", activeIcon: "calendar" },
  { key: "settings", label: "Settings", icon: "settings-outline", activeIcon: "settings" },
];

export function ReferenceMobileBottomNav({ active = "boards", onNavigate }: { active?: ReferenceMobileTab; onNavigate?: (tab: ReferenceMobileTab) => void }) {
  const insets = useSafeAreaInsets();
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors);
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row}>
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={tab.label} onPress={() => onNavigate?.(tab.key)} style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}>
              <View style={[styles.icon, selected && styles.itemSelected]}><Ionicons name={selected ? tab.activeIcon : tab.icon} size={22} color={selected ? colors.primary : colors.muted} /></View>
              <Text style={[type.caption, { color: selected ? colors.primary : colors.muted, fontWeight: selected ? "700" : "500" }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ReferenceColors) { return StyleSheet.create({
  nav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 68, paddingTop: 4, backgroundColor: colors.surfaceContainerLowest, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: -2 }, elevation: 8, zIndex: 50 },
  row: { height: 60, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  item: { flex: 1, minHeight: 52, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", gap: 3 },
  icon: { width: 52, height: 30, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  itemSelected: { backgroundColor: colors.primaryFixed },
});
}
