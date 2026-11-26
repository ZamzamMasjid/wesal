// Cairo carries Arabic and English, the same typeface as the website (ADR-024).
// The Google Fonts package ships static faces; React Native cannot vary the
// weight axis of a variable font on Android, so each weight has its own family.

import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from "@expo-google-fonts/cairo";
import type { TextStyle } from "react-native";

export const fontAssets = {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} as const;

const families = {
  400: "Cairo_400Regular",
  500: "Cairo_500Medium",
  600: "Cairo_600SemiBold",
  700: "Cairo_700Bold",
  800: "Cairo_800ExtraBold",
} as const;

function weightNumber(weight: TextStyle["fontWeight"]): number {
  if (weight === "bold") return 700;
  if (weight === "normal" || weight === undefined) return 400;
  const value = typeof weight === "number" ? weight : Number(weight);
  return Number.isFinite(value) ? value : 400;
}

/** The Cairo face matching a style's `fontWeight`. */
export function fontFamilyFor(weight: TextStyle["fontWeight"]): string {
  const value = weightNumber(weight);
  if (value >= 800) return families[800];
  if (value >= 700) return families[700];
  if (value >= 600) return families[600];
  if (value >= 500) return families[500];
  return families[400];
}
