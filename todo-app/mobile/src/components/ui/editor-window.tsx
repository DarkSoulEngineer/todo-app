import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";

/** Desktop-style frame; the editor owns its draft, scrolling and save behavior. */
export function EditorWindow({ visible, title, subtitle, onClose, children }: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { theme: { colors: c } } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [maximized, setMaximized] = useState(false);
  const [hovered, setHovered] = useState<"maximize" | "close" | null>(null);
  const availableWidth = Math.max(0, width - insets.left - insets.right - 32);
  const availableHeight = Math.max(0, height - insets.top - insets.bottom - 32);

  return <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close task editor backdrop" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} />
      <View testID="task-editor-window" accessibilityViewIsModal style={[styles.window, { width: maximized ? availableWidth : Math.min(960, availableWidth), height: maximized ? availableHeight : Math.min(760, availableHeight), backgroundColor: c.card, borderColor: c.borderStrong, shadowColor: c.shadow }]}>
        <View testID="task-editor-window-titlebar" style={[styles.titlebar, { backgroundColor: c.backgroundAlt, borderBottomColor: c.border }]}>
          <Ionicons name="checkbox-outline" size={18} color={c.primary} />
          <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: c.foreground }]}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={maximized ? "Restore editor window" : "Maximize editor window"} onPress={() => setMaximized((value) => !value)} onHoverIn={() => setHovered("maximize")} onHoverOut={() => setHovered(null)} style={({ pressed }) => [styles.captionButton, { backgroundColor: hovered === "maximize" || pressed ? c.secondary : "transparent" }]}>
            <Ionicons name={maximized ? "copy-outline" : "square-outline"} size={15} color={c.foreground} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Close task editor" onPress={onClose} onHoverIn={() => setHovered("close")} onHoverOut={() => setHovered(null)} style={({ pressed }) => [styles.captionButton, { backgroundColor: hovered === "close" || pressed ? c.destructive : "transparent" }]}>
            {({ pressed }) => <Ionicons name="close" size={20} color={hovered === "close" || pressed ? c.destructiveForeground : c.foreground} />}
          </Pressable>
        </View>
        {subtitle ? <View style={[styles.toolbar, { borderBottomColor: c.border, backgroundColor: c.backgroundAlt }]}>
          <Text style={[styles.subtitle, { color: c.mutedForeground }]}>{subtitle}</Text>
        </View> : null}
        {children}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center" },
  window: { maxWidth: "100%", maxHeight: "100%", minHeight: 0, borderWidth: 1, borderRadius: 8, overflow: "hidden", shadowOpacity: 0.35, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 20 },
  titlebar: { flexDirection: "row", alignItems: "center", paddingLeft: 16, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexShrink: 0 },
  title: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "600" },
  captionButton: { width: 46, height: 44, alignItems: "center", justifyContent: "center" },
  toolbar: { paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexShrink: 0 },
  subtitle: { fontSize: 12, lineHeight: 18 },
});
