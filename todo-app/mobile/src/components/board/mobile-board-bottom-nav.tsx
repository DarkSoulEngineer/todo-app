import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomNavIsland, type NavigationBlurTarget } from "@/components/ui/bottom-nav-island";
import { useReferenceTheme, type ReferenceColors } from "../reference/reference-theme";
import type { ViewMode } from "@/lib/domain/types";

export type BoardViewNavTab = ViewMode;

interface ViewTabConfig {
  key: BoardViewNavTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  customIcon?: "board";
}

const VIEW_TABS: ViewTabConfig[] = [
  { key: "board", label: "Board", icon: "albums-outline", activeIcon: "albums", customIcon: "board" },
  { key: "list", label: "Activity", icon: "pulse-outline", activeIcon: "pulse" },
  { key: "calendar", label: "Calendar", icon: "calendar-outline", activeIcon: "calendar" },
  { key: "insights", label: "Insights", icon: "stats-chart-outline", activeIcon: "stats-chart" },
];

interface MobileBoardBottomNavProps {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  blurTarget?: NavigationBlurTarget;
}

export function MobileBoardBottomNav({ mode, onMode, blurTarget }: MobileBoardBottomNavProps) {
  const { colors, type } = useReferenceTheme();
  const styles = createStyles(colors);

  return (
    <BottomNavIsland tabCount={4} blurTarget={blurTarget}>
      <View style={styles.row}>
        {VIEW_TABS.map((tab) => {
          const selected = tab.key === mode;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${tab.label} view`}
              onPress={() => onMode(tab.key)}
              style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.icon}>
                {tab.customIcon === "board" ? (
                  <View style={styles.columnsMark}>
                    {[17, 12, 15].map((height, index) => (
                      <View
                        key={index}
                        style={[
                          styles.columnMark,
                          {
                            height,
                            borderColor: selected ? colors.primary : colors.muted,
                          },
                        ]}
                      />
                    ))}
                  </View>
                ) : (
                  <Ionicons
                    name={selected ? tab.activeIcon : tab.icon}
                    size={22}
                    color={selected ? colors.primary : colors.muted}
                  />
                )}
              </View>
              <Text
                style={[
                  type.caption,
                  {
                    color: selected ? colors.primary : colors.muted,
                    fontWeight: selected ? "700" : "500",
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomNavIsland>
  );
}

function createStyles(colors: ReferenceColors) {
  return StyleSheet.create({
    row: {
      minHeight: 56,
      paddingHorizontal: 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    item: {
      flex: 1,
      minHeight: 52,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    icon: {
      width: 44,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    itemSelected: {},
    columnsMark: {
      flexDirection: "row",
      gap: 2,
      height: 17,
      alignItems: "flex-start",
    },
    columnMark: {
      width: 5,
      borderWidth: 1.5,
      borderRadius: 1,
    },
  });
}
