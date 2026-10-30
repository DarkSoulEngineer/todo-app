import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/providers/theme-provider";

/** Custom easter eggs use quiet, high-contrast illustrations that stay crisp at any card size. */
export function CustomCardArtwork({ id, phase, compact }: { id: string; phase: Animated.Value; compact: boolean }) {
  const { theme } = useTheme();
  const size = compact ? 48 : 104;
  const dsePrimary = theme.colors.primary;
  const dseAccent = theme.colors.accent;
  const dseMuted = theme.colors.mutedForeground;
  const dseCanvas = theme.colors.backgroundAlt;
  const dseGlass = theme.colors.card;

  return <>
    <View pointerEvents="none" style={styles.wash}>
      <Svg width="100%" height="100%" viewBox="0 0 320 140" preserveAspectRatio="none">
        {id === "darksoulengineer" ? <DarkSoulCircuit primary={dsePrimary} secondary={dseAccent} muted={dseMuted} background={dseCanvas} /> : <JanusPortal />}
      </Svg>
    </View>
    <Animated.View testID={`custom-artwork-${id}`} pointerEvents="none" style={[styles.emblem, { width: size, height: size, opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.48, 0.67] }), transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }]}>
      <Svg width="100%" height="100%" viewBox="0 0 104 104">
        {id === "darksoulengineer" ? <DarkSoulEmblem primary={dsePrimary} secondary={dseAccent} background={dseGlass} muted={dseMuted} /> : <JanusEmblem />}
      </Svg>
    </Animated.View>
    {!compact ? <View pointerEvents="none" style={styles.signature}>
      <Svg width={72} height={18} viewBox="0 0 72 18">
        {id === "darksoulengineer"
          ? <><Path d="M1 9 H17 L22 4 L27 14 L32 9 H43" fill="none" stroke={dsePrimary} strokeWidth={1} opacity={0.45} /><Circle cx={47} cy={9} r={2} fill={dseAccent} opacity={0.85} /><Path d="M51 9 H71" stroke={dsePrimary} strokeWidth={1} opacity={0.35} /></>
          : <><Path d="M1 9 H20 M52 9 H71" stroke="#E8BD70" strokeWidth={1} opacity={0.42} /><Path d="M36 2 L43 9 L36 16 L29 9Z" fill="none" stroke="#A8C9FF" strokeWidth={1} opacity={0.6} /></>}
      </Svg>
    </View> : null}
  </>;
}

function DarkSoulCircuit({ primary, secondary, muted, background }: { primary: string; secondary: string; muted: string; background: string }) {
  return <G opacity={0.66}>
    <Defs><LinearGradient id="dseFlow" x1={0} y1={0} x2={1} y2={1}><Stop offset="0" stopColor={primary} stopOpacity="0" /><Stop offset="0.45" stopColor={primary} stopOpacity="0.32" /><Stop offset="1" stopColor={secondary} stopOpacity="0" /></LinearGradient></Defs>
    <Path d="M0 28 H38 L51 16 L62 36 L77 28 H118 L130 18 L145 39 L156 29 H216 M0 105 H67 L81 95 L96 112 L111 102 H190 M238 140 V116 L252 103 H320" fill="none" stroke="url(#dseFlow)" strokeWidth={1.2} />
    <Path d="M232 63 A18 18 0 0 1 258 63 M224 71 A28 28 0 0 1 266 71 M216 79 A38 38 0 0 1 274 79" fill="none" stroke={primary} strokeWidth={1} opacity={0.42} />
    {[18, 102, 182, 292].map((x, index) => <G key={x}><Circle cx={x} cy={index % 2 ? 104 : 29} r={2.2} fill={index % 2 ? secondary : primary} opacity={0.76} /><Circle cx={x} cy={index % 2 ? 104 : 29} r={5.5} fill="none" stroke={index % 2 ? secondary : primary} strokeWidth={0.75} opacity={0.28} /></G>)}
    <Path d="M48 0 V18 M194 140 V122 M284 0 V15" stroke={muted} strokeWidth={0.8} opacity={0.32} />
    <Circle cx={160} cy={70} r={35} fill="none" stroke={background} strokeOpacity={0.7} strokeWidth={1.5} />
  </G>;
}

