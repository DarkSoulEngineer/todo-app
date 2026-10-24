import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/providers/theme-provider";

export function JanusLogo({ size = 40 }: { size?: number }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: theme.colors.primary }]}>
      <View style={[styles.face, styles.faceLeft, { width: size * 0.42, height: size * 0.64, top: size * 0.18, left: size * 0.13, paddingTop: size * 0.15, borderRadius: size * 0.22, backgroundColor: theme.colors.primaryForeground }]}>
        <View style={[styles.eye, { width: size * 0.09, height: size * 0.09, borderRadius: size, backgroundColor: theme.colors.primary }]} />
      </View>
      <View style={[styles.face, styles.faceRight, { width: size * 0.42, height: size * 0.64, top: size * 0.18, right: size * 0.13, paddingTop: size * 0.15, borderRadius: size * 0.22, backgroundColor: theme.colors.primaryForeground, opacity: 0.68 }]}>
        <View style={[styles.eye, { width: size * 0.09, height: size * 0.09, borderRadius: size, backgroundColor: theme.colors.primary }]} />
      </View>
      <View style={[styles.seam, { height: size * 0.48, backgroundColor: theme.colors.primary }]} />
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
    overflow: "hidden",
    position: "relative",
  },
  face: {
    position: "absolute",
    alignItems: "center",
  },
  faceLeft: {
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  faceRight: {
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
  },
  eye: {
    alignSelf: "center",
  },
  seam: {
    width: 2,
    position: "absolute",
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
