import type { ViewStyle } from "react-native";

/** A shallower bevel for dense card feeds; depth never changes card geometry. */
export function tactileCardSurface({ pressed = false, selected = false, dark = true }: {
  pressed?: boolean;
  selected?: boolean;
  dark?: boolean;
} = {}): ViewStyle {
  const highlight = dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.90)";
  return {
    transform: [{ translateY: pressed ? 1 : 0 }],
    boxShadow: pressed
      ? "inset 0 1px 3px rgba(0,0,0,0.16), 0 1px 2px rgba(0,0,0,0.08)"
      : `inset 0 1px 0 ${highlight}, 0 2px 0 rgba(0,0,0,${dark ? "0.24" : "0.10"}), 0 ${selected ? 5 : 4}px 8px rgba(0,0,0,${dark ? "0.20" : "0.10"})`,
  };
}

/** A fixed-size bevel: pressing changes depth, never the surrounding layout. */
export function tactileSurface({ pressed = false, selected = false, disabled = false, dark = true, accent }: {
  pressed?: boolean;
  selected?: boolean;
  disabled?: boolean;
  dark?: boolean;
  accent?: string;
} = {}): ViewStyle {
  return {
    borderWidth: 1,
    borderColor: selected && accent ? accent : undefined,
  };
}
