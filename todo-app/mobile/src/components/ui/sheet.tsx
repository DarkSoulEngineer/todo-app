import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";
import { BottomSheetModal } from "@/components/ui/bottom-sheet-modal";

export function Sheet({ visible, onClose, children, style }: { visible: boolean; onClose: () => void; children: React.ReactNode; style?: ViewStyle }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <BottomSheetModal visible={visible} onClose={onClose} style={[styles.sheet, { paddingBottom: insets.bottom + 12 }, style]}>
      <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {children}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 10,
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
