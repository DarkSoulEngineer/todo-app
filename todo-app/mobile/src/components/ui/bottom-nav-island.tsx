import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";

export type NavigationBlurTarget = any;

/** A centered, width-limited surface shared by the main and board navigation. */
export function BottomNavIsland({ children, tabCount = 3, blurTarget }: { children: ReactNode; tabCount?: 3 | 4; blurTarget?: NavigationBlurTarget }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;
  const dark = theme.scheme === "dark";
  const bottomGap = Math.max(insets.bottom, 12);
  return <View pointerEvents="box-none" style={[styles.position, {
    paddingBottom: bottomGap,
    paddingLeft: Math.max(insets.left, 16),
    paddingRight: Math.max(insets.right, 16),
  }]}>
    <View testID="navigation-content-fade" pointerEvents="none" style={[styles.contentFade, { height: 24 + bottomGap }]}>
      <LinearGradient
        colors={[`${c.background}00`, `${c.background}20`, `${c.background}90`]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.fadeEdge}
      />
    </View>
    <View testID="navigation-island-surface" style={[styles.surface, { maxWidth: Math.min(600, tabCount * 80 + 48), shadowColor: c.shadow, backgroundColor: `${c.card}B3`, borderColor: c.border }]}>
      <View style={[styles.glass, {
        backgroundColor: `${c.card}B3`,
        borderColor: c.border,
      }]}>
        <LinearGradient
          pointerEvents="none"
          colors={dark ? [`${c.background}D9`, `${c.background}1A`, `${c.background}1A`, `${c.background}D9`] : [`${c.background}80`, `${c.background}00`, `${c.background}00`, `${c.background}80`]}
          locations={[0, 0.24, 0.76, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  position: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", zIndex: 50 },
  contentFade: { position: "absolute", left: 0, right: 0, bottom: 0 },
  fadeEdge: { flex: 1 },
  surface: { width: "100%", borderRadius: 26, shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8, borderWidth: 0 },
  glass: { borderRadius: 26, overflow: "hidden", borderWidth: 1, paddingVertical: 4, paddingHorizontal: 4 },
});
