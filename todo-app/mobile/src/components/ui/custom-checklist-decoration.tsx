import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

/** Fixed-size ornaments per checklist row; never stretch with the card. */
export function CustomChecklistDecoration({ id, done }: { id: "darksoulengineer" | "janus"; done: boolean }) {
  const color = id === "darksoulengineer" ? "#63E6D1" : "#D7BD8C";
  return <View testID={`checklist-decoration-${id}`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 48, height: 24, flexShrink: 0, opacity: done ? 0.45 : 0.22 }}>
    <Svg width={48} height={24} viewBox="0 0 48 24">
      {id === "darksoulengineer" ? <>
        <Path d="M2 17 H15 L24 8 H40 M8 21 H22 L31 12 H45 M5 5 L9 9 L5 13" fill="none" stroke={color} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
        <Rect x={39} y={6} width={4} height={4} rx={0.5} fill={color} />
      </> : <>
        <Path d="M2 18 H14 V6 H26 V18 H38 V6 H46 M18 12 H22 M30 12 H34" fill="none" stroke={color} strokeWidth={1} strokeLinejoin="round" />
        <Path d="M2 22 H46" stroke={color} strokeWidth={0.6} />
      </>}
    </Svg>
  </View>;
}
