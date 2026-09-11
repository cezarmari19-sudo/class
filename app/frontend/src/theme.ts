// Design tokens for ClassLobby - Tactile / Playful LIGHT personality.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FDFBF7",
  onSurface: "#1C1C1E",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1C1C1E",
  surfaceTertiary: "#F1F8E9",
  onSurfaceTertiary: "#2E7D32",
  surfaceInverse: "#1C1C1E",
  onSurfaceInverse: "#FFFFFF",
  muted: "#757575",

  brand: "#00E676",
  onBrand: "#1C1C1E",
  brandPrimary: "#00C853",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FFD600",
  onBrandSecondary: "#1C1C1E",
  brandTertiary: "#B9F6CA",
  onBrandTertiary: "#1C1C1E",

  success: "#00C853",
  onSuccess: "#FFFFFF",
  warning: "#FFD600",
  onWarning: "#1C1C1E",
  error: "#D50000",
  onError: "#FFFFFF",
  info: "#00BFA5",
  onInfo: "#FFFFFF",

  border: "#E0E0E0",
  borderStrong: "#BDBDBD",
  divider: "#EEEEEE",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme as Parameters<typeof Appearance.setColorScheme>[0]);
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system === "light" || system === "dark" ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const colors = light;
