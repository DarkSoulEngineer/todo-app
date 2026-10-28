import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { JanusLogo } from "@/components/ui/janus-logo";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { useTasksContext } from "@/providers/tasks-provider";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";
import { pickWorkspaceFile } from "@/lib/data/transfer";
import { mobileContentStyle } from "@/theme/layout";

export function WelcomeScreen() {
  const { theme, toggle } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const api = useTasksContext();
  const toast = useToast();
  const { createProject, importProject } = api;
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const create = () => {
    if (!newName.trim()) return;
    const id = createProject(newName.trim());
    setNewName("");
    setShowCreate(false);
    if (id) router.push(`/board/${id}`);
  };

  const importBoard = async () => {
    try {
      const result = await pickWorkspaceFile();
      if (!result) return;
      const id = importProject(result.name, result.workspace);
      toast.success("Board imported", { description: result.name });
      if (id) router.push(`/board/${id}`);
    } catch {
      toast.error("Could not import that file", { description: "Choose a Janus JSON backup." });
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ThemeAtmosphere />
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push("/settings")} style={[styles.topButton, { backgroundColor: c.card }]}>
            <Ionicons name="settings-outline" size={22} color={c.foreground} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={theme.scheme === "dark" ? "Use light theme" : "Use dark theme"} onPress={toggle} style={[styles.topButton, { backgroundColor: c.card }]}>
            <Ionicons name={theme.scheme === "dark" ? "sunny-outline" : "moon-outline"} size={22} color={c.foreground} />
          </Pressable>
        </View>
        <View style={styles.header}>
          <View style={[styles.logoWrap, { backgroundColor: "transparent" }]}>
            <JanusLogo size={200} />
          </View>
          <Text style={[styles.title, { color: c.foreground }]}>Welcome</Text>
          <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
            Get started by creating your first board to organize your tasks.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            variant="primary"
            label="Create your first board"
            onPress={() => setShowCreate(true)}
            style={styles.actionButton}
          >
            <Ionicons name="add-circle-outline" size={18} color={c.primaryForeground} />
            <Text style={{ color: c.primaryForeground, fontSize: 14, fontWeight: "600" }}>Create your first board</Text>
          </Button>
          <Button
            variant="outline"
            label="Import a board"
            onPress={() => {
              void importBoard();
            }}
            style={styles.actionButton}
          >
            <Ionicons name="download-outline" size={18} color={c.foreground} />
            <Text style={{ color: c.foreground, fontSize: 14, fontWeight: "600" }}>Import a board</Text>
          </Button>
        </View>
      </View>

      <Sheet visible={showCreate} onClose={() => setShowCreate(false)}>
        <Text style={[styles.sheetTitle, { color: c.foreground }]}>New board</Text>
        <Text style={{ color: c.mutedForeground, marginTop: 6 }}>Add lists and categories after creating the board.</Text>
        <Input
          autoFocus
          value={newName}
          onChangeText={setNewName}
          placeholder="Board name"
          onSubmitEditing={create}
          style={{ marginTop: 12 }}
        />
        <Button variant="outline" label="Create board" onPress={create} disabled={!newName.trim()} style={{ marginTop: 14 }} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: 48,
    ...mobileContentStyle,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    gap: 16,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 22,
  },
  actions: {
    gap: 12,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  actionButton: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
  },
  sheetTitle: {
    fontSize: 23,
    fontWeight: "700",
  },
});
