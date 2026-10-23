import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/providers/theme-provider";
import { Button } from "./button";

export function EmptyState({
  icon = "file-tray-outline",
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
        <Ionicons name={icon} size={22} color={theme.colors.primary} />
      </View>
      <Text style={[styles.title, { color: theme.colors.foreground, fontSize: theme.type.title.fontSize }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.colors.mutedForeground, fontSize: theme.type.body.fontSize }]}>{message}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={{ marginTop: 16 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    maxWidth: 280,
  },
});
