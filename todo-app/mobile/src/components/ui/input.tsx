import { useState } from "react";
import { Platform, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { useTheme } from "@/providers/theme-provider";

export function Input({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={theme.colors.mutedForeground}
      selectionColor={theme.colors.primary}
      cursorColor={theme.colors.primary}
      underlineColorAndroid="transparent"
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
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
        Platform.OS === "web" && { outlineWidth: 0 },
        focused && { borderColor: theme.colors.primary },
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderWidth: 1,
  },
});
