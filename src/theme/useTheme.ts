import { useMemo } from "react"
import { useColorScheme } from "react-native"

import { useRootStore, useShallow } from "@/stores/useRootStore"

import { colorsFor, type ThemeColors } from "./setuColors"
import { gradientsFor, type Gradients } from "./setuGradients"
import { SetuRadius, SetuSpacing, SetuTouchTarget } from "./setuSpacing"

export { SetuSpacing, SetuRadius, SetuTouchTarget }
export const spacing = SetuSpacing
export const radius = SetuRadius

export type ThemePreference = "system" | "light" | "dark"

export interface UseThemeResult {
  colors: ThemeColors
  gradients: Gradients
  spacing: typeof SetuSpacing
  radius: typeof SetuRadius
  isDark: boolean
  scheme: "light" | "dark"
  themePreference: ThemePreference
  setThemePreference: (pref: ThemePreference) => void
}

/**
 * BlinkQuest is a light-mode-only app. This function always returns "light"
 * regardless of system preference or stored setting.
 * Per product requirements: "One light theme, everywhere."
 */
function resolveScheme(_pref: ThemePreference, _system: string | null | undefined): "light" | "dark" {
  return "light"
}

/**
 * BlinkQuest theme hook. Supports system, light, and dark schemes.
 * By default uses system preference.
 */
export function useColors(): ThemeColors {
  const themePreference = useRootStore((s) => s.themePreference)
  const system = useColorScheme()
  const scheme = resolveScheme(themePreference as ThemePreference, system)
  return useMemo(() => colorsFor(scheme), [scheme])
}

/**
 * Themed styles factory — creates memoised styles from colors.
 */
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const colors = useColors()
  return useMemo(() => factory(colors), [colors, factory])
}

export function useTheme(): UseThemeResult {
  const { themePreference, setThemePreference } = useRootStore(
    useShallow((s) => ({
      themePreference: s.themePreference,
      setThemePreference: s.setThemePreference,
    })),
  )
  const system = useColorScheme()
  const scheme = resolveScheme(themePreference as ThemePreference, system)
  const colors = useMemo(() => colorsFor(scheme), [scheme])
  const gradients = useMemo(() => gradientsFor(colors), [colors])

  return {
    colors,
    gradients,
    spacing: SetuSpacing,
    radius: SetuRadius,
    isDark: scheme === "dark",
    scheme,
    themePreference: themePreference as ThemePreference,
    setThemePreference,
  }
}
