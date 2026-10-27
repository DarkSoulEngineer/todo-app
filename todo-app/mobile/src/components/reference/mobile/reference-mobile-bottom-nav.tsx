import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomNavIsland, type NavigationBlurTarget } from "@/components/ui/bottom-nav-island";
import { useReferenceTheme, type ReferenceColors } from "../reference-theme";

export type ReferenceMobileTab = "boards" | "top-tasks" | "settings";

const tabs: { key: ReferenceMobileTab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "boards", label: "Home", icon: "home-outline", activeIcon: "home" },
  { key: "top-tasks", label: "Top Tasks", icon: "flame-outline", activeIcon: "flame" },
  { key: "settings", label: "Settings", icon: "settings-outline", activeIcon: "settings" },
];

export function ReferenceMobileBottomNav({ active = "boards", onNavigate, blurTarget }: { active?: ReferenceMobileTab; onNavigate?: (tab: ReferenceMobileTab) => void; blurTarget?: NavigationBlurTarget }) {
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors);
  return (
    <BottomNavIsland blurTarget={blurTarget}>
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
    </BottomNavIsland>
  );
}

function createStyles(colors: ReferenceColors) { return StyleSheet.create({
  row: { minHeight: 56, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  item: { flex: 1, minHeight: 52, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", gap: 3 },
  icon: { width: 44, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  itemSelected: { backgroundColor: colors.primaryFixed },
});
}
