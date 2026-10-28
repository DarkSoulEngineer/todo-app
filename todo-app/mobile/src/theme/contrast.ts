import type { ThemeColors } from "./palettes";

function channels(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function luminance(hex: string): number {
  const linear = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function contrastRatio(ink: string, surface: string): number {
  const a = luminance(ink);
  const b = luminance(surface);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Keep the original hue where possible; move only as far as readability needs. */
export function readableInk(ink: string, surfaces: string[], minimum = 4.5): string {
  const score = (color: string) => Math.min(...surfaces.map((surface) => contrastRatio(color, surface)));
  if (score(ink) >= minimum) return ink;
  const target = score("#FFFFFF") >= score("#000000") ? 255 : 0;
  const original = channels(ink);
  const mix = (amount: number) => `#${original.map((channel) => Math.round(channel + (target - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 16; i++) {
    const middle = (low + high) / 2;
    if (score(mix(middle)) >= minimum) high = middle;
    else low = middle;
  }
  return mix(high);
}

/** Palette foregrounds must match the UI surfaces, not syntax-highlighter roles. */
export function withReadableText(colors: ThemeColors): ThemeColors {
  const c = { ...colors };
  const surfaces = [c.background, c.backgroundAlt, c.card, c.cardElevated, c.input, c.secondary];
  c.foreground = readableInk(c.foreground, surfaces);
  c.mutedForeground = readableInk(c.mutedForeground, surfaces);
  c.secondaryForeground = readableInk(c.secondaryForeground, [c.secondary]);
  // Soft buttons and selected chips use primarySoft, not the solid accent.
  c.accentForeground = readableInk(c.accentForeground, [c.primarySoft]);
  c.primaryForeground = readableInk(c.primaryForeground, [c.primary]);
  c.destructiveForeground = readableInk(c.destructiveForeground, [c.destructive]);
  c.successForeground = readableInk(c.successForeground, [c.success]);
  return c;
}
