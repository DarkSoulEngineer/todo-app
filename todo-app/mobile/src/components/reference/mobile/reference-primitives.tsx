import { Ionicons } from "@expo/vector-icons";
import { Circle, Svg } from "react-native-svg";
import { format, isValid, parseISO } from "date-fns";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { Task } from "@/lib/domain/types";
import { deriveStatus } from "@/lib/domain/status";
import { MobileTopBar, MobileTopBarAction } from "@/components/ui/mobile-top-bar";
import { useReferenceTheme } from "../reference-theme";

export interface ReferenceActivity {
  message: string;
  time: string;
}

export interface ReferenceTaskDisplay {
  task: Task;
  projectId?: string;
  projectLabel?: string;
  boardLabel?: string;
  sectionLabel?: string;
  statusLabel?: string;
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

function referenceActivityFor(event: Task["activity"][number]): ReferenceActivity {
  const createdAt = isValid(parseISO(event.createdAt)) ? parseISO(event.createdAt) : null;
  return {
    message: event.message,
    time: createdAt ? format(createdAt, "MMM d, h:mm a") : "Recently",
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
  const content = <>
    {icon ? <Ionicons name={icon} size={13} color={palette.color} /> : null}
    <Text style={[type.caption, { color: palette.color }]} numberOfLines={1}>{label}</Text>
  </>;
  if (!onPress) return <View style={[styles.pill, { backgroundColor: palette.backgroundColor }, style]}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.pill, { backgroundColor: palette.backgroundColor, opacity: pressed ? 0.75 : 1 }, style]}>
      {content}
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

export function ScreenHeader({ title, subtitle, onBack, onSearch, searchActive = false, onNotifications, onMore, onAdd, moreIcon = "ellipsis-horizontal", moreLabel = "More options", showThemeToggle = true, actions, search }: { title: string; subtitle?: string; onBack?: () => void; onSearch?: () => void; searchActive?: boolean; onNotifications?: () => void; onMore?: () => void; onAdd?: () => void; moreIcon?: keyof typeof Ionicons.glyphMap; moreLabel?: string; showThemeToggle?: boolean; actions?: React.ReactNode; search?: React.ReactNode }) {
  const { toggle, scheme } = useReferenceTheme();
  const hasActions = Boolean(onSearch || onAdd || onNotifications || showThemeToggle || onMore || actions);
  return (
    <MobileTopBar
      title={title}
      subtitle={subtitle}
      leading={onBack ? <MobileTopBarAction icon="chevron-back" label="Go back" onPress={onBack} /> : undefined}
      actions={hasActions ? <>
        {onSearch ? <MobileTopBarAction icon="search-outline" label="Search" onPress={onSearch} active={searchActive} /> : null}
        {onAdd ? <MobileTopBarAction icon="add-outline" label="New task" onPress={onAdd} /> : null}
        {onNotifications ? <MobileTopBarAction icon="notifications-outline" label="Notifications" onPress={onNotifications} /> : null}
        {showThemeToggle ? <MobileTopBarAction icon={scheme === "dark" ? "sunny-outline" : "moon-outline"} label={scheme === "dark" ? "Use light theme" : "Use dark theme"} onPress={toggle} /> : null}
        {onMore ? <MobileTopBarAction icon={moreIcon} label={moreLabel} onPress={onMore} /> : null}
        {actions}
      </> : undefined}
      search={search}
    />
  );
}

const styles = StyleSheet.create({
  iconButton: { alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, backgroundColor: "transparent" },
  pill: { minHeight: 32, paddingHorizontal: 9, borderRadius: 9999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  ringLabel: { position: "absolute", alignItems: "center", justifyContent: "center" },
});
