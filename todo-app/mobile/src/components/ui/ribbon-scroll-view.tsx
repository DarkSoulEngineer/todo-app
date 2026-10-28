import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/providers/theme-provider";

/** Advertise off-screen ribbon tools even when labels are collapsed to icons. */
export function RibbonScrollView({ children, accessibilityLabel, accessibilityRole, contentContainerStyle, style, onInteraction }: {
  children: ReactNode;
  accessibilityLabel: string;
  accessibilityRole?: ScrollViewProps["accessibilityRole"];
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  onInteraction?: () => void;
}) {
  const { theme } = useTheme();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [metrics, setMetrics] = useState({ outer: 0, viewport: 0, content: 0, offset: 0 });
  const overflow = metrics.outer > 0 && metrics.content > metrics.outer + 1;
  const maximum = Math.max(0, metrics.content - metrics.viewport);
  const offset = Math.min(maximum, Math.max(0, metrics.offset));
  const scrollBy = useCallback((direction: -1 | 1) => {
    onInteraction?.();
    scroll.current?.scrollTo({ x: Math.max(0, Math.min(maximum, offset + direction * Math.max(44, metrics.viewport * 0.8))), animated: true });
  }, [maximum, metrics.viewport, offset, onInteraction]);
  const arrow = (direction: -1 | 1) => {
    const disabled = direction === -1 ? offset <= 1 : offset >= maximum - 1;
    return <Pressable accessibilityRole="button" accessibilityLabel={`Scroll ${accessibilityLabel} ${direction === -1 ? "left" : "right"}`} accessibilityHint="More ribbon options are available horizontally" disabled={disabled} onPress={() => scrollBy(direction)} style={[styles.arrow, { opacity: disabled ? 0.25 : 1, backgroundColor: theme.colors.card }]}>
      <Ionicons name={direction === -1 ? "chevron-back" : "chevron-forward"} size={18} color={theme.colors.primary} />
    </Pressable>;
  };
  return <View style={[styles.root, style]} onLayout={(event) => {
    const outer = event.nativeEvent.layout.width;
    setMetrics((current) => current.outer === outer ? current : { ...current, outer });
  }}>
    {overflow ? arrow(-1) : null}
    <ScrollView ref={scroll} horizontal accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityRole} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={contentContainerStyle} scrollEventThrottle={32}
      onLayout={(event) => {
        const viewport = event.nativeEvent.layout.width;
        setMetrics((current) => current.viewport === viewport ? current : { ...current, viewport });
      }}
      onContentSizeChange={(content) => setMetrics((current) => current.content === content ? current : { ...current, content })}
      onScroll={(event) => {
        const { contentOffset, layoutMeasurement } = event.nativeEvent;
        onInteraction?.();
        setMetrics((current) => ({ ...current, offset: contentOffset.x, viewport: layoutMeasurement.width }));
      }}>
      {children}
    </ScrollView>
    {overflow ? arrow(1) : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { width: "100%", minWidth: 0, flexShrink: 0, flexDirection: "row", alignItems: "center" },
  scroll: { flex: 1, minWidth: 0 },
  arrow: { width: 44, minHeight: 44, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
});
