import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";

export type ToastTone = "default" | "success" | "error";

export interface ToastOptions {
  description?: string;
  tone?: ToastTone;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

interface ToastMessage extends ToastOptions {
  id: number;
  message: string;
}

interface ToastContextValue {
  show: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: Omit<ToastOptions, "tone">) => void;
  error: (message: string, options?: Omit<ToastOptions, "tone">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(14));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 10, duration: 160, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [opacity, translateY]);

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      counter.current += 1;
      setToast({ id: counter.current, message, ...options });
      opacity.setValue(0);
      translateY.setValue(14);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 220, useNativeDriver: true }),
      ]).start();
      timerRef.current = setTimeout(dismiss, options.duration ?? 2800);
    },
    [dismiss, opacity, translateY],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, options) => show(message, { ...options, tone: "success" }),
      error: (message, options) => show(message, { ...options, tone: "error" }),
    }),
    [show],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const toneColor =
    toast?.tone === "success"
      ? theme.colors.success
      : toast?.tone === "error"
        ? theme.colors.destructive
        : theme.colors.primary;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              bottom: insets.bottom + 18,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <View
            style={[
              styles.toast,
              {
                backgroundColor: theme.colors.cardElevated,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: toneColor }]} />
            <View style={styles.copy}>
              <Text style={[styles.message, { color: theme.colors.foreground }]} numberOfLines={2}>
                {toast.message}
              </Text>
              {toast.description ? (
                <Text
                  style={[styles.description, { color: theme.colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {toast.description}
                </Text>
              ) : null}
            </View>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  toast.action?.onPress();
                  dismiss();
                }}
                hitSlop={8}
                style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.actionLabel, { color: toneColor }]}>{toast.action.label}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  toast: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  copy: { flex: 1, gap: 2 },
  message: { fontSize: 14, fontWeight: "600" },
  description: { fontSize: 12.5, lineHeight: 17 },
  action: { paddingHorizontal: 6, paddingVertical: 4 },
  actionLabel: { fontSize: 13, fontWeight: "700" },
});

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
