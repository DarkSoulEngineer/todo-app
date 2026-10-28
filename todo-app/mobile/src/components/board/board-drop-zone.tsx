import { useLayoutEffect, useRef, type ComponentRef, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { BoardCellMeasure } from "@/lib/features/board-drag";

export function BoardDropZone({ id, register, children, style }: { id: string; register: (id: string, measure: BoardCellMeasure) => () => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  useLayoutEffect(() => register(id, (receive) => {
    if (!ref.current) { receive(null); return; }
    ref.current.measureInWindow((x, y, width, height) => receive({ x, y, width, height }));
  }), [id, register]);
  return <View ref={ref} collapsable={false} style={style}>{children}</View>;
}
