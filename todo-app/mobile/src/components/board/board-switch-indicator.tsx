import { useCallback, useEffect, useRef, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "@/providers/theme-provider";

interface Props {
  boards: { id: string; name: string }[];
  activeId: string;
  onSwitch: (id: string) => void;
}

/** Small visual markers with full-sized touch targets, not another toolbar. */
export function BoardSwitchIndicator({ boards, activeId, onSwitch }: Props) {
  const { theme } = useTheme();
  const rail = useRef<ComponentRef<typeof ScrollView>>(null);
  const index = boards.findIndex((board) => board.id === activeId);
  const revealActive = useCallback(() => {
    rail.current?.scrollTo({ x: Math.max(0, index * 36 - 126), animated: false });
  }, [index]);
  useEffect(revealActive, [revealActive]);
  if (boards.length < 2 || index < 0) return null;

  return <View style={styles.root}>
    <ScrollView ref={rail} horizontal accessibilityRole="tablist" accessibilityLabel="Switch boards" showsHorizontalScrollIndicator={false}
      onContentSizeChange={revealActive} style={styles.rail} contentContainerStyle={styles.items}>
      {boards.map((board, position) => {
        const selected = board.id === activeId;
        return <Pressable key={board.id} accessibilityRole="tab" accessibilityLabel={`${board.name}, board ${position + 1} of ${boards.length}`} accessibilityState={{ selected }}
          onPress={() => { if (!selected) onSwitch(board.id); }} style={styles.target}>
          <View style={[styles.marker, { width: selected ? 28 : 20, backgroundColor: selected ? theme.colors.primary : theme.colors.borderStrong }]} />
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { alignItems: "center", paddingHorizontal: 12 },
  rail: { flexGrow: 0, maxWidth: 288 },
  items: { alignItems: "center" },
  target: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  marker: { height: 5, borderRadius: 3 },
});
