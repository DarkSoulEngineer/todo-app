import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/providers/theme-provider";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends PressableProps {
  variant?: Variant;
  size?: Size;
  label?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({ variant = "primary", size = "md", label, children, style, disabled, ...props }: ButtonProps) {
  const { theme } = useTheme();

  const variantStyle = (() => {
    switch (variant) {
      case "primary":
        return { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 };
      case "secondary":
        return { backgroundColor: theme.colors.secondary, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border };
      case "outline":
        return { backgroundColor: theme.colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border };
      case "ghost":
        return { backgroundColor: "transparent" };
      case "danger":
        return { backgroundColor: theme.colors.destructive, shadowColor: theme.colors.destructive, shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 };
      case "soft":
        return { backgroundColor: theme.colors.primarySoft, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.primarySoft };
      default:
        return { backgroundColor: theme.colors.primary };
    }
  })();

  const textColor = (() => {
    switch (variant) {
      case "primary":
        return theme.colors.primaryForeground;
      case "secondary":
        return theme.colors.secondaryForeground;
      case "outline":
        return theme.colors.foreground;
      case "ghost":
        return theme.colors.mutedForeground;
      case "danger":
        return theme.colors.destructiveForeground;
      case "soft":
        return theme.colors.accentForeground;
      default:
        return theme.colors.primaryForeground;
    }
  })();

  const sizeStyle = (() => {
    switch (size) {
      case "sm":
        return { height: 36, paddingHorizontal: 12, borderRadius: theme.radius.md };
      case "md":
        return { height: 44, paddingHorizontal: 16, borderRadius: theme.radius.lg };
      case "lg":
        return { height: 48, paddingHorizontal: 20, borderRadius: theme.radius.lg };
      case "icon":
        return { height: 44, width: 44, borderRadius: theme.radius.lg };
      case "icon-sm":
        return { height: 36, width: 36, borderRadius: theme.radius.md };
      default:
        return { height: 44, paddingHorizontal: 16, borderRadius: theme.radius.lg };
    }
  })();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        sizeStyle,
        { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
        style,
      ]}
      {...props}
    >
      {children ? (
        <View style={styles.row}>{children}</View>
      ) : label ? (
        <Text style={[styles.text, { color: textColor, fontSize: size === "sm" ? 13 : 14, fontWeight: "600" }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  text: {
    textAlign: "center",
  },
});
