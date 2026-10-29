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
  plain = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  plain?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.xl }, plain && styles.plain]}>
      {!plain ? <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
        <Ionicons name={icon} size={22} color={theme.colors.primary} />
      </View> : null}
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
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
  },
  plain: {
    backgroundColor: "transparent",
    borderWidth: 0,
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
