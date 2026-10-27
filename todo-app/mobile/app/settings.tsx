import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReferenceMobileBottomNav, type ReferenceMobileTab } from "@/components/reference/mobile/reference-mobile-bottom-nav";
import { Pill, ScreenHeader, SurfaceCard } from "@/components/reference/mobile/reference-primitives";
import { useReferenceTheme, type ReferenceColors, referenceRadii, referenceSpacing } from "@/components/reference/reference-theme";
import { usePreferences, type CalendarDefaultView, type CalendarWeekStart } from "@/providers/preferences-provider";
import { useTasksContext } from "@/providers/tasks-provider";
import { useTheme } from "@/providers/theme-provider";
import { ThemeAtmosphere } from "@/components/ui/atmosphere";
import { SectionHeading } from "@/components/ui/section-heading";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { exportAllBoards, exportFullBackup, exportSettings, pickBackupFile } from "@/lib/data/transfer";
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

type BackupScope = "preferences" | "boards" | "all";
const BACKUP_OPTIONS: { value: BackupScope; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "preferences", label: "Preferences", description: "Theme, calendar view and week start", icon: "options-outline" },
  { value: "boards", label: "Boards", description: "Every board, list and task", icon: "albums-outline" },
  { value: "all", label: "All", description: "Preferences and all boards in one JSON file", icon: "archive-outline" },
];

export default function SettingsRoute() {
  const api = useTasksContext();
  const { preference, setPreference, savePreference } = useTheme();
  const { calendarDefaultView, calendarWeekStart, setCalendarDefaultView, setCalendarWeekStart, savePreferences } = usePreferences();
  const { colors, type } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; error: boolean } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [scope, setScope] = useState<BackupScope>("all");

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const taskCount = api.projects.reduce((total, project) => total + (project.id === api.currentProjectId ? api.tasks.length : project.workspace.tasks.length), 0);

  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "settings") return;
    if (tab === "boards") return router.replace("/");
    if (tab === "calendar") return router.replace("/calendar");
  };

  const allBoards = () => api.projects.map((project) => ({
    name: project.name,
    closedAt: project.closedAt,
    workspace: project.id === api.currentProjectId
      ? { tasks: api.tasks, sections: api.sections, boards: api.boards }
      : project.workspace,
  }));

  const handleSave = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const boards = allBoards();
      const settings = { theme: preference, calendarDefaultView, calendarWeekStart };
      if (scope === "preferences") await exportSettings(settings);
      else if (scope === "all") await exportFullBackup(boards, settings);
      else {
        if (!boards.length) throw new Error("There are no boards to save yet.");
        await exportAllBoards(boards);
      }
      setSaveOpen(false);
      setStatus({ message: Platform.OS === "web" ? "Backup download started." : "Backup ready to share. Choose a destination to save it.", error: false });
    } catch {
      setStatus({ message: scope === "boards" && !api.projects.length ? "There are no boards to save yet." : "Could not save your backup. Please try again.", error: true });
      setSaveOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const backup = await pickBackupFile();
      if (!backup) {
        setStatus({ message: "Import cancelled. Nothing changed.", error: false });
        return;
      }
      if (backup.settings) {
        await Promise.all([savePreferences(backup.settings), savePreference(backup.settings.theme)]);
      }
      const importedIds = backup.boards.length ? api.importProjects(backup.boards) : [];
      if (backup.boards.length && !importedIds.length) throw new Error("Could not import boards.");
      const parts = [backup.settings ? "preferences" : "", importedIds.length ? `${importedIds.length} board${importedIds.length === 1 ? "" : "s"}` : ""].filter(Boolean);
      setStatus({ message: `Imported ${parts.join(" and ")}.`, error: false });
    } catch (error) {
      setStatus({ message: error instanceof Error && error.message === "Choose a valid Janus JSON backup."
        ? error.message : "Could not import that backup. Please try again.", error: true });
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
                    disabled={busy}
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
                  <Pressable key={option.value} disabled={busy} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Open calendar in ${option.label.toLowerCase()} view`} onPress={() => setCalendarDefaultView(option.value)} style={[styles.segment, selected && styles.segmentSelected]}>
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
                  <Pressable key={option.value} disabled={busy} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Start weeks on ${option.label}`} onPress={() => setCalendarWeekStart(option.value)} style={[styles.segment, selected && styles.segmentSelected]}>
                    <Text style={[type.bodyStrong, { color: selected ? colors.primary : colors.muted }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeading title="Data & backups" subtitle="Changes save automatically on this device. Choose what to include when saving a backup file." />
          <SurfaceCard style={styles.sectionCard}>
            <Pressable accessibilityRole="button" accessibilityLabel="Save backup" disabled={busy} onPress={() => { setStatus(null); setSaveOpen(true); }} style={({ pressed }) => [styles.actionRow, styles.firstRow, { opacity: busy ? 0.55 : pressed ? 0.7 : 1 }]}>
              <View style={styles.actionIcon}><Ionicons name="save-outline" size={19} color={colors.primary} /></View>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>Save</Text><Text style={[type.caption, { color: colors.muted }]}>Choose preferences, boards or all</Text></View>
              <Ionicons name="chevron-forward" size={17} color={colors.outline} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Import backup" disabled={busy} onPress={() => void handleImport()} style={({ pressed }) => [styles.actionRow, { opacity: busy ? 0.55 : pressed ? 0.7 : 1 }]}>
              <View style={styles.actionIcon}><Ionicons name="cloud-upload-outline" size={19} color={colors.secondary} /></View>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>Import</Text><Text style={[type.caption, { color: colors.muted }]}>Restore a JSON backup; adds boards and replaces included preferences</Text></View>
              <Ionicons name="chevron-forward" size={17} color={colors.outline} />
            </Pressable>
            {status ? <View accessibilityLiveRegion="polite" style={[styles.statusBanner, { backgroundColor: status.error ? colors.errorContainer : colors.successFixed }]}><Ionicons name={status.error ? "alert-circle-outline" : "checkmark-circle-outline"} size={17} color={status.error ? colors.error : colors.success} /><Text style={[type.caption, { flex: 1, color: status.error ? colors.error : colors.success }]}>{status.message}</Text></View> : null}
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
      <Sheet visible={saveOpen} onClose={() => { if (!busy) setSaveOpen(false); }}>
        <Text accessibilityRole="header" style={type.title}>Save backup</Text>
        <Text style={[type.caption, { color: colors.muted, marginBottom: 12 }]}>What would you like to download or save?</Text>
        <View accessibilityRole="radiogroup">
          {BACKUP_OPTIONS.map((option, index) => (
            <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: scope === option.value, disabled: busy }} disabled={busy} onPress={() => setScope(option.value)} style={({ pressed }) => [styles.actionRow, index === 0 && styles.firstRow, { opacity: pressed ? 0.7 : 1 }]}>
              <View style={styles.actionIcon}><Ionicons name={option.icon} size={19} color={colors.primary} /></View>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>{option.label}</Text><Text style={[type.caption, { color: colors.muted }]}>{option.description}</Text></View>
              <Ionicons name={scope === option.value ? "radio-button-on" : "radio-button-off"} size={22} color={scope === option.value ? colors.primary : colors.outline} />
            </Pressable>
          ))}
        </View>
        <Text style={[type.caption, { color: colors.muted, marginVertical: 12 }]}>Saves a JSON file you can import into Janus later.</Text>
        <Button label={busy ? "Saving…" : "Save file"} disabled={busy} onPress={() => void handleSave()} />
        <Button label="Cancel" variant="ghost" disabled={busy} onPress={() => setSaveOpen(false)} />
      </Sheet>
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
