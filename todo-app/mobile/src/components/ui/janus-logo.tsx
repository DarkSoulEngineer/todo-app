import { useTheme } from "@/providers/theme-provider";
import Svg, { Circle, Rect } from "react-native-svg";

export function JanusLogo({ size = 48 }: { size?: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const good = c.success;
  const bad = c.destructive;
  const surface = c.background;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Janus logo">
      <Rect x={6} y={14} width={24} height={36} rx={6} fill={good} />
      <Rect x={34} y={14} width={24} height={36} rx={6} fill={bad} />
      <Circle cx={18} cy={24} r={6} fill={surface} />
      <Circle cx={46} cy={40} r={6} fill={surface} />
    </Svg>
  );
}
