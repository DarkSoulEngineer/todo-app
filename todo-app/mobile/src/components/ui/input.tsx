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
          fontFamily: theme.fontFamily || undefined,
          paddingHorizontal: 12,
          boxShadow: "inset 0 2px 3px rgba(0,0,0,0.10)",
        },
        style,
        Platform.OS === "web" && { outlineWidth: 0 },
        focused && { borderColor: theme.colors.primary, boxShadow: `inset 0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px ${theme.colors.primary}` },
        props.editable === false && { opacity: 0.55 },
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
