import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { EditorWindow } from "@/components/ui/editor-window";
import { Sheet } from "@/components/ui/sheet";
import { SEASONAL_CARD_THEMES } from "@/lib/features/card-themes";
import { setEventOverride } from "@/lib/features/active-events";
import { useActiveEvents } from "@/hooks/use-active-events";
import { useTheme } from "@/providers/theme-provider";

export function EventDebugButton({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { theme: { colors: c } } = useTheme();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const { override } = useActiveEvents();
  const wide = width >= 700;
  const changeOpen = (value: boolean) => { setOpen(value); onOpenChange(value); };
  const content = <>
    <Text style={[styles.sectionTitle, { color: c.foreground }]}>Choose an event</Text>
    <View style={styles.options}>
      {SEASONAL_CARD_THEMES.map((entry) => {
        const selected = override === entry.id;
        return <Pressable
          key={entry.id}
          accessibilityRole="button"
          accessibilityLabel={`Trigger ${entry.label} event`}
          accessibilityState={{ selected }}
          onPress={() => setEventOverride(entry.id)}
          style={[
            styles.option,
            wide ? styles.wideOption : styles.mobileOption,
            { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primarySoft : c.cardElevated },
          ]}
        >
          <Text style={styles.optionSymbol}>{entry.symbol}</Text>
          <Text numberOfLines={1} style={[styles.optionLabel, { color: selected ? c.primary : c.foreground }]}>{entry.label}</Text>
          {selected ? <Ionicons name="checkmark-circle" size={17} color={c.primary} /> : null}
        </Pressable>;
      })}
    </View>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Reset events to automatic dates"
      onPress={() => setEventOverride(null)}
      style={[styles.reset, { borderColor: c.border, backgroundColor: c.cardElevated }]}
    >
      <Ionicons name="refresh-outline" size={17} color={c.mutedForeground} />
      <Text style={[styles.resetLabel, { color: c.foreground }]}>Reset to automatic dates</Text>
    </Pressable>
  </>;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Debug events" onPress={() => changeOpen(true)} style={styles.trigger}>
      <Ionicons name="bug-outline" size={19} color={override ? c.primary : c.mutedForeground} />
      <Text style={{ fontSize: 10, color: override ? c.primary : c.mutedForeground }}>Debug events</Text>
    </Pressable>
    {wide
      ? <EditorWindow visible={open} title="Debug events" icon="bug-outline" closeLabel="Close event previews" onClose={() => changeOpen(false)} width={680} height={510}>
        <View style={[styles.desktopContent, { backgroundColor: c.card }]}>{content}</View>
      </EditorWindow>
      : <Sheet visible={open} onClose={() => changeOpen(false)} style={styles.mobileSheet}>
        <View style={styles.mobileContent}>
          <View style={styles.mobileHeader}>
            <View style={[styles.previewIcon, { backgroundColor: c.primarySoft }]}><Ionicons name="bug-outline" size={19} color={c.primary} /></View>
            <Text accessibilityRole="header" style={[styles.mobileTitle, styles.mobileHeaderTitle, { color: c.foreground }]}>Debug events</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close event previews" onPress={() => changeOpen(false)} style={styles.closeButton}>
              <Ionicons name="close" size={18} color={c.mutedForeground} />
            </Pressable>
          </View>
          {content}
        </View>
      </Sheet>}
  </>;
}

const styles = StyleSheet.create({
  trigger: { minWidth: 76, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 6 },
  desktopContent: { flex: 1, gap: 18, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24 },
  mobileSheet: { paddingHorizontal: 18, paddingTop: 4 },
  mobileContent: { gap: 16, paddingBottom: 8 },
  mobileHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingBottom: 2 },
  mobileTitle: { fontSize: 19, lineHeight: 24, fontWeight: "700" },
  mobileHeaderTitle: { flex: 1, paddingTop: 6 },
  closeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "rgba(128,128,128,0.12)" },
  previewIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  sectionTitle: { fontSize: 13, lineHeight: 18, fontWeight: "700", marginBottom: -8 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11, borderWidth: 1, borderRadius: 12 },
  mobileOption: { flexGrow: 1, flexBasis: "47%", minWidth: 138 },
  wideOption: { flexGrow: 1, flexBasis: "30%", minWidth: 170 },
  optionSymbol: { fontSize: 16 },
  optionLabel: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: "600" },
  reset: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  resetLabel: { fontSize: 12, fontWeight: "600" },
});
