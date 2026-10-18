import { Redirect, Stack } from "expo-router"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { useColors } from "@/theme/useTheme"

export { ErrorBoundary } from "@/components/ErrorBoundary"

export default function AuthLayout() {
  const colors = useColors()
  const { hasCompletedOnboarding, isAuthenticated } = useRootStore(
    useShallow((s) => ({
      hasCompletedOnboarding: s.hasCompletedOnboarding,
      isAuthenticated: s.isAuthenticated,
    })),
  )

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/dashboard" />
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="sign-in" />
    </Stack>
  )
}
