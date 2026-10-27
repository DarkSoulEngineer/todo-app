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
import { SectionHeading } from "@/components/ui/section-heading";
import { exportAllBoards, exportAllBoardsCsv, pickBoardsFile } from "@/lib/data/transfer";
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

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const taskCount = api.projects.reduce((total, project) => total + (project.id === api.currentProjectId ? api.tasks.length : project.workspace.tasks.length), 0);

  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "settings") return;
    if (tab === "boards") return router.replace("/");
    if (tab === "my-tasks") return router.replace("/my-tasks");
    if (tab === "calendar") return router.replace("/calendar");
  };

  const allBoards = () => api.projects.map((project) => ({
    name: project.name,
    closedAt: project.closedAt,
    workspace: project.id === api.currentProjectId
      ? { tasks: api.tasks, sections: api.sections, boards: api.boards }
      : project.workspace,
  }));

  const handleExport = async (format: "json" | "csv") => {
    setBusy(true);
    setStatus(null);
    try {
      const boards = allBoards();
      if (!boards.length) {
        setStatus("There are no boards to export yet.");
        return;
      }
      if (format === "json") await exportAllBoards(boards);
      else await exportAllBoardsCsv(boards);
      setStatus(`${format === "json" ? "Board backup" : "All-board CSV"} ready to share.`);
    } catch {
      setStatus("Could not export your boards.");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const boards = await pickBoardsFile();
      if (!boards) {
        setStatus("Import cancelled or that file is not a Janus backup.");
        return;
      }
      const importedIds = api.importProjects(boards);
      if (!importedIds.length) {
        setStatus("Could not import that backup.");
        return;
      }
      setStatus(`Imported ${importedIds.length} board${importedIds.length === 1 ? "" : "s"}.`);
    } catch {
      setStatus("Could not import that backup.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ThemeAtmosphere />
      <ScreenHeader title="Settings" showThemeToggle={false} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + mobileBottomNavClearance }]}>
        <View style={styles.sectionBlock}>
          <SectionHeading
            title="Appearance"
            subtitle="Choose how Janus looks on this device. Your choice is saved automatically."
            right={<Pill label={preference === "system" ? "Auto" : preference === "light" ? "Light" : "Dark"} tone="primary" />}
          />
          <SurfaceCard style={styles.sectionCard}>
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
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeading title="Calendar" subtitle="Choose how the Calendar tab opens and which day starts its week." />
          <SurfaceCard style={styles.sectionCard}>
            <Text style={[type.caption, styles.settingLabelFirst]}>DEFAULT VIEW</Text>
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
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeading title="Data & backups" subtitle="Back up every board in one file, or restore boards from another device." />
          <SurfaceCard style={styles.sectionCard}>
            <Pressable accessibilityRole="button" accessibilityLabel="Export all boards as JSON" disabled={busy} onPress={() => void handleExport("json")} style={({ pressed }) => [styles.actionRow, styles.firstRow, { opacity: busy ? 0.55 : pressed ? 0.7 : 1 }]}>
              <View style={styles.actionIcon}><Ionicons name="code-slash-outline" size={19} color={colors.primary} /></View>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>Export all boards as JSON</Text><Text style={[type.caption, { color: colors.muted }]}>One backup with every board, list and task</Text></View>
              <Ionicons name="chevron-forward" size={17} color={colors.outline} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Export all boards as CSV" disabled={busy} onPress={() => void handleExport("csv")} style={({ pressed }) => [styles.actionRow, { opacity: busy ? 0.55 : pressed ? 0.7 : 1 }]}>
              <View style={styles.actionIcon}><Ionicons name="document-text-outline" size={19} color={colors.primary} /></View>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>Export all boards as CSV</Text><Text style={[type.caption, { color: colors.muted }]}>Every task across all boards for spreadsheets</Text></View>
              <Ionicons name="chevron-forward" size={17} color={colors.outline} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Import boards from a Janus backup" disabled={busy} onPress={() => void handleImport()} style={({ pressed }) => [styles.actionRow, { opacity: busy ? 0.55 : pressed ? 0.7 : 1 }]}>
              <View style={styles.actionIcon}><Ionicons name="cloud-upload-outline" size={19} color={colors.secondary} /></View>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>Import boards</Text><Text style={[type.caption, { color: colors.muted }]}>Restore one or more boards from a Janus backup</Text></View>
              <Ionicons name="chevron-forward" size={17} color={colors.outline} />
            </Pressable>
            {status ? <View accessibilityLiveRegion="polite" style={[styles.statusBanner, { backgroundColor: status.toLowerCase().includes("could not") ? colors.errorContainer : colors.successFixed }]}><Ionicons name={status.toLowerCase().includes("could not") ? "alert-circle-outline" : "checkmark-circle-outline"} size={17} color={status.toLowerCase().includes("could not") ? colors.error : colors.success} /><Text style={[type.caption, { flex: 1, color: status.toLowerCase().includes("could not") ? colors.error : colors.success }]}>{status}</Text></View> : null}
          </SurfaceCard>
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeading
            title="About"
            subtitle="Janus is a local-first task manager. Your boards and tasks stay on this device unless you export them."
            right={<Pill label={`v${appVersion}`} />}
          />
          <SurfaceCard style={styles.sectionCard}>
            <View style={[styles.infoRow, styles.firstRow, { borderTopColor: colors.outlineVariant }]}>
              <View style={styles.actionIcon}><Ionicons name="folder-open-outline" size={19} color={colors.primary} /></View>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>{api.projects.length} board{api.projects.length === 1 ? "" : "s"} · {taskCount} task{taskCount === 1 ? "" : "s"}</Text><Text style={[type.caption, { color: colors.muted }]}>Stored locally on this device</Text></View>
            </View>
            <View style={[styles.infoRow, { borderTopColor: colors.outlineVariant }]}>
              <View style={styles.actionIcon}><Ionicons name="shield-checkmark-outline" size={19} color={colors.success} /></View>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>No account required</Text><Text style={[type.caption, { color: colors.muted }]}>Back up anytime from Data &amp; backups.</Text></View>
            </View>
          </SurfaceCard>
        </View>
      </ScrollView>
      <ReferenceMobileBottomNav active="settings" onNavigate={navigate} />
    </View>
  );
}

function createStyles(colors: ReferenceColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { ...mobileContentStyle, gap: referenceSpacing.lg },
  sectionBlock: { gap: 8 },
  sectionCard: { padding: referenceSpacing.md },
  firstRow: { borderTopWidth: 0 },
  settingLabel: { marginTop: referenceSpacing.md, marginBottom: 6, color: colors.muted },
  settingLabelFirst: { marginBottom: 6, color: colors.muted },
  segmented: { padding: 4, borderRadius: referenceRadii.lg, backgroundColor: colors.surfaceLow, flexDirection: "row", gap: 3 },
  segment: { flex: 1, minHeight: 44, paddingHorizontal: 6, borderRadius: referenceRadii.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  segmentSelected: { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  actionRow: { minHeight: 58, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
  infoRow: { minHeight: 58, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  actionIcon: { width: 38, height: 38, borderRadius: referenceRadii.md, backgroundColor: colors.surfaceLow, alignItems: "center", justifyContent: "center" },
  actionCopy: { flex: 1, minWidth: 0, gap: 2 },
  statusBanner: { minHeight: 42, marginTop: 8, paddingHorizontal: 10, borderRadius: referenceRadii.md, flexDirection: "row", alignItems: "center", gap: 7 },
 }); }
