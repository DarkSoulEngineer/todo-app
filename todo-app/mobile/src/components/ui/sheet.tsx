import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";

export function Sheet({ visible, onClose, children, style }: { visible: boolean; onClose: () => void; children: React.ReactNode; style?: ViewStyle }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={insets.top} style={styles.keyboard}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.card,
                borderTopLeftRadius: theme.radius.xl,
                borderTopRightRadius: theme.radius.xl,
                paddingBottom: insets.bottom + 12,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.shadow,
                shadowOpacity: 1,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: -6 },
                elevation: 12,
              },
              style,
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  keyboard: {
    maxHeight: "92%",
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "100%",
  },
  content: {
    paddingBottom: 4,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
});
