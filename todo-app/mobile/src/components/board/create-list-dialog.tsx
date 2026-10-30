import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Button } from "@/components/ui/button";
import { EditorWindow } from "@/components/ui/editor-window";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useTheme } from "@/providers/theme-provider";

export function CreateListDialog({ visible, title, onChangeTitle, onClose, onCreate }: {
  visible: boolean;
  title: string;
  onChangeTitle: (value: string) => void;
  onClose: () => void;
  onCreate: (title: string) => void;
}) {
  const { theme: { colors } } = useTheme();
  const { width } = useWindowDimensions();
  const windowed = width >= 768;
  const submit = () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle) onCreate(trimmedTitle);
  };
  const field = <>
    <Text style={[styles.copy, !windowed && styles.mobileCopy, { color: colors.mutedForeground }]}>Use lists to shape this board around your flow.</Text>
    <Text style={[styles.label, !windowed && styles.mobileLabel, { color: colors.mutedForeground }]}>LIST NAME</Text>
    <Input autoFocus value={title} onChangeText={onChangeTitle} placeholder="e.g. In progress" accessibilityLabel="List name" accessibilityHint="Required" returnKeyType="done" onSubmitEditing={submit} style={windowed ? styles.windowInput : styles.mobileInput} />
  </>;
  const createButton = <Button variant="secondary" label="Add list" disabled={!title.trim()} onPress={submit} style={windowed ? styles.primary : styles.mobileButton} />;

  if (windowed) return <EditorWindow visible={visible} title="Add a list" icon="list-outline" closeLabel="Close list editor" testID="create-list-window" width={560} height={300} onClose={onClose}>
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.content}>{field}</ScrollView>
    <View style={[styles.footer, { backgroundColor: colors.backgroundAlt, borderTopColor: colors.border }]}>
      <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.windowInput} />
      {createButton}
    </View>
  </EditorWindow>;

  return <Sheet visible={visible} onClose={onClose} style={styles.mobileSheet}>
    <Text accessibilityRole="header" style={[styles.title, styles.mobileTitle, { color: colors.foreground }]}>Add a list</Text>
    {field}
    <View style={styles.mobileFooter}>{createButton}</View>
  </Sheet>;
}

const styles = StyleSheet.create({
  title: { fontSize: 23, fontWeight: "700", marginBottom: 6 },
  copy: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  scroll: { flex: 1, minHeight: 0 },
  content: { padding: 20 },
  windowInput: { borderRadius: 6 },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  primary: { minWidth: 120, borderRadius: 12 },
  mobileSheet: { paddingHorizontal: 12, paddingTop: 2, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  mobileTitle: { fontSize: 20, lineHeight: 26, marginBottom: 4 },
  mobileCopy: { fontSize: 12, lineHeight: 18 },
  mobileLabel: { marginTop: 12, marginBottom: 6, fontSize: 10, letterSpacing: 0.8 },
  mobileInput: { height: 44, minWidth: 0, borderRadius: 8, fontSize: 14, paddingHorizontal: 10, paddingVertical: 0 },
  mobileButton: { height: 44, borderRadius: 8 },
  mobileFooter: { marginTop: 10 },
});
