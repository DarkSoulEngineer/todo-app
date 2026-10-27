import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";

/** A centered, width-limited surface shared by the main and board navigation. */
export function BottomNavIsland({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;
  return <View pointerEvents="box-none" style={[styles.position, {
    paddingBottom: Math.max(insets.bottom, 12),
    paddingLeft: Math.max(insets.left, 16),
    paddingRight: Math.max(insets.right, 16),
  }]}>
    <View style={[styles.surface, { backgroundColor: c.card, borderColor: c.border, shadowColor: c.shadow }]}>
      {children}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  position: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", zIndex: 50 },
  surface: { width: "100%", maxWidth: 480, borderRadius: 26, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 4, shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
});
