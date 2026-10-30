import { Children, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

/** Only visible modules take space; the last module fills an incomplete row. */
export function InsightsModuleGrid({ children, columns, testID, equalHeight = false }: { children: ReactNode; columns: number; testID?: string; equalHeight?: boolean }) {
  const modules = Children.toArray(children);
  if (!modules.length) return null;
  return <View testID={testID} style={[styles.grid, columns > 1 && styles.horizontal, columns > 1 && equalHeight && { alignItems: "stretch" }]}>
    {modules.map((module, index) => <View key={(module as { key?: string }).key ?? index} style={columns > 1 ? { flexGrow: 1, flexShrink: 1, flexBasis: `${90 / Math.min(columns, modules.length)}%`, minWidth: 0 } : undefined}>{module}</View>)}
  </View>;
}

const styles = StyleSheet.create({
  grid: { gap: 16 },
  horizontal: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
});
