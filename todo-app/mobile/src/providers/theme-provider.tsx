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

const THEME_KEY = "janus.theme.v2";

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  savePreference: (preference: ThemePreference) => Promise<void>;
  /** Cycles system -> light -> dark -> system. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
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

  const resolvedScheme = preference === "system" ? (system === "dark" ? "dark" : "light") : undefined;
  const resolved = preference === "system" ? (resolvedScheme === "light" ? themes.light : themes.dark) : getThemeById(preference);

  const toggle = useCallback(() => {
    setPreference(preference === "system" ? "dark" : preference === "dark" ? "light" : "system");
  }, [preference, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: resolved, preference, setPreference, savePreference, toggle }),
    [resolved, preference, setPreference, savePreference, toggle],
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
