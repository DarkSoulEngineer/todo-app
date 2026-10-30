import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Platform, StyleSheet, Text, View } from "react-native";
import type { SeasonalCardTheme } from "@/lib/features/card-themes";
import { SeasonalCardArtwork } from "./seasonal-card-artwork";

/** A small, non-interactive seasonal layer. Ordinary cards never mount it. */
export function SeasonalCardDecoration({ theme, paused = false, compact = false }: { theme: SeasonalCardTheme; paused?: boolean; compact?: boolean }) {
  const [phase] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let disposed = false, reduced = true, preferenceChanged = false;
    let active = AppState.currentState === "active";
    let animation: Animated.CompositeAnimation | null = null;
    const refresh = () => {
      if (disposed) return;
      animation?.stop();
      animation = null;
      phase.setValue(0);
      if (reduced || !active || paused || compact) return;
      const config = { duration: 2400, useNativeDriver: Platform.OS !== "web", isInteraction: false };
      animation = Animated.loop(Animated.sequence([
        Animated.timing(phase, { ...config, toValue: 1 }),
        Animated.timing(phase, { ...config, toValue: 0 }),
      ]));
      animation.start();
    };
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      preferenceChanged = true;
      reduced = enabled;
      refresh();
    });
    const app = AppState.addEventListener("change", (state) => { active = state === "active"; refresh(); });
    refresh();
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (disposed || preferenceChanged) return;
      reduced = enabled;
      refresh();
    }).catch(() => { /* Prefer a static design if the setting is unavailable. */ });
    return () => { disposed = true; animation?.stop(); motion.remove(); app.remove(); };
  }, [compact, paused, phase]);

  return <View testID={`seasonal-decoration-${theme.id}`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: theme.wash, borderRadius: 12, overflow: "hidden" }]}>
    {theme.id === "halloween" ? <>
      <View testID="halloween-orbit" style={[styles.orbit, { borderColor: theme.border }]} />
      {!compact ? <Animated.View style={[styles.motif, { opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.22] }), transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }, { rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "5deg"] }) }] }]}><Text style={{ color: theme.accent, fontSize: 50 }}>{theme.decoration}</Text></Animated.View> : null}
    </> : <SeasonalCardArtwork id={theme.id} phase={phase} compact={compact} />}
  </View>;
}

const styles = StyleSheet.create({
  orbit: { position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 1, right: -70, bottom: -75, opacity: 0.6 },
  motif: { position: "absolute", right: 12, bottom: -8 },
});
