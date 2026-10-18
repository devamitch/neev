import React from "react"
import { ScrollView, StyleSheet, View, Linking } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppHeader } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { PressableScale } from "@/components/ui/PressableScale"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { useColors } from "@/theme/useTheme"
import { useTabBarInset } from "@/components/navigation/CustomTabBar"
import { useFamilyStore, type FamilyRole } from "@/stores/useFamilyStore"

export default function FamilyScreen() {
  const colors = useColors()
  const bottomInset = useTabBarInset()
  const { household, members } = useFamilyStore()

  const elders = members.filter((m) => m.role === "elder")
  const parents = members.filter((m) => m.role === "parent")
  const youth = members.filter((m) => m.role === "youth")

  const callMember = (phone?: string) => {
    if (!phone) return
    void Haptics.selectionAsync()
    void Linking.openURL(`tel:${phone}`)
  }

  const renderMemberCard = (m: (typeof members)[0]) => (
    <Card key={m.id} style={[styles.memberCard, { backgroundColor: colors.surface }]}>
      <View style={styles.memberCardTop}>
        <View style={[styles.avatarCircle, { backgroundColor: m.avatarColor }]}>
          <AppText style={styles.avatarText}>{m.avatarText}</AppText>
        </View>

        <View style={styles.memberInfo}>
          <View style={styles.nameRow}>
            <AppText variant="subheading" style={styles.memberName}>
              {m.name}
            </AppText>
            {m.bloodGroup && (
              <View style={[styles.bloodChip, { backgroundColor: "rgba(190, 52, 52, 0.1)" }]}>
                <AppText style={styles.bloodText}>{m.bloodGroup}</AppText>
              </View>
            )}
          </View>
          <AppText variant="caption" style={styles.relationshipText}>
            {m.relationship}
          </AppText>
        </View>

        {m.phone && (
          <PressableScale style={[styles.callBtn, { backgroundColor: colors.primaryAlpha }]} onPress={() => callMember(m.phone)}>
            <Ionicons name="call" size={16} color={colors.primary} />
          </PressableScale>
        )}
      </View>

      {m.notes && (
        <View style={[styles.notesBox, { backgroundColor: colors.surface2 }]}>
          <Ionicons name="information-circle-outline" size={14} color={colors.text.muted} style={{ marginRight: 6 }} />
          <AppText variant="caption" style={styles.notesText}>
            {m.notes}
          </AppText>
        </View>
      )}
    </Card>
  )

  return (
    <ScreenContainer scrollable={false} style={{ backgroundColor: colors.background }}>
      <AppHeader
        title="Family Sanctuary"
        subtitle={`${members.length} Multigenerational Members`}
        showBack={false}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Household Sanctuary Card */}
        <Card style={[styles.householdCard, { backgroundColor: colors.surface }]}>
          <View style={styles.householdIconRow}>
            <View style={[styles.shieldIcon, { backgroundColor: colors.primaryAlpha }]}>
              <Ionicons name="home" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="subheading" style={styles.householdName}>
                {household.name}
              </AppText>
              <AppText variant="caption" style={{ color: colors.text.muted }}>
                {household.city} · Est. {household.establishedYear}
              </AppText>
            </View>
          </View>
          <AppText variant="body" style={styles.householdMotto}>
            "{household.motto}"
          </AppText>
        </Card>

        {/* ── Elders Section ── */}
        <View style={styles.sectionHeader}>
          <AppText variant="subheading" style={styles.sectionTitle}>
            Elders & Guardians ({elders.length})
          </AppText>
          <Badge label="Pillars of Wisdom" tone="warning" size="small" />
        </View>
        <View style={styles.membersList}>{elders.map(renderMemberCard)}</View>

        {/* ── Parents Section ── */}
        <View style={styles.sectionHeader}>
          <AppText variant="subheading" style={styles.sectionTitle}>
            Parents & Organizers ({parents.length})
          </AppText>
          <Badge label="Sanctuary Keepers" tone="info" size="small" />
        </View>
        <View style={styles.membersList}>{parents.map(renderMemberCard)}</View>

        {/* ── Youth & Children Section ── */}
        <View style={styles.sectionHeader}>
          <AppText variant="subheading" style={styles.sectionTitle}>
            Youth & Next Generation ({youth.length})
          </AppText>
          <Badge label="Heritage Carriers" tone="success" size="small" />
        </View>
        <View style={styles.membersList}>{youth.map(renderMemberCard)}</View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  householdCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
  },
  householdIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  householdName: {
    fontWeight: "700",
    fontSize: 16,
  },
  householdMotto: {
    marginTop: 10,
    fontStyle: "italic",
    color: "#555",
    fontSize: 12.5,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
  },
  membersList: {
    gap: 10,
    marginBottom: 8,
  },
  memberCard: {
    padding: 14,
    borderRadius: 16,
  },
  memberCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberName: {
    fontWeight: "700",
    fontSize: 15,
  },
  bloodChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bloodText: {
    color: "#BE3434",
    fontSize: 10.5,
    fontWeight: "700",
  },
  relationshipText: {
    color: "#666",
    marginTop: 2,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  notesBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  notesText: {
    flex: 1,
    color: "#555",
    fontSize: 11.5,
  },
})
