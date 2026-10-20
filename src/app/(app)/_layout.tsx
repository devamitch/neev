import { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import { Redirect, Stack } from "expo-router"

import { bootstrapLocalData } from "@/services/bootstrap"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { useColors } from "@/theme/useTheme"

export { ErrorBoundary } from "@/components/ErrorBoundary"

export const unstable_settings = { anchor: "(tabs)" }

export default function AppLayout() {
  const colors = useColors()
  const { hasCompletedOnboarding, isAuthenticated } = useRootStore(
    useShallow((s) => ({
      hasCompletedOnboarding: s.hasCompletedOnboarding,
      isAuthenticated: s.isAuthenticated,
    })),
  )

  useEffect(() => {
    void bootstrapLocalData()
  }, [])

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />
  }

  if (!isAuthenticated) {
    return <Redirect href={"/(auth)/sign-in" as any} />
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(profile)" />
        <Stack.Screen name="map" options={{ animation: "slide_from_bottom" }} />
      </Stack>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
