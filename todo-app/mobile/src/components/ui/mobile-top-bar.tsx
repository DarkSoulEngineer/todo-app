import { Ionicons } from "@expo/vector-icons";
import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";

export function MobileTopBar({
  title,
  leading,
  actions,
  search,
}: {
  title: string;
  leading?: ReactNode;
  actions?: ReactNode;
  search?: ReactNode;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: c.card, borderTopColor: c.primary, borderBottomColor: c.border, paddingTop: insets.top }]}>
      <View style={[styles.row, { borderTopColor: c.border }]}>
        {leading}
        <View style={styles.copy}>
          <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>{title}</Text>
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      {search ? <View style={styles.searchRow}>{search}</View> : null}
    </View>
  );
}

export function MobileTopBarAction({
  icon,
  label,
  onPress,
  active = false,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active ? { selected: true } : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.action, active && { backgroundColor: c.input }, style, { opacity: pressed ? 0.65 : 1 }]}
    >
      <Ionicons name={icon} size={19} color={active ? c.primary : c.foreground} />
    </Pressable>
  );
}

export function MobileSearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  autoFocus = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  autoFocus?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const input = useRef<ComponentRef<typeof TextInput> | null>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.search, { borderColor: focused ? c.primary : c.borderStrong, backgroundColor: c.input }]}>
      <Ionicons name="search-outline" size={16} color={c.mutedForeground} />
      <TextInput
        ref={input}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={c.primary}
        cursorColor={c.primary}
        underlineColorAndroid="transparent"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, { color: c.foreground }, Platform.OS === "web" && { outlineWidth: 0 }]}
      />
      {value ? (
        <Pressable hitSlop={1} accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { onChangeText(""); input.current?.focus(); }} style={({ pressed }) => [styles.clear, { opacity: pressed ? 0.65 : 1 }]}>
          <Ionicons name="close" size={19} color={c.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderTopWidth: 1, borderBottomWidth: 1 },
  row: { minHeight: 44, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4, borderTopWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, minWidth: 0, paddingHorizontal: 6 },
  title: { fontSize: 17, fontWeight: "800" },
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
  searchRow: { paddingHorizontal: 12, paddingVertical: 8 },
  action: { width: 44, height: 44, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  search: { width: "100%", height: 44, borderWidth: 1, borderRadius: 9, paddingLeft: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  input: { flex: 1, minWidth: 0, height: 42, paddingVertical: 0, fontSize: 14 },
  clear: { width: 44, height: 42, borderRadius: 7, alignItems: "center", justifyContent: "center" },
});
