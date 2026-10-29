import { useTheme } from "@/providers/theme-provider";
import { useId } from "react";
import Svg, { Circle, Defs, FeDropShadow, Filter, G, Rect } from "react-native-svg";

export function JanusLogo({ size = 48, color, surfaceColor, shadow = false }: { size?: number; color?: string; surfaceColor?: string; shadow?: boolean }) {
  const { theme } = useTheme();
  const shadowId = `janus-shadow-${useId().replace(/:/g, "")}`;
  const c = theme.colors;
  const good = color ?? c.success;
  const bad = color ?? c.destructive;
  const surface = surfaceColor ?? c.background;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Janus logo">
      {shadow ? <Defs><Filter id={shadowId} x="-25%" y="-25%" width="150%" height="150%">
        <FeDropShadow dx={0.4} dy={0.8} stdDeviation={0.8} floodColor="#000000" floodOpacity={0.65} />
      </Filter></Defs> : null}
      <G filter={shadow ? `url(#${shadowId})` : undefined}>
      <Rect x={6} y={14} width={24} height={36} rx={6} fill={good} />
      <Rect x={34} y={14} width={24} height={36} rx={6} fill={bad} />
      </G>
      <Circle cx={14} cy={22} r={4} fill={surface} />
      <Circle cx={50} cy={42} r={4} fill={surface} />
    </Svg>
  );
}
