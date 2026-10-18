import { Redirect } from "expo-router"

import { useRootStore, useShallow } from "@/stores/useRootStore"

export { ErrorBoundary } from "@/components/ErrorBoundary"

export default function RootIndex() {
  const { hasCompletedOnboarding, isAuthenticated } = useRootStore(
    useShallow((s) => ({
      hasCompletedOnboarding: s.hasCompletedOnboarding,
      isAuthenticated: s.isAuthenticated,
    })),
  )

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />
  }

  if (!isAuthenticated) {
    return <Redirect href={"/(auth)/sign-in" as any} />
  }

  return <Redirect href="/(app)/(tabs)/dashboard" />
}

