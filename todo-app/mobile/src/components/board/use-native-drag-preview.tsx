import { useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import type { BoardCellRect } from "@/lib/features/board-drag";

interface Preview { children: ReactNode; rect: BoardCellRect; position: Animated.ValueXY }

/** A non-interactive sibling overlay escapes the columns' nested scroll clipping. */
export function useNativeDragPreview() {
  const host = useRef<ComponentRef<typeof View>>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const generation = useRef(0);
  const layer = useMemo(() => ({
    show(children: ReactNode, rect: BoardCellRect, position: Animated.ValueXY) {
      const token = ++generation.current;
      host.current?.measureInWindow((x, y) => {
        if (token === generation.current) setPreview({ children, rect: { ...rect, x: rect.x - x, y: rect.y - y }, position });
      });
    },
    hide() { generation.current++; setPreview(null); },
  }), []);
  return {
    host,
    layer: Platform.OS === "web" ? undefined : layer,
    overlay: Platform.OS === "web" ? null : <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
      {preview ? <Animated.View style={{ position: "absolute", left: preview.rect.x, top: preview.rect.y, width: preview.rect.width, height: preview.rect.height, opacity: 0.95, transform: preview.position.getTranslateTransform() }}>{preview.children}</Animated.View> : null}
    </View>,
  };
}
