import React, { useState } from "react"
import { Share, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppHeader } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { Card } from "@/components/ui/Card"
import { TextField } from "@/components/ui/TextField"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { formatInviteCode, useCloudSyncStore } from "@/services/sync/cloudSyncEngine"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { useColors } from "@/theme/useTheme"

/** Share this household's invite code, or join another family's household with theirs. */
export default function HouseholdModal() {
  const colors = useColors()
  const showToast = useRootStore((s) => s.showToast)
  const householdName = useRootStore((s) => s.household.name)
  const { status, inviteCode, householdId, accountCount, joinHousehold, lastError } = useCloudSyncStore(
    useShallow((s) => ({
      status: s.status,
      inviteCode: s.inviteCode,
      householdId: s.householdId,
      accountCount: s.householdAccountCount,
      joinHousehold: s.joinHousehold,
      lastError: s.lastError,
    })),
  )
  const [code, setCode] = useState("")
  const [joining, setJoining] = useState(false)

  const shareCode = async () => {
    if (!inviteCode) return
    void Haptics.selectionAsync()
    await Share.share({
      message: `Join ${householdName || "our family"} on Neev.\n\nInvite code: ${formatInviteCode(inviteCode)}\n\nOpen Neev → Family → Join a family, and enter this code.`,
    })
  }

  const handleJoin = async () => {
    if (joining || !code.trim()) return
    setJoining(true)
    try {
      const res = await joinHousehold(code)
      if (res.ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        showToast({ message: "You've joined the family household", type: "success" })
        router.back()
      } else {
        showToast({ message: res.error || "Couldn't join that household", type: "error" })
      }
    } finally {
      setJoining(false)
    }
  }

  return (
    <ScreenContainer
      safeArea
      scrollable
      header={<AppHeader title="Family Household" subtitle="Share or join across devices" showBack />}
    >
      <Card style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="home-outline" size={20} color={colors.primary} />
          <AppText variant="bodyMedium" style={styles.bold}>
            {householdName || "Your household"}
          </AppText>
        </View>
        {householdId ? (
          <>
            <AppText variant="caption" color={colors.text.secondary}>
              {accountCount === 1 ? "1 account" : `${accountCount} accounts`} share this household. Anyone with
              the code below can join and see your family&apos;s members, events, notes and tasks.
            </AppText>
            <AppText variant="h2" style={[styles.code, { color: colors.primary }]}>
              {formatInviteCode(inviteCode)}
            </AppText>
            <AppButton title="Share invite code" variant="primary" onPress={() => void shareCode()} />
          </>
        ) : (
          <AppText variant="caption" color={colors.text.secondary}>
            {status === "error"
              ? `Cloud sync isn't connected: ${lastError || "unknown error"}`
              : "Connecting to the cloud… Sign in with Google or continue without an account to get an invite code."}
          </AppText>
        )}
      </Card>

      <Card style={styles.card}>
        <AppText variant="bodyMedium" style={styles.bold}>
          Join a family
        </AppText>
        <AppText variant="caption" color={colors.text.secondary}>
          Enter the code a family member shared with you. This device switches to their household.
        </AppText>
        <TextField
          label="Invite code"
          placeholder="ABCD-2345"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <AppButton
          title={joining ? "Joining…" : "Join household"}
          variant="outline"
          onPress={() => void handleJoin()}
          disabled={!code.trim() || joining || !householdId}
        />
      </Card>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  bold: { fontWeight: "700" },
  card: { gap: 12, marginBottom: 16 },
  code: { fontWeight: "800", letterSpacing: 4, textAlign: "center", marginVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
})
