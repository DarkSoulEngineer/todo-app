export interface ThemeColors {
  /** App canvas. */
  background: string;
  /** Slightly raised canvas region (section columns, sheets). */
  backgroundAlt: string;
  card: string;
  cardElevated: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  borderStrong: string;
  input: string;
  primary: string;
  primaryForeground: string;
  primarySoft: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveSoft: string;
  destructiveForeground: string;
  success: string;
  successSoft: string;
  successForeground: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  shadow: string;
  skeleton: string;
}

/** The board's warm neutrals, shared by every screen and theme adapter. */
const light: ThemeColors = {
  background: "#F1EEE9",
  backgroundAlt: "#F1EEE9",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  foreground: "#211C17",
  mutedForeground: "#4A4035",
  border: "#DAD4CC",
  borderStrong: "#B0A79C",
  input: "#FFFFFF",
  primary: "#9333EA",
  primaryForeground: "#FFFFFF",
  primarySoft: "#F3E8FF",
  secondary: "#F1EEE9",
  secondaryForeground: "#342D25",
  accent: "#F3E8FF",
  accentForeground: "#7E22CE",
  destructive: "#BE123C",
  destructiveSoft: "#FFDAD6",
  destructiveForeground: "#FFFFFF",
  success: "#047857",
  successSoft: "#C7FFCA",
  successForeground: "#FFFFFF",
  warning: "#92400E",
  warningSoft: "#FFEDD5",
  info: "#0369A1",
  infoSoft: "#DBE1FF",
  overlay: "rgba(18,15,11,0.42)",
  shadow: "rgba(18,15,11,0.10)",
  skeleton: "#DAD4CC",
};

const dark: ThemeColors = {
  background: "#120F0B",
  backgroundAlt: "#191510",
  card: "#211C17",
  cardElevated: "#29231D",
  foreground: "#F1EEE9",
  mutedForeground: "#B0A79C",
  border: "#342D25",
  borderStrong: "#4A4035",
  input: "#191510",
  primary: "#A193FC",
  primaryForeground: "#160D22",
  primarySoft: "#322C46",
  secondary: "#29231D",
  secondaryForeground: "#DAD4CC",
  accent: "#322C46",
  accentForeground: "#D8B4FE",
  destructive: "#F36164",
  destructiveSoft: "#431B1D",
  destructiveForeground: "#150A09",
  success: "#45BF82",
  successSoft: "#1D3A2C",
  successForeground: "#10291D",
  warning: "#F1AF57",
  warningSoft: "#47351F",
  info: "#55AEE8",
  infoSoft: "#2D2A45",
  overlay: "rgba(0,0,0,0.58)",
  shadow: "rgba(0,0,0,0.45)",
  skeleton: "#29231D",
};

export interface Theme {
  scheme: "light" | "dark";
  colors: ThemeColors;
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  space: (steps: number) => number;
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

export type ThemePreference = "system" | "light" | "dark";

export const themes: Record<"light" | "dark", Theme> = {
  light: {
    scheme: "light",
    colors: light,
    radius: { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 },
    space: (steps) => steps * 4,
    type: {
      display: { fontSize: 30, lineHeight: 36, fontWeight: "700" },
      title: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
      subtitle: { fontSize: 17, lineHeight: 23, fontWeight: "600" },
      body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
      bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
      caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
      micro: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
    },
  },
  dark: {
    scheme: "dark",
    colors: dark,
    radius: { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 },
    space: (steps) => steps * 4,
    type: {
      display: { fontSize: 30, lineHeight: 36, fontWeight: "700" },
      title: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
      subtitle: { fontSize: 17, lineHeight: 23, fontWeight: "600" },
      body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
      bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
      caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
      micro: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
    },
  },
};
