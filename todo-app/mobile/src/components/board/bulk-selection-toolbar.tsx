import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useTheme } from "@/providers/theme-provider";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { RibbonScrollView } from "@/components/ui/ribbon-scroll-view";

export interface BulkSelectionToolbarProps {
  /** Keeps the toolbar out of the tree when the board is not selecting tasks. */
  selectionMode?: boolean;
  selectedCount: number;
  allSelected?: boolean;
  onSelectAll?: () => void;
  /** Clear the current selection. */
  onClear?: () => void;
  /** Alias for consumers that prefer the more explicit callback name. */
  onClearSelection?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
  onRestore?: () => void;
  onMore?: () => void;
  onDelete?: () => void;
  onMove?: (event: GestureResponderEvent) => void;
  onPriority?: (event: GestureResponderEvent) => void;
  onClose?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

type ActionTone = "neutral" | "success" | "danger";

/**
 * Bulk task actions for a board's mobile selection state.
 *
 * Laid out like the ribbon's other tool strips: one group of 48dp tools per
 * action family, a 9px caption underneath, and hairline separators between
 * groups. Parents own selection and mutation state through the callbacks.
 */
export function BulkSelectionToolbar({
  selectionMode = true,
  selectedCount,
  allSelected = false,
  onSelectAll,
  onClear,
  onClearSelection,
  onComplete,
  onCancel,
  onRestore,
  onMore,
  onDelete,
  onMove,
  onPriority,
  disabled = false,
  style,
}: BulkSelectionToolbarProps) {
  const { theme } = useTheme();

  if (!selectionMode) return null;

  const count = Math.max(0, selectedCount);
  const hasSelection = count > 0;
  const clearSelection = onClearSelection ?? onClear;
  const taskWord = count === 1 ? "task" : "tasks";
  const actionDisabled = disabled || !hasSelection;

  const group = (label: string, children: ReactNode) => (
    <View key={label} style={[styles.group, { borderColor: theme.colors.border }]}>
      <View style={styles.groupTools}>{children}</View>
      <Text numberOfLines={1} style={[styles.caption, { color: theme.colors.mutedForeground }]}>{label}</Text>
    </View>
  );

  return (
    <RibbonScrollView
      contentContainerStyle={styles.tools}
      accessibilityRole="toolbar"
      accessibilityLabel="Bulk task actions"
      style={style}
    >
      {onSelectAll || clearSelection ? group(`${count} SELECTED`, <>
        {onSelectAll ? <ToolButton icon={allSelected ? "checkmark-done-outline" : "checkbox-outline"} label="Select all" accessibilityLabel="Select all visible tasks" onPress={onSelectAll} selected={allSelected} disabled={disabled} /> : null}
        {clearSelection ? <ToolButton icon="close-circle-outline" label="Unselect all" accessibilityLabel="Unselect all tasks" onPress={clearSelection} disabled={actionDisabled} /> : null}
      </>) : null}
      {onComplete || onCancel || onRestore ? group("STATUS", <>
        {onComplete ? <ToolButton icon="checkmark-done-outline" label="Complete" accessibilityLabel={`Complete ${count} selected ${taskWord}`} onPress={onComplete} tone="success" disabled={actionDisabled} /> : null}
        {onCancel ? <ToolButton icon="remove-circle-outline" label="Cancel" accessibilityLabel={`Cancel ${count} selected ${taskWord}`} onPress={onCancel} tone="danger" disabled={actionDisabled} /> : null}
        {onRestore ? <ToolButton icon="refresh-outline" label="Restore" accessibilityLabel={`Restore ${count} selected ${taskWord}`} onPress={onRestore} tone="success" disabled={actionDisabled} /> : null}
      </>) : null}
      {onMore || onMove || onPriority || onDelete ? group("ORGANIZE", <>
        {onMore ? <ToolButton icon="ellipsis-horizontal" label="More" accessibilityLabel="More actions for selected tasks" onPress={onMore} disabled={disabled} /> : null}
        {onMove ? <ToolButton icon="arrow-forward-outline" label="Move" accessibilityLabel="Move selected tasks" onPress={onMove} disabled={actionDisabled} /> : null}
        {onPriority ? <ToolButton icon="flag-outline" label="Priority" accessibilityLabel="Set priority for selected tasks" onPress={onPriority} disabled={actionDisabled} /> : null}
        {onDelete ? <ToolButton icon="trash-outline" label="Delete" accessibilityLabel={`Delete ${count} selected ${taskWord}`} onPress={onDelete} tone="danger" disabled={actionDisabled} /> : null}
      </>) : null}
    </RibbonScrollView>
  );
}

export interface BulkToolbarProps extends BulkSelectionToolbarProps {
  /** Alias used by board surfaces that call the visible set the selectable set. */
  allVisibleSelected?: boolean;
}

/** Short alias for board callers; kept alongside the descriptive export. */
export function BulkToolbar({ allVisibleSelected, allSelected, ...props }: BulkToolbarProps) {
  return <BulkSelectionToolbar {...props} allSelected={allVisibleSelected ?? allSelected} />;
}

function ToolButton({
  icon,
  label,
  accessibilityLabel,
  onPress,
  tone = "neutral",
  disabled = false,
  selected = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accessibilityLabel: string;
  onPress: (event: GestureResponderEvent) => void;
  tone?: ActionTone;
  disabled?: boolean;
  selected?: boolean;
}) {
  const { theme } = useTheme();
  const color = selected
    ? theme.colors.primary
    : tone === "danger"
      ? theme.colors.destructive
      : tone === "success"
        ? theme.colors.success
        : theme.colors.mutedForeground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tool, { opacity: disabled ? 0.35 : 1 }]}
    >
      <Ionicons name={icon} size={19} color={color} />
      <Text numberOfLines={2} style={[styles.toolText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tools: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 4,
  },
  group: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 5,
    gap: 3,
  },
  groupTools: {
    flexDirection: "row",
  },
  tool: {
    minWidth: 65,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 6,
  },
  toolText: {
    fontSize: 10,
    textAlign: "center",
  },
  caption: {
    textAlign: "center",
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
