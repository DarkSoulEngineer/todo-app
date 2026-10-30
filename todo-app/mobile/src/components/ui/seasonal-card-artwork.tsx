import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";

/** Each holiday has its own composition, not a recolored version of one motif. */
export function SeasonalCardArtwork({ id, phase, compact }: { id: string; phase: Animated.Value; compact: boolean }) {
  if (id === "christmas") return <ChristmasArtwork phase={phase} compact={compact} />;
  if (id === "easter") return <EasterArtwork phase={phase} compact={compact} />;
  if (id === "new-year") return <NewYearArtwork phase={phase} compact={compact} />;
  return null;
}

function ChristmasArtwork({ phase, compact }: { phase: Animated.Value; compact: boolean }) {
  return <>
    <View testID="christmas-lights" style={styles.lights}>
      <Svg width="100%" height={18} viewBox="0 0 320 18" preserveAspectRatio="none">
        <Path d="M-8 1 Q80 15 160 4 T328 3" fill="none" stroke="#86A68D" strokeWidth={1} opacity={0.4} />
        {[18, 55, 93, 132, 171, 211, 250, 292].map((x, index) => <G key={x}><Line x1={x} y1={index < 4 ? 5 : 4} x2={x} y2={10} stroke="#86A68D" strokeWidth={1} /><Circle cx={x} cy={11} r={2.5} fill={index % 2 ? "#FACC6B" : "#F87171"} opacity={0.7} /></G>)}
      </Svg>
    </View>
    {!compact ? <>
      <Animated.View testID="christmas-snow" style={[StyleSheet.absoluteFill, { opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.45] }), transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, 7] }) }] }]}>
        <Svg width="100%" height="100%" viewBox="0 0 320 140" preserveAspectRatio="none">
          {[[30, 36], [116, 19], [204, 46], [265, 28], [299, 83], [234, 108], [166, 121]].map(([x, y], index) => <Circle key={x} cx={x} cy={y} r={index % 2 ? 1 : 1.6} fill="#E8F4F0" />)}
        </Svg>
      </Animated.View>
      <View testID="christmas-tree" style={[styles.corner, { opacity: 0.35 }]}>
        <Svg width={90} height={90} viewBox="0 0 90 90">
          <Rect x={46} y={71} width={7} height={17} rx={1} fill="#C8A27C" />
          <Path d="M49 18 L31 45 H39 L23 64 H34 L16 82 H82 L65 64 H75 L59 45 H67 Z" fill="#48A276" />
          <Path d="M49 10 L51 16 L57 17 L52 21 L53 27 L49 24 L44 27 L45 21 L40 17 L47 16 Z" fill="#FACC6B" />
          <Path d="M36 44 Q49 54 63 45 M28 63 Q49 76 71 64" fill="none" stroke="#FACC6B" strokeWidth={1.5} />
          <Circle cx={45} cy={40} r={2.5} fill="#F87171" /><Circle cx={56} cy={60} r={3} fill="#F87171" /><Circle cx={35} cy={74} r={2.5} fill="#E8F4F0" />
        </Svg>
      </View>
    </> : null}
  </>;
}

