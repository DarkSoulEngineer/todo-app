import { BlurView } from "expo-blur";
import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";

export type NavigationBlurTarget = NonNullable<ComponentProps<typeof BlurView>["blurTarget"]>;

/** A centered, width-limited surface shared by the main and board navigation. */
export function BottomNavIsland({ children, tabCount = 3, blurTarget }: { children: ReactNode; tabCount?: 3 | 4; blurTarget?: NavigationBlurTarget }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;
  const dark = theme.scheme === "dark";
  return <View pointerEvents="box-none" style={[styles.position, {
    paddingBottom: Math.max(insets.bottom, 12),
    paddingLeft: Math.max(insets.left, 16),
    paddingRight: Math.max(insets.right, 16),
  }]}>
    <View style={[styles.surface, { maxWidth: tabCount * 80 + 16, shadowColor: c.shadow }]}>
      <BlurView intensity={60} tint={dark ? "dark" : "light"} blurTarget={blurTarget} blurMethod={blurTarget ? "dimezisBlurViewSdk31Plus" : "none"} style={[styles.glass, {
        backgroundColor: dark ? "rgba(30, 26, 22, 0.38)" : "rgba(255, 255, 255, 0.38)",
        borderColor: dark ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.72)",
      }]}>
        {children}
      </BlurView>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  position: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", zIndex: 50 },
  surface: { width: "100%", borderRadius: 26, shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  glass: { borderRadius: 26, overflow: "hidden", borderWidth: 1, paddingVertical: 4, paddingHorizontal: 4 },
});
