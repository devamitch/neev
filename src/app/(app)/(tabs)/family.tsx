import React from "react"
import { Linking, ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

import { AppHeader, HeaderIconButton } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { PressableScale } from "@/components/ui/PressableScale"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { useColors } from "@/theme/useTheme"
import { useTabBarInset } from "@/components/navigation/CustomTabBar"
import { useFamilyStore, type FamilyMember } from "@/stores/useFamilyStore"

export default function FamilyScreen() {
  const colors = useColors()
  const bottomInset = useTabBarInset()
  const household = useFamilyStore((s) => s.household)
  const members = useFamilyStore((s) => s.members)

  const elders = members.filter((m) => m.role === "elder")
  const parents = members.filter((m) => m.role === "parent")
  const youth = members.filter((m) => m.role === "youth")
  const pets = members.filter((m) => m.role === "pet")

  const callMember = (phone?: string) => {
    if (!phone) return
    void Linking.openURL(`tel:${phone}`)
  }

  const renderMemberCard = (m: FamilyMember) => (
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
            {m.nickname && (
              <View style={[styles.nicknameChip, { backgroundColor: colors.primaryAlpha }]}>
                <AppText style={[styles.nicknameText, { color: colors.primary }]}>{m.nickname}</AppText>
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

      {/* Superpower & Favorite Treat */}
      {(m.superpower || m.favoriteTreat) && (
        <View style={styles.traitsBox}>
          {m.superpower && (
            <View style={styles.traitRow}>
              <Ionicons name="sparkles" size={13} color="#D97706" style={{ marginRight: 6 }} />
              <AppText variant="caption" style={{ flex: 1, color: colors.text.secondary }}>
                {m.superpower}
              </AppText>
            </View>
          )}
          {m.favoriteTreat && (
            <View style={[styles.traitRow, { marginTop: 4 }]}>
              <Ionicons name="heart" size={13} color="#C85A32" style={{ marginRight: 6 }} />
              <AppText variant="caption" style={{ flex: 1, color: colors.text.muted }}>
                Favorite: {m.favoriteTreat}
              </AppText>
            </View>
          )}
        </View>
      )}

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
        subtitle={`${members.length} Multigenerational Members & Pets`}
        showBack={false}
        rightAction={
          <HeaderIconButton
            icon="person-add"
            label="Welcome Member"
            onPress={() => router.push("/modal/add-member")}
          />
        }
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
            Elders & Wisdom Keepers ({elders.length})
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

        {/* ── Beloved Pets Section ── */}
        {pets.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <AppText variant="subheading" style={styles.sectionTitle}>
                Beloved Family Pets ({pets.length})
              </AppText>
              <Badge label="Four-Legged Joy" tone="warning" size="small" />
            </View>
            <View style={styles.membersList}>{pets.map(renderMemberCard)}</View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  householdCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  householdIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  shieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  householdName: {
    fontWeight: "700",
  },
  householdMotto: {
    fontStyle: "italic",
    opacity: 0.85,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontWeight: "700",
  },
  membersList: {
    gap: 10,
    marginBottom: 16,
  },
  memberCard: {
    padding: 14,
    borderRadius: 18,
  },
  memberCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
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
  },
  nicknameChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  nicknameText: {
    fontSize: 11,
    fontWeight: "700",
  },
  relationshipText: {
    opacity: 0.7,
    marginTop: 2,
  },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  traitsBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  traitRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  notesBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 10,
    marginTop: 10,
  },
  notesText: {
    flex: 1,
    opacity: 0.8,
  },
})
