import { useRouter, useLocalSearchParams } from "expo-router"
import React, { useEffect, useRef } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import { AppText } from "@/components/ui/AppText"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { useTheme } from "@/theme/useTheme"

export default function AuthCallbackScreen() {
  const { colors } = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{
    status?: "authorized" | "cancelled" | "error"
    user_id?: string
    display_name?: string
    avatar?: string
    token?: string
    state?: string
    error_message?: string
  }>()

  const handledRef = useRef(false)

  const { handleSetuSsoCallback, isAuthenticated, showToast } = useRootStore(
    useShallow((s) => ({
      handleSetuSsoCallback: s.handleSetuSsoCallback,
      isAuthenticated: s.isAuthenticated,
      showToast: s.showToast,
    })),
  )

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    if (isAuthenticated) {
      router.replace("/(app)/(tabs)/dashboard")
      return
    }

    const status = params.status || "error"

    if (status === "authorized") {
      const ok = handleSetuSsoCallback({
        status: "authorized",
        userId: params.user_id,
        displayName: params.display_name,
        avatar: params.avatar,
        token: params.token,
        state: params.state,
      })

      if (ok) {
        showToast(`Connected with Setu as ${params.display_name || "Setu Explorer"}`, "success")
        router.replace("/(app)/(tabs)/dashboard")
      } else {
        showToast("Setu authentication could not be completed", "error")
        router.replace("/(auth)/sign-in" as any)
      }
    } else if (status === "cancelled") {
      handleSetuSsoCallback({ status: "cancelled", state: params.state })
      showToast("Setu sign-in was cancelled", "info")
      router.replace("/(auth)/sign-in" as any)
    } else {
      handleSetuSsoCallback({
        status: "error",
        state: params.state,
        errorMessage: params.error_message || "Unknown SSO error",
      })
      showToast(params.error_message || "Setu sign-in failed", "error")
      router.replace("/(auth)/sign-in" as any)
    }
  }, [params, handleSetuSsoCallback, router, showToast])

  return (
    <ScreenContainer safeArea>
      <View style={styles.container}>
        <View style={[styles.badge, { backgroundColor: colors.primaryAlpha }]}>
          <NeevLogoIcon size={56} />
        </View>
        <AppText variant="h2" style={styles.title}>
          Connecting with Setu
        </AppText>
        <AppText variant="body" color={colors.text.secondary} style={styles.subtitle}>
          Finishing the link with Setu…
        </AppText>
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 24,
  },
  loader: {
    marginTop: 8,
  },
})
