import { useTheme } from "@/providers/theme-provider";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export function JanusLogo({ size = 48 }: { size?: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const good = c.success;
  const bad = c.destructive;
  const surface = c.background;
  const ring = c.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Janus logo">
      <Rect x={4} y={16} width={24} height={32} rx={9} fill={good} />
      <Rect x={36} y={16} width={24} height={32} rx={9} fill={bad} />
      <Circle cx={32} cy={32} r={13} fill={surface} stroke={c.borderStrong} strokeWidth={1.5} />
      <Circle cx={32} cy={32} r={15} fill="none" stroke={ring} strokeWidth={1} opacity={0.45} />
      <Path d="M32,19 A13,13 0 0,0 32,45 Z" fill={good} />
      <Path d="M32,19 A13,13 0 0,1 32,45 Z" fill={bad} />
      <Circle cx={32} cy={25} r={3} fill={bad} />
      <Circle cx={32} cy={39} r={3} fill={good} />
    </Svg>
  );
}
