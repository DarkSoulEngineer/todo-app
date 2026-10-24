import { useMemo } from "react";
import { useTheme } from "@/providers/theme-provider";
import { themes } from "@/theme/tokens";

/** Fluent/Stride reference tokens. Keep the light values aligned with DESIGN.md. */
const lightColors = {
  surface: "#f8f9ff",
  surfaceDim: "#cbdbf5",
  surfaceBright: "#f8f9ff",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#eff4ff",
  surfaceContainer: "#e5eeff",
  surfaceContainerHigh: "#dce9ff",
  surfaceContainerHighest: "#d3e4fe",
  onSurface: "#0b1c30",
  onSurfaceVariant: "#434655",
  inverseSurface: "#213145",
  inverseOnSurface: "#eaf1ff",
  outline: "#737686",
  outlineVariant: "#c3c6d7",
  surfaceTint: "#0053db",
  primary: "#004ac6",
  onPrimary: "#ffffff",
  primaryContainer: "#004ac6",
  onPrimaryContainer: "#ffffff",
  secondary: "#eff4ff",
  onSecondary: "#434655",
  secondaryContainer: "#dbe1ff",
  onSecondaryContainer: "#004ac6",
  tertiary: "#006329",
  onTertiary: "#ffffff",
  tertiaryContainer: "#007f36",
  onTertiaryContainer: "#c7ffca",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",
  warning: "#d97706",
  warningContainer: "#ffedd5",
  canvas: "#f1f5f9",
  workspace: "#f8fafc",
  hairline: "#e2e8f0",
  selectedBorder: "#cbd5e1",
  muted: "#94a3b8",
  shadow: "rgba(15,23,42,0.10)",
  primaryFixed: "#dbe1ff",
  secondaryFixed: "#dbe1ff",
  successFixed: "#c7ffca",
  background: "#f8f9ff",
  surfaceLow: "#eff4ff",
  surfaceHigh: "#dce9ff",
  surfaceHighest: "#d3e4fe",
  card: "#ffffff",
  text: "#0b1c30",
  success: "#007f36",
} as const;

/** Warm near-black palette mirrored from todo-app-bck's dark globals. */
const darkColors: { [Key in keyof typeof lightColors]: string } = {
  surface: "#120d09",
  surfaceDim: "#120d09",
  surfaceBright: "#1d1611",
  surfaceContainerLowest: "#1d1611",
  surfaceContainerLow: "#26201b",
  surfaceContainer: "#251f1b",
  surfaceContainerHigh: "#26201b",
  surfaceContainerHighest: "#2d2721",
  onSurface: "#f1eee9",
  onSurfaceVariant: "#aba39b",
  inverseSurface: "#e9e5df",
  inverseOnSurface: "#2d2721",
  outline: "#aba39b",
  outlineVariant: "rgba(255,255,255,0.09)",
  surfaceTint: "#a193fc",
  primary: "#a193fc",
  onPrimary: "#110f1e",
  primaryContainer: "#a193fc",
  onPrimaryContainer: "#110f1e",
  secondary: "#26201b",
  onSecondary: "#e7e4df",
  secondaryContainer: "#26201b",
  onSecondaryContainer: "#f1eee9",
  tertiary: "#45bf82",
  onTertiary: "#10291d",
  tertiaryContainer: "#2e865a",
  onTertiaryContainer: "#d0f6dc",
  error: "#f36164",
  errorContainer: "#4a1f21",
  onErrorContainer: "#ffd8d8",
  warning: "#f1af57",
  warningContainer: "#47351f",
  canvas: "#120d09",
  workspace: "#251f1b",
  hairline: "rgba(255,255,255,0.09)",
  selectedBorder: "rgba(255,255,255,0.13)",
  muted: "#aba39b",
  shadow: "rgba(0,0,0,0.45)",
  primaryFixed: "#2d2a45",
  secondaryFixed: "#26201b",
  successFixed: "#1d3a2c",
  background: "#120d09",
  text: "#f1eee9",
  card: "#1d1611",
  surfaceLow: "#26201b",
  surfaceHigh: "#26201b",
  surfaceHighest: "#2d2721",
  success: "#45bf82",
} as const;

