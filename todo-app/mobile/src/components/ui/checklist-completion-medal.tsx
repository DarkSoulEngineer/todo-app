import Svg, { Circle, Path } from "react-native-svg";
import { HoverLabel } from "@/components/ui/hover-label";
import { useTheme } from "@/providers/theme-provider";

/** Replaces the Done glyph when the task and its checklist are fully completed. */
export function ChecklistCompletionMedal({ zoom = 1 }: { zoom?: number }) {
  const { theme } = useTheme();
  const color = theme.colors.accent;
  return <HoverLabel label="Task and checklist fully completed" accessibilityLabel="Task and checklist fully completed">
    <Svg width={14 * zoom} height={16.5 * zoom} viewBox="0 0 24 28">
      <Path d="M6 16 L4 26 L10 23 L12 26 L14 23 L20 26 L18 16" fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <Circle cx={12} cy={10} r={8.5} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1.6} />
      <Path d="M8 10 L11 13 L16 7" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </HoverLabel>;
}
