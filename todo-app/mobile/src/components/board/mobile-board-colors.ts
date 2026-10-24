import { useTheme } from "@/providers/theme-provider";
import type { ThemeColors } from "@/theme/tokens";

/** Warm desktop-board palette, scoped so the board manager stays unchanged. */
export function useMobileBoardColors(): ThemeColors {
  const { theme } = useTheme();
  if (theme.scheme === "light") return theme.colors;
  return {
    ...theme.colors,
    background: "#120F0B",
    backgroundAlt: "#191510",
    card: "#211C17",
    cardElevated: "#29231D",
    input: "#191510",
    secondary: "#29231D",
    border: "#342D25",
    borderStrong: "#4A4035",
    foreground: "#F1EEE9",
    mutedForeground: "#B0A79C",
    secondaryForeground: "#DAD4CC",
    primary: "#A193FC",
    primarySoft: "#322C46",
    success: "#45BF82",
    warning: "#F1AF57",
    destructive: "#F36164",
    info: "#55AEE8",
  };
}
