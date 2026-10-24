import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import { useTheme } from "@/providers/theme-provider";

/** A single tiled SVG keeps the reference dot grid inexpensive on native. */
export function ThemeAtmosphere() {
  const { theme } = useTheme();
  const id = `dots-${useId().replace(/:/g, "")}`;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%">
      <Defs><Pattern id={id} width={20} height={20} patternUnits="userSpaceOnUse"><Circle cx={10} cy={10} r={1} fill={theme.scheme === "dark" ? "#30303A" : "#CBD5E1"} opacity={theme.scheme === "dark" ? 0.5 : 0.35} /></Pattern></Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  </View>;
}
