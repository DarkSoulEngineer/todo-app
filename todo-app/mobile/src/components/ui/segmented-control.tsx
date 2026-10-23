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
            style={[
              styles.item,
              active && { backgroundColor: theme.colors.card, borderRadius: theme.radius.md },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.label,
                { color: active ? theme.colors.foreground : theme.colors.mutedForeground, fontWeight: active ? "600" : "500" },
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
    padding: 4,
    gap: 4,
  },
  item: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 13,
  },
});
