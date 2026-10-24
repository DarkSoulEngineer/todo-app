import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/providers/theme-provider";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

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
  onMove?: () => void;
  onPriority?: () => void;
  onClose?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

type ActionTone = "neutral" | "success" | "danger" | "primary";

/**
 * Compact task actions for a board's mobile selection state.
 *
 * The component only presents actions. Parents own selection and mutation state
 * through the callbacks, so it can be used with either the board or list view.
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
  onClose,
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

  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Bulk task actions"
      style={[
        styles.toolbar,
        {
          backgroundColor: theme.colors.cardElevated,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
        style,
      ]}
    >
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close selection mode"
          disabled={disabled}
          hitSlop={4}
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: theme.colors.secondary, opacity: disabled ? 0.45 : pressed ? 0.65 : 1 },
          ]}
        >
          <Ionicons name="close" size={20} color={theme.colors.foreground} />
        </Pressable>
      ) : null}

      <View
        accessibilityLabel={`${count} selected ${taskWord}`}
        style={styles.summary}
      >
        <View style={[styles.countBadge, { backgroundColor: theme.colors.primarySoft }]}>
          <Text style={[styles.countText, { color: theme.colors.primary }]}>{count}</Text>
        </View>
        <Text style={[theme.type.caption, styles.summaryText, { color: theme.colors.foreground }]} numberOfLines={1}>
          {taskWord} selected
        </Text>
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={styles.actions}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {onSelectAll ? (
          <ToolbarAction
            icon={allSelected ? "checkmark-done-outline" : "checkbox-outline"}
            label={allSelected ? "Clear all" : "Select all"}
            accessibilityLabel={allSelected ? "Clear all selected tasks" : "Select all visible tasks"}
            onPress={allSelected && clearSelection ? clearSelection : onSelectAll}
            tone="primary"
            disabled={disabled}
            selected={allSelected}
          />
        ) : null}
        {clearSelection && !allSelected ? (
          <ToolbarAction
            icon="close-circle-outline"
            label="Clear"
            accessibilityLabel="Clear selected tasks"
            onPress={clearSelection}
            tone="neutral"
            disabled={disabled || !hasSelection}
          />
        ) : null}
        {onComplete ? (
          <ToolbarAction
            icon="checkmark-done-outline"
            label="Complete"
            accessibilityLabel={`Complete ${count} selected ${taskWord}`}
            onPress={onComplete}
            tone="success"
            disabled={actionDisabled}
          />
        ) : null}
        {onCancel ? (
          <ToolbarAction
            icon="remove-circle-outline"
            label="Cancel"
            accessibilityLabel={`Cancel ${count} selected ${taskWord}`}
            onPress={onCancel}
            tone="danger"
            disabled={actionDisabled}
          />
        ) : null}
        {onRestore ? (
          <ToolbarAction
            icon="refresh-outline"
            label="Restore"
            accessibilityLabel={`Restore ${count} selected ${taskWord}`}
            onPress={onRestore}
            tone="success"
            disabled={actionDisabled}
          />
        ) : null}
        {onMore ? (
          <ToolbarAction
            icon="ellipsis-horizontal"
            label="More"
            accessibilityLabel="More actions for selected tasks"
            onPress={onMore}
            tone="neutral"
            disabled={disabled}
          />
        ) : null}
        {onMove ? (
          <ToolbarAction
            icon="arrow-forward-outline"
            label="Move"
            accessibilityLabel="Move selected tasks"
            onPress={onMove}
            tone="neutral"
            disabled={actionDisabled}
          />
        ) : null}
        {onPriority ? (
          <ToolbarAction
            icon="flag-outline"
            label="Priority"
            accessibilityLabel="Set priority for selected tasks"
            onPress={onPriority}
            tone="neutral"
            disabled={actionDisabled}
          />
        ) : null}
        {onDelete ? (
          <ToolbarAction
            icon="trash-outline"
            label="Delete"
            accessibilityLabel={`Delete ${count} selected ${taskWord}`}
            onPress={onDelete}
            tone="danger"
            disabled={actionDisabled}
          />
        ) : null}
      </ScrollView>
    </View>
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

function ToolbarAction({
  icon,
  label,
  accessibilityLabel,
  onPress,
  tone,
  disabled = false,
  selected = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  tone: ActionTone;
  disabled?: boolean;
  selected?: boolean;
}) {
  const { theme } = useTheme();
  const palette = {
    neutral: { backgroundColor: theme.colors.secondary, color: theme.colors.secondaryForeground },
    primary: { backgroundColor: theme.colors.primarySoft, color: theme.colors.accentForeground },
    success: { backgroundColor: theme.colors.successSoft, color: theme.colors.success },
    danger: { backgroundColor: theme.colors.destructiveSoft, color: theme.colors.destructive },
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: theme.colors.border,
          opacity: disabled ? 0.42 : pressed ? 0.68 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={17} color={palette.color} />
      <Text style={[theme.type.micro, styles.actionText, { color: palette.color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    minHeight: 60,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  summary: {
    minWidth: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  countText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  summaryText: {
    flexShrink: 1,
  },
  actions: {
    flexGrow: 1,
    alignItems: "center",
    gap: 6,
    paddingRight: 2,
  },
  action: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  actionText: {
    fontWeight: "600",
  },
});
