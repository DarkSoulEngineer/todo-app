import { useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from "react-native";
import { getBoardScrollPosition } from "@/lib/features/board-scroll-position";
import { BoardPositionIndicator } from "./board-position-indicator";

interface Props {
  carouselRef: RefObject<ComponentRef<typeof ScrollView> | null>;
  columns: { id: string; title: string }[];
  interval: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onContentSizeChange: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  children: ReactNode;
}

/** Scroll updates stay here, so tracking the indicator doesn't rerender cards. */
export function BoardColumnCarousel({ carouselRef, columns, interval, style, contentContainerStyle, onContentSizeChange, onScroll, children }: Props) {
  const [metrics, setMetrics] = useState({ viewport: 0, content: 0, offset: 0 });
  const position = getBoardScrollPosition(columns, interval, metrics.viewport, metrics.content, metrics.offset);
  return <>
    <BoardPositionIndicator {...position} onPosition={(offset) => carouselRef.current?.scrollTo({ x: offset, animated: true })} />
    <ScrollView ref={carouselRef} testID="kanban-carousel" horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={32}
      onLayout={(event) => { const viewport = event.nativeEvent.layout.width; setMetrics((previous) => previous.viewport === viewport ? previous : { ...previous, viewport }); }}
      onContentSizeChange={(content) => { setMetrics((previous) => previous.content === content ? previous : { ...previous, content }); onContentSizeChange(); }}
      onScroll={(event) => {
        const offset = event.nativeEvent.contentOffset.x;
        setMetrics((previous) => previous.offset === offset ? previous : { ...previous, offset });
        onScroll(event);
      }} style={style} contentContainerStyle={contentContainerStyle}>
      {children}
    </ScrollView>
  </>;
}
