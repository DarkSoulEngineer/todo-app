import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReferenceMobileBottomNav, type ReferenceMobileTab } from "@/components/reference/mobile/reference-mobile-bottom-nav";
import { Pill, ScreenHeader, SurfaceCard } from "@/components/reference/mobile/reference-primitives";
import { useReferenceTheme, type ReferenceColors, referenceRadii, referenceSpacing } from "@/components/reference/reference-theme";
import { usePreferences, type CalendarDefaultView, type CalendarWeekStart } from "@/providers/preferences-provider";
import { useTasksContext } from "@/providers/tasks-provider";
import { useTheme } from "@/providers/theme-provider";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { exportWorkspace, exportWorkspaceCsv, pickWorkspaceFile } from "@/lib/data/transfer";
import type { ThemePreference } from "@/theme/tokens";
import { mobileBottomNavClearance, mobileContentStyle } from "@/theme/layout";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "system", label: "System", icon: "phone-portrait-outline" },
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
];

const CALENDAR_VIEW_OPTIONS: { value: CalendarDefaultView; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "month", label: "Month", icon: "calendar-outline" },
  { value: "week", label: "Week", icon: "today-outline" },
];

const WEEK_START_OPTIONS: { value: CalendarWeekStart; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 0, label: "Sunday" },
];

