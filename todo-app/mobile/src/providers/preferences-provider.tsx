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
import { defaultBoardDisplay, normalizeBoardDisplay, type BoardDisplayPreferences } from "@/lib/data/board-display-preferences";

export type { CalendarDefaultView, CalendarWeekStart } from "@/lib/data/settings";

const PREFERENCES_KEY = "janus.preferences.v1";

type StoredPreferences = AppPreferences & { boardDisplay: BoardDisplayPreferences; singleKeyShortcuts: boolean; ribbonPinned: boolean };

const DEFAULTS: StoredPreferences = {
  calendarWeekStart: 1,
  calendarDefaultView: "month",
  boardDisplay: defaultBoardDisplay,
  singleKeyShortcuts: true,
  ribbonPinned: false,
};

interface PreferencesContextValue extends AppPreferences {
  ribbonPinned: boolean;
  setRibbonPinned: (pinned: boolean) => void;
  singleKeyShortcuts: boolean;
  setSingleKeyShortcuts: (enabled: boolean) => void;
  boardDisplay: BoardDisplayPreferences;
  setBoardDisplayPreferences: (patch: Partial<BoardDisplayPreferences>) => void;
  savePreferences: (value: AppPreferences) => Promise<void>;
  setCalendarWeekStart: (value: CalendarWeekStart) => void;
  setCalendarDefaultView: (value: CalendarDefaultView) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<StoredPreferences>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(PREFERENCES_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as { calendarWeekStart?: unknown; calendarDefaultView?: unknown; boardDisplay?: unknown; singleKeyShortcuts?: unknown; ribbonPinned?: unknown };
        const next = { ...DEFAULTS };
        next.boardDisplay = normalizeBoardDisplay(parsed.boardDisplay);
        if (typeof parsed.singleKeyShortcuts === "boolean") next.singleKeyShortcuts = parsed.singleKeyShortcuts;
        if (typeof parsed.ribbonPinned === "boolean") next.ribbonPinned = parsed.ribbonPinned;
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

  const update = useCallback((patch: Partial<StoredPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      void AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const savePreferences = useCallback(async (next: AppPreferences) => {
    const updated = { ...preferences, calendarWeekStart: next.calendarWeekStart, calendarDefaultView: next.calendarDefaultView };
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
    setPreferences(updated);
  }, [preferences]);

  const setBoardDisplayPreferences = useCallback((patch: Partial<BoardDisplayPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, boardDisplay: normalizeBoardDisplay({ ...current.boardDisplay, ...patch }) };
      void AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...preferences,
      savePreferences,
      setBoardDisplayPreferences,
      setSingleKeyShortcuts: (enabled) => update({ singleKeyShortcuts: enabled }),
      setRibbonPinned: (pinned) => update({ ribbonPinned: pinned }),
      setCalendarWeekStart: (value) => update({ calendarWeekStart: value }),
      setCalendarDefaultView: (value) => update({ calendarDefaultView: value }),
    }),
    [preferences, update, savePreferences, setBoardDisplayPreferences],
  );

  if (!hydrated) return null;

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}
