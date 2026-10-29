import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
} from "@expo-google-fonts/sora";

export interface FontOption {
  id: string;
  label: string;
  /** Regular weight family name passed to `fontFamily`. */
  family: string;
}

/** Default when no font is selected or fonts are not loaded yet. */
export const SYSTEM_FONT: FontOption = { id: "system", label: "System", family: "" };

export const FONT_OPTIONS: FontOption[] = [
  SYSTEM_FONT,
  { id: "inter", label: "Inter", family: "Inter_400Regular" },
  { id: "geist", label: "Geist", family: "Geist_400Regular" },
  { id: "dm-sans", label: "DM Sans", family: "DMSans_400Regular" },
  { id: "plus-jakarta", label: "Plus Jakarta Sans", family: "PlusJakartaSans_400Regular" },
  { id: "manrope", label: "Manrope", family: "Manrope_400Regular" },
  { id: "space-grotesk", label: "Space Grotesk", family: "SpaceGrotesk_400Regular" },
  { id: "outfit", label: "Outfit", family: "Outfit_400Regular" },
  { id: "sora", label: "Sora", family: "Sora_400Regular" },
];

export const FONT_FILES = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
};

/** Maps a font family's regular name to its weight variants. */
export const FONT_WEIGHT_MAP: Record<string, Record<string, string>> = {
  Inter_400Regular: { "400": "Inter_400Regular", "500": "Inter_500Medium", "600": "Inter_600SemiBold", "700": "Inter_700Bold" },
  Geist_400Regular: { "400": "Geist_400Regular", "500": "Geist_500Medium", "600": "Geist_600SemiBold", "700": "Geist_700Bold" },
  DMSans_400Regular: { "400": "DMSans_400Regular", "500": "DMSans_500Medium", "600": "DMSans_600SemiBold", "700": "DMSans_700Bold" },
  PlusJakartaSans_400Regular: { "400": "PlusJakartaSans_400Regular", "500": "PlusJakartaSans_500Medium", "600": "PlusJakartaSans_600SemiBold", "700": "PlusJakartaSans_700Bold" },
  Manrope_400Regular: { "400": "Manrope_400Regular", "500": "Manrope_500Medium", "600": "Manrope_600SemiBold", "700": "Manrope_700Bold" },
  SpaceGrotesk_400Regular: { "400": "SpaceGrotesk_400Regular", "500": "SpaceGrotesk_500Medium", "600": "SpaceGrotesk_600SemiBold", "700": "SpaceGrotesk_700Bold" },
  Outfit_400Regular: { "400": "Outfit_400Regular", "500": "Outfit_500Medium", "600": "Outfit_600SemiBold", "700": "Outfit_700Bold" },
  Sora_400Regular: { "400": "Sora_400Regular", "500": "Sora_500Medium", "600": "Sora_600SemiBold", "700": "Sora_700Bold" },
};

export function getFontFamily(optionId: string, weight: string | number = "400"): string {
  const option = FONT_OPTIONS.find((item) => item.id === optionId) ?? SYSTEM_FONT;
  if (option.id === "system") return "";
  const map = FONT_WEIGHT_MAP[option.family];
  const key = String(weight);
  return map?.[key] ?? map?.["400"] ?? option.family;
}
