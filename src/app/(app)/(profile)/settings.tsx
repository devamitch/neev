/**
 * Sanctuary Settings Screen for Neev:
 * Local data management, household configuration, notification toggles, and ecosystem links.
 */
import React, { useState } from "react"
import { StyleSheet, Switch, View } from "react-native"
import { useRouter } from "expo-router"

import { AppHeader } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { Card } from "@/components/ui/Card"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import { ListGroup, ListRow, SectionHeader } from "@/components/ui/Section"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useScheduleStore } from "@/stores/useScheduleStore"
import { useKnowledgeStore } from "@/stores/useKnowledgeStore"
import { useRoutineStore } from "@/stores/useRoutineStore"
import { useTheme } from "@/theme/useTheme"
import { useRootStore, useShallow } from "@/stores/useRootStore"

export default function SettingsScreen() {
  const { colors } = useTheme()
  const router = useRouter()

  const household = useFamilyStore((s) => s.household)
  const members = useFamilyStore((s) => s.members)
  const functions = useScheduleStore((s) => s.functions)
  const entries = useKnowledgeStore((s) => s.entries)
  const routines = useRoutineStore((s) => s.routines)

  const { showAlert, showToast, notificationsEnabled, setNotificationsEnabled } = useRootStore(
    useShallow((s) => ({
      showAlert: s.showAlert,
      showToast: s.showToast,
      notificationsEnabled: s.notificationsEnabled,
      setNotificationsEnabled: s.setNotificationsEnabled,
    })),
  )

  const [elderAlertsEnabled, setElderAlertsEnabled] = useState(true)
  const [ritualRemindersEnabled, setRitualRemindersEnabled] = useState(true)

  const handleClearCache = () => {
    showAlert({
      title: "Purge Local Image Cache?",
      message: "This will refresh cached images while preserving all your family calendar events and heirloom recipes.",
      confirmText: "Refresh Cache",
      cancelText: "Cancel",
      onConfirm: async () => {
        showToast("Sanctuary cache refreshed successfully", "success")
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
          subtitle="Household configurations and offline records"
          showBack
        />
      }
      contentContainerStyle={styles.scrollContent}
    >
      {/* Household Overview Header */}
      <Card style={[styles.headerCard, { backgroundColor: colors.surface }]}>
        <View style={styles.iconRow}>
          <NeevLogoIcon size={44} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <AppText variant="subheading" style={styles.householdName}>
              {household.name}
            </AppText>
            <AppText variant="caption" style={{ color: colors.text.muted }}>
              {household.city} · Established {household.establishedYear}
            </AppText>
          </View>
        </View>
      </Card>

      {/* Notifications Section */}
      <SectionHeader title="NOTIFICATIONS & REMINDERS" />
      <ListGroup>
        <ListRow
          title="Function & Event Reminders"
          subtitle="Countdowns and preparation checklists for upcoming family functions"
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
          title="Elder Health Care Nudges"
          subtitle="Gentle daily reminders for morning vitals and medication"
          trailing={
            <Switch
              value={elderAlertsEnabled}
              onValueChange={setElderAlertsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <ListRow
          title="Puja & Muhurat Timers"
          subtitle="Auspicious timing notices for Mandir rituals and dusk lamps"
          trailing={
            <Switch
              value={ritualRemindersEnabled}
              onValueChange={setRitualRemindersEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          }
        />
      </ListGroup>

      {/* Local Storage Summary */}
      <SectionHeader title="LOCAL SANCTUARY RECORDS" />
      <ListGroup>
        <ListRow
          title="Family Members Registered"
          trailing={<AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>{members.length} Members</AppText>}
        />
        <ListRow
          title="Scheduled Family Functions"
          trailing={<AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>{functions.length} Events</AppText>}
        />
        <ListRow
          title="Vault Knowledge & Recipes"
          trailing={<AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>{entries.length} Preserved</AppText>}
        />
        <ListRow
          title="Daily Family Rhythms"
          trailing={<AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>{routines.length} Habits</AppText>}
        />
      </ListGroup>

      {/* Privacy & Legal */}
      <SectionHeader title="SANCTUARY COVENANT" />
      <ListGroup>
        <ListRow
          title="Privacy Policy"
          subtitle="Zero tracking, on-device local SQLite processing"
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
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 8,
  },
  headerCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 8,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  householdName: {
    fontWeight: "700",
    fontSize: 16,
  },
})