export default function SettingsRoute() {
  const api = useTasksContext();
  const { preference, setPreference } = useTheme();
  const { calendarDefaultView, calendarWeekStart, setCalendarDefaultView, setCalendarWeekStart } = usePreferences();
  const { colors, type } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const boardName = api.currentProjectName || "Board";
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const taskCount = api.projects.reduce((total, project) => total + (project.id === api.currentProjectId ? api.tasks.length : project.workspace.tasks.length), 0);

  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "settings") return;
    if (tab === "boards") return router.replace("/");
    if (tab === "my-tasks") return router.replace("/my-tasks");
    if (tab === "calendar") return router.replace("/calendar");
  };

  const currentWorkspace = () => {
    const project = api.projects.find((item) => item.id === api.currentProjectId);
    if (!project) return api.snapshot();
    return { ...project.workspace, tasks: api.tasks, sections: api.sections, boards: api.boards };
  };

  const handleExport = async (format: "json" | "csv") => {
    setBusy(true);
    setStatus(null);
    try {
      const workspace = currentWorkspace();
      if (format === "json") await exportWorkspace(workspace, boardName);
      else await exportWorkspaceCsv(workspace, boardName);
      setStatus(`${format === "json" ? "JSON" : "CSV"} export ready to share.`);
    } catch {
      setStatus(`Could not export ${boardName}.`);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await pickWorkspaceFile();
      if (!result) {
        setStatus("Import cancelled.");
        return;
      }
       const importedId = api.importProject(result.name, result.workspace);
       setStatus(`Imported “${result.name}”.`);
       router.replace(importedId ? `/board/${importedId}` : "/");
    } catch {
      setStatus("Could not import that file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ThemeAtmosphere />
      <ScreenHeader title="Settings" showThemeToggle={false} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + mobileBottomNavClearance }]}>
        <SurfaceCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitle}><Ionicons name="contrast-outline" size={18} color={colors.primary} /><Text style={type.section}>Appearance</Text></View>
            <Pill label={preference === "system" ? "Auto" : preference === "light" ? "Light" : "Dark"} tone="primary" />
          </View>
          <Text style={[type.body, { color: colors.muted, marginBottom: 10 }]}>Choose how Janus looks on this device. Your choice is saved automatically.</Text>
          <View style={styles.segmented}>
            {THEME_OPTIONS.map((option) => {
              const selected = preference === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Use ${option.label.toLowerCase()} theme`}
                  onPress={() => setPreference(option.value)}
                  style={[styles.segment, selected && styles.segmentSelected]}
                >
                  <Ionicons name={option.icon} size={17} color={selected ? colors.primary : colors.muted} />
                  <Text style={[type.bodyStrong, { color: selected ? colors.primary : colors.muted }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitle}><Ionicons name="calendar-outline" size={18} color={colors.secondary} /><Text style={type.section}>Calendar</Text></View>
          </View>
          <Text style={[type.body, { color: colors.muted }]}>Choose how the Calendar tab opens and which day starts its week.</Text>
          <Text style={[type.caption, styles.settingLabel]}>DEFAULT VIEW</Text>
          <View style={styles.segmented}>
            {CALENDAR_VIEW_OPTIONS.map((option) => {
              const selected = calendarDefaultView === option.value;
              return (
                <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Open calendar in ${option.label.toLowerCase()} view`} onPress={() => setCalendarDefaultView(option.value)} style={[styles.segment, selected && styles.segmentSelected]}>
                  <Ionicons name={option.icon} size={17} color={selected ? colors.primary : colors.muted} />
                  <Text style={[type.bodyStrong, { color: selected ? colors.primary : colors.muted }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[type.caption, styles.settingLabel]}>WEEK STARTS ON</Text>
          <View style={styles.segmented}>
            {WEEK_START_OPTIONS.map((option) => {
              const selected = calendarWeekStart === option.value;
              return (
                <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Start weeks on ${option.label}`} onPress={() => setCalendarWeekStart(option.value)} style={[styles.segment, selected && styles.segmentSelected]}>
                  <Text style={[type.bodyStrong, { color: selected ? colors.primary : colors.muted }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitle}><Ionicons name="swap-vertical-outline" size={18} color={colors.success} /><Text style={type.section}>Data &amp; backups</Text></View>
          </View>
          <Text style={[type.body, { color: colors.muted, marginBottom: 8 }]}>Export the active board or restore a Janus backup from another device.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Export active board as JSON" disabled={busy} onPress={() => void handleExport("json")} style={({ pressed }) => [styles.actionRow, { opacity: busy ? 0.55 : pressed ? 0.7 : 1 }]}>
            <View style={styles.actionIcon}><Ionicons name="code-slash-outline" size={19} color={colors.primary} /></View>
            <View style={styles.actionCopy}><Text style={type.bodyStrong}>Export active board as JSON</Text><Text style={[type.caption, { color: colors.muted }]}>Full backup with tasks, sections and boards</Text></View>
            <Ionicons name="chevron-forward" size={17} color={colors.outline} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Export active board as CSV" disabled={busy} onPress={() => void handleExport("csv")} style={({ pressed }) => [styles.actionRow, { opacity: busy ? 0.55 : pressed ? 0.7 : 1 }]}>
            <View style={styles.actionIcon}><Ionicons name="document-text-outline" size={19} color={colors.primary} /></View>
            <View style={styles.actionCopy}><Text style={type.bodyStrong}>Export active board as CSV</Text><Text style={[type.caption, { color: colors.muted }]}>Task rows for spreadsheets and reports</Text></View>
            <Ionicons name="chevron-forward" size={17} color={colors.outline} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Import a Janus board backup" disabled={busy} onPress={() => void handleImport()} style={({ pressed }) => [styles.actionRow, { opacity: busy ? 0.55 : pressed ? 0.7 : 1 }]}>
            <View style={styles.actionIcon}><Ionicons name="cloud-upload-outline" size={19} color={colors.secondary} /></View>
            <View style={styles.actionCopy}><Text style={type.bodyStrong}>Import board</Text><Text style={[type.caption, { color: colors.muted }]}>Open a Janus JSON backup as a new board</Text></View>
            <Ionicons name="chevron-forward" size={17} color={colors.outline} />
          </Pressable>
           {status ? <View accessibilityLiveRegion="polite" style={[styles.statusBanner, { backgroundColor: status.toLowerCase().includes("could not") ? colors.errorContainer : colors.successFixed }]}><Ionicons name={status.toLowerCase().includes("could not") ? "alert-circle-outline" : "checkmark-circle-outline"} size={17} color={status.toLowerCase().includes("could not") ? colors.error : colors.success} /><Text style={[type.caption, { flex: 1, color: status.toLowerCase().includes("could not") ? colors.error : colors.success }]}>{status}</Text></View> : null}
        </SurfaceCard>

        <SurfaceCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitle}><Ionicons name="information-circle-outline" size={18} color={colors.secondary} /><Text style={type.section}>About</Text></View>
            <Pill label={`v${appVersion}`} />
          </View>
          <Text style={[type.body, { color: colors.muted, marginBottom: 8 }]}>Janus is a local-first task manager. Your boards and tasks stay on this device unless you export them.</Text>
          <View style={[styles.infoRow, { borderTopColor: colors.outlineVariant }]}>
            <View style={styles.actionIcon}><Ionicons name="folder-open-outline" size={19} color={colors.primary} /></View>
            <View style={styles.actionCopy}><Text style={type.bodyStrong}>{api.projects.length} board{api.projects.length === 1 ? "" : "s"} · {taskCount} task{taskCount === 1 ? "" : "s"}</Text><Text style={[type.caption, { color: colors.muted }]}>Stored locally on this device</Text></View>
          </View>
          <View style={[styles.infoRow, { borderTopColor: colors.outlineVariant }]}>
            <View style={styles.actionIcon}><Ionicons name="shield-checkmark-outline" size={19} color={colors.success} /></View>
            <View style={styles.actionCopy}><Text style={type.bodyStrong}>No account required</Text><Text style={[type.caption, { color: colors.muted }]}>Back up anytime from Data &amp; backups.</Text></View>
          </View>
        </SurfaceCard>
      </ScrollView>
      <ReferenceMobileBottomNav active="settings" onNavigate={navigate} />
    </View>
  );
}

function createStyles(colors: ReferenceColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { ...mobileContentStyle, gap: referenceSpacing.md },
  sectionCard: { padding: referenceSpacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 9 },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  settingLabel: { marginTop: referenceSpacing.md, marginBottom: 6, color: colors.muted },
  segmented: { padding: 4, borderRadius: referenceRadii.lg, backgroundColor: colors.surfaceLow, flexDirection: "row", gap: 3 },
  segment: { flex: 1, minHeight: 44, paddingHorizontal: 6, borderRadius: referenceRadii.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  segmentSelected: { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  actionRow: { minHeight: 58, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
  infoRow: { minHeight: 58, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  actionIcon: { width: 38, height: 38, borderRadius: referenceRadii.md, backgroundColor: colors.surfaceLow, alignItems: "center", justifyContent: "center" },
  actionCopy: { flex: 1, minWidth: 0, gap: 2 },
  statusBanner: { minHeight: 42, marginTop: 8, paddingHorizontal: 10, borderRadius: referenceRadii.md, flexDirection: "row", alignItems: "center", gap: 7 },
 }); }