function DarkSoulEmblem({ primary, secondary, background, muted }: { primary: string; secondary: string; background: string; muted: string }) {
  return <G>
    <Circle cx={52} cy={52} r={46} fill={background} fillOpacity={0.8} stroke={primary} strokeOpacity={0.72} strokeWidth={1.2} />
    <Circle cx={52} cy={52} r={38} fill="none" stroke={secondary} strokeOpacity={0.34} strokeWidth={0.8} strokeDasharray="2 5" />
    <Path d="M75 25 V17 M72 17 H79" fill="none" stroke={primary} strokeWidth={1.3} strokeLinecap="round" />
    <G transform="translate(5.2 5.2) scale(0.9)">
      <Rect x={18} y={25} width={68} height={36} rx={6} fill={background} fillOpacity={0.9} stroke={primary} strokeWidth={1.5} />
      <Path d="M28 35 H76" stroke={secondary} strokeWidth={1.3} opacity={0.8} />
      <Circle cx={26} cy={35} r={1.3} fill={primary} /><Circle cx={32} cy={35} r={1.3} fill={muted} />
      <Path d="M29 45 L37 52 L29 59 M40 59 H49" fill="none" stroke={primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M56 58 L61 50 L65 58 L69 45 L73 57" fill="none" stroke={secondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 69 H86 L91 76 Q89 79 82 79 H22 Q15 79 17 73Z" fill={background} fillOpacity={0.9} stroke={primary} strokeOpacity={0.8} strokeWidth={1.2} />
      <Path d="M42 69 H62 L60 73 H44Z" fill={secondary} fillOpacity={0.54} />
    </G>
    <Circle cx={79} cy={39} r={2.2} fill={primary} /><Circle cx={24} cy={40} r={1.6} fill={muted} />
  </G>;
}

function JanusPortal() {
  return <G opacity={0.48}>
    <Defs><LinearGradient id="janusSplit" x1={0} y1={0} x2={1} y2={0}><Stop offset="0" stopColor="#E8BD70" stopOpacity="0" /><Stop offset="0.5" stopColor="#E8BD70" stopOpacity="0.3" /><Stop offset="1" stopColor="#A8C9FF" stopOpacity="0" /></LinearGradient></Defs>
    <Path d="M0 24 H95 L112 42 H208 L225 24 H320 M0 117 H104 L119 101 H202 L218 117 H320" fill="none" stroke="url(#janusSplit)" strokeWidth={1.2} />
    <Path d="M160 0 V140" stroke="#E8BD70" strokeWidth={0.8} strokeDasharray="3 7" opacity={0.35} />
    <Path d="M0 72 H71 L87 57 M320 72 H249 L233 87" fill="none" stroke="#A8C9FF" strokeWidth={0.8} opacity={0.3} />
  </G>;
}

function JanusEmblem() {
  return <G>
    <Ellipse cx={52} cy={52} rx={42} ry={45} fill="#152033" fillOpacity={0.82} stroke="#E8BD70" strokeOpacity={0.52} strokeWidth={1.3} />
    <Path d="M52 10 C31 15 21 33 23 51 C24 68 35 81 52 92Z" fill="#E8BD70" fillOpacity={0.82} />
    <Path d="M52 10 C73 15 83 33 81 51 C80 68 69 81 52 92Z" fill="#A8C9FF" fillOpacity={0.82} />
    <Path d="M47 36 Q36 30 30 39 L37 42 M57 36 Q68 30 74 39 L67 42" fill="none" stroke="#172033" strokeWidth={2.2} strokeLinecap="round" />
    <Path d="M30 54 Q39 59 47 54 M57 54 Q65 59 74 54" fill="none" stroke="#172033" strokeWidth={2.2} strokeLinecap="round" />
    <Path d="M52 19 V85" stroke="#172033" strokeOpacity={0.68} strokeWidth={1.2} />
    <Path d="M17 52 A35 38 0 0 1 52 17 M52 87 A35 38 0 0 0 87 52" fill="none" stroke="#FFF1C7" strokeWidth={1.1} strokeOpacity={0.7} />
    <Polygon points="52,4 55,9 52,14 49,9" fill="#FFF1C7" />
  </G>;
}

const styles = StyleSheet.create({
  wash: { ...StyleSheet.absoluteFill, opacity: 0.7 },
  emblem: { position: "absolute", right: 6, bottom: 0 },
  signature: { position: "absolute", right: 72, bottom: 8 },
});
