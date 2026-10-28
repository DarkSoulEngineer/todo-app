import { useTheme } from "@/providers/theme-provider";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export function JanusLogo({ size = 48 }: { size?: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const good = c.success;
  const bad = c.destructive;
  const surface = c.background;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Janus logo">
      <Rect x={6} y={14} width={26} height={36} rx={10} fill={good} />
      <Rect x={32} y={14} width={26} height={36} rx={10} fill={bad} />
      <Circle cx={32} cy={32} r={11} fill={surface} stroke={c.borderStrong} strokeWidth={1.5} />
      <Path d="M32,21 A11,11 0 0,0 32,43 Z" fill={good} />
      <Path d="M32,21 A11,11 0 0,1 32,43 Z" fill={bad} />
      <Circle cx={32} cy={26} r={2.5} fill={bad} />
      <Circle cx={32} cy={38} r={2.5} fill={good} />
    </Svg>
  );
}
