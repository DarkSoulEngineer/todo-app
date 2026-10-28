import Constants from "expo-constants";
import { BlurTargetView } from "expo-blur";
import { router } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReferenceMobileBottomNav, type ReferenceMobileTab } from "@/components/reference/mobile/reference-mobile-bottom-nav";
import { ScreenHeader } from "@/components/reference/mobile/reference-primitives";
import { ThemePicker } from "@/components/settings/theme-picker";
import { useReferenceTheme, type ReferenceColors, referenceRadii, referenceSpacing } from "@/components/reference/reference-theme";
import { usePreferences, type CalendarDefaultView, type CalendarWeekStart } from "@/providers/preferences-provider";
import { useTasksContext } from "@/providers/tasks-provider";
import { useTheme } from "@/providers/theme-provider";
import { SectionHeading } from "@/components/ui/section-heading";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { exportAllBoards, exportFullBackup, exportSettings, pickBackupFile } from "@/lib/data/transfer";
import { mobileBottomNavClearance, mobileContentStyle } from "@/theme/layout";

const CALENDAR_VIEW_OPTIONS: { value: CalendarDefaultView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
];

const WEEK_START_OPTIONS: { value: CalendarWeekStart; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 0, label: "Sunday" },
];

type BackupScope = "preferences" | "boards" | "all";
const BACKUP_OPTIONS: { value: BackupScope; label: string; description: string }[] = [
  { value: "preferences", label: "Preferences", description: "Theme, calendar view and week start" },
  { value: "boards", label: "Boards", description: "Every board, list and task" },
  { value: "all", label: "Everything", description: "Preferences and all boards in one JSON file" },
];

const SETTINGS_SECTIONS = ["Appearance", "Calendar", "Data & backups", "About"] as const;

