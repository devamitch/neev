/**
 * Privacy Policy Screen for Neev:
 * Zero-tracking, local-first on-device family sanctuary privacy covenant.
 */
import React from "react"
import { StyleSheet } from "react-native"

import { AppHeader } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { Card } from "@/components/ui/Card"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { useColors } from "@/theme/useTheme"

export default function PrivacyPolicyScreen() {
  const colors = useColors()

  return (
    <ScreenContainer
      safeArea
      scrollable
      header={
        <AppHeader
          sticky
          title="Privacy Policy"
          subtitle="Zero-tracking and on-device family privacy covenant"
          showBack
        />
      }
      contentContainerStyle={styles.scrollContent}
    >
      <Card style={[styles.card, { backgroundColor: colors.surface }]}>
        <AppText variant="heading" style={styles.cardTitle}>
          Neev Privacy Policy
        </AppText>
        <AppText variant="caption" style={styles.dateText}>
          Last Updated: October 2026 · Local-First Edition
        </AppText>

        <AppText variant="subheading" style={styles.sectionHeading}>
          1. Local-First Family Data Storage
        </AppText>
        <AppText variant="body" style={[styles.section, { color: colors.text.secondary }]}>
          Neev is built from the ground up on local-first principles. Your family member directory,
          sacred rituals, function calendars, health notes, and heirloom recipes are stored directly on your
          device using encrypted local storage (SQLite & MMKV).
        </AppText>

        <AppText variant="subheading" style={styles.sectionHeading}>
          2. Zero Third-Party Advertising or Tracking
        </AppText>
        <AppText variant="body" style={[styles.section, { color: colors.text.secondary }]}>
          We believe family sanctity cannot coexist with advertising surveillance. Neev contains zero
          third-party analytics trackers, zero data brokers, and zero marketing SDKs. We do not sell, rent,
          or monetize your family records.
        </AppText>

        <AppText variant="subheading" style={styles.sectionHeading}>
          3. Multigenerational Family Privacy
        </AppText>
        <AppText variant="body" style={[styles.section, { color: colors.text.secondary }]}>
          Elders&apos; medical notes and children&apos;s school schedules remain strictly within your authorized family scope.
          When shared between family devices, data is synchronized through your private Supabase enclave protected by strict Row-Level Security policies.
        </AppText>

        <AppText variant="subheading" style={styles.sectionHeading}>
          4. Complete User Control & Export
        </AppText>
        <AppText variant="body" style={[styles.section, { color: colors.text.secondary }]}>
          You own your family archive. You may export or purge all scheduled functions and heirloom notes at
          any time directly from Sanctuary Settings.
        </AppText>
      </Card>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  card: {
    padding: 20,
    borderRadius: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  dateText: {
    color: "#888",
    marginTop: 4,
    marginBottom: 16,
  },
  sectionHeading: {
    marginTop: 18,
    marginBottom: 6,
    fontSize: 15,
    fontWeight: "700",
  },
  section: {
    lineHeight: 22,
    fontSize: 13,
  },
})
