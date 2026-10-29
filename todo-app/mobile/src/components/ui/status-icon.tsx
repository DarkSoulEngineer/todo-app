import { StyleSheet } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { HoverLabel } from "@/components/ui/hover-label";
import type { TaskStatus } from "@/lib/domain/types";
import { useTheme } from "@/providers/theme-provider";

const STATUS_TEXT: Record<Exclude<TaskStatus, "upcoming">, string> = {
  completed: "Done",
  canceled: "Canceled",
  overdue: "Overdue",
};

function CheckGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 12.8 9.3 17.1 19.1 6.9"
        fill="none"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CancelGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.4} fill="none" stroke={color} strokeWidth={2.2} />
      <Line x1={6.1} y1={17.9} x2={17.9} y2={6.1} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function AlertGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={12} y1={4.4} x2={12} y2={14.4} stroke={color} strokeWidth={2.8} strokeLinecap="round" />
      <Circle cx={12} cy={19} r={1.7} fill={color} />
    </Svg>
  );
}

interface StatusIconProps {
  status: TaskStatus | null | undefined;
  /** Base glyph size in points, before zoom is applied. */
  size?: number;
  /** Keeps the glyph in step with card zoom. */
  zoom?: number;
  /** Optional richer hover/accessibility text, e.g. "Overdue by 6d". */
  detail?: string;
}

/**
 * Icon-only status indicator: a check for done, a slashed circle for canceled
 * and an exclamation mark for overdue. No fill or text; the readable label is
 * revealed on hover and always exposed to assistive technology.
 */
export function StatusIcon({ status, size = 13, zoom = 1, detail }: StatusIconProps) {
  const { theme } = useTheme();
  if (!status || status === "upcoming") return null;

  const label = detail ?? STATUS_TEXT[status];
  const color =
    status === "completed"
      ? theme.colors.success
      : status === "canceled"
        ? theme.colors.mutedForeground
        : theme.colors.destructive;
  const glyphSize = size * zoom;

  return (
    <HoverLabel label={label} accessibilityLabel={label} style={styles.wrapper}>
      {status === "completed" ? <CheckGlyph size={glyphSize} color={color} /> : null}
      {status === "canceled" ? <CancelGlyph size={glyphSize} color={color} /> : null}
      {status === "overdue" ? <AlertGlyph size={glyphSize} color={color} /> : null}
    </HoverLabel>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
});
