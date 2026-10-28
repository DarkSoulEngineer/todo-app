import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";

/** A page-space point captured from the press that opened a menu. */
export interface MenuAnchor {
  x: number;
  y: number;
}

export interface MenuOption {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

export function anchorFromEvent(event: { nativeEvent: { pageX: number; pageY: number } }): MenuAnchor {
  return { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
}

/**
 * Small menus stay sheets on phones and on Android. Tablets, iPads and wide
 * web layouts instead get a compact popover anchored to the press point.
 */
export function useAnchoredMenus(): boolean {
  const { width } = useWindowDimensions();
  if (Platform.OS === "android") return false;
  if (Platform.OS === "ios") return (Platform as unknown as { isPad?: boolean }).isPad === true;
  return width >= 768;
}

export interface MenuPositionInput {
  anchor: MenuAnchor;
  menuWidth: number;
  menuHeight: number;
  windowWidth: number;
  windowHeight: number;
  insetTop?: number;
  insetBottom?: number;
}

/** Keeps a popover inside the viewport and flips it above the press point when needed. */
export function resolveMenuPosition({
  anchor,
  menuWidth,
  menuHeight,
  windowWidth,
  windowHeight,
  insetTop = 0,
  insetBottom = 0,
}: MenuPositionInput): { left: number; top: number; width: number; height: number } {
  const edge = 12;
  const gap = 8;
  const usableTop = insetTop + edge;
  const usableBottom = windowHeight - insetBottom - edge;
  const width = Math.max(0, Math.min(menuWidth, windowWidth - edge * 2));
  const height = Math.max(0, Math.min(menuHeight, usableBottom - usableTop));
  const left = Math.max(edge, Math.min(anchor.x - 14, windowWidth - width - edge));
  const fitsBelow = anchor.y + gap + height <= usableBottom;
  const top = fitsBelow
    ? Math.max(usableTop, Math.min(anchor.y + gap, usableBottom - height))
    : Math.max(usableTop, anchor.y - gap - height);
  return { left, top, width, height };
}

export function AnchoredMenu({
  visible,
  title,
  options,
  anchor,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: MenuOption[];
  anchor: MenuAnchor;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const idealWidth = Math.min(300, Math.max(220, windowWidth - 24));
  const estimatedHeight = Math.min(windowHeight - insets.top - insets.bottom - 24, 44 + options.length * 44 + 8);
  const position = resolveMenuPosition({
    anchor,
    menuWidth: measured?.width ?? idealWidth,
    menuHeight: measured?.height ?? estimatedHeight,
    windowWidth,
    windowHeight,
    insetTop: insets.top,
    insetBottom: insets.bottom,
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width && height && (measured?.width !== width || measured?.height !== height)) {
      setMeasured({ width, height });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onContextMenu={(e) => { e.preventDefault?.(); onClose(); }}
        />
        <View
          testID="anchored-menu-surface"
          accessibilityViewIsModal
          onLayout={onLayout}
          style={[
            styles.card,
            {
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: windowHeight - insets.top - insets.bottom - 24,
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              shadowColor: theme.colors.shadow,
            },
          ]}
          onContextMenu={(e) => { e.preventDefault?.(); /* keep open */ }}
        >
          <View style={[styles.titleRow, { borderBottomColor: theme.colors.border }]}>
            <Text numberOfLines={1} style={[styles.title, { color: theme.colors.mutedForeground }]}>{title}</Text>
          </View>
          <ScrollView bounces={false} showsVerticalScrollIndicator={options.length > 7} style={styles.scroll} contentContainerStyle={styles.list}>
            {options.map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="menuitem"
                accessibilityLabel={option.label}
                onPress={() => { option.onPress(); onClose(); }}
                style={({ pressed, hovered }) => [styles.option, { backgroundColor: (pressed || hovered) ? theme.colors.secondary : "transparent" }]}
              >
                <Ionicons
                  name={option.icon ?? "chevron-forward-outline"}
                  size={17}
                  color={option.destructive ? theme.colors.destructive : theme.colors.primary}
                />
                <Text
                  numberOfLines={2}
                  style={[styles.optionText, { color: option.destructive ? theme.colors.destructive : theme.colors.foreground }]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: { backgroundColor: "rgba(0,0,0,0.06)" },
  card: {
    position: "absolute",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 6,
    overflow: "hidden",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  titleRow: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 11, lineHeight: 15, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" },
  scroll: { flexShrink: 1 },
  list: { paddingVertical: 4 },
  option: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionText: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: "600" },
});
