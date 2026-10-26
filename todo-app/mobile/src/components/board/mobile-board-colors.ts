import { useTheme } from "@/providers/theme-provider";
import type { ThemeColors } from "@/theme/tokens";

/** Compatibility hook: boards use the same palette as the rest of the app. */
export function useMobileBoardColors(): ThemeColors {
  const { theme } = useTheme();
  return theme.colors;
}
