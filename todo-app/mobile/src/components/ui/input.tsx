import { TextInput, StyleSheet, type TextInputProps } from "react-native";
import { useTheme } from "@/providers/theme-provider";

export function Input({ style, ...props }: TextInputProps) {
  const { theme } = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.colors.mutedForeground}
      style={[
        styles.input,
        {
          backgroundColor: theme.colors.input,
          color: theme.colors.foreground,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          fontSize: 14,
          paddingHorizontal: 12,
        },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