export const referenceTheme = {
  colors: lightColors,
  typography: {
    titlebar: { fontSize: 12, fontWeight: "500" as const, lineHeight: 16 },
    ribbonTab: { fontSize: 12, fontWeight: "600" as const, lineHeight: 16 },
    ribbonActionLarge: { fontSize: 11, fontWeight: "400" as const, lineHeight: 14 },
    ribbonActionCompact: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
    ribbonGroupLabel: { fontSize: 10, fontWeight: "500" as const, lineHeight: 12 },
    columnHeader: { fontSize: 14, fontWeight: "600" as const, lineHeight: 20 },
    cardTitle: { fontSize: 13, fontWeight: "500" as const, lineHeight: 18 },
    cardMetadata: { fontSize: 11, fontWeight: "400" as const, lineHeight: 14 },
    body: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
    bodyStrong: { fontSize: 13, fontWeight: "600" as const, lineHeight: 18 },
    statusBar: { fontSize: 11, fontWeight: "400" as const, lineHeight: 14 },
    drawerHeading: { fontSize: 18, fontWeight: "600" as const, lineHeight: 24 },
  },
  spacing: { gutter: 12, columnGap: 16, canvasMargin: 16, twoXs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { sm: 8, md: 12, lg: 16, xl: 22, full: 9999 },
} as const;

export type ReferenceTheme = typeof referenceTheme;
export type ReferenceColors = { [Key in keyof typeof lightColors]: string };

export const referenceColors: ReferenceColors = lightColors;

export const referenceRadii = { sm: referenceTheme.radius.sm, md: referenceTheme.radius.md, lg: referenceTheme.radius.lg, pill: referenceTheme.radius.full } as const;
export const referenceSpacing = { xs: referenceTheme.spacing.xs, sm: referenceTheme.spacing.sm, md: referenceTheme.spacing.md, lg: referenceTheme.spacing.lg, xl: referenceTheme.spacing.xl } as const;

export const referenceType = {
  title: { fontSize: 22, lineHeight: 28, fontWeight: "600" as const, color: referenceColors.onSurface },
  section: { fontSize: 17, lineHeight: 23, fontWeight: "600" as const, color: referenceColors.onSurface },
  body: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const, color: referenceColors.onSurface },
  bodyStrong: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const, color: referenceColors.onSurface },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: "500" as const, color: referenceColors.onSurface },
  micro: { fontSize: 10, lineHeight: 12, fontWeight: "600" as const, color: referenceColors.onSurface },
} as const;

export type ReferenceType = typeof referenceType;

export function getReferenceColors(scheme: "light" | "dark"): ReferenceColors {
  const c = themes[scheme].colors;
  return {
    ...(scheme === "dark" ? darkColors : lightColors),
    surface: c.background, surfaceBright: c.card, surfaceDim: c.backgroundAlt,
    surfaceContainerLowest: c.card, surfaceContainerLow: c.backgroundAlt,
    surfaceContainer: c.secondary, surfaceContainerHigh: c.secondary,
    surfaceContainerHighest: c.secondary, onSurface: c.foreground,
    onSurfaceVariant: c.mutedForeground, outline: c.mutedForeground,
    outlineVariant: c.border, surfaceTint: c.primary, primary: c.primary,
    onPrimary: c.primaryForeground, primaryContainer: c.primary,
    onPrimaryContainer: c.primaryForeground, secondary: c.secondary,
    onSecondary: c.secondaryForeground, secondaryContainer: c.primarySoft,
    onSecondaryContainer: c.accentForeground, tertiary: c.success,
    error: c.destructive, canvas: c.background, workspace: c.backgroundAlt,
    hairline: c.border, selectedBorder: c.borderStrong,
    muted: c.mutedForeground, primaryFixed: c.primarySoft,
    secondaryFixed: c.secondary, background: c.background,
    surfaceLow: c.backgroundAlt, surfaceHigh: c.secondary,
    surfaceHighest: c.secondary, card: c.card, text: c.foreground, success: c.success,
  };
}

export function useReferenceTheme() {
  const { theme, toggle } = useTheme();
  return useMemo(() => {
    const colors = getReferenceColors(theme.scheme);
    const type = Object.fromEntries(Object.entries(referenceType).map(([key, value]) => [key, { ...value, color: colors.onSurface }])) as ReferenceType;
    const card = {
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: referenceRadii.md,
      shadowColor: colors.shadow,
      shadowOpacity: 1,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    } as const;
    return { scheme: theme.scheme, colors, type, card, radii: referenceRadii, spacing: referenceSpacing, toggle };
  }, [theme.scheme, toggle]);
}

export const referenceCard = {
  backgroundColor: referenceColors.surfaceContainerLowest,
  borderWidth: 1,
  borderColor: referenceColors.outlineVariant,
  borderRadius: referenceRadii.md,
  shadowColor: referenceColors.shadow,
  shadowOpacity: 1,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;
