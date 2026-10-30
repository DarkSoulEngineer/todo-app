import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTasksContext } from "@/providers/tasks-provider";

export type ToastTone = "default" | "success" | "error";

export interface ToastOptions {
  description?: string;
  tone?: ToastTone;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

export interface ToastNotification extends ToastOptions {
  id: number;
  projectId: string;
  message: string;
  createdAt: number;
  read: boolean;
}

interface ToastContextValue {
  notifications: ToastNotification[];
  show: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: Omit<ToastOptions, "tone">) => void;
  error: (message: string, options?: Omit<ToastOptions, "tone">) => void;
  markNotificationsRead: () => void;
  dismissNotification: (id: number) => void;
  clearNotifications: () => void;
  runNotificationAction: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { currentProjectId, projects } = useTasksContext();
  const [allNotifications, setAllNotifications] = useState<ToastNotification[]>([]);
  const notifications = allNotifications.filter((item) => item.projectId === currentProjectId);
  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      setAllNotifications((current) => [
        { id: Date.now() + Math.random(), projectId: currentProjectId, message, createdAt: Date.now(), read: false, ...options },
        ...current,
      ].slice(0, 100));
    },
    [currentProjectId],
  );
  const markNotificationsRead = useCallback(() => {
    setAllNotifications((current) => current.some((item) => item.projectId === currentProjectId && !item.read)
      ? current.map((item) => item.projectId === currentProjectId ? { ...item, read: true } : item)
      : current);
  }, [currentProjectId]);
  const dismissNotification = useCallback((id: number) => {
    setAllNotifications((current) => current.filter((item) => item.id !== id));
  }, []);
  const clearNotifications = useCallback(() => {
    setAllNotifications((current) => current.filter((item) => item.projectId !== currentProjectId));
  }, [currentProjectId]);
  const runNotificationAction = useCallback((id: number) => {
    const notification = allNotifications.find((item) => item.id === id && item.projectId === currentProjectId);
    if (!notification?.action) return;
    notification.action.onPress();
    dismissNotification(id);
  }, [allNotifications, currentProjectId, dismissNotification]);

  const projectIds = projects.map((project) => project.id);
  useEffect(() => {
    const activeProjectIds = new Set(projectIds);
    setAllNotifications((current) => current.filter((item) => activeProjectIds.has(item.projectId)));
  }, [projectIds.join("\0")]);

  const value = useMemo<ToastContextValue>(
    () => ({
      notifications,
      show,
      success: (message, options) => show(message, { ...options, tone: "success" }),
      error: (message, options) => show(message, { ...options, tone: "error" }),
      markNotificationsRead,
      dismissNotification,
      clearNotifications,
      runNotificationAction,
    }),
    [clearNotifications, dismissNotification, markNotificationsRead, notifications, runNotificationAction, show],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
