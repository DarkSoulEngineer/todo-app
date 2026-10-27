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

import type { AppPreferences, CalendarDefaultView, CalendarWeekStart } from "@/lib/data/settings";

export type { CalendarDefaultView, CalendarWeekStart } from "@/lib/data/settings";

const PREFERENCES_KEY = "janus.preferences.v1";

const DEFAULTS: AppPreferences = {
  calendarWeekStart: 1,
  calendarDefaultView: "month",
};

interface PreferencesContextValue extends AppPreferences {
  savePreferences: (value: AppPreferences) => Promise<void>;
  setCalendarWeekStart: (value: CalendarWeekStart) => void;
  setCalendarDefaultView: (value: CalendarDefaultView) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(PREFERENCES_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as { calendarWeekStart?: unknown; calendarDefaultView?: unknown };
        const next = { ...DEFAULTS };
        if (parsed.calendarWeekStart === 0 || parsed.calendarWeekStart === 1) {
          next.calendarWeekStart = parsed.calendarWeekStart;
        }
        if (parsed.calendarDefaultView === "month" || parsed.calendarDefaultView === "week") {
          next.calendarDefaultView = parsed.calendarDefaultView;
        }
        setPreferences(next);
      })
      .catch(() => {
        // Invalid or unavailable storage falls back to the defaults.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<AppPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      void AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const savePreferences = useCallback(async (next: AppPreferences) => {
    const preferences = { calendarWeekStart: next.calendarWeekStart, calendarDefaultView: next.calendarDefaultView };
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    setPreferences(preferences);
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...preferences,
      savePreferences,
      setCalendarWeekStart: (value) => update({ calendarWeekStart: value }),
      setCalendarDefaultView: (value) => update({ calendarDefaultView: value }),
    }),
    [preferences, update, savePreferences],
  );

  if (!hydrated) return null;

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}
