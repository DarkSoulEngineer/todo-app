import type { ViewStyle } from "react-native";

/** A fixed-size bevel: pressing changes depth, never the surrounding layout. */
export function tactileSurface({ pressed = false, selected = false, disabled = false, dark = true, accent }: {
  pressed?: boolean;
  selected?: boolean;
  disabled?: boolean;
  dark?: boolean;
  accent?: string;
} = {}): ViewStyle {
  const down = !disabled && (pressed || selected);
  return {
    borderWidth: 1,
    borderBottomWidth: 3,
    borderBottomColor: selected && accent ? accent : dark ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.20)",
    transform: [{ translateY: disabled ? 0 : pressed ? 2 : selected ? 1 : 0 }],
    boxShadow: disabled ? "none" : down
      ? "inset 0 1px 3px rgba(0,0,0,0.16), 0 1px 1px rgba(0,0,0,0.08)"
      : `inset 0 1px 0 ${dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.85)"}, 0 3px 0 rgba(0,0,0,0.12), 0 5px 8px rgba(0,0,0,0.10)`,
  };
}
