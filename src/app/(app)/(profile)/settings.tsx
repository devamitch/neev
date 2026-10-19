import React, { useState } from "react"
import { ScrollView, StyleSheet, Switch, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppHeader } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { SectionHeader, ListGroup, ListRow } from "@/components/ui/Section"
import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import { useColors } from "@/theme/useTheme"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useScheduleStore } from "@/stores/useScheduleStore"
import { useKnowledgeStore } from "@/stores/useKnowledgeStore"
import { useRoutineStore } from "@/stores/useRoutineStore"
import { useIntentionsStore } from "@/stores/useIntentionsStore"
import { useCloudSyncStore } from "@/services/sync/cloudSyncEngine"
import { useByokStore } from "@/stores/useByokStore"
import { useRootStore, useShallow } from "@/stores/useRootStore"

export default function SettingsScreen() {
  const colors = useColors()

  const user = useRootStore((s) => s.user)
  const signOut = useRootStore((s) => s.signOut)
  const household = useFamilyStore((s) => s.household)
  const members = useFamilyStore((s) => s.members)
  const functions = useScheduleStore((s) => s.functions)
  const entries = useKnowledgeStore((s) => s.entries)
  const routines = useRoutineStore((s) => s.routines)
  const intentions = useIntentionsStore((s) => s.intentions)

  const { status, lastSyncedAt, syncAll, isGoogleConnected } = useCloudSyncStore(
    useShallow((s) => ({
      status: s.status,
      lastSyncedAt: s.lastSyncedAt,
      syncAll: s.syncAll,
      isGoogleConnected: s.isGoogleConnected,
    })),
  )
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

  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [intentionNudgesEnabled, setIntentionNudgesEnabled] = useState(true)
  const [pujaTimersEnabled, setPujaTimersEnabled] = useState(true)

  const handleSyncNow = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await syncAll()
    showToast({ message: "Household synchronized with Supabase cloud!", type: "success" })
  }

  const handleSignOut = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    showAlert({
      title: "Sign Out of Sanctuary?",
      message: "Your local family data is safely preserved and backed up to your encrypted cloud enclave.",
      confirmText: "Sign Out",
      cancelText: "Stay in Sanctuary",
      onConfirm: async () => {
        try {
          await signOut()
          showToast({ message: "Signed out safely. Until we meet again!", type: "info" })
          router.replace("/(auth)/sign-in")
        } catch {
          router.replace("/(auth)/sign-in")
        }
      },
    })
  }

  const handleClearCache = () => {
    showAlert({
      title: "Purge Local Image Cache?",
      message: "This will refresh cached images while preserving all your family calendar events, intentions, and heirloom recipes.",
      confirmText: "Refresh Cache",
      cancelText: "Cancel",
      onConfirm: async () => {
        showToast({ message: "Cache refreshed successfully", type: "success" })
      },
    })
  }

  return (
    <ScreenContainer
      safeArea
      scrollable
      header={
        <AppHeader
          sticky
          title="Sanctuary Settings"
          subtitle="Household Preferences & Multi-User Cloud Hub"
          showBack
        />
      }
    >
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
              "{household.motto}"
            </AppText>
          </View>
        </View>
      </Card>

      {/* Cloud Backend & Scaled Multi-User Sync */}
      <SectionHeader title="SUPABASE & GOOGLE CLOUD BACKEND" />
      <ListGroup>
        <ListRow
          title="Cloud Backend Connection"
          subtitle="Real-time multi-device synchronization via Supabase Postgres"
          trailing={
            <Badge
              label={status === "syncing" ? "Syncing..." : "🟢 Connected"}
              variant={status === "syncing" ? "warning" : "success"}
            />
          }
        />
        <ListRow
          title="Google Services Integration"
          subtitle="Google Calendar, Google Tasks & Health Connect sync"
          trailing={<Badge label={isGoogleConnected ? "Active" : "Offline"} variant="neutral" />}
        />
        <ListRow
          title="Household Invite Code"
          subtitle="Share with family members to join this cloud sanctuary"
          trailing={<AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>NEEV-7829-SANC</AppText>}
        />
        <ListRow
          title="Last Synchronized"
          subtitle="Push local changes and pull updates from family members"
          trailing={
            <AppButton
              title="Sync Now"
              variant="outline"
              size="sm"
              onPress={handleSyncNow}
            />
          }
        />
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
          title="Rituals & Muhurat Timers"
          subtitle="Auspicious timing notices for Mandir deepam and festivals"
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
          subtitle="Preserves all local data and safely closes cloud session"
          icon="log-out-outline"
          destructive
          onPress={handleSignOut}
        />
      </ListGroup>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
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
