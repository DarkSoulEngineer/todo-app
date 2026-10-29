import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Button } from "@/components/ui/button";
import { EditorWindow } from "@/components/ui/editor-window";
import { Sheet } from "@/components/ui/sheet";
import { useTheme } from "@/providers/theme-provider";

export function ConfirmationDialog({ visible, title, description, confirmLabel, cancelLabel, onClose, onConfirm }: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { theme: { colors } } = useTheme();
  const { width } = useWindowDimensions();
  const windowed = width >= 768;
  const copy = <Text style={[styles.copy, { color: colors.mutedForeground }]}>{description}</Text>;
  const actions = <View style={[styles.actions, windowed && styles.windowActions, windowed && { backgroundColor: colors.backgroundAlt, borderTopColor: colors.border }]}>
    <Button variant="outline" label={cancelLabel} onPress={onClose} style={windowed ? styles.windowButton : styles.mobileButton} />
    <Button variant="danger" label={confirmLabel} onPress={onConfirm} style={windowed ? styles.windowButton : styles.mobileButton} />
  </View>;

  if (windowed) return <EditorWindow visible={visible} title={title} icon="trash-outline" closeLabel="Close confirmation" testID="confirmation-window" width={560} height={280} onClose={onClose}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>{copy}</ScrollView>
    {actions}
  </EditorWindow>;

  return <Sheet visible={visible} onClose={onClose}>
    <Text accessibilityRole="header" accessibilityLabel={title} numberOfLines={2} ellipsizeMode="tail" style={[styles.title, { color: colors.foreground }]}>{title}</Text>
    {copy}
    {actions}
  </Sheet>;
}

const styles = StyleSheet.create({
  title: { fontSize: 23, fontWeight: "700", marginBottom: 6 },
  copy: { fontSize: 14, lineHeight: 21 },
  scroll: { flex: 1, minHeight: 0 },
  content: { padding: 20 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  windowActions: { marginTop: 0, justifyContent: "flex-end", padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  windowButton: { minWidth: 120, borderRadius: 6 },
  mobileButton: { flex: 1 },
});
