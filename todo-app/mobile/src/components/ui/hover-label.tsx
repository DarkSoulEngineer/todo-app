import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/providers/theme-provider";

/** Tracks pointer hover so icon-only badges can stay quiet until inspected. */
export function useHoverLabel() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    hoverProps: {
      onPointerEnter: () => setHovered(true),
      onPointerLeave: () => setHovered(false),
    },
  };
}

interface HoverLabelProps {
  /** Readable text revealed while the pointer rests on the icon. */
  label: string;
  accessibilityLabel: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps an icon-only glyph with a hover label. The visible label only appears on
 * pointer hover, while assistive technology always gets the full description.
 */
export function HoverLabel({ label, accessibilityLabel, children, style }: HoverLabelProps) {
  const { theme } = useTheme();
  const { hovered, hoverProps } = useHoverLabel();

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      {...hoverProps}
      style={[styles.wrapper, style]}
    >
      {children}
      {hovered ? (
        <View pointerEvents="none" style={[styles.tooltip, { backgroundColor: theme.colors.foreground }]}>
          <Text numberOfLines={1} style={[styles.tooltipText, { color: theme.colors.background }]}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  tooltip: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 20,
    elevation: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  tooltipText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