function EasterArtwork({ phase, compact }: { phase: Animated.Value; compact: boolean }) {
  return <>
    <View testID="easter-meadow" style={styles.meadow}>
      <Svg width="100%" height={25} viewBox="0 0 320 25" preserveAspectRatio="none">
        <Path d="M0 17 Q55 1 122 15 T245 12 T320 16 V25 H0 Z" fill="#A7DAB6" opacity={0.13} />
        {[16, 31, 51, 280, 299].map((x) => <Path key={x} d={`M${x} 25 q-1 -13 -5 -17 M${x} 25 q1 -10 6 -13`} stroke="#A7DAB6" strokeWidth={1} fill="none" opacity={0.45} />)}
      </Svg>
    </View>
    {!compact ? <Animated.View testID="easter-eggs" style={[styles.corner, { opacity: 0.5, transform: [{ rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] }) }] }]}>
      <Svg width={116} height={81} viewBox="0 0 116 81">
        <G transform="translate(34 52) rotate(-18) scale(.8)">
          <Path d="M0 -27 C-11 -27 -21 -6 -21 8 C-21 32 21 32 21 8 C21 -6 11 -27 0 -27Z" fill="#F4B8CB" />
          <Path d="M-17 -5 L-10 0 L-3 -5 L4 0 L11 -5 L18 0 M-20 12 L-13 17 L-6 12 L1 17 L8 12 L15 17 L20 13" fill="none" stroke="#FFF2CF" strokeWidth={3} />
        </G>
        <G transform="translate(68 43) rotate(8)">
          <Path d="M0 -27 C-11 -27 -21 -6 -21 8 C-21 32 21 32 21 8 C21 -6 11 -27 0 -27Z" fill="#BDE3CF" />
          {[[0, -15], [-8, -3], [8, -3], [0, 8], [-9, 19], [9, 19]].map(([x, y]) => <Circle key={`${x}:${y}`} cx={x} cy={y} r={2.4} fill="#FFF2CF" />)}
        </G>
        <G transform="translate(95 57) rotate(20) scale(.65)">
          <Path d="M0 -27 C-11 -27 -21 -6 -21 8 C-21 32 21 32 21 8 C21 -6 11 -27 0 -27Z" fill="#E3CCF7" />
          <Path d="M-16 -7 H16 M-21 7 H21 M-18 20 H18" stroke="#FFF2CF" strokeWidth={4} />
        </G>
      </Svg>
    </Animated.View> : null}
  </>;
}

function Firework({ x, y, radius, color }: { x: number; y: number; radius: number; color: string }) {
  return <G>{Array.from({ length: 12 }, (_, index) => {
    const angle = index * Math.PI / 6;
    return <G key={index}><Line x1={x + Math.cos(angle) * radius * 0.4} y1={y + Math.sin(angle) * radius * 0.4} x2={x + Math.cos(angle) * radius} y2={y + Math.sin(angle) * radius} stroke={color} strokeWidth={1.5} strokeLinecap="round" /><Circle cx={x + Math.cos(angle) * (radius + 4)} cy={y + Math.sin(angle) * (radius + 4)} r={0.9} fill={color} /></G>;
  })}</G>;
}

function NewYearArtwork({ phase, compact }: { phase: Animated.Value; compact: boolean }) {
  return <>
    <View testID="new-year-confetti" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 320 140" preserveAspectRatio="none">
        {[[24, 8, 22], [102, 6, -18], [228, 12, 35], [293, 32, -25], [264, 123, 40], [176, 130, -30]].map(([x, y, angle], index) => <Rect key={x} x={x} y={y} width={3} height={7} rx={0.5} transform={`rotate(${angle} ${x} ${y})`} fill={index % 2 ? "#F4CF76" : "#91C5FF"} opacity={0.5} />)}
        <Path d="M306 75 q-10 0 -5 9 t-7 9 M42 127 q8 -8 14 -2" stroke="#F4CF76" strokeWidth={1} fill="none" opacity={0.4} />
      </Svg>
    </View>
    {!compact ? <Animated.View testID="new-year-fireworks" style={[styles.corner, { opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] }), transform: [{ scale: phase.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.04] }) }] }]}>
      <Svg width={112} height={100} viewBox="0 0 112 100">
        <Firework x={73} y={35} radius={24} color="#F4CF76" />
        <Firework x={30} y={69} radius={16} color="#91C5FF" />
        <Path d="M73 69 q-3 15 -9 23 M30 91 l-3 7" stroke="#91C5FF" strokeWidth={1} opacity={0.35} fill="none" />
      </Svg>
    </Animated.View> : null}
  </>;
}

const styles = StyleSheet.create({
  corner: { position: "absolute", right: 0, bottom: 0 },
  lights: { position: "absolute", top: 0, left: 0, right: 0 },
  meadow: { position: "absolute", bottom: 0, left: 0, right: 0 },
});
