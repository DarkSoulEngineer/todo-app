import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef, type ReactNode } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";
import { useTheme } from "@/providers/theme-provider";
import type { BoardCellMeasure, BoardCellRect, BoardPoint } from "@/lib/features/board-drag";

export interface JanusDragCellProps {
  id: string;
  name: string;
  width: number | "100%";
  /** Only start a section drag from its heading, never from its nested cards. */
  handleHeight?: number;
  floating?: boolean;
  fillHeight?: boolean;
  /** Native section previews must not remount registered drag cells or scroll refs. */
  renderPreview?: () => ReactNode;
  previewLayer?: { show: (children: ReactNode, rect: BoardCellRect, position: Animated.ValueXY) => void; hide: () => void };
  enabled: boolean;
  active: boolean;
  target: boolean;
  onRegister: (id: string, measure: BoardCellMeasure) => () => void;
  onStart: (id: string, pointer: BoardPoint) => void;
  onMove: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
  onCancel: () => void;
  children: ReactNode;
}

export function JanusDragCell(props: JanusDragCellProps) {
  const { id, onRegister } = props;
  const { theme } = useTheme();
  const callbacks = useRef(props);
  const node = useRef<ComponentRef<typeof View>>(null);
  const moving = useRef(false);
  const pressedAt = useRef<BoardPoint | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const grantedAt = useRef({ x: 0, y: 0 });
  const cursor = useRef({ x: 0, y: 0 });
  const position = useMemo(() => new Animated.ValueXY(), []);
  useLayoutEffect(() => { callbacks.current = props; }, [props]);
  useLayoutEffect(() => onRegister(id, (receive) => {
    if (!node.current) { receive(null); return; }
    node.current.measureInWindow((x, y, width, height) => receive({ x, y, width, height }));
  }), [id, onRegister]);
  useLayoutEffect(() => {
    if (!props.active) {
      if (moving.current) callbacks.current.previewLayer?.hide();
      moving.current = false;
      pressedAt.current = null;
      position.setValue({ x: 0, y: 0 });
    }
  }, [props.active, position]);
  useEffect(() => () => {
    if (moving.current) { callbacks.current.previewLayer?.hide(); callbacks.current.onCancel(); }
  }, []);
  // create() stores these event callbacks; it does not read the ref during render.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(() => PanResponder.create({
    // Let clicks reach card controls; claim the whole card once a drag starts.
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: (event) => {
      if (callbacks.current.enabled && !moving.current) {
        const pointer = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        pressedAt.current = callbacks.current.handleHeight === undefined ? pointer : null;
        if (callbacks.current.handleHeight !== undefined) node.current?.measureInWindow((x, y) => {
          if (pointer.y >= y && pointer.y <= y + (callbacks.current.handleHeight ?? 0)) pressedAt.current = pointer;
        });
      }
      return false;
    },
    onMoveShouldSetPanResponder: (_, gesture) => callbacks.current.enabled && (callbacks.current.handleHeight === undefined || pressedAt.current !== null) && Math.hypot(gesture.dx, gesture.dy) > 4,
    onMoveShouldSetPanResponderCapture: (_, gesture) => callbacks.current.enabled && (callbacks.current.handleHeight === undefined || pressedAt.current !== null) && Math.hypot(gesture.dx, gesture.dy) > 4,
    onPanResponderGrant: (_, gesture) => {
      if (!callbacks.current.enabled) return;
      moving.current = true;
      const { x0, y0 } = gesture;
      origin.current = pressedAt.current ?? { x: x0, y: y0 };
      grantedAt.current = { x: x0, y: y0 };
      cursor.current = { x: x0, y: y0 };
      callbacks.current.onStart(callbacks.current.id, cursor.current);
      if (callbacks.current.previewLayer) node.current?.measureInWindow((x, y, width, height) => {
        if (moving.current) callbacks.current.previewLayer?.show(callbacks.current.renderPreview?.() ?? callbacks.current.children, { x, y, width, height }, position);
      });
      position.setValue({ x: x0 - origin.current.x, y: y0 - origin.current.y });
    },
    onPanResponderMove: (_, gesture) => {
      if (!moving.current) return;
      cursor.current = {
        x: Number.isFinite(gesture.moveX) ? gesture.moveX : grantedAt.current.x + gesture.dx,
        y: Number.isFinite(gesture.moveY) ? gesture.moveY : grantedAt.current.y + gesture.dy,
      };
      position.setValue({ x: cursor.current.x - origin.current.x, y: cursor.current.y - origin.current.y });
      callbacks.current.onMove(cursor.current.x, cursor.current.y);
    },
    onPanResponderRelease: (_, gesture) => {
      callbacks.current.previewLayer?.hide();
      moving.current = false;
      pressedAt.current = null;
      callbacks.current.onDrop(Number.isFinite(gesture.moveX) ? gesture.moveX : cursor.current.x, Number.isFinite(gesture.moveY) ? gesture.moveY : cursor.current.y);
      if (!callbacks.current.active) position.setValue({ x: 0, y: 0 });
    },
    onPanResponderTerminate: () => { callbacks.current.previewLayer?.hide(); moving.current = false; pressedAt.current = null; position.setValue({ x: 0, y: 0 }); callbacks.current.onCancel(); },
    onPanResponderTerminationRequest: () => false,
  }), [position]);

  return <View ref={node} {...responder.panHandlers} testID={`board-drag-cell-${props.id}`}
    accessibilityHint={props.enabled ? `Drag ${props.name} onto another grid position, or use its move buttons.` : undefined}
    style={[styles.cell, props.fillHeight && { height: "100%", maxHeight: "100%" }, { width: props.width, zIndex: props.active ? 10 : 0 }]}>
    {props.active ? <View testID={`board-drag-placeholder-${props.id}`} pointerEvents="none" style={[styles.placeholder, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.primarySoft }]} /> : null}
    <Animated.View style={[styles.content, props.fillHeight && { minHeight: 0, flexShrink: 1 }, { opacity: props.active ? props.previewLayer ? 0.2 : 0.9 : 1, transform: props.previewLayer ? undefined : position.getTranslateTransform() }]}>{props.children}</Animated.View>
    {props.target ? <View testID={`board-drop-target-${props.id}`} pointerEvents="none" style={[styles.target, { borderColor: theme.colors.primary }]} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  cell: { position: "relative" },
  content: { flexGrow: 1 },
  placeholder: { ...StyleSheet.absoluteFill, borderWidth: 1, borderStyle: "dashed", borderRadius: 20 },
  target: { ...StyleSheet.absoluteFill, borderWidth: 2, borderRadius: 20 },
});
