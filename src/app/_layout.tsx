import { useCallback, useEffect, useRef, useState } from "react"
import { Linking, Platform, StatusBar, StyleSheet } from "react-native"
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router"
import { useFonts } from "@expo-google-fonts/space-grotesk"
import { SystemBars } from "react-native-edge-to-edge"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"

import { ErrorBoundary } from "@/components/ErrorBoundary"
import { AnimatedSplashScreen } from "@/components/splash/AnimatedSplashScreen"
import { CustomAlert } from "@/components/ui/CustomAlert"
import { Toast } from "@/components/ui/Toast"
import { MindfulNotificationBanner } from "@/components/ui/MindfulNotificationBanner"
import { initI18n } from "@/i18n"
import { setuSsoService } from "@/services/auth/setuSsoService"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { customFontsToLoad } from "@/theme/typography"
import { loadDateFnsLocale } from "@/utils/formatDate"
import { QueryProvider } from "@/services/query/queryClient"
import { notificationsService } from "@/services/notifications/notificationsService"

/** Run a splash call without ever letting it throw or reject into the app. */
function safely(run: () => unknown) {
  try {
    Promise.resolve(run()).catch(() => undefined)
  } catch {
    // ignore: the splash is cosmetic, it must never take the app down
  }
}

safely(() => SplashScreen.hide())

if (__DEV__ && Platform.OS !== "web") {
  // Load Reactotron configuration in development. We don't want to
  // include this in our production bundle, so we are using `if (__DEV__)`
  // to only execute this in development.
  require("@/devtools/ReactotronConfig")
}

/** If fonts / i18n never settle, start the app anyway instead of hanging. */
const BOOT_TIMEOUT_MS = 6000
/** Safety net: hide the native splash even if the animated one never reports ready. */
const NATIVE_SPLASH_FALLBACK_MS = 1500

import {
  recordNavigationTransition,
  getPersistedNavigationPath,
  clearCompleteNavigationData,
} from "@/utils/useNavigationPersistence"

function AuthNavigationGuard({ loaded }: { loaded: boolean }) {
  const { hasCompletedOnboarding, isAuthenticated } = useRootStore(
    useShallow((s) => ({
      hasCompletedOnboarding: s.hasCompletedOnboarding,
      isAuthenticated: s.isAuthenticated,
    })),
  )
  const segments = useSegments()
  const router = useRouter()
  const hasRestoredInitialNav = useRef(false)

  useEffect(() => {
    if (!loaded) return

    const topSegment = segments[0] as string | undefined
    const inAuthGroup = topSegment === "(auth)" || topSegment === "auth"
    const inOnboarding = topSegment === "onboarding"

    // 1. Show intro / onboarding sliders first if never completed
    if (!hasCompletedOnboarding) {
      clearCompleteNavigationData()
      if (!inOnboarding) router.replace("/onboarding")
    // 2. Once completed, check if user is signed in
    } else if (!isAuthenticated) {
      clearCompleteNavigationData()
      if (!inAuthGroup) router.replace("/(auth)/sign-in" as any)
    // 3. User is signed in and has completed onboarding -> restore last saved route or go to dashboard
    } else if (inOnboarding || inAuthGroup || !hasRestoredInitialNav.current) {
      hasRestoredInitialNav.current = true
      const savedRoute = getPersistedNavigationPath()
      if (savedRoute && savedRoute !== "/(app)/(tabs)/dashboard") {
        try {
          router.replace(savedRoute as any)
        } catch {
          router.replace("/(app)/(tabs)/dashboard")
        }
      } else {
        router.replace("/(app)/(tabs)/dashboard")
      }
    } else {
      // 4. Save entire navigation path & history stack (Ignite Boilerplate Standard)
      const currentPath = `/${segments.join("/")}`
      recordNavigationTransition(currentPath, segments as string[])
    }
  }, [loaded, hasCompletedOnboarding, isAuthenticated, segments, router])

  useEffect(() => {
    if (!loaded || !isAuthenticated) return

    // Safely register FCM & real push notifications once signed in
    void notificationsService.registerForPushNotificationsAsync()

    // Attach listeners for incoming push messages & deep link navigation
    const cleanup = notificationsService.setupNotificationListeners((route) => {
      try {
        router.push(route as any)
      } catch (err) {
        if (__DEV__) console.warn("[push] navigation failed:", err)
      }
    })

    return cleanup
  }, [loaded, isAuthenticated, router])

  return null
}

