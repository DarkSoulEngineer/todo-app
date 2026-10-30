import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Platform, StyleSheet, View } from "react-native";
import type { DecorativeCardTheme } from "@/lib/features/card-themes";
import { SeasonalCardArtwork } from "./seasonal-card-artwork";
import { StatusCardArtwork } from "./status-card-artwork";
import { HalloweenCardArtwork } from "./halloween-card-artwork";

/** A small, non-interactive seasonal layer. Ordinary cards never mount it. */
export function SeasonalCardDecoration({ theme, cardId = "", paused = false, compact = false }: { theme: DecorativeCardTheme; cardId?: string; paused?: boolean; compact?: boolean }) {
  const [phase] = useState(() => new Animated.Value(0));
  const staticDesign = theme.id === "done" || theme.id === "canceled" || theme.id === "overdue";

  useEffect(() => {
    let disposed = false, reduced = true, preferenceChanged = false;
    let active = AppState.currentState === "active";
    let animation: Animated.CompositeAnimation | null = null;
    const refresh = () => {
      if (disposed) return;
      animation?.stop();
      animation = null;
      phase.setValue(0);
      if (reduced || !active || paused || compact || staticDesign) return;
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
  }, [compact, paused, phase, staticDesign]);

  return <View testID={`seasonal-decoration-${theme.id}`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: theme.wash, borderRadius: 12, overflow: "hidden" }]}>
    {theme.id === "halloween" ? <HalloweenCardArtwork cardId={cardId} phase={phase} compact={compact} /> : staticDesign ? <StatusCardArtwork id={theme.id} color={theme.accent} compact={compact} /> : <SeasonalCardArtwork id={theme.id} phase={phase} compact={compact} />}
  </View>;
}
