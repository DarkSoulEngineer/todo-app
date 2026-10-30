import { StyleSheet, View } from "react-native";
import { useTheme } from "@/providers/theme-provider";

/** A centered LED bar, outside the content flow so labels never shift. */
export function SelectionLed({ selected, color }: { selected: boolean; color?: string }) {
  const { theme: { colors } } = useTheme();
  const light = selected ? color ?? colors.success : colors.mutedForeground;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.led, {
    backgroundColor: light,
    opacity: selected ? 1 : 0.3,
    boxShadow: selected ? `0 0 4px ${light}` : "none",
  }]} />;
}

const styles = StyleSheet.create({
  led: { position: "absolute", top: 4, left: "50%", transform: [{ translateX: -7 }], width: 14, height: 3, borderRadius: 2 },
});
