import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { useTheme } from "@/providers/theme-provider";
import {
  celebrationParticleCount,
  subscribeToTaskCompletionCelebrations,
  type TaskCompletionCelebrationEvent,
} from "@/lib/features/task-completion-celebration";

type EffectStyle = "confetti" | "stars" | "fireworks";

interface Particle {
  id: number;
  left: number;
  top: number;
  driftX: number;
  driftY: number;
  rotation: number;
  size: number;
  delay: number;
  color: string;
  star: boolean;
}

function createParticles(
  celebration: TaskCompletionCelebrationEvent,
  width: number,
  height: number,
  colors: string[],
): { style: EffectStyle; particles: Particle[] } {
  const style = (["confetti", "stars", "fireworks"] as const)[Math.floor(Math.random() * 3)];
  const count = celebrationParticleCount(celebration.priority, celebration.completedChecklistItems);
  const origin = celebration.origin ?? { x: width / 2, y: height * 0.36 };
  const particles = Array.from({ length: count }, (_, id) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 55 + Math.random() * Math.min(width * 0.42, height * 0.3);

    return {
      id,
      left: origin.x + (Math.random() - 0.5) * (style === "fireworks" ? 36 : 20),
      top: origin.y + (Math.random() - 0.5) * (style === "fireworks" ? 28 : 20),
      driftX: Math.cos(angle) * distance,
      driftY: Math.sin(angle) * distance,
      rotation: (Math.random() - 0.5) * 900,
      size: 8 + Math.random() * 12,
      delay: Math.random() * 0.18,
      color: colors[Math.floor(Math.random() * colors.length)],
      star: style !== "confetti" || Math.random() > 0.55,
    };
  });
  return { style, particles };
}

export function TaskCompletionCelebration() {
  const { width, height } = useWindowDimensions();
  const { theme: { colors: c } } = useTheme();
  const [celebration, setCelebration] = useState<TaskCompletionCelebrationEvent | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const palette = useMemo(() => [c.success, c.primary, c.warning, c.info, c.destructive], [c.destructive, c.info, c.primary, c.success, c.warning]);
  const effect = useMemo(
    () => celebration ? createParticles(celebration, width, height, palette) : null,
    [celebration, height, palette, width],
  );

  useEffect(() => subscribeToTaskCompletionCelebrations(setCelebration), []);

  useEffect(() => {
    if (!celebration) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 2100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setCelebration(null);
    });
    return () => animation.stop();
  }, [celebration, progress]);

  if (!celebration || !effect) return null;

  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.overlay}>
    {effect.particles.map((particle) => {
      const start = particle.delay;
      const fadeInEnd = start + 0.12;
      const opacity = progress.interpolate({
        inputRange: [0, start, fadeInEnd, 0.78, 1],
        outputRange: [0, 0, 1, 0.9, 0],
        extrapolate: "clamp",
      });
      const scale = progress.interpolate({
        inputRange: [0, fadeInEnd, 0.8, 1],
        outputRange: [0.35, 1, 0.9, 0.45],
        extrapolate: "clamp",
      });
      return <Animated.View
        key={`${celebration.id}-${particle.id}`}
        style={[
          styles.particle,
          { left: particle.left, top: particle.top, opacity },
          {
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, particle.driftX] }) },
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, particle.driftY] }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${particle.rotation}deg`] }) },
              { scale },
            ],
          },
        ]}
      >
        {particle.star
          ? <Ionicons name={effect.style === "fireworks" ? "sparkles" : "star"} size={particle.size} color={particle.color} />
          : <View style={[styles.confetti, { width: particle.size * 0.55, height: particle.size * 1.35, backgroundColor: particle.color }]} />}
      </Animated.View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, elevation: 20, overflow: "hidden" },
  particle: { position: "absolute", width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  confetti: { borderRadius: 2 },
});