export default function SettingsRoute() {
  const api = useTasksContext();
  const blurTarget = useRef<ComponentRef<typeof BlurTargetView> | null>(null);
  const { preference, savePreference } = useTheme();
  const { calendarDefaultView, calendarWeekStart, setCalendarDefaultView, setCalendarWeekStart, savePreferences } = usePreferences();
  const { colors, type } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; error: boolean } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [scope, setScope] = useState<BackupScope>("all");
  const [section, setSection] = useState<typeof SETTINGS_SECTIONS[number]>("Appearance");

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const taskCount = api.projects.reduce((total, project) => total + (project.id === api.currentProjectId ? api.tasks.length : project.workspace.tasks.length), 0);

  const navigate = (tab: ReferenceMobileTab) => {
    if (tab === "settings") return;
    if (tab === "boards") return router.replace("/");
    if (tab === "top-tasks") return router.replace("/top-tasks");
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
      <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
      <ScreenHeader title="Settings" showThemeToggle={false} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + mobileBottomNavClearance }]}>
        <ScrollView horizontal accessibilityRole="tablist" accessibilityLabel="Settings sections" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>
          {SETTINGS_SECTIONS.map((label) => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: section === label }} onPress={() => setSection(label)}
            style={[styles.sectionTab, { borderBottomColor: section === label ? colors.primary : "transparent" }]}>
            <Text style={[type.bodyStrong, { color: section === label ? colors.text : colors.muted }]}>{label}</Text>
          </Pressable>)}
        </ScrollView>
        {section === "Appearance" ? <View style={styles.sectionBlock}>
          <SectionHeading title="Theme & appearance" subtitle="Switch between Light and Dark, then pick a palette for that mode. Changes save automatically on this device." />
          <View style={styles.sectionCard}>
            <Text style={[type.caption, styles.settingLabelFirst]}>Interface theme</Text>
            <ThemePicker disabled={busy} />
          </View>
          <Text style={[type.caption, { color: colors.muted }]}>The sun and moon buttons switch your appearance; the selector then lists only palettes that match it. System follows your device’s light or dark appearance.</Text>
        </View> : null}

        {section === "Calendar" ? <View style={styles.sectionBlock}>
          <SectionHeading title="Calendar" subtitle="Choose how board calendars open and which day starts their week." />
          <View style={styles.sectionCard}>
            <Text style={[type.bodyStrong, styles.settingLabelFirst]}>Default view</Text>
            <View style={styles.segmented}>
              {CALENDAR_VIEW_OPTIONS.map((option) => {
                const selected = calendarDefaultView === option.value;
                return (
                  <Pressable key={option.value} disabled={busy} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Open calendar in ${option.label.toLowerCase()} view`} onPress={() => setCalendarDefaultView(option.value)} style={[styles.segment, selected && styles.segmentSelected]}>
                    <Text style={[type.bodyStrong, { color: selected ? colors.primary : colors.muted }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[type.bodyStrong, styles.settingLabel]}>Week starts on</Text>
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
          </View>
        </View> : null}

        {section === "Data & backups" ? <View style={styles.sectionBlock}>
          <SectionHeading title="Data & backups" subtitle="Changes save automatically on this device. Choose what to include when saving a backup file." />
          <View style={styles.sectionCard}>
            <Pressable accessibilityRole="button" accessibilityLabel="Save backup" disabled={busy} onPress={() => { setStatus(null); setSaveOpen(true); }} style={({ pressed }) => [styles.actionRow, styles.firstRow, { opacity: busy ? 0.55 : pressed ? 0.7 : 1 }]}>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>Export backup</Text><Text style={[type.caption, { color: colors.muted }]}>Choose preferences, boards or everything</Text></View>
              <Text style={[type.caption, { color: colors.primary }]}>Export</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Import backup" disabled={busy} onPress={() => void handleImport()} style={({ pressed }) => [styles.actionRow, { opacity: busy ? 0.55 : pressed ? 0.7 : 1 }]}>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>Import backup</Text><Text style={[type.caption, { color: colors.muted }]}>Adds boards and replaces included preferences</Text></View>
              <Text style={[type.caption, { color: colors.primary }]}>Import</Text>
            </Pressable>
            <Text style={[type.caption, styles.storageNote, { color: colors.muted }]}>{api.projects.length} board{api.projects.length === 1 ? "" : "s"} · {taskCount} task{taskCount === 1 ? "" : "s"} stored locally</Text>
            {status ? <View accessibilityLiveRegion="polite" style={[styles.statusBanner, { backgroundColor: status.error ? colors.errorContainer : colors.successFixed }]}><Text style={[type.caption, { flex: 1, color: status.error ? colors.error : colors.success }]}>{status.message}</Text></View> : null}
          </View>
        </View> : null}

        {section === "About" ? <View style={styles.sectionBlock}>
          <SectionHeading
            title="Janus"
            subtitle={`Version ${appVersion}`}
          />
          <View style={styles.sectionCard}>
            <View style={[styles.infoRow, styles.firstRow, { borderTopColor: colors.outlineVariant }]}>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>Local-first</Text><Text style={[type.caption, { color: colors.muted }]}>Your boards and tasks stay on this device unless you export them.</Text></View>
            </View>
            <View style={[styles.infoRow, { borderTopColor: colors.outlineVariant }]}>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>No account required</Text><Text style={[type.caption, { color: colors.muted }]}>Back up anytime from Data &amp; backups.</Text></View>
            </View>
          </View>
        </View> : null}
      </ScrollView>
      </BlurTargetView>
      <ReferenceMobileBottomNav active="settings" onNavigate={navigate} blurTarget={blurTarget} />
      <Sheet visible={saveOpen} onClose={() => { if (!busy) setSaveOpen(false); }}>
        <Text accessibilityRole="header" style={type.title}>Save backup</Text>
        <Text style={[type.caption, { color: colors.muted, marginBottom: 12 }]}>What would you like to download or save?</Text>
        <View accessibilityRole="radiogroup">
          {BACKUP_OPTIONS.map((option, index) => (
            <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: scope === option.value, disabled: busy }} disabled={busy} onPress={() => setScope(option.value)} style={({ pressed }) => [styles.actionRow, index === 0 && styles.firstRow, { opacity: pressed ? 0.7 : 1 }]}>
              <View style={styles.actionCopy}><Text style={type.bodyStrong}>{option.label}</Text><Text style={[type.caption, { color: colors.muted }]}>{option.description}</Text></View>
              <Text style={[type.caption, { color: colors.primary }]}>{scope === option.value ? "Selected" : ""}</Text>
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
  sectionBlock: { gap: 12 },
  sectionCard: { padding: referenceSpacing.md, borderRadius: referenceRadii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.outlineVariant, backgroundColor: colors.card },
  sectionTabs: { flexDirection: "row", gap: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant },
  sectionTab: { minHeight: 44, justifyContent: "center", borderBottomWidth: 2, paddingHorizontal: 2 },
  firstRow: { borderTopWidth: 0 },
  settingLabel: { marginTop: referenceSpacing.md, marginBottom: 6, color: colors.muted },
  settingLabelFirst: { marginBottom: 10, color: colors.muted },
  segmented: { padding: 4, borderRadius: referenceRadii.lg, backgroundColor: colors.surfaceLow, flexDirection: "row", gap: 3 },
  segment: { flex: 1, minHeight: 44, paddingHorizontal: 6, borderRadius: referenceRadii.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  segmentSelected: { backgroundColor: colors.card },
  actionRow: { minHeight: 60, paddingHorizontal: 4, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
  infoRow: { minHeight: 60, paddingHorizontal: 4, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  actionCopy: { flex: 1, minWidth: 0, gap: 5 },
  storageNote: { marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
  statusBanner: { minHeight: 42, marginTop: 12, padding: 10, borderRadius: referenceRadii.md, flexDirection: "row", alignItems: "center" },
 }); }
