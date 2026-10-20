import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useState, type ReactNode } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import { AppBottomSheetModal } from "@/components/ui/AppBottomSheetModal"
import { AppButton } from "@/components/ui/AppButton"
import { HeaderBackButton } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Badge"
import { PressableScale } from "@/components/ui/PressableScale"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { SquircleSurface } from "@/components/ui/SquircleSurface"
import { resetAllToCleanAccount, useRootStore, useShallow } from "@/stores/useRootStore"
import { useTheme } from "@/theme/useTheme"

type Pending = "google" | "setu" | "demo" | "guest" | null

export default function SignInScreen() {
  const { colors } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [pending, setPending] = useState<Pending>(null)
  const [showGoogleDisclosure, setShowGoogleDisclosure] = useState(false)

  const {
    signInWithGoogle,
    signInWithSetu,
    signInAsGuest,
    signInAsDemoUser,
    openSetuDownload,
    showAlert,
    showToast,
  } = useRootStore(
    useShallow((s) => ({
      signInWithGoogle: s.signInWithGoogle,
      signInWithSetu: s.signInWithSetu,
      signInAsGuest: s.signInAsGuest,
      signInAsDemoUser: s.signInAsDemoUser,
      openSetuDownload: s.openSetuDownload,
      showAlert: s.showAlert,
      showToast: s.showToast,
    })),
  )

  const proceedWithGoogleSignIn = async () => {
    setPending("google")
    try {
      const status = await signInWithGoogle()
      setShowGoogleDisclosure(false)
      if (status === "success") {
        router.replace("/(app)/(tabs)/dashboard")
      } else if (status === "not_configured") {
        showAlert({
          title: "Google sign-in isn't set up",
          message:
            "This build has no Google client ID yet. Continue with Guest Mode or Setu.",
          confirmText: "OK",
          cancelText: null,
        })
      } else if (status === "cancelled") {
        showToast("Google sign-in was dismissed or cancelled", "info")
      } else {
        const errorMsg =
          useRootStore.getState().authError ||
          "Google sign-in could not be completed on this device."
        showAlert({
          title: "Google Sign-In",
          message: `${errorMsg}\n\nTip: You can use "Continue as Guest Tester" to test all app features in clean sandbox mode.`,
          confirmText: "OK",
          cancelText: null,
        })
      }
    } catch (e) {
      setShowGoogleDisclosure(false)
      showToast(e instanceof Error ? e.message : "Google sign-in error", "error")
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

  const handleDemo = async () => {
    setPending("demo")
    try {
      await signInAsDemoUser()
      showToast("Welcome to Demo Sanctuary", "success")
      router.replace("/(app)/(tabs)/dashboard")
    } finally {
      setPending(null)
    }
  }

  const handleGuest = async () => {
    setPending("guest")
    try {
      // Clear any prior cached data so the tester starts with a completely clean, isolated state
      resetAllToCleanAccount()
      await signInAsGuest()
      showToast("Entering Clean Guest Sandbox", "info")
      router.replace("/(app)/(tabs)/dashboard")
    } finally {
      setPending(null)
    }
  }

  const handleClearStorage = () => {
    resetAllToCleanAccount()
    showToast("Local Storage (MMKV) Cleared", "success")
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
          Neev
        </AppText>
        <AppText variant="body" color={colors.text.secondary} style={styles.center}>
          The private, AI-guided family operating system for functions, schedules & shared wisdom.
        </AppText>
      </View>

      <View style={styles.actions}>
        {/* Android Tester Priority Flow */}
        <ProviderButton
          label="Continue as Guest Tester"
          subtitle="Clean sandbox · No Google account required · Local isolated storage"
          icon={<Ionicons name="flask-outline" size={22} color={colors.accentText} />}
          busy={pending === "guest"}
          disabled={pending !== null}
          onPress={() => void handleGuest()}
          highlighted
        />

        <ProviderButton
          label="Continue with Google"
          subtitle="Privacy disclosure shown before connecting"
          icon={<GoogleG />}
          busy={pending === "google"}
          disabled={pending !== null}
          onPress={() => setShowGoogleDisclosure(true)}
        />

        <ProviderButton
          label="Continue with Setu"
          subtitle="On-device decentralized SSO"
          icon={<Ionicons name="finger-print-outline" size={20} color={colors.accentText} />}
          busy={pending === "setu"}
          disabled={pending !== null}
          onPress={() => void setu()}
        />

        <ProviderButton
          label="Try Demo Sanctuary (Sample Data)"
          subtitle="Pre-populated preview with sample family & chores"
          icon={<Ionicons name="play-circle-outline" size={20} color={colors.text.secondary} />}
          busy={pending === "demo"}
          disabled={pending !== null}
          onPress={() => void handleDemo()}
        />
      </View>

      {/* Storage Reset Utility for Android Testers */}
      <View style={styles.testerBar}>
        <PressableScale onPress={handleClearStorage} style={styles.clearStorageBtn}>
          <Ionicons name="trash-bin-outline" size={14} color={colors.text.muted} />
          <AppText variant="caption" style={{ color: colors.text.muted, fontWeight: "600" }}>
            Reset App Storage (MMKV)
          </AppText>
        </PressableScale>
      </View>

      <View style={styles.note}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.text.muted} />
        <AppText variant="caption" style={styles.noteText}>
          Your family data is stored locally on this phone. Zero ads, zero tracking, zero third-party brokers.
        </AppText>
      </View>

      {/* ── Google Sign-In & Privacy Scope Disclosure Modal ── */}
      <AppBottomSheetModal
        visible={showGoogleDisclosure}
        onClose={() => setShowGoogleDisclosure(false)}
        eyebrow="PRIVACY & PERMISSIONS"
        title="Google Account Transparency"
        subtitle="Review what Neev requests before connecting"
      >
        <View style={[styles.disclosureContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
          <View style={[styles.scopeBox, { backgroundColor: colors.surface2 }]}>
            <View style={styles.scopeRow}>
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium" style={{ fontWeight: "700" }}>
                  Basic Profile (Name & Avatar)
                </AppText>
                <AppText variant="caption" color={colors.text.secondary}>
                  OAuth Scope: <AppText variant="caption" style={{ fontFamily: "monospace" }}>profile</AppText>. Used strictly to display your name and avatar to authorized family members.
                </AppText>
              </View>
            </View>

            <View style={styles.scopeRow}>
              <Ionicons name="mail-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium" style={{ fontWeight: "700" }}>
                  Email Address
                </AppText>
                <AppText variant="caption" color={colors.text.secondary}>
                  OAuth Scope: <AppText variant="caption" style={{ fontFamily: "monospace" }}>email</AppText>. Used solely as your unique account identifier.
                </AppText>
              </View>
            </View>
          </View>

          <View style={[styles.guaranteeBox, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              <AppText variant="caption" style={{ fontWeight: "800", color: colors.text.primary }}>
                What Neev NEVER Accesses:
              </AppText>
            </View>
            <AppText variant="caption" color={colors.text.secondary} style={{ lineHeight: 18 }}>
              • Zero access to Google Contacts, Gmail inbox, Drive, or Calendar.{"\n"}
              • No automatic location access (location sharing requires explicit toggle in Family Map).{"\n"}
              • Clean state: New accounts start with zero dummy relatives or pre-seeded records.
            </AppText>
          </View>

          <View style={{ gap: 10, marginTop: 16 }}>
            <AppButton
              title="I Understand & Continue with Google"
              variant="primary"
              loading={pending === "google"}
              disabled={pending !== null}
              onPress={() => void proceedWithGoogleSignIn()}
            />
            <AppButton
              title="Continue as Guest Tester Instead"
              variant="outline"
              disabled={pending !== null}
              onPress={() => {
                setShowGoogleDisclosure(false)
                void handleGuest()
              }}
            />
          </View>
        </View>
      </AppBottomSheetModal>
    </ScreenContainer>
  )
}

function ProviderButton({
  label,
  subtitle,
  icon,
  busy,
  disabled,
  highlighted,
  onPress,
}: {
  label: string
  subtitle?: string
  icon: ReactNode
  busy: boolean
  disabled: boolean
  highlighted?: boolean
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
      <SquircleSurface
        radius={16}
        fill={highlighted ? colors.surface : colors.surface}
        style={[
          styles.provider,
          highlighted && { borderWidth: 1.5, borderColor: colors.primary },
        ]}
      >
        <View style={styles.providerIcon}>{icon}</View>
        <View style={styles.providerTextContainer}>
          <AppText
            variant="bodyMedium"
            style={[
              styles.providerLabel,
              highlighted && { fontWeight: "700", color: colors.text.primary },
            ]}
          >
            {label}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color={colors.text.secondary} numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
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
  actions: { gap: 12, marginTop: 28 },
  back: { marginBottom: 8 },
  center: { textAlign: "center" },
  clearStorageBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  disclosureContent: {
    gap: 12,
    paddingBottom: 16,
    paddingTop: 8,
  },
  guaranteeBox: {
    borderRadius: 14,
    padding: 14,
  },
  hero: { alignItems: "center", gap: 12 },
  mascot: {
    alignItems: "center",
    borderRadius: 48,
    height: 96,
    justifyContent: "center",
    marginBottom: 8,
    width: 96,
  },
  note: { alignItems: "flex-start", flexDirection: "row", gap: 8, marginTop: 20, paddingHorizontal: 4 },
  noteText: { flex: 1 },
  page: { flexGrow: 1, justifyContent: "center", paddingBottom: 32 },
  provider: { alignItems: "center", flexDirection: "row", minHeight: 64, paddingHorizontal: 18, paddingVertical: 10 },
  providerIcon: { alignItems: "center", width: 28 },
  providerLabel: { fontWeight: "600" },
  providerTextContainer: { flex: 1, paddingHorizontal: 12 },
  scopeBox: {
    borderRadius: 14,
    gap: 12,
    padding: 14,
  },
  scopeRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  testerBar: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
})
