import { Stack } from "expo-router"

import { useColors } from "@/theme/useTheme"

export { ErrorBoundary } from "@/components/ErrorBoundary"

/**
 * Nested stack for profile & settings flows:
 * Settings, Privacy Policy, and About Neev.
 */
export default function ProfileLayout() {
  const colors = useColors()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="settings" />
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="about" />
    </Stack>
  )
}
