import { Animated, StyleSheet, View } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/providers/theme-provider";

/** Unframed object studies: a metal laptop and a carved, two-faced Janus bust. */
export function CustomCardArtwork({ id, phase, compact }: { id: string; phase: Animated.Value; compact: boolean }) {
  const { theme } = useTheme();
  const size = compact ? 44 : 96;

  return <>
    {!compact ? <View testID={`custom-details-${id}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 320 160" preserveAspectRatio="none">
        {id === "darksoulengineer" ? <DarkSoulDetails /> : <JanusDetails />}
      </Svg>
    </View> : null}
    <Animated.View testID={`custom-artwork-${id}`} pointerEvents="none" style={[styles.emblem, {
    width: size,
    height: size,
    marginTop: -size / 2,
    opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.82, 0.92] }),
  }]}>
    <Svg width="100%" height="100%" viewBox="0 0 104 104">
      {id === "darksoulengineer" ? <DarkSoulLaptop accent={theme.colors.primary} /> : <JanusBust />}
    </Svg>
    </Animated.View>
  </>;
}

function DarkSoulDetails() {
  return <G stroke="#63E6D1" fill="none" strokeWidth={0.9} opacity={0.65}>
    <Path d="M14 18 H78 L88 8 H134 M14 23 H55 L63 15 H76 M190 11 H222 L234 23 H294 V40 M306 48 V22 H282" />
    <Path d="M166 149 H202 L213 138 H250 M237 148 H283 L296 135 V118 M306 104 V139 L294 151" />
    <Rect x={132} y={6} width={4} height={4} rx={0.5} fill="#63E6D1" />
    <Rect x={248} y={136} width={4} height={4} rx={0.5} fill="#63E6D1" />
    <Path d="M180 30 L175 35 L180 40 M193 30 L198 35 L193 40 M189 28 L184 42" opacity={0.6} />
    <Path d="M285 75 H298 M292 69 V82 M272 113 H280 M276 109 V117" opacity={0.45} />
  </G>;
}

function JanusDetails() {
  return <G stroke="#D7BD8C" fill="none" strokeWidth={0.85} opacity={0.65}>
    <Path d="M15 22 V12 H53 V22 H43 V17 H25 V22 H15 M63 12 H96 M224 12 H257 V22 H247 V17 H229 V22 H219 V12 M267 12 H302 V26" />
    <Path d="M160 147 H191 M201 147 H234 V137 H224 V142 H206 V137 H196 V147 M244 147 H279 V137 H269 V142 H251 V137 H241" />
    <Path d="M292 119 Q302 91 290 63 M286 111 Q278 102 285 95 Q294 102 286 111 M292 94 Q283 85 289 78 Q298 84 292 94 M292 77 Q282 72 285 64 Q296 67 292 77" />
    <Path d="M180 114 L185 119 L180 124 L175 119Z M166 119 H170 M190 119 H194" opacity={0.55} />
  </G>;
}

function DarkSoulLaptop({ accent }: { accent: string }) {
  return <G>
    <Defs>
      <LinearGradient id="dseMetal" x1={0} y1={0} x2={0.8} y2={1}>
        <Stop offset="0" stopColor="#C3CCD3" /><Stop offset="0.45" stopColor="#697781" /><Stop offset="1" stopColor="#36434F" />
      </LinearGradient>
      <LinearGradient id="dseScreen" x1={0} y1={0} x2={1} y2={1}>
        <Stop offset="0" stopColor="#243E43" /><Stop offset="1" stopColor="#0B141E" />
      </LinearGradient>
      <LinearGradient id="dseDeck" x1={0} y1={0} x2={0} y2={1}>
        <Stop offset="0" stopColor="#8B99A3" /><Stop offset="1" stopColor="#D4DBDE" />
      </LinearGradient>
    </Defs>
    <Path d="M13 85 Q52 89 94 84 L84 90 H24Z" fill="#090F18" opacity={0.28} />
    <Path d="M22 20 Q22 17 26 17 H83 Q87 17 87 21 V66 H22Z" fill="url(#dseMetal)" stroke="#CFD8DC" strokeOpacity={0.45} strokeWidth={0.8} />
    <Rect x={26} y={22} width={57} height={40} rx={1.5} fill="url(#dseScreen)" />
    <Path d="M28 24 H78 L28 48Z" fill="#FFFFFF" opacity={0.055} />
    <Path d="M34 35 L41 41 L34 47 M45 47 H53" fill="none" stroke="#82D8BF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M58 35 H73 M58 40 H69 M58 45 H75 M34 54 H62" stroke={accent} strokeOpacity={0.8} strokeWidth={1.2} strokeLinecap="round" />
    <Path d="M22 66 H87 L98 80 Q99 82 95 83 H12 Q8 82 10 80Z" fill="url(#dseDeck)" stroke="#B5C1C8" strokeWidth={0.7} />
    <Path d="M27 68 H82 L87 75 H21Z" fill="#35434E" />
    <Path d="M29 70 H80 M26 73 H83 M35 68 L33 75 M44 68 L43 75 M53 68 V75 M62 68 L63 75 M71 68 L73 75" stroke="#91A0AB" strokeWidth={0.6} opacity={0.7} />
    <Path d="M44 77 H64 L66 81 H42Z" fill="#82939D" stroke="#D3DCDF" strokeWidth={0.5} />
    <Path d="M10 83 H97 L94 86 H15Z" fill="#45535F" />
    <Path d="M16 83 H91" stroke="#E6EDEF" strokeOpacity={0.65} strokeWidth={0.7} />
  </G>;
}

function JanusBust() {
  return <G>
    <Defs>
      <LinearGradient id="janusStone" x1={0} y1={0} x2={1} y2={0.6}>
        <Stop offset="0" stopColor="#E4D4B3" /><Stop offset="0.45" stopColor="#BAA581" /><Stop offset="1" stopColor="#6E665D" />
      </LinearGradient>
      <LinearGradient id="janusShadow" x1={0} y1={0} x2={1} y2={0}>
        <Stop offset="0" stopColor="#A89D88" /><Stop offset="1" stopColor="#64717D" />
      </LinearGradient>
      <LinearGradient id="janusPlinth" x1={0} y1={0} x2={0} y2={1}>
        <Stop offset="0" stopColor="#C8B99A" /><Stop offset="1" stopColor="#756F64" />
      </LinearGradient>
    </Defs>
    <Path d="M23 94 H82 L88 97 H17Z" fill="#090F18" opacity={0.22} />
    <Path d="M39 61 L38 74 Q29 77 25 85 H79 Q75 77 66 74 L65 61Z" fill="url(#janusStone)" />
    <Path d="M52 66 V85 H79 Q75 77 66 74 L65 61Z" fill="url(#janusShadow)" />
    <Path d="M52 12 C35 9 25 21 27 34 L24 42 L18 49 Q18 51 25 52 L24 57 L28 59 Q25 64 30 68 Q38 71 46 64 L52 59Z" fill="url(#janusStone)" />
    <Path d="M52 12 C69 9 79 21 77 34 L80 42 L86 49 Q86 51 79 52 L80 57 L76 59 Q79 64 74 68 Q66 71 58 64 L52 59Z" fill="url(#janusShadow)" />
    <Path d="M27 32 Q23 20 34 14 Q43 8 52 12 Q64 7 74 17 Q81 24 77 34 L70 29 L68 22 L63 28 L58 21 L52 28 L46 21 L41 28 L36 23 L33 32Z" fill="url(#janusStone)" />
    <Path d="M29 24 Q32 16 38 17 M39 20 Q43 13 47 17 M56 17 Q62 12 66 18 M68 19 Q74 19 74 26" fill="none" stroke="#F2E3C9" strokeOpacity={0.48} strokeWidth={1.5} strokeLinecap="round" />
    <Path d="M29 38 Q35 34 40 39 M64 39 Q69 34 75 38" fill="none" stroke="#625A4E" strokeWidth={1.6} strokeLinecap="round" />
    <Path d="M29 41 L35 42 M69 42 L75 41 M25 56 L31 56 M73 56 L79 56" stroke="#4F514F" strokeWidth={1.1} strokeLinecap="round" />
    <Path d="M37 44 Q42 49 38 57 L34 62 M67 44 Q62 49 66 57 L70 62" fill="none" stroke="#726C5E" strokeOpacity={0.7} strokeWidth={1.1} />
    <Path d="M47 33 Q42 43 46 52 Q49 57 44 63 M57 33 Q62 43 58 52 Q55 57 60 63" fill="none" stroke="#EEE1C7" strokeOpacity={0.25} strokeWidth={1.2} />
    <Path d="M42 70 L47 79 M62 70 L57 79 M31 82 Q51 87 73 82" fill="none" stroke="#6D675D" strokeOpacity={0.65} strokeWidth={1.1} />
    <Path d="M25 85 H79 V89 H25Z M22 90 H82 V95 H22Z" fill="url(#janusPlinth)" />
    <Path d="M25 85 H79 M22 90 H82" stroke="#E8DBBF" strokeOpacity={0.55} strokeWidth={0.8} />
  </G>;
}

const styles = StyleSheet.create({
  emblem: { position: "absolute", right: 16, top: "50%" },
});
