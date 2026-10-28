import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Input } from "@/components/ui/input";
import { useReferenceTheme } from "@/components/reference/reference-theme";
import { useTheme } from "@/providers/theme-provider";
import { themes as catalog } from "@/theme/palettes";
import { getThemeById, type ThemeColors } from "@/theme/tokens";

type Mode = "light" | "dark";

const MODES: { value: Mode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
];

function Swatches({ colors }: { colors: ThemeColors }) {
  return <View accessible={false} style={styles.swatches}>
    {[colors.background, colors.card, colors.primary].map((color, index) =>
      <View key={index} style={[styles.swatch, { backgroundColor: color, borderColor: colors.borderStrong }]} />)}
  </View>;
}

export function ThemePicker({ disabled = false }: { disabled?: boolean }) {
  const { preference, theme, setPreference } = useTheme();
  const { colors, type } = useReferenceTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Remember the last palette used in each mode so the sun/moon switch returns to it.
  const [chosen, setChosen] = useState<Record<Mode, string>>({ light: "light", dark: "dark" });
  const mode = theme.scheme;
  const selected = catalog.find((entry) => entry.id === preference);
  const options = catalog.filter((entry) => (entry.id === "system" || entry.scheme === mode)
    && entry.name.toLowerCase().includes(query.trim().toLowerCase()));

  const selectMode = (next: Mode) => {
    if (disabled || next === mode) return;
    const current = catalog.find((entry) => entry.id === preference && entry.id !== "system" && entry.scheme === mode);
    const memory = current ? { ...chosen, [mode]: current.id } : chosen;
    const remembered = catalog.find((entry) => entry.id === memory[next] && entry.id !== "system" && entry.scheme === next);
    const fallback = catalog.find((entry) => entry.id === next && entry.scheme === next) ?? catalog.find((entry) => entry.id !== "system" && entry.scheme === next);
    setChosen(memory);
    if (remembered) setPreference(remembered.id);
    else if (fallback) setPreference(fallback.id);
  };

  return <View style={styles.root}>
    <Text style={[type.caption, { color: colors.muted }]}>Appearance mode</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Appearance mode" style={[styles.modeSwitch, { backgroundColor: colors.surfaceLow, borderColor: colors.outlineVariant }]}>
      {MODES.map((option) => {
        const active = mode === option.value;
        return <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={`Use ${option.label.toLowerCase()} appearance`} accessibilityState={{ checked: active, disabled }} aria-checked={active} disabled={disabled}
          onPress={() => selectMode(option.value)}
          style={({ pressed }) => [styles.modeButton, active && { backgroundColor: colors.card }, { opacity: pressed ? 0.75 : 1 }]}>
          <Ionicons name={option.icon} size={18} color={active ? colors.primary : colors.muted} />
          <Text style={[type.bodyStrong, { color: active ? colors.text : colors.muted }]}>{option.label}</Text>
        </Pressable>;
      })}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose interface theme" accessibilityState={{ expanded: open, disabled }} disabled={disabled}
      onPress={() => { setOpen(!open); setQuery(""); }}
      style={({ pressed }) => [styles.trigger, { backgroundColor: colors.surfaceLow, borderColor: colors.outlineVariant, opacity: pressed ? 0.75 : 1 }]}>
      <Swatches colors={theme.colors} />
      <View style={styles.copy}>
        <Text style={type.bodyStrong}>{selected?.name ?? "System"}</Text>
        <Text style={[type.caption, { color: colors.muted }]}>{preference === "system" ? "Follows your device appearance" : `${theme.scheme === "dark" ? "Dark" : "Light"} palette`}</Text>
      </View>
      <Text style={[type.caption, { color: colors.primary }]}>{open ? "Close" : "Change"}</Text>
    </Pressable>
    {open ? <View style={[styles.menu, { borderColor: colors.outlineVariant }]}>
      <Input value={query} onChangeText={setQuery} placeholder="Search themes" accessibilityLabel="Search themes" autoCorrect={false} />
      <Text style={[type.caption, { color: colors.muted, paddingHorizontal: 4 }]}>{`${mode === "dark" ? "Dark" : "Light"} themes${preference === "system" ? " · System follows this device" : ""}`}</Text>
      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.options}>
        <View accessibilityRole="radiogroup" accessibilityLabel={`${mode === "dark" ? "Dark" : "Light"} interface themes`}>
          {options.map((entry) => {
            const active = preference === entry.id;
            const preview = entry.id === "system" ? theme : getThemeById(entry.id);
            return <Pressable key={entry.id} accessibilityRole="radio" accessibilityLabel={entry.name} accessibilityState={{ checked: active, disabled }} aria-checked={active} disabled={disabled}
              onPress={() => {
                if (entry.id !== "system" && (entry.scheme === "light" || entry.scheme === "dark")) {
                  setChosen((current) => ({ ...current, [entry.scheme]: entry.id }));
                }
                setPreference(entry.id); setOpen(false); setQuery("");
              }}
              style={({ pressed }) => [styles.option, { backgroundColor: active ? colors.secondaryContainer : pressed ? colors.surfaceLow : "transparent" }]}>
              <Swatches colors={preview.colors} />
              <Text numberOfLines={1} style={[type.body, styles.copy, { fontWeight: active ? "600" : "400" }]}>{entry.id === "system" ? "System (follow device)" : entry.name}</Text>
              {active ? <Text style={[type.caption, { color: colors.onSecondaryContainer }]}>Selected</Text> : null}
            </Pressable>;
          })}
          {!options.length ? <Text accessibilityLiveRegion="polite" style={[type.caption, styles.empty, { color: colors.muted }]}>No themes match your search.</Text> : null}
        </View>
      </ScrollView>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  modeSwitch: { padding: 4, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 4 },
  modeButton: { flex: 1, minHeight: 44, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  trigger: { minHeight: 64, padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 },
  swatches: { flexDirection: "row", gap: 3 },
  swatch: { width: 12, height: 24, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  menu: { padding: 8, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  options: { maxHeight: 300 },
  option: { minHeight: 48, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 10 },
  empty: { padding: 12 },
});
