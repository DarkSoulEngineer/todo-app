import { StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { HoverLabel } from "@/components/ui/hover-label";
import { PRIORITY_META } from "@/lib/domain/constants";
import type { Priority } from "@/lib/domain/types";
import { useTheme } from "@/providers/theme-provider";

/** Star count per grade. Critical stands alone as one oversized star. */
const STAR_COUNT: Record<Priority, number> = {
  critical: 1,
  high: 3,
  medium: 2,
  low: 1,
};

/** Extra scale applied to the single critical star. */
const CRITICAL_SCALE = 1.5;

/** Classic five-point star silhouette, kept on a 24pt grid for crisp scaling. */
const STAR_PATH =
  "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

function StarGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill={color} />
    </Svg>
  );
}

interface PriorityStarsProps {
  priority: Priority;
  /** Base glyph size in points, before zoom is applied. */
  size?: number;
  /** Keeps the stars in step with card zoom. */
  zoom?: number;
}

/**
 * Star-rating priority indicator: 1 star for low, 2 for medium, 3 for high, and
 * a single larger star for critical. Only the star is tinted; there is no pill
 * or text. The readable grade is revealed on hover and to screen readers.
 */
export function PriorityStars({ priority, size = 13, zoom = 1 }: PriorityStarsProps) {
  const { theme } = useTheme();
  const meta = PRIORITY_META[priority];
  const color = theme.scheme === "light" ? meta.ink : meta.dot;
  const starSize = (priority === "critical" ? size * CRITICAL_SCALE : size) * zoom;

  return (
    <HoverLabel
      label={`${meta.label} priority`}
      accessibilityLabel={`${meta.label} priority`}
      style={styles.row}
    >
      {Array.from({ length: STAR_COUNT[priority] }, (_, index) => (
        <StarGlyph key={index} size={starSize} color={color} />
      ))}
    </HoverLabel>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1.5,
  },
});
