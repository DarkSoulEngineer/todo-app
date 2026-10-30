import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { halloweenVariantForCard, type HalloweenVariant } from "@/lib/features/halloween-variants";

const INK = "#302538";
const BONE = "#F4E5C9";
const COSTUME_COLORS: Record<HalloweenVariant, string> = {
  skeleton: BONE, zombie: "#A6C979", vampire: "#BA9BE2", clown: "#F2909B", ghost: "#C5D7ED", pumpkin: "#F6A34F",
};

/** Inline vector costumes stay crisp and identical on native and web. */
export function HalloweenCharacter({ variant }: { variant: HalloweenVariant }) {
  switch (variant) {
    case "skeleton": return <G>
      <Path d="M30 68 L72 92 M72 68 L30 92" stroke={BONE} strokeWidth={7} strokeLinecap="round" />
      <Path d="M25 39 C25 8 77 8 77 39 Q77 55 66 60 V71 Q51 78 36 71 V60 Q25 55 25 39Z" fill={BONE} />
      <Ellipse cx={39} cy={43} rx={8} ry={10} fill={INK} /><Ellipse cx={63} cy={43} rx={8} ry={10} fill={INK} />
      <Path d="M51 53 L46 61 H56Z M42 65 V73 M51 65 V75 M60 65 V73" stroke={INK} strokeWidth={2.5} fill={INK} />
    </G>;
    case "zombie": return <G>
      <Path d="M23 94 Q25 70 51 70 Q77 70 80 94" fill="#8D79AF" />
      <Rect x={24} y={19} width={54} height={59} rx={16} fill="#A6C979" />
      <Path d="M24 35 V22 Q32 10 49 16 L58 11 L60 19 L73 16 L78 35 L65 29 L58 34 L44 26 L36 33Z" fill="#52654A" />
      <Circle cx={39} cy={45} r={8} fill={BONE} /><Circle cx={63} cy={47} r={6} fill={BONE} /><Circle cx={41} cy={46} r={3} fill={INK} /><Circle cx={62} cy={49} r={2.5} fill={INK} />
      <Path d="M37 63 L64 61 M43 59 L44 66 M53 59 L54 65 M60 25 L67 34 M59 30 L65 26" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M50 62 H56 V68 H50Z" fill={BONE} />
    </G>;
    case "vampire": return <G>
      <Path d="M15 62 L40 72 L51 89 L64 72 L88 62 L79 99 H23Z" fill="#8E66BB" /><Path d="M23 99 L39 74 H63 L79 99" fill={INK} />
      <Ellipse cx={51} cy={43} rx={26} ry={31} fill="#D8C4EA" />
      <Path d="M24 40 Q16 8 51 11 Q86 8 78 40 L66 27 L51 35 L36 27Z" fill={INK} />
      <Path d="M34 43 L43 46 M59 46 L68 43" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <Path d="M37 57 Q51 72 65 57Z" fill={INK} /><Path d="M40 59 L44 69 L48 61 M55 61 L59 69 L63 59" fill={BONE} />
      <Path d="M43 83 L51 87 L59 83 V94 L51 90 L43 94Z" fill="#ED7C8D" />
    </G>;
    case "clown": return <G>
      <Circle cx={26} cy={37} r={15} fill="#DE788B" /><Circle cx={76} cy={37} r={15} fill="#DE788B" />
      <Ellipse cx={51} cy={48} rx={26} ry={31} fill={BONE} />
      <Path d="M38 21 L51 2 L65 21Z" fill="#A78ACB" /><Circle cx={51} cy={5} r={4} fill="#F4BD63" />
      <Path d="M34 43 L39 31 L44 43 M58 43 L63 31 L68 43" fill="#8E78BE" />
      <Circle cx={39} cy={46} r={3} fill={INK} /><Circle cx={63} cy={46} r={3} fill={INK} /><Circle cx={51} cy={55} r={7} fill="#DE788B" />
      <Path d="M35 62 Q51 82 67 62 Q51 69 35 62Z" fill="#DE788B" />
      <Path d="M27 83 L46 87 L51 82 L56 87 L75 83 L69 98 L52 92 L33 98Z" fill="#A78ACB" />
    </G>;
    case "ghost": return <G>
      <Path d="M23 85 V43 C23 5 79 5 79 43 V85 L68 77 L58 89 L47 80 L35 89Z" fill="#D4E3F2" />
      <Ellipse cx={40} cy={43} rx={5} ry={8} fill={INK} /><Ellipse cx={62} cy={43} rx={5} ry={8} fill={INK} /><Ellipse cx={51} cy={62} rx={6} ry={8} fill={INK} />
      <Ellipse cx={30} cy={55} rx={5} ry={3} fill="#C09EC8" /><Ellipse cx={72} cy={55} rx={5} ry={3} fill="#C09EC8" />
    </G>;
    case "pumpkin": return <G>
      <Path d="M49 29 Q43 12 57 10 L61 15 Q49 17 55 29" fill="#A6C979" />
      <Ellipse cx={51} cy={57} rx={37} ry={31} fill="#F6A34F" /><Ellipse cx={51} cy={57} rx={21} ry={31} fill="none" stroke="#D87D37" strokeWidth={2} />
      <Path d="M27 51 L40 39 L44 54Z M58 54 L63 39 L76 51Z M48 58 L54 58 L51 53Z M28 64 L39 69 L44 65 L51 72 L59 65 L65 69 L75 64 Q63 89 39 78Z" fill={INK} />
    </G>;
  }
}

export function HalloweenCardArtwork({ cardId, phase, compact }: { cardId: string; phase: Animated.Value; compact: boolean }) {
  const variant = halloweenVariantForCard(cardId);
  const color = COSTUME_COLORS[variant];
  return <>
    <View testID="halloween-cobweb" style={styles.web}>
      <Svg width={60} height={46} viewBox="0 0 60 46">
        <Path d="M60 0 L0 0 M60 0 L13 24 M60 0 L36 44 M60 0 V46 M39 0 Q40 8 44 8 Q47 15 51 16 Q55 19 60 18 M20 0 Q23 13 31 15 Q34 26 43 30 Q51 35 60 34" fill="none" stroke={color} strokeWidth={0.8} opacity={0.22} />
      </Svg>
    </View>
    <Animated.View testID={`halloween-character-${variant}`} style={[styles.character, compact ? styles.compact : styles.regular, { opacity: compact ? 0.18 : 0.32, transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "2deg"] }) }] }]}>
      <Svg width="100%" height="100%" viewBox="0 0 102 104">
        <Circle cx={52} cy={55} r={45} fill={color} opacity={0.09} />
        <HalloweenCharacter variant={variant} />
      </Svg>
    </Animated.View>
    {!compact ? <View testID="halloween-bats" style={styles.bats}>
      <Svg width={86} height={34} viewBox="0 0 86 34">
        <Path d="M4 15 L1 5 L12 10 L16 6 L20 10 L31 5 L28 15 Q22 11 21 20 L16 16 L11 20 Q10 11 4 15Z M59 24 L56 17 L64 20 L67 17 L70 20 L79 17 L76 24 Q71 22 71 29 L67 26 L63 29 Q63 22 59 24Z" fill={color} opacity={0.24} />
      </Svg>
    </View> : null}
  </>;
}

const styles = StyleSheet.create({
  web: { position: "absolute", right: 0, top: 0 },
  character: { position: "absolute", right: 3, bottom: -9 },
  regular: { width: 96, height: 98 },
  compact: { width: 48, height: 49, right: 40, bottom: -9 },
  bats: { position: "absolute", right: 70, top: 10 },
});
