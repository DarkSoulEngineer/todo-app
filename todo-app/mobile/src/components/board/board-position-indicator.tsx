import { useCallback, useEffect, useRef, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/providers/theme-provider";
import type { BoardScrollStop } from "@/lib/features/board-scroll-position";

interface Props {
  stops: BoardScrollStop[];
  activeIndex: number;
  canLeft: boolean;
  canRight: boolean;
  onPosition: (offset: number) => void;
}

/** Small visual markers with full-sized touch targets, not another toolbar. */
export function BoardPositionIndicator({ stops, activeIndex: index, canLeft, canRight, onPosition }: Props) {
  const { theme } = useTheme();
  const rail = useRef<ComponentRef<typeof ScrollView>>(null);
  const revealActive = useCallback(() => {
    rail.current?.scrollTo({ x: Math.max(0, index * 36 - 126), animated: false });
  }, [index]);
  useEffect(revealActive, [revealActive]);
  if (stops.length < 2) return null;

  return <View style={styles.root}>
    <Pressable accessibilityRole="button" accessibilityLabel="Scroll board left" disabled={!canLeft} onPress={() => onPosition(stops[Math.max(0, index - 1)].offset)} style={[styles.target, { opacity: canLeft ? 1 : 0 }]}>
      <Text style={{ color: theme.colors.mutedForeground, fontSize: 20 }}>‹</Text>
    </Pressable>
    <ScrollView ref={rail} horizontal accessibilityRole="tablist" accessibilityLabel="Board column positions" showsHorizontalScrollIndicator={false}
      onContentSizeChange={revealActive} style={styles.rail} contentContainerStyle={styles.items}>
      {stops.map((stop, position) => {
        const selected = position === index;
        return <Pressable key={stop.id} accessibilityRole="tab" accessibilityLabel={`Scroll to ${stop.title}, position ${position + 1} of ${stops.length}`} accessibilityState={{ selected }}
          onPress={() => onPosition(stop.offset)} style={styles.target}>
          <View style={[styles.marker, { width: selected ? 28 : 20, backgroundColor: selected ? theme.colors.primary : theme.colors.borderStrong }]} />
        </Pressable>;
      })}
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Scroll board right" disabled={!canRight} onPress={() => onPosition(stops[Math.min(stops.length - 1, index + 1)].offset)} style={[styles.target, { opacity: canRight ? 1 : 0 }]}>
      <Text style={{ color: theme.colors.mutedForeground, fontSize: 20 }}>›</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingHorizontal: 8 },
  rail: { flexGrow: 0, flexShrink: 1, maxWidth: 288 },
  items: { alignItems: "center" },
  target: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  marker: { height: 5, borderRadius: 3 },
});
