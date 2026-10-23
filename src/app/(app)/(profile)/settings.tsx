import React, { useState } from "react"
import { ScrollView, StyleSheet, Switch, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { SanctuaryHeader, SanctuaryLargeTitle } from "@/components/ui/SanctuaryHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { SectionHeader, ListGroup, ListRow } from "@/components/ui/Section"
import { PressableScale } from "@/components/ui/PressableScale"
import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import { ByokModal } from "@/components/settings/ByokModal"
import { useTheme } from "@/theme/useTheme"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useScheduleStore } from "@/stores/useScheduleStore"
import { useKnowledgeStore } from "@/stores/useKnowledgeStore"
import { useRoutineStore } from "@/stores/useRoutineStore"
import { useIntentionsStore } from "@/stores/useIntentionsStore"
import { googleServicesClient } from "@/services/google/googleServicesClient"
import { syncGoogleNow, useGoogleSyncStore } from "@/services/google/googleSyncService"
import { deleteAccountAndData, formatInviteCode, useCloudSyncStore } from "@/services/sync/cloudSyncEngine"
import { useByokStore } from "@/stores/useByokStore"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { useQueryClient } from "@tanstack/react-query"
import { offlineMapTileService } from "@/services/location/offlineMapTileService"

export default function SettingsScreen() {
  const { colors, themePalette, setThemePalette } = useTheme()
  const [byokModalVisible, setByokModalVisible] = useState(false)

  const user = useRootStore((s) => s.user)
  const signOut = useRootStore((s) => s.signOut)
  const household = useFamilyStore((s) => s.household)
  const members = useFamilyStore((s) => s.members)
  const functions = useScheduleStore((s) => s.functions)
  const entries = useKnowledgeStore((s) => s.entries)
  const routines = useRoutineStore((s) => s.routines)
  const intentions = useIntentionsStore((s) => s.intentions)

  const { status, lastSyncedAt, lastError, syncAll, inviteCode, householdAccountCount } = useCloudSyncStore(
    useShallow((s) => ({
      status: s.status,
      lastSyncedAt: s.lastSyncedAt,
      lastError: s.lastError,
      syncAll: s.syncAll,
      inviteCode: s.inviteCode,
      householdAccountCount: s.householdAccountCount,
    })),
  )
  const isGoogleUser = useRootStore((s) => s.user?.provider === "google")
  const [isBackingUp, setIsBackingUp] = useState(false)
  const googleSync = useGoogleSyncStore(
    useShallow((s) => ({
      status: s.status,
      lastSyncedAt: s.lastSyncedAt,
      lastError: s.lastError,
      importedEvents: s.importedEvents,
      importedTasks: s.importedTasks,
    })),
  )

  const handleGoogleSync = async () => {
    if (googleSync.status === "syncing") return
    const res = await syncGoogleNow({ interactive: true })
    showToast({
      message: res.ok ? "Google Calendar & Tasks synced" : res.error || "Couldn't sync with Google",
      type: res.ok ? "success" : "error",
    })
  }

  const handleDriveBackup = async () => {
    if (isBackingUp) return
    setIsBackingUp(true)
    try {
      const state = useRootStore.getState()
      const today = new Date().toISOString().slice(0, 10)
      const res = await googleServicesClient.backupToDrive(`Neev backup ${today}.json`, {
        app: "Neev",
        exportedAt: new Date().toISOString(),
        household: state.household,
        members: state.members,
        functions: state.functions,
        knowledge: state.entries,
        routines: state.routines,
        intentions: state.intentions,
        tasks: state.tasks,
      })
      showToast({
        message: res.success
          ? "Backup saved to your Google Drive"
          : res.reason === "declined"
            ? "Drive access was not granted"
            : "Couldn't save the backup to Google Drive",
        type: res.success ? "success" : "error",
      })
    } finally {
      setIsBackingUp(false)
    }
  }
  const { credentials, deterministicOnlyMode, setDeterministicOnlyMode, testConnection } = useByokStore(
    useShallow((s) => ({
      credentials: s.credentials,
      deterministicOnlyMode: s.deterministicOnlyMode,
      setDeterministicOnlyMode: s.setDeterministicOnlyMode,
      testConnection: s.testConnection,
    })),
  )

  const { showAlert, showToast } = useRootStore(
    useShallow((s) => ({
      showAlert: s.showAlert,
      showToast: s.showToast,
    })),
  )

  const notificationsEnabled = useRootStore((s) => s.notificationsEnabled)
  const setNotificationsEnabled = useRootStore((s) => s.setNotificationsEnabled)
  const intentionNudgesEnabled = useRootStore((s) => s.intentionNudgesEnabled)
  const setIntentionNudgesEnabled = useRootStore((s) => s.setIntentionNudgesEnabled)
  const pujaTimersEnabled = useRootStore((s) => s.pujaTimersEnabled)
  const setPujaTimersEnabled = useRootStore((s) => s.setPujaTimersEnabled)
  const queryClient = useQueryClient()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSyncNow = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      const res = await syncAll()
      if (res.ok) {
        void queryClient.invalidateQueries()
        showToast({ message: "Household synced with the cloud", type: "success" })
      } else {
        showToast({ message: res.error || "Cloud sync could not complete. Working in local mode.", type: "error" })
      }
    } catch (err: any) {
      showToast({ message: err?.message || "Cloud sync interrupted. Working in offline mode.", type: "error" })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDeleteAccount = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    showAlert({
      title: "Delete account permanently?",
      message:
        "This deletes your Neev account and Google access for Neev. If you're the only account in your household, all its members, events, notes and tasks are deleted from the cloud. If others share it, they keep the family data and you're removed. This can't be undone.",
      confirmText: "Delete Forever",
      cancelText: "Cancel",
      onConfirm: async () => {
        const res = await deleteAccountAndData()
        if (!res.ok) {
          showToast({ message: res.error || "Couldn't delete the account.", type: "error" })
          return
        }
        await signOut()
        showToast({ message: "Your account and data were deleted.", type: "info" })
        router.replace("/(auth)/sign-in")
      },
    })
  }

  const handleSignOut = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    showAlert({
      title: "Sign Out of Sanctuary?",
      message:
        useRootStore.getState().user?.provider === "guest"
          ? "You're using Neev without an account. Signing out permanently disconnects this phone from its household unless another family member's device has joined it. Share your invite code first if you want to keep the data."
          : "Your family data stays in your household's cloud and comes back when you sign in again. This phone's copy will be cleared.",
      confirmText: "Sign Out",
      cancelText: "Stay in Sanctuary",
      onConfirm: async () => {
        try {
          await signOut()
          showToast({ message: "Signed out safely. Until we meet again!", type: "info" })
          router.replace("/(auth)/sign-in")
        } catch (err: any) {
          showToast({ message: err?.message || "Sign out could not be completed. Please try again.", type: "error" })
        }
      },
    })
  }

  const handleClearCache = () => {
    showAlert({
      title: "Purge Local Cache?",
      message: "This will refresh cached map tiles, query cache, and temporary responses while safely preserving your family tree, calendar events, intentions, and heirloom notes.",
      confirmText: "Purge Cache",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          offlineMapTileService.clearMapPack()
          queryClient.clear()
          await queryClient.invalidateQueries()
          showToast({ message: "Local cache purged successfully. All storage refreshed.", type: "success" })
        } catch {
          showToast({ message: "Could not purge local cache. Working in standard mode.", type: "error" })
        }
      },
    })
  }

  return (
    <ScreenContainer
      safeArea
      scrollable
      header={
        <SanctuaryHeader
          showBack
          title="Sanctuary Settings"
        />
      }
    >
      <SanctuaryLargeTitle
        title="Sanctuary Settings"
        subtitle="Household Preferences & Multi-User Cloud Hub"
      />
      {/* Active User Account & Profile */}
      <Card level={2} style={styles.accountCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatarBadge, { backgroundColor: colors.surface2 }]}>
            <Ionicons name="person" size={24} color={colors.primary} />
          </View>
          <View style={styles.householdMeta}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText variant="subheading" style={{ fontWeight: "700" }}>
                {user?.displayName || "Family Guardian"}
              </AppText>
              <Badge
                label={user?.provider ? `${user.provider.toUpperCase()} LINKED` : "ACTIVE SESSION"}
                tone="success"
                size="small"
              />
            </View>
            <AppText variant="caption" style={{ color: colors.text.secondary, marginTop: 2 }}>
              {user?.email || "Encrypted Local & Cloud Sync"}
            </AppText>
          </View>
        </View>
      </Card>

      {/* Household Overview Card */}
      <Card level={1} style={styles.householdCard}>
        <View style={styles.cardHeader}>
          <NeevLogoIcon size={38} />
          <View style={styles.householdMeta}>
            <AppText variant="h3">{household.name}</AppText>
            <AppText variant="caption" color={colors.text.secondary}>
              {household.city} · Est. {household.establishedYear}
            </AppText>
            <AppText variant="caption" style={{ fontStyle: "italic", marginTop: 4, color: colors.primary }}>
              &ldquo;{household.motto}&rdquo;
            </AppText>
          </View>
        </View>
      </Card>

      {/* Sanctuary Theme & Color Palette Flow */}
      <SectionHeader title="SANCTUARY THEME & COLOR PALETTE" />
      <View style={styles.themeRow}>
        <PressableScale
          style={[
            styles.themeCard,
            {
              backgroundColor: themePalette === "pista_terracotta" ? colors.surface : colors.surface2,
              borderColor: themePalette === "pista_terracotta" ? "#6B856E" : colors.border,
              borderWidth: themePalette === "pista_terracotta" ? 1.5 : 1,
            },
          ]}
          onPress={() => {
            void Haptics.selectionAsync()
            setThemePalette("pista_terracotta")
            showToast({ message: "Switched to Pista Sanctuary with Terracotta Accent", type: "success" })
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <View style={[styles.paletteSwatch, { backgroundColor: "#6B856E" }]} />
              <View style={[styles.paletteSwatch, { backgroundColor: "#DA7756" }]} />
            </View>
            {themePalette === "pista_terracotta" && (
              <Ionicons name="checkmark-circle" size={18} color="#6B856E" />
            )}
          </View>
          <AppText variant="caption" style={{ fontWeight: "700", marginTop: 8, color: colors.text.primary }}>
            Pista Sanctuary
          </AppText>
          <AppText style={{ fontSize: 11, color: colors.text.muted, marginTop: 2 }}>
            Pista Primary • Terracotta Accent
          </AppText>
        </PressableScale>

        <PressableScale
          style={[
            styles.themeCard,
            {
              backgroundColor: themePalette === "terracotta_pista" ? colors.surface : colors.surface2,
              borderColor: themePalette === "terracotta_pista" ? "#DA7756" : colors.border,
              borderWidth: themePalette === "terracotta_pista" ? 1.5 : 1,
            },
          ]}
          onPress={() => {
            void Haptics.selectionAsync()
            setThemePalette("terracotta_pista")
            showToast({ message: "Switched to Terracotta Warmth with Pista Accent", type: "success" })
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <View style={[styles.paletteSwatch, { backgroundColor: "#DA7756" }]} />
              <View style={[styles.paletteSwatch, { backgroundColor: "#6B856E" }]} />
            </View>
            {themePalette === "terracotta_pista" && (
              <Ionicons name="checkmark-circle" size={18} color="#DA7756" />
            )}
          </View>
          <AppText variant="caption" style={{ fontWeight: "700", marginTop: 8, color: colors.text.primary }}>
            Terracotta Warmth
          </AppText>
          <AppText style={{ fontSize: 11, color: colors.text.muted, marginTop: 2 }}>
            Terracotta Primary • Pista Accent
          </AppText>
        </PressableScale>
      </View>

      {/* Cloud Backend & Scaled Multi-User Sync */}
      <SectionHeader title="CLOUD SYNC & GOOGLE SERVICES" />
      <ListGroup>
        <ListRow
          title="Cloud Sync"
          subtitle={
            status === "error"
              ? lastError || "Not connected"
              : lastSyncedAt
                ? `Firebase · last synced ${lastSyncedAt}`
                : "Firebase · real-time across your family's devices"
          }
          trailing={
            <Badge
              label={
                status === "syncing"
                  ? "Syncing..."
                  : status === "connected"
                    ? "Connected"
                    : status === "error"
                      ? "Error"
                      : "Offline"
              }
              variant={status === "connected" ? "success" : status === "error" ? "error" : "warning"}
            />
          }
        />
        <ListRow
          title="Family Household"
          subtitle={
            inviteCode
              ? `${householdAccountCount} account${householdAccountCount === 1 ? "" : "s"} · tap to share or join`
              : "Share an invite code or join your family"
          }
          trailing={
            <AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>
              {formatInviteCode(inviteCode) || "Open"}
            </AppText>
          }
          onPress={() => router.push("/modal/household")}
        />
        <ListRow
          title="Sync Now"
          subtitle="Push local changes and pull updates from family members"
          trailing={
            <AppButton title={isSyncing ? "Syncing..." : "Sync Now"} variant="outline" size="sm" onPress={handleSyncNow} />
          }
        />
        <ListRow
          title="Google Calendar & Tasks"
          subtitle={
            !isGoogleUser
              ? "Sign in with Google to sync Calendar, Tasks, Meet and Drive"
              : googleSync.status === "needs_consent"
                ? "Allow access to sync your calendars and task lists both ways"
                : googleSync.lastError
                  ? googleSync.lastError
                  : googleSync.lastSyncedAt
                    ? `${googleSync.importedEvents} events · ${googleSync.importedTasks} tasks · synced ${googleSync.lastSyncedAt}`
                    : "Two-way sync every 15 minutes and after each change"
          }
          trailing={
            isGoogleUser ? (
              <AppButton
                title={
                  googleSync.status === "syncing"
                    ? "Syncing..."
                    : googleSync.status === "needs_consent"
                      ? "Allow"
                      : "Sync"
                }
                variant="outline"
                size="sm"
                onPress={() => void handleGoogleSync()}
              />
            ) : (
              <Badge label="Google sign-in needed" variant="neutral" />
            )
          }
        />
        {isGoogleUser ? (
          <ListRow
            title="Back up to Google Drive"
            subtitle="Saves your household records as a file only Neev can see in your Drive"
            trailing={
              <AppButton
                title={isBackingUp ? "Saving..." : "Back up"}
                variant="outline"
                size="sm"
                onPress={() => void handleDriveBackup()}
              />
            }
          />
        ) : null}
      </ListGroup>

      {/* AI Engine & Token Optimization (BYOK) */}
      <SectionHeader title="AI ENGINE & TOKEN OPTIMIZATION (BYOK)" />
      <ListGroup>
        <ListRow
          title="100% Deterministic Calculations"
          subtitle="Saves 100% AI tokens using offline mathematical algorithms"
          trailing={
            <Switch
              value={deterministicOnlyMode}
              onValueChange={setDeterministicOnlyMode}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <ListRow
          title="Bring Your Own Key (BYOK)"
          subtitle={
            credentials.length > 0
              ? `${credentials[0].provider.toUpperCase()} (${credentials[0].maskedKey})`
              : "Google Gemini, OpenAI, or Groq API Key"
          }
          onPress={() => setByokModalVisible(true)}
          trailing={
            <Badge
              label={deterministicOnlyMode ? "Offline Math" : credentials.length > 0 ? "Configured" : "Free Default"}
              variant={credentials.length > 0 ? "success" : "neutral"}
            />
          }
        />
      </ListGroup>

      {/* Notifications Section */}
      <SectionHeader title="NOTIFICATIONS & NUDGES" />
      <ListGroup>
        <ListRow
          title="Function & Gathering Alerts"
          subtitle="Countdowns, invitations, and preparation checklists"
          trailing={
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <ListRow
          title="Family Intentions & Milestones"
          subtitle="Cheerful nudges for shared pet projects and weekend bonding"
          trailing={
            <Switch
              value={intentionNudgesEnabled}
              onValueChange={setIntentionNudgesEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <ListRow
          title="Traditions & Event Timers"
          subtitle="Gentle notices for family milestones, traditions, and festivals"
          trailing={
            <Switch
              value={pujaTimersEnabled}
              onValueChange={setPujaTimersEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          }
        />
      </ListGroup>

      {/* Cloud Storage Summary */}
      <SectionHeader title="CLOUD SANCTUARY METRICS" />
      <ListGroup>
        <ListRow
          title="Family Members & Pets"
          trailing={<AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>{members.length} Members</AppText>}
        />
        <ListRow
          title="Scheduled Functions & Outings"
          trailing={<AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>{functions.length} Events</AppText>}
        />
        <ListRow
          title="Active Intentions & Pet Projects"
          trailing={<AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>{intentions.length} Projects</AppText>}
        />
        <ListRow
          title="Vault Knowledge & Heirloom Recipes"
          trailing={<AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>{entries.length} Preserved</AppText>}
        />
        <ListRow
          title="Daily Family Rhythms"
          trailing={<AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>{routines.length} Habits</AppText>}
        />
      </ListGroup>

      {/* Privacy & Legal */}
      {/* Privacy & Legal */}
      <SectionHeader title="SANCTUARY COVENANT" />
      <ListGroup>
        <ListRow
          title="Privacy Policy"
          subtitle="End-to-end encrypted family cloud, zero ad-tracking"
          onPress={() => router.push("/(app)/(profile)/privacy-policy")}
        />
        <ListRow
          title="About Neev OS"
          subtitle="Version 1.0.0 · Ecosystem family architecture"
          onPress={() => router.push("/(app)/(profile)/about")}
        />
        <ListRow
          title="Refresh Cache & Resync"
          onPress={handleClearCache}
        />
      </ListGroup>

      {/* Account & Session Management */}
      <SectionHeader title="ACCOUNT & ENCLAVE SESSION" />
      <ListGroup>
        <ListRow
          title="Sign Out of Sanctuary"
          subtitle="Your household stays in the cloud; this phone's copy is cleared"
          icon="log-out-outline"
          destructive
          onPress={handleSignOut}
        />
        <ListRow
          title="Delete Account & Data"
          subtitle="Permanently deletes your account, your household data and Neev's Google access"
          icon="trash-outline"
          destructive
          onPress={handleDeleteAccount}
        />
      </ListGroup>

      <ByokModal visible={byokModalVisible} onClose={() => setByokModalVisible(false)} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  themeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  themeCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
  },
  paletteSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  accountCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
  },
  householdCard: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 20,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  householdMeta: {
    flex: 1,
  },
})
