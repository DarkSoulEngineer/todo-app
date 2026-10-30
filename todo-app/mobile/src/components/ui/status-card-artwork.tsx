import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";

/** Status scenes are decorative only; task state remains owned by the task API. */
export function StatusCardArtwork({ id, color, compact }: { id: string; color: string; compact: boolean }) {
  if (id === "done") return <View testID="done-seal" style={[styles.corner, { opacity: 0.3 }]}>
    <Svg width={compact ? 54 : 112} height={compact ? 48 : 94} viewBox="0 0 112 94">
      <Path d="M37 66 L32 91 L47 83 L58 91 L59 68 M63 67 L68 90 L78 81 L91 85 L81 60" fill={color} opacity={0.35} />
      <Path d="M60 9 L69 15 L80 14 L85 24 L95 30 L93 41 L97 51 L89 60 L85 71 L73 72 L63 80 L53 74 L41 74 L35 64 L25 59 L27 47 L22 37 L30 28 L34 17 L46 16 Z" fill="none" stroke={color} strokeWidth={2} />
      <Circle cx={60} cy={44} r={24} fill={color} opacity={0.12} />
      <Path d="M45 44 L56 55 L76 33" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      {!compact ? <G fill={color}><Path d="M10 57 Q2 45 8 32 Q15 44 10 57 M15 69 Q2 65 2 53 Q15 57 15 69 M22 79 Q9 80 5 68 Q18 69 22 79" /><Circle cx={95} cy={13} r={1.5} /><Path d="M100 62 h8 M104 58 v8" fill="none" stroke={color} strokeWidth={1.2} /></G> : null}
    </Svg>
  </View>;

  if (id === "canceled") return <View testID="canceled-ticket" style={[styles.corner, { opacity: 0.27 }]}>
    <Svg width={compact ? 58 : 118} height={compact ? 44 : 88} viewBox="0 0 118 88">
      {!compact ? <G stroke={color} opacity={0.3}>{[0, 14, 28, 42, 56].map((x) => <Line key={x} x1={x} y1={88} x2={x + 35} y2={53} strokeWidth={1} />)}</G> : null}
      <G transform="translate(20 6) rotate(-12 44 37)">
        <Path d="M7 10 H80 V27 Q69 30 80 39 V65 H7 V46 Q18 40 7 34 Z" fill={color} opacity={0.1} stroke={color} strokeWidth={1.6} />
        <Path d="M7 10 H80 V27 Q69 30 80 39 V65 H7 V46 Q18 40 7 34 Z" fill="none" stroke={color} strokeWidth={1.6} />
        <Path d="M27 24 L58 53 M57 24 L27 53" stroke={color} strokeWidth={3} strokeLinecap="round" />
        <Line x1={68} y1={16} x2={68} y2={59} stroke={color} strokeWidth={1} strokeDasharray="3 4" />
      </G>
    </Svg>
  </View>;

  if (id === "overdue") return <View testID="overdue-clock" style={[styles.corner, { opacity: 0.26 }]}>
    <Svg width={compact ? 54 : 110} height={compact ? 48 : 94} viewBox="0 0 110 94">
      <Circle cx={65} cy={49} r={29} stroke={color} strokeWidth={2} fill="none" />
      <Circle cx={65} cy={49} r={23} fill={color} opacity={0.09} />
      <Path d="M65 30 V49 L81 57" stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M40 20 Q32 9 26 23 M86 20 Q96 11 99 25 M44 75 l-5 9 M85 74 l5 9" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Circle cx={65} cy={49} r={2.5} fill={color} />
      {!compact ? <G stroke={color} fill="none" strokeWidth={1.5}><Path d="M12 47 l6 -6 6 6 M12 58 l6 -6 6 6 M12 69 l6 -6 6 6" /><Path d="M65 13 v-6 M101 49 h6" opacity={0.5} /></G> : null}
      <Rect x={60} y={4} width={10} height={3} rx={1} fill={color} />
    </Svg>
  </View>;
  return null;
}

const styles = StyleSheet.create({ corner: { position: "absolute", right: 0, bottom: 0 } });
