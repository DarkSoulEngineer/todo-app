import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { getThemeById, themes, type Theme, type ThemePreference } from "@/theme/tokens";
import { getFontFamily } from "@/theme/fonts";

const THEME_KEY = "janus.theme.v2";

const FONT_KEY = "janus.font.v1";

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  savePreference: (preference: ThemePreference) => Promise<void>;
  /** Cycles system -> light -> dark -> system. */
  toggle: () => void;
  font: string;
  setFont: (font: string) => void;
  saveFont: (font: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [font, setFontState] = useState<string>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(THEME_KEY)
      .then((value) => {
        if (cancelled) return;
        if (value) {
          setPreferenceState(value);
        } else {
          void AsyncStorage.getItem("janus.theme.v1").then((old) => {
            if (cancelled) return;
            if (old === "light" || old === "dark" || old === "system") {
              setPreferenceState(old);
            }
          });
        }
      })
      .catch(() => {
        // Storage may be unavailable; keep defaults.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    void AsyncStorage.getItem(FONT_KEY)
      .then((value) => {
        if (cancelled) return;
        if (value) setFontState(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  }, []);

  const savePreference = useCallback(async (next: ThemePreference) => {
    await AsyncStorage.setItem(THEME_KEY, next);
    setPreferenceState(next);
  }, []);

  const setFont = useCallback((next: string) => {
    setFontState(next);
    void AsyncStorage.setItem(FONT_KEY, next);
  }, []);

  const saveFont = useCallback(async (next: string) => {
    await AsyncStorage.setItem(FONT_KEY, next);
    setFontState(next);
  }, []);

  const resolvedScheme = preference === "system" ? (system === "dark" ? "dark" : "light") : undefined;
  const baseResolved = preference === "system" ? (resolvedScheme === "light" ? themes.light : themes.dark) : getThemeById(preference);
  const resolved = useMemo(() => ({ ...baseResolved, fontFamily: getFontFamily(font) }), [baseResolved, font]);

  const toggle = useCallback(() => {
    setPreference(preference === "system" ? "dark" : preference === "dark" ? "light" : "system");
  }, [preference, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: resolved, preference, setPreference, savePreference, toggle, font, setFont, saveFont }),
    [resolved, preference, setPreference, savePreference, toggle, font, setFont, saveFont],
  );

  // Avoid a light flash before the saved preference loads.
  if (!hydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
