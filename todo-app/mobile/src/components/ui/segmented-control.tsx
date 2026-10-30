import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/providers/theme-provider";

export interface SegmentedOption {
  key: string;
  label: string;
}

export function SegmentedControl({ options, value, onChange }: { options: SegmentedOption[]; value: string; onChange: (key: string) => void }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.secondary,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.item,
              { backgroundColor: active ? theme.colors.primarySoft : theme.colors.card, borderColor: active ? theme.colors.primary : theme.colors.border, borderRadius: theme.radius.md },
            ]}
            accessibilityRole="button"
            aria-pressed={active}
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.label,
                { color: active ? theme.colors.accentForeground : theme.colors.mutedForeground, fontWeight: "600" },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    padding: 5,
    paddingBottom: 7,
    gap: 6,
  },
  item: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 13,
  },
});
