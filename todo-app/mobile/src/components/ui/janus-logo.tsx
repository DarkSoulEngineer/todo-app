import { useTheme } from "@/providers/theme-provider";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

export function JanusLogo({ size = 48 }: { size?: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const width = size;
  const height = Math.round(size * 0.62);
  const good = c.success;
  const bad = c.destructive;
  const stroke = c.background;
  return (
    <Svg width={width} height={height} viewBox="0 0 64 40" accessibilityLabel="Janus logo">
      <Rect x={4} y={6} width={30} height={28} rx={13} fill={good} stroke={stroke} strokeWidth={2} />
      <Rect x={30} y={6} width={30} height={28} rx={13} fill={bad} stroke={stroke} strokeWidth={2} />
      <SvgText x={19} y={25} fontSize={11} fontWeight="700" fill={c.successForeground ?? "#FFFFFF"} textAnchor="middle">.*</SvgText>
      <SvgText x={45} y={25} fontSize={13} fontWeight="700" fill="#FFFFFF" textAnchor="middle">*</SvgText>
    </Svg>
  );
}
