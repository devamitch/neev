import React from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppHeader } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { PressableScale } from "@/components/ui/PressableScale"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { SquircleSurface } from "@/components/ui/SquircleSurface"
import { useColors } from "@/theme/useTheme"
import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"

interface QuickActionItem {
  id: string
  title: string
  subtitle: string
  badge: string
  tone: "primary" | "info" | "warning" | "success"
  icon: keyof typeof Ionicons.glyphMap
  route: "/modal/add-event" | "/modal/add-task" | "/modal/add-knowledge" | "/modal/add-member"
  accentColor: string
}

export default function QuickActionModal() {
  const colors = useColors()

  const quickActions: QuickActionItem[] = [
    {
      id: "action-event",
      title: "Schedule Event & Celebration",
      subtitle: "Plan weddings, milestone birthdays, dinners, or outings with task delegations",
      badge: "Calendar & Google Sync",
      tone: "primary",
      icon: "calendar-outline",
      route: "/modal/add-event",
      accentColor: colors.primary,
    },
    {
      id: "action-task",
      title: "Add Space Task & Milestone",
      subtitle: "Child school, doctor visits, career switch plans & escalating reminders",
      badge: "Personal · Nuclear · Family",
      tone: "success",
      icon: "checkbox-outline",
      route: "/modal/add-task",
      accentColor: colors.primary,
    },
    {
      id: "action-knowledge",
      title: "Preserve Heirloom Wisdom",
      subtitle: "Record ancestral recipes, elder life lessons & emergency contacts in vault",
      badge: "Permanent Family Vault",
      tone: "warning",
      icon: "book-outline",
      route: "/modal/add-knowledge",
      accentColor: colors.warning,
    },
    {
      id: "action-member",
      title: "Welcome Family Member or Pet",
      subtitle: "Register grandparents, parents, youth, or pets with their unique superpowers",
      badge: "Multigenerational Sanctuary",
      tone: "info",
      icon: "people-outline",
      route: "/modal/add-member",
      accentColor: colors.accentText,
    },
  ]

  const handleSelectAction = (route: QuickActionItem["route"]) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.replace(route as any)
  }

  return (
    <ScreenContainer
      safeArea
      scrollable
      header={
        <AppHeader
          title="Quick Family Actions"
          subtitle="Sanctuary Hub for Time, Rituals & Memory"
          showBack
        />
      }
    >
        {/* Brand Banner */}
        <Card style={styles.brandBanner}>
          <View style={styles.bannerRow}>
            <NeevLogoIcon size={44} withBackground={false} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <AppText variant="h3" style={{ color: colors.text.primary }}>
                Neev Family OS
              </AppText>
              <AppText variant="caption" style={{ color: colors.text.secondary, marginTop: 2 }}>
                Private, local-first sanctuary for your nuclear and extended family.
              </AppText>
            </View>
          </View>
        </Card>

        {/* Action Cards */}
        <View style={styles.actionsList}>
          {quickActions.map((action) => (
            <PressableScale
              key={action.id}
              style={styles.actionPressable}
              onPress={() => handleSelectAction(action.route)}
            >
              <Card style={styles.actionCard}>
                <View style={styles.actionTop}>
                  <SquircleSurface
                    radius={14}
                    fill={colors.surface2}
                    style={styles.iconSurface}
                  >
                    <Ionicons name={action.icon} size={22} color={action.accentColor} />
                  </SquircleSurface>

                  <View style={styles.badgeWrap}>
                    <Badge label={action.badge} tone={action.tone} size="small" />
                  </View>
                </View>

                <AppText variant="subheading" style={styles.actionTitle}>
                  {action.title}
                </AppText>

                <AppText variant="caption" style={[styles.actionSubtitle, { color: colors.text.secondary }]}>
                  {action.subtitle}
                </AppText>

                <View style={styles.actionFooter}>
                  <AppText variant="label" style={{ color: action.accentColor, fontSize: 13 }}>
                    Continue →
                  </AppText>
                </View>
              </Card>
            </PressableScale>
          ))}
        </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  brandBanner: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionsList: {
    gap: 12,
  },
  actionPressable: {
    width: "100%",
  },
  actionCard: {
    padding: 18,
    borderRadius: 20,
  },
  actionTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  iconSurface: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeWrap: {
    alignItems: "flex-end",
    flexShrink: 0,
  },
  actionTitle: {
    fontWeight: "700",
    marginBottom: 4,
  },
  actionSubtitle: {
    lineHeight: 18,
    marginBottom: 12,
  },
  actionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
})
