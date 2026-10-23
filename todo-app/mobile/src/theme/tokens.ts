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
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  shadow: string;
  skeleton: string;
}

const light: ThemeColors = {
  background: "#FAF9F5",
  backgroundAlt: "#F3F1EA",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  foreground: "#2B2723",
  mutedForeground: "#7D776E",
  border: "#E6E2D9",
  borderStrong: "#D6D1C6",
  input: "#EDEAE2",
  primary: "#7C3AED",
  primaryForeground: "#FCFBFF",
  primarySoft: "#F0E9FF",
  secondary: "#F1EEE7",
  secondaryForeground: "#4A443D",
  accent: "#EDE4FF",
  accentForeground: "#5B21B6",
  destructive: "#DC2626",
  destructiveSoft: "#FEE9E9",
  success: "#16A34A",
  successSoft: "#E5F6EA",
  warning: "#D97706",
  warningSoft: "#FDF0DA",
  info: "#2563EB",
  infoSoft: "#E6EEFF",
  overlay: "rgba(31,26,20,0.42)",
  shadow: "rgba(43,39,35,0.14)",
  skeleton: "#EDEAE2",
};

const dark: ThemeColors = {
  background: "#1B1916",
  backgroundAlt: "#24211D",
  card: "#2A2722",
  cardElevated: "#322E28",
  foreground: "#F2F0EA",
  mutedForeground: "#B4ADA2",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.18)",
  input: "rgba(255,255,255,0.07)",
  primary: "#A78BFA",
  primaryForeground: "#241A3E",
  primarySoft: "rgba(167,139,250,0.16)",
  secondary: "#38332C",
  secondaryForeground: "#EDE9E1",
  accent: "rgba(167,139,250,0.18)",
  accentForeground: "#DDD1FF",
  destructive: "#F87171",
  destructiveSoft: "rgba(248,113,113,0.16)",
  success: "#4ADE80",
  successSoft: "rgba(74,222,128,0.14)",
  warning: "#FBBF24",
  warningSoft: "rgba(251,191,36,0.14)",
  info: "#60A5FA",
  infoSoft: "rgba(96,165,250,0.14)",
  overlay: "rgba(0,0,0,0.58)",
  shadow: "rgba(0,0,0,0.45)",
  skeleton: "#38332C",
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
