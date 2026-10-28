import { Stack, usePathname } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform, StyleSheet } from "react-native";
import { PreferencesProvider } from "@/providers/preferences-provider";
import { TasksProvider } from "@/providers/tasks-provider";
import { ThemeProvider, useTheme } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";

function RootLayoutInner() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const pageTitle = pathname === "/" ? "Home"
    : ["/top-tasks", "/my-tasks", "/calendar"].includes(pathname) ? "Priorities"
    : pathname === "/settings" ? "Settings"
    : pathname === "/task/new" ? "Create"
    : pathname.startsWith("/task/") ? "Task"
    : pathname === "/reference-board" || pathname.startsWith("/board/") ? "Board"
    : "Janus";
  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {Platform.OS === "web" ? <Head><title>{pageTitle}</title></Head> : null}
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="index" options={{ title: "Home" }} />
        <Stack.Screen name="top-tasks" options={{ title: "Priorities" }} />
        <Stack.Screen name="my-tasks" options={{ title: "Priorities" }} />
        <Stack.Screen name="calendar" options={{ title: "Priorities" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="board/[id]" options={{ title: "Board" }} />
        <Stack.Screen name="reference-board" options={{ title: "Board" }} />
        <Stack.Screen name="task/new" options={{ title: "Create" }} />
        <Stack.Screen name="task/[id]" options={{ title: "Task" }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <TasksProvider>
          <PreferencesProvider>
            <ToastProvider>
              <RootLayoutInner />
            </ToastProvider>
          </PreferencesProvider>
        </TasksProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
