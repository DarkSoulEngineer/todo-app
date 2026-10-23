import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/providers/theme-provider";

export function JanusLogo({ size = 40 }: { size?: number }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2.5, backgroundColor: theme.colors.primary }]}>
      <Ionicons name="sparkles" size={size * 0.5} color={theme.colors.primaryForeground} />
    </View>
  );
}

export function JanusLockup({ tagline }: { tagline?: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.lockup}>
      <JanusLogo />
      <View>
        <Text style={[styles.name, { color: theme.colors.foreground }]}>Janus</Text>
        {tagline ? <Text style={[styles.tagline, { color: theme.colors.mutedForeground }]}>{tagline}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  lockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
  },
  tagline: {
    fontSize: 11,
    marginTop: 2,
  },
});
