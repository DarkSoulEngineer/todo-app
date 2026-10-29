import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { EditorWindow } from "@/components/ui/editor-window";
import { commandShortcut, filterCommands, PALETTE_HELP, type Command } from "@/lib/features/commands";
import { useTheme } from "@/providers/theme-provider";
import { usePreferences } from "@/providers/preferences-provider";

export type PaletteMode = "commands" | "help" | null;

export function CommandPalette({ mode, onMode, commands, blocked = false }: {
  mode: PaletteMode;
  onMode: (mode: PaletteMode) => void;
  commands: Command[];
  blocked?: boolean;
}) {
  const { theme: { colors: c } } = useTheme();
  const { singleKeyShortcuts } = usePreferences();
  const focused = useIsFocused();
  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<ComponentRef<typeof TextInput> | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const rowLayouts = useRef<Record<string, number>>({});
  let entries = commands;
  let title = "Commands";
  for (const id of path) {
    const parent = entries.find((entry) => entry.id === id);
    if (!parent?.children) break;
    title = parent.label;
    entries = parent.children;
  }
  const results = filterCommands(entries, query);
  const activeIndex = Math.min(index, Math.max(0, results.length - 1));
  const reset = () => { setPath([]); setQuery(""); setIndex(0); };
  const close = () => { onMode(null); reset(); };
  const choose = (command: Command) => {
    if (command.children) {
      setPath((current) => [...current, command.id]); setQuery(""); setIndex(0); input.current?.focus();
    } else { close(); command.run?.(); }
  };
  const back = () => {
    if (mode === "help") { onMode("commands"); return; }
    if (!path.length) { close(); return; }
    setPath((current) => current.slice(0, -1)); setQuery(""); setIndex(0);
  };

  useEffect(() => {
    const y = rowLayouts.current[results[activeIndex]?.id];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - 90), animated: false });
  }, [activeIndex, results]);

  useEffect(() => {
    if (Platform.OS !== "web" || !focused || typeof document === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return;
      if (mode) {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); back(); return; }
        if (mode === "help") return;
        const down = event.key === "ArrowDown" || (event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === "j");
        const up = event.key === "ArrowUp" || (event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === "k");
        if (down || up) {
          event.preventDefault();
          setIndex(results.length ? (activeIndex + (down ? 1 : -1) + results.length) % results.length : 0);
        } else if (event.key === "Enter" && event.target === input.current) {
          event.preventDefault(); if (results[activeIndex]) choose(results[activeIndex]);
        }
        return;
      }
      if (blocked) return;
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="dialog"], [aria-modal="true"]'));
      const shortcut = commandShortcut(event, editing, singleKeyShortcuts);
      if (!shortcut) return;
      if (shortcut === "palette" || shortcut === "help") {
        event.preventDefault(); reset(); onMode(shortcut === "help" ? "help" : "commands");
      } else {
        const command = commands.find((entry) => entry.id === shortcut);
        if (!command) return;
        event.preventDefault();
        if (command.children) { reset(); setPath([command.id]); onMode("commands"); }
        else command.run?.();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  if (!mode || !focused) return null;
  return <EditorWindow visible title={mode === "help" ? "Keyboard shortcuts" : title} icon="reader-outline" closeLabel="Close command palette" testID="command-palette" width={640} height={540} onClose={close}>
    <View style={[styles.toolbar, { borderColor: c.border }]}>
      {path.length || mode === "help" ? <Pressable accessibilityRole="button" accessibilityLabel="Back to commands" onPress={back} style={styles.icon}><Ionicons name="arrow-back" size={20} color={c.foreground} /></Pressable> : null}
      {mode === "commands" ? <TextInput ref={input} autoFocus value={query} onChangeText={(value) => { setQuery(value); setIndex(0); }} onSubmitEditing={() => { if (Platform.OS !== "web" && results[activeIndex]) choose(results[activeIndex]); }} accessibilityLabel={`Search ${title.toLowerCase()}`} placeholder={path.length ? "Find a target…" : "Type a command…"} placeholderTextColor={c.mutedForeground} style={[styles.input, { color: c.foreground }]} /> : <Text style={{ flex: 1, color: c.mutedForeground }}>Quick reference</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={mode === "help" ? "Show commands" : "Keyboard shortcut help"} onPress={() => onMode(mode === "help" ? "commands" : "help")} style={styles.icon}><Ionicons name={mode === "help" ? "reader-outline" : "help-circle-outline"} size={22} color={c.primary} /></Pressable>
    </View>
    {mode === "help" ? <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.hint, { color: c.mutedForeground }]}>Shortcuts work on web, including tablet browsers with a keyboard. They pause while typing or using dialogs. On native tablets, tap commands instead.</Text>
      {!singleKeyShortcuts ? <Text style={[styles.hint, { color: c.primary }]}>Single-key shortcuts are disabled in Settings → Keyboard. Modified shortcuts and ? help remain available.</Text> : null}
      {[...PALETTE_HELP, ...commands.filter((command) => command.shortcut).map((command) => [command.shortcut!, command.label])].map(([keys, label]) => <View key={keys} style={[styles.helpRow, { borderColor: c.border }]}><Text style={{ flex: 1, color: c.foreground }}>{label}</Text><Text style={[styles.keys, { color: c.primary, backgroundColor: c.secondary }]}>{keys}</Text></View>)}
      <Text style={[styles.hint, { color: c.mutedForeground }]}>Rename and move commands ask you to choose a target. Left/right moves cards between visible lists; up/down reorders cards within a list. Moves stop at the edges.</Text>
    </ScrollView> : <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text accessibilityLiveRegion="polite" style={[styles.hint, { color: c.mutedForeground }]}>{results.length} {path.length ? "targets" : "commands"} · {path.length ? title : "Choose an action"}</Text>
      {results.map((command, position) => <Pressable key={command.id} onLayout={(event) => { rowLayouts.current[command.id] = event.nativeEvent.layout.y; }} accessibilityRole="button" accessibilityLabel={`${command.label}${command.detail ? `, ${command.detail}` : ""}`} accessibilityState={{ selected: position === activeIndex }} onPress={() => choose(command)} style={({ pressed }) => [styles.result, { backgroundColor: pressed || position === activeIndex ? c.primarySoft : "transparent" }]}>
        <Ionicons name={command.selected ? "checkmark-circle" : command.children ? "folder-open-outline" : "chevron-forward"} size={18} color={c.primary} />
        <View style={{ flex: 1 }}><Text style={{ color: c.foreground, fontSize: 14, fontWeight: "600" }}>{command.label}</Text>{command.detail ? <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 3 }}>{command.detail}</Text> : null}</View>
        {command.shortcut ? <Text style={[styles.keys, { color: c.mutedForeground, backgroundColor: c.secondary }]}>{command.shortcut}</Text> : null}
      </Pressable>)}
      {!results.length ? <Text style={[styles.hint, { color: c.mutedForeground }]}>{entries.length ? "No matches. Try another search." : "No available targets for this command."}</Text> : null}
    </ScrollView>}
    <View style={[styles.footer, { borderColor: c.border }]}><Text style={{ color: c.mutedForeground, fontSize: 11 }}>↑ ↓ select · Enter run · Esc back</Text></View>
  </EditorWindow>;
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 8, fontSize: 16 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { padding: 12, gap: 4 },
  hint: { fontSize: 12, lineHeight: 19, margin: 8 },
  result: { minHeight: 48, borderRadius: 8, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  keys: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, fontSize: 11 },
  helpRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, minHeight: 48, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
