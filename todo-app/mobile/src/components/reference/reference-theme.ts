import { useMemo } from "react";
import { useTheme } from "@/providers/theme-provider";
import { themes } from "@/theme/tokens";

/** Reference components adapt the app palette instead of owning another theme. */
export function getReferenceColors(scheme: "light" | "dark") {
  const c = themes[scheme].colors;
  const inverse = themes[scheme === "light" ? "dark" : "light"].colors;
  return {
    surface: c.background, surfaceBright: c.cardElevated, surfaceDim: c.backgroundAlt,
    surfaceContainerLowest: c.card, surfaceContainerLow: c.backgroundAlt,
    surfaceContainer: c.secondary, surfaceContainerHigh: c.cardElevated,
    surfaceContainerHighest: c.cardElevated, onSurface: c.foreground,
    onSurfaceVariant: c.mutedForeground, inverseSurface: inverse.background,
    inverseOnSurface: inverse.foreground, outline: c.mutedForeground,
    outlineVariant: c.border, surfaceTint: c.primary, primary: c.primary,
    onPrimary: c.primaryForeground, primaryContainer: c.primary,
    onPrimaryContainer: c.primaryForeground, secondary: c.secondary,
    onSecondary: c.secondaryForeground, secondaryContainer: c.primarySoft,
    onSecondaryContainer: c.accentForeground, tertiary: c.success,
    onTertiary: c.successForeground, tertiaryContainer: c.success,
    onTertiaryContainer: c.successForeground, error: c.destructive,
    errorContainer: c.destructiveSoft, onErrorContainer: c.destructive,
    warning: c.warning, warningContainer: c.warningSoft,
    canvas: c.background, workspace: c.backgroundAlt,
    hairline: c.border, selectedBorder: c.borderStrong,
    muted: c.mutedForeground, shadow: c.shadow, primaryFixed: c.primarySoft,
    secondaryFixed: c.secondary, successFixed: c.successSoft,
    background: c.background, surfaceLow: c.backgroundAlt,
    surfaceHigh: c.cardElevated, surfaceHighest: c.cardElevated,
    card: c.card, text: c.foreground, success: c.success,
  };
}

const lightColors = getReferenceColors("light");

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
export type ReferenceColors = ReturnType<typeof getReferenceColors>;

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
