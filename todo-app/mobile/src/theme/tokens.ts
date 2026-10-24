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

const light: ThemeColors = {
  background: "#F8FAFC",
  backgroundAlt: "#F8FAFC",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  foreground: "#0F172A",
  mutedForeground: "#64748B",
  border: "#E2E8F0",
  borderStrong: "#C3C6D7",
  input: "#FFFFFF",
  primary: "#9333EA",
  primaryForeground: "#FFFFFF",
  primarySoft: "#F3E8FF",
  secondary: "#F1F5F9",
  secondaryForeground: "#475569",
  accent: "#F3E8FF",
  accentForeground: "#7E22CE",
  destructive: "#F43F5E",
  destructiveSoft: "#FFDAD6",
  destructiveForeground: "#FFFFFF",
  success: "#10B981",
  successSoft: "#C7FFCA",
  successForeground: "#FFFFFF",
  warning: "#D97706",
  warningSoft: "#FFEDD5",
  info: "#0EA5E9",
  infoSoft: "#DBE1FF",
  overlay: "rgba(11,28,48,0.42)",
  shadow: "rgba(15,23,42,0.10)",
  skeleton: "#EFF4FF",
};

const dark: ThemeColors = {
  background: "#0C0C0F",
  backgroundAlt: "#101115",
  card: "#121217",
  cardElevated: "#18181F",
  foreground: "#F4F4F5",
  mutedForeground: "#A1A1AA",
  border: "#24242F",
  borderStrong: "#3F3F4B",
  input: "#121217",
  primary: "#C084FC",
  primaryForeground: "#160D22",
  primarySoft: "#29133E",
  secondary: "#1C1C25",
  secondaryForeground: "#D4D4D8",
  accent: "#29133E",
  accentForeground: "#D8B4FE",
  destructive: "#FB7185",
  destructiveSoft: "#4A1F21",
  destructiveForeground: "#150A09",
  success: "#34D399",
  successSoft: "#1D3A2C",
  successForeground: "#10291D",
  warning: "#F1AF57",
  warningSoft: "#47351F",
  info: "#38BDF8",
  infoSoft: "#2D2A45",
  overlay: "rgba(0,0,0,0.58)",
  shadow: "rgba(0,0,0,0.45)",
  skeleton: "#1C1C25",
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
