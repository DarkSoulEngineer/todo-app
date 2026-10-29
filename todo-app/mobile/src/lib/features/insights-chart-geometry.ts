import { format, parseISO } from "date-fns";
import type { DailyPoint } from "./insights";

/** Keep the whole period visible, summing adjacent days rather than dropping them. */
export function bucketChartPoints(points: DailyPoint[], limit = 12): DailyPoint[] {
  const size = Math.max(1, Math.ceil(points.length / Math.max(1, limit)));
  const result: DailyPoint[] = [];
  for (let index = 0; index < points.length; index += size) {
    const group = points.slice(index, index + size);
    const first = group[0];
    const last = group[group.length - 1];
    result.push({ key: first.key, label: group.length === 1 ? format(parseISO(first.key), "MMM d") : `${format(parseISO(first.key), "MMM d")}–${format(parseISO(last.key), "MMM d")}`, count: group.reduce((sum, point) => sum + point.count, 0) });
  }
  return result;
}

export function chartCoordinates(values: number[], width: number, height: number, max: number) {
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : index * width / Math.max(1, values.length - 1),
    y: height * (1 - Math.min(1, Math.max(0, value) / Math.max(1, max))),
  }));
}

/** Horizontal Bézier handles stay between the observed values (no negative overshoot). */
export function smoothChartPath(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const point = points[index];
    const middle = (previous.x + point.x) / 2;
    path += ` C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }
  return path;
}

export function ringFraction(value: number, total: number): number {
  return total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
}
