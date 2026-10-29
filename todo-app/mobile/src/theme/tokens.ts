import { themesById, type ThemeColors, type ThemeDefinition } from "./palettes";
import { withReadableText } from "./contrast";

export type { ThemeColors };

export interface Theme {
  scheme: "light" | "dark";
  colors: ThemeColors;
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  space: (steps: number) => number;
  /** Active font family (empty string means system default). */
  fontFamily: string;
  type: {
    display: { fontSize: number; lineHeight: number; fontWeight: "700" };
    title: { fontSize: number; lineHeight: number; fontWeight: "700" };
    subtitle: { fontSize: number; lineHeight: number; fontWeight: "600" };
    body: { fontSize: number; lineHeight: number; fontWeight: "400" };
    bodyStrong: { fontSize: number; lineHeight: number; fontWeight: "600" };
    caption: { fontSize: number; lineHeight: number; fontWeight: "500" };
    micro: { fontSize: number; lineHeight: number; fontWeight: "600" };
  };
}

export type ThemePreference = string;

export const builtInThemes = themesById;

export const themes: Record<string, Theme> = Object.fromEntries(
  Object.values(themesById)
    .filter((t) => t.id !== "system")
    .map((t) => [
      t.id,
      {
        scheme: t.scheme,
        colors: withReadableText(t.colors),
        radius: { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 },
        space: (steps: number) => steps * 4,
        type: {
          display: { fontSize: 30, lineHeight: 36, fontWeight: "700" },
          title: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
          subtitle: { fontSize: 17, lineHeight: 23, fontWeight: "600" },
          body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
          bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
          caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
          micro: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
        },
      } as Theme,
    ]),
);

export function getThemeById(id: string | undefined): Theme {
  if (!id || id === "system") return themes.dark;
  return themes[id] ?? themes.dark;
}

export type { ThemeDefinition };
