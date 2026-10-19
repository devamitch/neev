/**
 * The first screen of a fresh install: sign in with Google or Setu.
 * Both are real providers; there is no guest path. Scans and progress stay on
 * this phone either way, the account only gives them an owner.
 */
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useState, type ReactNode } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import Svg, { Path } from "react-native-svg"

import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import { HeaderBackButton } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { PressableScale } from "@/components/ui/PressableScale"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { SquircleSurface } from "@/components/ui/SquircleSurface"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { useTheme } from "@/theme/useTheme"

type Pending = "google" | "setu" | null

export default function SignInScreen() {
  const { colors } = useTheme()
  const router = useRouter()
  const [pending, setPending] = useState<Pending>(null)

  const { signInWithGoogle, signInWithSetu, openSetuDownload, showAlert, showToast } =
    useRootStore(
      useShallow((s) => ({
        signInWithGoogle: s.signInWithGoogle,
        signInWithSetu: s.signInWithSetu,
        openSetuDownload: s.openSetuDownload,
        showAlert: s.showAlert,
        showToast: s.showToast,
      })),
    )

  const google = async () => {
    setPending("google")
    try {
      const status = await signInWithGoogle()
      if (status === "success") {
        router.replace("/(app)/(tabs)/dashboard")
      } else if (status === "not_configured") {
        showAlert({
          title: "Google sign-in isn't set up",
          message:
            "This build has no Google client ID yet. Continue with Setu, or install a build with Google enabled.",
          confirmText: "OK",
          cancelText: null,
        })
      } else if (status !== "cancelled") {
        showToast(useRootStore.getState().authError || "Google sign-in failed", "error")
      }
    } finally {
      setPending(null)
    }
  }

  const setu = async () => {
    setPending("setu")
    try {
      const result = await signInWithSetu()
      if (result.status === "not_installed") {
        showAlert({
          title: "Get Setu to continue",
          message: "Setu keeps your identity on your phone and approves Neev in one tap.",
          confirmText: "Get Setu",
          cancelText: "Not now",
          onConfirm: () => void openSetuDownload(),
        })
      } else if (result.status === "failed") {
        showToast("Couldn't open Setu", "error")
      }
    } finally {
      setPending(null)
    }
  }

  return (
    <ScreenContainer safeArea scrollable contentContainerStyle={styles.page}>
      {router.canGoBack() ? (
        <View style={styles.back}>
          <HeaderBackButton />
        </View>
      ) : null}

      <View style={styles.hero}>
        <View style={[styles.mascot, { backgroundColor: colors.primaryAlpha }]}>
          <NeevLogoIcon size={56} />
        </View>
        <AppText variant="display" style={styles.center}>
          Neev · नींव
        </AppText>
        <AppText variant="body" color={colors.text.secondary} style={styles.center}>
          The private, AI-guided family operating system for functions, schedules & shared wisdom.
        </AppText>
      </View>

      <View style={styles.actions}>
        <ProviderButton
          label="Continue with Google"
          icon={<GoogleG />}
          busy={pending === "google"}
          disabled={pending !== null}
          onPress={() => void google()}
        />
        <ProviderButton
          label="Continue with Setu"
          icon={<Ionicons name="finger-print-outline" size={20} color={colors.accentText} />}
          busy={pending === "setu"}
          disabled={pending !== null}
          onPress={() => void setu()}
        />
      </View>

      <View style={styles.note}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.text.muted} />
        <AppText variant="caption" style={styles.noteText}>
          Your family data is stored locally on this phone. Zero ads, zero tracking, zero third-party brokers.
        </AppText>
      </View>
    </ScreenContainer>
  )
}

function ProviderButton({
  label,
  icon,
  busy,
  disabled,
  onPress,
}: {
  label: string
  icon: ReactNode
  busy: boolean
  disabled: boolean
  onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      disabledOpacity={busy ? 1 : 0.55}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled }}
    >
      <SquircleSurface radius={16} fill={colors.surface} style={styles.provider}>
        <View style={styles.providerIcon}>{icon}</View>
        <AppText variant="bodyMedium" style={styles.providerLabel}>
          {label}
        </AppText>
        <View style={styles.providerIcon}>
          {busy ? <ActivityIndicator size="small" color={colors.text.secondary} /> : null}
        </View>
      </SquircleSurface>
    </PressableScale>
  )
}

/** The standard four-colour Google "G", as Google's branding guidelines require. */
function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  actions: { gap: 12, marginTop: 36 },
  back: { marginBottom: 8 },
  center: { textAlign: "center" },
  hero: { alignItems: "center", gap: 12 },
  mascot: {
    alignItems: "center",
    borderRadius: 48,
    height: 96,
    justifyContent: "center",
    marginBottom: 8,
    width: 96,
  },
  note: { alignItems: "flex-start", flexDirection: "row", gap: 8, marginTop: 28, paddingHorizontal: 4 },
  noteText: { flex: 1 },
  page: { flexGrow: 1, justifyContent: "center", paddingBottom: 32 },
  provider: { alignItems: "center", flexDirection: "row", minHeight: 56, paddingHorizontal: 18 },
  providerIcon: { alignItems: "center", width: 24 },
  providerLabel: { flex: 1, textAlign: "center" },
})
