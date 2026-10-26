import { Ionicons } from "@expo/vector-icons";
import { Circle, Svg } from "react-native-svg";
import { format, isValid, parseISO } from "date-fns";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Assignee, Task } from "@/lib/domain/types";
import { deriveStatus } from "@/lib/domain/status";
import { useReferenceTheme } from "../reference-theme";

export interface ReferenceAssignee {
  id?: string;
  initials: string;
  name: string;
  subtitle?: string;
  color?: string;
}

export interface ReferenceActivity {
  initials: string;
  name: string;
  message: string;
  time: string;
  color?: string;
}

export interface ReferenceTaskDisplay {
  task: Task;
  projectLabel?: string;
  boardLabel?: string;
  sectionLabel?: string;
  statusLabel?: string;
  assignee?: ReferenceAssignee;
  tags?: string[];
  attachmentCount?: number;
  commentCount?: number;
  activity?: ReferenceActivity[];
  blocked?: boolean;
}

export type ReferenceTaskInput = Task | ReferenceTaskDisplay;

export function isReferenceTaskDisplay(input: ReferenceTaskInput): input is ReferenceTaskDisplay {
  return typeof input === "object" && "task" in input;
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function referenceAssigneeFor(assignee: Assignee): ReferenceAssignee {
  return {
    id: assignee.id,
    name: assignee.name,
    initials: assignee.initials ?? initialsFor(assignee.name),
    subtitle: assignee.subtitle,
    color: assignee.color,
  };
}

function referenceActivityFor(event: Task["activity"][number]): ReferenceActivity {
  const actor = event.actor;
  const name = actor?.name ?? "Unknown";
  const createdAt = isValid(parseISO(event.createdAt)) ? parseISO(event.createdAt) : null;
  return {
    initials: actor?.initials ?? initialsFor(name),
    name,
    message: event.message,
    time: createdAt ? format(createdAt, "MMM d, h:mm a") : "Recently",
    color: actor?.color,
  };
}

export function resolveReferenceTask(input: ReferenceTaskInput, _index = 0): ReferenceTaskDisplay {
  void _index;
  if (isReferenceTaskDisplay(input)) {
    return { ...input };
  }
  return {
    task: input,
    tags: input.tags ?? [],
    attachmentCount: input.attachments?.length ?? 0,
    commentCount: 0,
    assignee: input.assignee ? referenceAssigneeFor(input.assignee) : undefined,
    activity: (input.activity ?? []).map(referenceActivityFor),
  };
}

export function statusLabelFor(task: Task, now = new Date()): string {
  const status = deriveStatus(task, now);
  if (status === "completed") return "Completed";
  if (status === "overdue") return "Overdue";
  if (status === "canceled") return "Canceled";
  return "Open";
}

export function Avatar({ person, size = 30 }: { person: ReferenceAssignee; size?: number }) {
  const { colors, type } = useReferenceTheme();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: person.color ?? colors.primary }]}> 
      <Text style={[type.micro, { color: person.color ? colors.onSurface : colors.onPrimary, fontSize: Math.max(9, size * 0.32) }]}>{person.initials}</Text>
    </View>
  );
}

export function IconButton({ icon, label, onPress, size = 44, color, style }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useReferenceTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, { width: size, height: size, borderColor: colors.outlineVariant, opacity: pressed ? 0.65 : 1 }, style]}>
      <Ionicons name={icon} size={Math.min(20, size * 0.48)} color={color ?? colors.onSurface} />
    </Pressable>
  );
}

export function Pill({ label, active = false, tone = "neutral", icon, onPress, style }: { label: string; active?: boolean; tone?: "neutral" | "primary" | "success" | "error" | "purple" | "warning"; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const { colors, type } = useReferenceTheme();
  const palette = {
    neutral: { backgroundColor: colors.surfaceContainerLow, color: colors.muted },
    primary: { backgroundColor: active ? colors.primaryContainer : colors.primaryFixed, color: active ? colors.onPrimaryContainer : colors.primary },
    success: { backgroundColor: colors.successFixed, color: colors.tertiary },
    error: { backgroundColor: colors.errorContainer, color: colors.error },
    purple: { backgroundColor: colors.secondaryFixed, color: colors.onSecondaryContainer },
    warning: { backgroundColor: colors.warningContainer, color: colors.warning },
  }[tone];
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress} style={({ pressed }) => [styles.pill, { backgroundColor: palette.backgroundColor, opacity: pressed ? 0.75 : 1 }, style]}>
      {icon ? <Ionicons name={icon} size={13} color={palette.color} /> : null}
      <Text style={[type.caption, { color: palette.color }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function ProgressRing({ value, size = 82 }: { value: number; size?: number }) {
  const { colors, type } = useReferenceTheme();
  const stroke = 6;
  const radius = (size - stroke) / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.surfaceContainerHigh} strokeWidth={stroke} fill="transparent" />
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.primary} strokeWidth={stroke} strokeLinecap="round" fill="transparent" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - value)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={styles.ringLabel}><Text style={[type.title, { fontSize: 16, lineHeight: 18 }]}>{Math.round(value * 100)}%</Text><Text style={[type.micro, { textTransform: "uppercase", fontSize: 9, color: colors.muted }]}>Done</Text></View>
    </View>
  );
}

export function SurfaceCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { card } = useReferenceTheme();
  return <View style={[card, style]}>{children}</View>;
}

export function ScreenHeader({ title, subtitle, onBack, onSearch, onNotifications, onMore }: { title: string; subtitle?: string; onBack?: () => void; onSearch?: () => void; onNotifications?: () => void; onMore?: () => void }) {
  const { colors, type, toggle, scheme } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screenHeader, { backgroundColor: colors.surface, borderBottomColor: colors.outlineVariant, paddingTop: insets.top + 4 }]}>
      {onBack ? <IconButton icon="chevron-back" label="Go back" onPress={onBack} /> : <View style={{ width: 12 }} />}
      <View style={styles.headerCopy}><Text style={[type.caption, { color: colors.muted }]}>{subtitle ?? "Workspace"}</Text><Text style={[type.title, { fontSize: 19 }]} numberOfLines={1}>{title}</Text></View>
      <View style={styles.headerActions}>{onSearch ? <IconButton icon="search-outline" label="Search" onPress={onSearch} /> : null}{onNotifications ? <IconButton icon="notifications-outline" label="Notifications" onPress={onNotifications} /> : null}<IconButton icon={scheme === "dark" ? "sunny-outline" : "moon-outline"} label={scheme === "dark" ? "Use light theme" : "Use dark theme"} onPress={toggle} />{onMore ? <IconButton icon="ellipsis-horizontal" label="More options" onPress={onMore} /> : null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  iconButton: { alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, backgroundColor: "transparent" },
  pill: { minHeight: 32, paddingHorizontal: 9, borderRadius: 9999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  ringLabel: { position: "absolute", alignItems: "center", justifyContent: "center" },
  screenHeader: { minHeight: 68, paddingHorizontal: 12, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "transparent", flexDirection: "row", alignItems: "center", gap: 8 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
});