export default function Root() {
  const [fontsLoaded, fontError] = useFonts(customFontsToLoad)
  const [isI18nReady, setIsI18nReady] = useState(false)
  const [bootTimedOut, setBootTimedOut] = useState(false)
  const [splashDone, setSplashDone] = useState(false)
  const nativeSplashHiddenRef = useRef(false)

  // MMKV-backed persist hydrates synchronously, so the guards below are stable on first render
  const { hasCompletedOnboarding, isAuthenticated, handleSetuSsoCallback } = useRootStore(
    useShallow((s) => ({
      hasCompletedOnboarding: s.hasCompletedOnboarding,
      isAuthenticated: s.isAuthenticated,
      handleSetuSsoCallback: s.handleSetuSsoCallback,
    })),
  )

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return
      if (url.startsWith("neev://auth/callback") || url.startsWith("blinkquest://auth/callback") || url.includes("/auth/callback?")) {
        const data = setuSsoService.parseCallbackUrl(url)
        handleSetuSsoCallback(data)
      }
    }

    void Linking.getInitialURL().then(handleUrl)
    const sub = Linking.addEventListener("url", (e) => handleUrl(e.url))
    return () => sub.remove()
  }, [handleSetuSsoCallback])

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        await initI18n()
      } catch (e) {
        // Never block startup on translations: fall back to default strings.
        if (__DEV__) console.warn("[boot] i18n init failed", e)
      }
      if (active) setIsI18nReady(true)

      try {
        await loadDateFnsLocale()
      } catch (e) {
        if (__DEV__) console.warn("[boot] date-fns locale failed", e)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setBootTimedOut(true), BOOT_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    // A font failure is not fatal: text falls back to the system font.
    if (fontError && __DEV__) console.warn("[boot] font load failed", fontError)
  }, [fontError])

  const loaded = bootTimedOut || ((fontsLoaded || !!fontError) && isI18nReady)

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHiddenRef.current) return
    nativeSplashHiddenRef.current = true
    safely(() => SplashScreen.hideAsync())
  }, [])

  // The animated splash calls this once its logo is visible, so the native
  // splash hands over with no blank frame. This timer is only a safety net.
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(hideNativeSplash, NATIVE_SPLASH_FALLBACK_MS)
    return () => clearTimeout(t)
  }, [loaded, hideNativeSplash])

  const handleSplashFinish = useCallback(() => setSplashDone(true), [])

  if (!loaded) {
    return null
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider>
          {/* Light theme everywhere: dark status/nav icons. The camera view pushes its own light entry. */}
          <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
          <SystemBars style="dark" />
          <QueryProvider>
            <ErrorBoundary>
              {/*
               * Root stack navigation tree:
               *   onboarding                 first run only
               *   (auth)       Stack         sign-in flow
               *   (app)        Stack         + persistent scanner overlay
               *     (tabs)     Tabs          Home · Activities · [Scan orb] · Discover · You
               *     (games)    Stack         touch games & guided exercises
               */}
              <AuthNavigationGuard loaded={loaded} />
              <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
                <Stack.Screen name="index" />
                <Stack.Screen
                  name="modal/quick-action"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="modal/add-event"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="modal/add-task"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="modal/add-knowledge"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="modal/add-member"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
              </Stack>
            </ErrorBoundary>
          </QueryProvider>
          <CustomAlert />
          <Toast />
          <MindfulNotificationBanner />
          {!splashDone && (
            <AnimatedSplashScreen
              onReady={hideNativeSplash}
              onAnimationFinish={handleSplashFinish}
            />
          )}
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
