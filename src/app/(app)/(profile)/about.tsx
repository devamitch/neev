/**
 * About Screen for Neev:
 * Application information, serene emblem, local-first family manifesto, and architectural credits.
 */
import React from "react"
import { StyleSheet, View } from "react-native"

import { AppHeader } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import { CONFIG } from "@/constants/config"
import { useColors } from "@/theme/useTheme"

export default function AboutScreen() {
  const colors = useColors()

  return (
    <ScreenContainer
      safeArea
      scrollable
      header={
        <AppHeader
          sticky
          title="About Neev"
          subtitle="Family Sanctuary Operating System"
          showBack
        />
      }
      contentContainerStyle={styles.scrollContent}
    >
      {/* Brand Hero Card */}
      <Card style={[styles.brandHeroCard, { backgroundColor: colors.surface }]}>
        <View style={styles.logoWrap}>
          <NeevLogoIcon size={80} />
        </View>
        <AppText variant="h1" style={styles.brandTitle}>
          Neev · नींव
        </AppText>
        <AppText variant="caption" style={[styles.tagline, { color: colors.primary }]}>
          ONE APP · EVERY ROLE · EVERY STAGE
        </AppText>
        <AppText variant="caption" style={styles.versionText}>
          Version {CONFIG.VERSION} · Production Release
        </AppText>
        <AppText variant="body" style={[styles.description, { color: colors.text.secondary }]}>
          Neev is a private, AI-guided family operating system built for households who take their
          responsibilities seriously. Like a wise elder who sees everything, says only what matters, and never judges.
        </AppText>
      </Card>

      {/* Local-First Sanctuary Manifesto */}
      <Card style={[styles.manifestoCard, { backgroundColor: colors.surface }]}>
        <View style={styles.manifestoHeader}>
          <Badge label="LOCAL-FIRST PRIVACY" tone="success" size="small" />
        </View>
        <AppText variant="subheading" style={styles.manifestoTitle}>
          The Family Sanctuary Covenant
        </AppText>
        <AppText variant="body" style={[styles.manifestoBody, { color: colors.text.secondary }]}>
          • <AppText style={{ fontWeight: "700" }}>Zero Data Monetization:</AppText> Family calendars, memories, health records, and recipes belong exclusively to your household.
        </AppText>
        <AppText variant="body" style={[styles.manifestoBody, { color: colors.text.secondary }]}>
          • <AppText style={{ fontWeight: "700" }}>Multigenerational Inclusion:</AppText> Respectful interfaces tailored for grandparents, parents, and youth.
        </AppText>
        <AppText variant="body" style={[styles.manifestoBody, { color: colors.text.secondary }]}>
          • <AppText style={{ fontWeight: "700" }}>Offline Resilience:</AppText> Works flawlessly without internet via local SQLite database synchronization.
        </AppText>
      </Card>

      {/* Ecosystem Family Credit */}
      <Card style={[styles.creditCard, { backgroundColor: colors.surface2 }]}>
        <AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>
          ECOSYSTEM FAMILY
        </AppText>
        <AppText variant="body" style={{ marginTop: 4, color: colors.text.secondary }}>
          Part of the <AppText style={{ fontWeight: "700" }}>Setu</AppText> and <AppText style={{ fontWeight: "700" }}>BlinkQuest</AppText> local-first software group. Built with pride for multigenerational families.
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
    gap: 16,
  },
  brandHeroCard: {
    alignItems: "center",
    padding: 24,
    borderRadius: 24,
  },
  logoWrap: {
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 6,
  },
  versionText: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
    marginBottom: 14,
  },
  description: {
    textAlign: "center",
    lineHeight: 22,
    fontSize: 13.5,
  },
  manifestoCard: {
    padding: 20,
    borderRadius: 20,
    gap: 10,
  },
  manifestoHeader: {
    flexDirection: "row",
  },
  manifestoTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  manifestoBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  creditCard: {
    padding: 16,
    borderRadius: 16,
  },
})
