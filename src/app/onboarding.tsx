/**
 * Shown once on first launch: intro sliders explaining BlinkQuest, then forwards
 * to auth flow (or dashboard if already signed in).
 */
import { useRouter } from "expo-router"

import { IntroSlider } from "@/components/onboarding/IntroSlider"
import { useRootStore, useShallow } from "@/stores/useRootStore"

export default function OnboardingScreen() {
  const router = useRouter()
  const { setHasCompletedOnboarding, isAuthenticated } = useRootStore(
    useShallow((s) => ({
      setHasCompletedOnboarding: s.setHasCompletedOnboarding,
      isAuthenticated: s.isAuthenticated,
    })),
  )

  const handleFinishIntro = () => {
    setHasCompletedOnboarding(true)
    if (isAuthenticated) {
      router.replace("/(app)/(tabs)/dashboard")
    } else {
      router.replace("/(auth)/sign-in" as any)
    }
  }

  return <IntroSlider onFinishIntro={handleFinishIntro} />
}

