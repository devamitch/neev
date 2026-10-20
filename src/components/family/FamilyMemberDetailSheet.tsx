import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import React, { useMemo, useState } from "react"
import { Linking, ScrollView, StyleSheet, View } from "react-native"

import { AppBottomSheetModal } from "@/components/ui/AppBottomSheetModal"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { PressableScale } from "@/components/ui/PressableScale"
import {
  familyLocationService,
  type FamilyLocationData,
} from "@/services/location/familyLocationService"
import { useFamilyNetworkStore } from "@/stores/useFamilyNetworkStore"
import { useFamilyStore, type FamilyMember } from "@/stores/useFamilyStore"
import { useRootStore } from "@/stores/useRootStore"
import { useSpacesStore } from "@/stores/useSpacesStore"
import { useColors } from "@/theme/useTheme"
import { SanctuaryNudgeSheet } from "./SanctuaryNudgeSheet"

export interface FamilyMemberDetailSheetProps {
  visible: boolean
  member: FamilyMember | null
  onClose: () => void
  onFindPhone?: (member: FamilyMember) => void
  onSelectRelative?: (relative: FamilyMember) => void
}

export function FamilyMemberDetailSheet({
  visible,
  member,
  onClose,
  onFindPhone,
  onSelectRelative,
}: FamilyMemberDetailSheetProps) {
  const colors = useColors()
  const members = useFamilyStore((s) => s.members)
  const kinshipEdges = useFamilyNetworkStore((s) => s.kinshipEdges)
  const clusters = useFamilyNetworkStore((s) => s.clusters)
  const createInvitation = useFamilyNetworkStore((s) => s.createInvitation)
  const allTasks = useSpacesStore((s) => s.tasks)
  const toggleTask = useSpacesStore((s) => s.toggleTask)
  const showToast = useRootStore((s) => s.showToast)
  const showAlert = useRootStore((s) => s.showAlert)

  // Live location & telemetry
  const locationData: FamilyLocationData | undefined = useMemo(() => {
    if (!member) return undefined
    return familyLocationService.getMemberLocation(member.id)
  }, [member])

  // Family relationships resolved from graph edges
  const relationships = useMemo(() => {
    if (!member) return { spouses: [], parents: [], children: [], siblings: [], other: [] }

    const spouses: { member: FamilyMember; label: string }[] = []
    const parents: { member: FamilyMember; label: string }[] = []
    const children: { member: FamilyMember; label: string }[] = []
    const other: { member: FamilyMember; label: string }[] = []

    kinshipEdges.forEach((edge) => {
      if (edge.sourceMemberId === member.id) {
        const target = members.find((m) => m.id === edge.targetMemberId)
        if (!target) return
        if (edge.relation === "spouse") {
          spouses.push({ member: target, label: edge.label || "Spouse / Partner" })
        } else if (edge.relation === "parent") {
          children.push({ member: target, label: `Child (${target.name.split(" ")[0]})` })
        } else if (edge.relation === "child") {
          parents.push({ member: target, label: `Parent (${target.name.split(" ")[0]})` })
        } else {
          other.push({ member: target, label: edge.label || edge.relation })
        }
      } else if (edge.targetMemberId === member.id) {
        const source = members.find((m) => m.id === edge.sourceMemberId)
        if (!source) return
        if (edge.relation === "spouse") {
          spouses.push({ member: source, label: edge.label || "Spouse / Partner" })
        } else if (edge.relation === "parent") {
          parents.push({ member: source, label: `Parent (${source.name.split(" ")[0]})` })
        } else if (edge.relation === "child") {
          children.push({ member: source, label: `Child (${source.name.split(" ")[0]})` })
        } else {
          other.push({ member: source, label: edge.label || edge.relation })
        }
      }
    })

    // Compute siblings (share at least one parent)
    const parentIds = parents.map((p) => p.member.id)
    const siblings: { member: FamilyMember; label: string }[] = []
    if (parentIds.length > 0) {
      members.forEach((m) => {
        if (m.id === member.id) return
        const isSibling = kinshipEdges.some(
          (edge) =>
            parentIds.includes(edge.sourceMemberId) &&
            edge.targetMemberId === m.id &&
            edge.relation === "parent",
        )
        if (isSibling && !siblings.some((s) => s.member.id === m.id)) {
          siblings.push({ member: m, label: "Sibling" })
        }
      })
    }

    return { spouses, parents, children, siblings, other }
  }, [member, kinshipEdges, members])

  // Assigned chores
  const memberTasks = useMemo(() => {
    if (!member) return []
    return allTasks.filter(
      (t) =>
        t.assignedTo.includes(member.name) ||
        (member.nickname && t.assignedTo.includes(member.nickname)),
    )
  }, [allTasks, member])

  // Member circles/clusters
  const memberClusters = useMemo(() => {
    if (!member) return []
    return clusters.filter((c) => c.memberIds.includes(member.id))
  }, [clusters, member])

  const [nudgeSheetVisible, setNudgeSheetVisible] = useState(false)

  if (!member) return null

  const handleCall = () => {
    if (!member.phone) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    void Linking.openURL(`tel:${member.phone.replace(/\s+/g, "")}`)
  }

  const handleGoogleMeet = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    void Linking.openURL("https://meet.google.com/new")
  }

  const handleShareInvite = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const inv = createInvitation(member.name)
    showAlert({
      title: "Sanctuary Invitation",
      message: `Share private claim code with ${member.name}:\n\nCode: ${inv.inviteCode}\n\nAllows linking their device privately to this realm.`,
      confirmText: "Copy & Done",
      onConfirm: async () => {
        showToast({ message: "Invite code copied!", type: "success" })
      },
    })
  }

  return (
    <>
      <AppBottomSheetModal
        visible={visible}
        onClose={onClose}
        title={member.name}
        subtitle={member.relationship}
        eyebrow="FAMILY MEMBER PROFILE"
        maxHeight="90%"
      >
        <ScrollView
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          keyboardDismissMode="on-drag"
          style={{ flexShrink: 1 }}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Top Hero Profile Card ── */}
          <View style={[styles.heroRow, { backgroundColor: colors.surface }]}>
            <View style={[styles.avatarCircle, { backgroundColor: member.avatarColor }]}>
              <AppText style={styles.avatarText}>{member.avatarText}</AppText>
              {locationData && (
                <View
                  style={[
                    styles.onlineDot,
                    { backgroundColor: locationData.isOnline ? "#2E7D32" : "#D97706" },
                  ]}
                />
              )}
            </View>

            <View style={styles.heroInfo}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}
              >
                <AppText variant="h3" style={styles.memberNameText}>
                  {member.name}
                </AppText>
                {member.nickname && (
                  <View style={[styles.nicknameBadge, { backgroundColor: colors.primaryAlpha }]}>
                    <AppText style={[styles.nicknameBadgeText, { color: colors.primary }]}>
                      {member.nickname}
                    </AppText>
                  </View>
                )}
              </View>

              <AppText variant="caption" style={{ color: colors.text.secondary, marginTop: 2 }}>
                {member.relationship} ·{" "}
                {member.role === "pet"
                  ? "Beloved Pet"
                  : member.role === "child"
                    ? "Supervised Child"
                    : member.role === "tutor"
                      ? "Home Tutor"
                      : member.role === "caregiver"
                        ? "Family Caregiver"
                        : member.role}
              </AppText>

              {member.phone && (
                <AppText variant="caption" style={{ color: colors.text.muted, marginTop: 2 }}>
                  {member.phone}
                </AppText>
              )}
            </View>
          </View>

          {/* ── Specialized Role & Supervision Card ── */}
          {(member.role === "child" ||
            member.role === "youth" ||
            member.role === "tutor" ||
            member.role === "caregiver" ||
            member.schoolGrade) && (
            <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons
                    name={
                      member.role === "tutor"
                        ? "school-outline"
                        : member.role === "caregiver"
                          ? "heart-outline"
                          : "happy-outline"
                    }
                    size={16}
                    color={colors.primary}
                  />
                  <AppText variant="subheading" style={styles.sectionHeading}>
                    {member.role === "tutor"
                      ? "Home Tutor Details"
                      : member.role === "caregiver"
                        ? "Caregiver Details"
                        : "Child Supervision & Growth"}
                  </AppText>
                </View>
                <Badge
                  label={
                    member.role === "child" || member.role === "youth"
                      ? "Supervised"
                      : "Approved Role"
                  }
                  tone="neutral"
                  size="small"
                />
              </View>

              {member.schoolGrade && (
                <View style={[styles.traitBox, { marginTop: 6 }]}>
                  <Ionicons
                    name="ribbon-outline"
                    size={14}
                    color={colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <AppText variant="caption" style={{ flex: 1, color: colors.text.primary }}>
                    <AppText style={{ fontWeight: "700" }}>School / Grade: </AppText>
                    {member.schoolGrade}
                  </AppText>
                </View>
              )}

              {member.learningGoals && member.learningGoals.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <AppText
                    variant="caption"
                    style={{ fontWeight: "700", color: colors.text.secondary, marginBottom: 4 }}
                  >
                    Learning Goals & Activities:
                  </AppText>
                  {member.learningGoals.map((goal, idx) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 3,
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={12} color={colors.primary} />
                      <AppText variant="caption" style={{ color: colors.text.primary }}>
                        {goal}
                      </AppText>
                    </View>
                  ))}
                </View>
              )}

              {member.subjectsTaught && member.subjectsTaught.length > 0 && (
                <View style={[styles.traitBox, { marginTop: 6 }]}>
                  <Ionicons
                    name="book-outline"
                    size={14}
                    color={colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <AppText variant="caption" style={{ flex: 1, color: colors.text.primary }}>
                    <AppText style={{ fontWeight: "700" }}>Subjects: </AppText>
                    {member.subjectsTaught.join(", ")}
                  </AppText>
                </View>
              )}

              {member.tutoringSchedule && (
                <View style={[styles.traitBox, { marginTop: 6 }]}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <AppText variant="caption" style={{ flex: 1, color: colors.text.primary }}>
                    <AppText style={{ fontWeight: "700" }}>Schedule: </AppText>
                    {member.tutoringSchedule}
                  </AppText>
                </View>
              )}

              {member.careSchedule && (
                <View style={[styles.traitBox, { marginTop: 6 }]}>
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <AppText variant="caption" style={{ flex: 1, color: colors.text.primary }}>
                    <AppText style={{ fontWeight: "700" }}>Care Hours: </AppText>
                    {member.careSchedule}
                  </AppText>
                </View>
              )}
            </Card>
          )}

          {/* ── Primary Quick Actions Row ── */}
          <View style={styles.quickActionsRow}>
            {member.phone ? (
              <PressableScale
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={handleCall}
              >
                <Ionicons name="call" size={16} color="#FFFFFF" />
                <AppText style={styles.actionBtnTextWhite}>Call</AppText>
              </PressableScale>
            ) : (
              <PressableScale
                style={[styles.actionBtn, { backgroundColor: colors.surface2 }]}
                onPress={handleShareInvite}
              >
                <Ionicons name="key-outline" size={16} color={colors.primary} />
                <AppText style={[styles.actionBtnTextPrimary, { color: colors.primary }]}>
                  Share Code
                </AppText>
              </PressableScale>
            )}

            <PressableScale
              style={[
                styles.actionBtn,
                { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={handleGoogleMeet}
            >
              <Ionicons name="videocam" size={16} color={colors.primary} />
              <AppText style={[styles.actionBtnTextPrimary, { color: colors.primary }]}>
                Google Meet
              </AppText>
            </PressableScale>

            <PressableScale
              style={[
                styles.actionBtn,
                { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => setNudgeSheetVisible(true)}
            >
              <Ionicons name="paper-plane-outline" size={16} color="#DA7756" />
              <AppText style={[styles.actionBtnTextPrimary, { color: "#DA7756" }]}>
                Send Nudge
              </AppText>
            </PressableScale>

            {onFindPhone && locationData && (
              <PressableScale
                style={[styles.actionBtn, { backgroundColor: colors.surface2 }]}
                onPress={() => {
                  onClose()
                  onFindPhone(member)
                }}
              >
                <Ionicons name="volume-high" size={16} color="#DA7756" />
                <AppText style={[styles.actionBtnTextPrimary, { color: "#DA7756" }]}>
                  Find Device
                </AppText>
              </PressableScale>
            )}
          </View>

          {/* ── Live Location & Device Telemetry ── */}
          <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <AppText variant="subheading" style={styles.sectionHeading}>
                  Location & Device Status
                </AppText>
              </View>
              <Badge
                label={
                  locationData
                    ? locationData.isOnline
                      ? "Sharing Active"
                      : "Stale Fix"
                    : "Private"
                }
                tone={locationData ? (locationData.isOnline ? "success" : "neutral") : "neutral"}
                size="small"
              />
            </View>

            {locationData ? (
              <>
                <View style={styles.locationDetailRow}>
                  <View style={{ flex: 1 }}>
                    <AppText
                      variant="body"
                      style={{ fontWeight: "700", color: colors.text.primary }}
                    >
                      {locationData.placeName}
                    </AppText>
                    {locationData.roomDetail ? (
                      <AppText
                        variant="caption"
                        style={{ color: colors.text.secondary, marginTop: 2 }}
                      >
                        {locationData.roomDetail} · {locationData.accuracyMeters}m accuracy
                      </AppText>
                    ) : null}
                    <AppText variant="caption" style={{ color: colors.text.muted, marginTop: 2 }}>
                      Updated {locationData.lastUpdated || "recently"}
                    </AppText>
                  </View>
                </View>

                {locationData.batteryLevel !== undefined ? (
                  <View style={[styles.statsGrid, { backgroundColor: colors.surface2 }]}>
                    <View style={styles.statBox}>
                      <Ionicons
                        name={locationData.isCharging ? "battery-charging" : "battery-full"}
                        size={16}
                        color={colors.primary}
                      />
                      <AppText variant="caption" style={styles.statVal}>
                        {locationData.batteryLevel}%
                      </AppText>
                      <AppText style={styles.statLabel}>
                        {locationData.isCharging ? "Charging" : "Battery"}
                      </AppText>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statBox}>
                      <Ionicons name="footsteps-outline" size={16} color="#2E7D32" />
                      <AppText variant="caption" style={styles.statVal}>
                        {locationData.health?.dailySteps?.toLocaleString() || "0"}
                      </AppText>
                      <AppText style={styles.statLabel}>Daily Steps</AppText>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statBox}>
                      <Ionicons name="moon-outline" size={16} color="#6B46C1" />
                      <AppText variant="caption" style={styles.statVal}>
                        {locationData.health?.sleepHours
                          ? `${locationData.health.sleepHours}h`
                          : "N/A"}
                      </AppText>
                      <AppText style={styles.statLabel}>Rest Sleep</AppText>
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={{ paddingVertical: 4 }}>
                <AppText variant="caption" style={{ color: colors.text.secondary, lineHeight: 18 }}>
                  Location sharing is private and managed entirely on this member&apos;s personal
                  device. No active location reports received.
                </AppText>
              </View>
            )}
          </Card>

          {/* ── Kinship & Family Tree Section ── */}
          <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="git-network-outline" size={16} color={colors.primary} />
                <AppText variant="subheading" style={styles.sectionHeading}>
                  Kinship & Family Tree
                </AppText>
              </View>
            </View>

            {/* Spouses */}
            {relationships.spouses.length > 0 && (
              <View style={styles.relationGroup}>
                <AppText style={styles.relationTypeLabel}>SPOUSE & PARTNER</AppText>
                {relationships.spouses.map(({ member: rel, label }) => (
                  <PressableScale
                    key={rel.id}
                    style={[styles.relativeRow, { backgroundColor: colors.surface2 }]}
                    onPress={() => onSelectRelative?.(rel)}
                  >
                    <View style={[styles.relAvatar, { backgroundColor: rel.avatarColor }]}>
                      <AppText style={styles.relAvatarText}>{rel.avatarText}</AppText>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <AppText variant="body" style={{ fontWeight: "700" }}>
                        {rel.name}
                      </AppText>
                      <AppText variant="caption" style={{ color: colors.text.secondary }}>
                        {label}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
                  </PressableScale>
                ))}
              </View>
            )}

            {/* Parents */}
            {relationships.parents.length > 0 && (
              <View style={styles.relationGroup}>
                <AppText style={styles.relationTypeLabel}>PARENTS</AppText>
                {relationships.parents.map(({ member: rel, label }) => (
                  <PressableScale
                    key={rel.id}
                    style={[styles.relativeRow, { backgroundColor: colors.surface2 }]}
                    onPress={() => onSelectRelative?.(rel)}
                  >
                    <View style={[styles.relAvatar, { backgroundColor: rel.avatarColor }]}>
                      <AppText style={styles.relAvatarText}>{rel.avatarText}</AppText>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <AppText variant="body" style={{ fontWeight: "700" }}>
                        {rel.name}
                      </AppText>
                      <AppText variant="caption" style={{ color: colors.text.secondary }}>
                        {rel.relationship} · {label}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
                  </PressableScale>
                ))}
              </View>
            )}

            {/* Children */}
            {relationships.children.length > 0 && (
              <View style={styles.relationGroup}>
                <AppText style={styles.relationTypeLabel}>CHILDREN</AppText>
                {relationships.children.map(({ member: rel, label }) => (
                  <PressableScale
                    key={rel.id}
                    style={[styles.relativeRow, { backgroundColor: colors.surface2 }]}
                    onPress={() => onSelectRelative?.(rel)}
                  >
                    <View style={[styles.relAvatar, { backgroundColor: rel.avatarColor }]}>
                      <AppText style={styles.relAvatarText}>{rel.avatarText}</AppText>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <AppText variant="body" style={{ fontWeight: "700" }}>
                        {rel.name}
                      </AppText>
                      <AppText variant="caption" style={{ color: colors.text.secondary }}>
                        {rel.relationship} · {label}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
                  </PressableScale>
                ))}
              </View>
            )}

            {/* Siblings */}
            {relationships.siblings.length > 0 && (
              <View style={styles.relationGroup}>
                <AppText style={styles.relationTypeLabel}>SIBLINGS</AppText>
                {relationships.siblings.map(({ member: rel, label }) => (
                  <PressableScale
                    key={rel.id}
                    style={[styles.relativeRow, { backgroundColor: colors.surface2 }]}
                    onPress={() => onSelectRelative?.(rel)}
                  >
                    <View style={[styles.relAvatar, { backgroundColor: rel.avatarColor }]}>
                      <AppText style={styles.relAvatarText}>{rel.avatarText}</AppText>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <AppText variant="body" style={{ fontWeight: "700" }}>
                        {rel.name}
                      </AppText>
                      <AppText variant="caption" style={{ color: colors.text.secondary }}>
                        {label}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
                  </PressableScale>
                ))}
              </View>
            )}

            {relationships.spouses.length === 0 &&
              relationships.parents.length === 0 &&
              relationships.children.length === 0 &&
              relationships.siblings.length === 0 && (
                <AppText variant="caption" style={{ color: colors.text.muted, marginTop: 4 }}>
                  No explicit tree edges linked yet. Use &ldquo;Connect Kinship Edge&rdquo; to map
                  relatives.
                </AppText>
              )}
          </Card>

          {/* ── Active Chores & Shared Responsibilities ── */}
          <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="checkmark-done-circle-outline" size={16} color={colors.primary} />
                <AppText variant="subheading" style={styles.sectionHeading}>
                  Assigned Responsibilities ({memberTasks.length})
                </AppText>
              </View>
            </View>

            {memberTasks.length > 0 ? (
              memberTasks.map((t) => (
                <PressableScale
                  key={t.id}
                  style={[
                    styles.taskItemRow,
                    { backgroundColor: t.isCompleted ? colors.surface2 : colors.background },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    toggleTask(t.id)
                  }}
                >
                  <Ionicons
                    name={t.isCompleted ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={t.isCompleted ? "#10B981" : colors.text.muted}
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText
                      variant="body"
                      style={{
                        fontWeight: "600",
                        textDecorationLine: t.isCompleted ? "line-through" : "none",
                        color: t.isCompleted ? colors.text.muted : colors.text.primary,
                      }}
                    >
                      {t.title}
                    </AppText>
                    <AppText
                      variant="caption"
                      style={{ color: colors.text.secondary, marginTop: 2 }}
                    >
                      Due {t.dueDate} · {t.time}
                    </AppText>
                  </View>
                  <Badge
                    label={t.priority.toUpperCase()}
                    tone={t.priority === "urgent" ? "error" : "neutral"}
                    size="small"
                  />
                </PressableScale>
              ))
            ) : (
              <AppText variant="caption" style={{ color: colors.text.muted, marginTop: 4 }}>
                No pending tasks assigned to {member.name.split(" ")[0]} right now.
              </AppText>
            )}
          </Card>

          {/* ── Personal Superpower & Favorite Treat ── */}
          {(member.superpower || member.favoriteTreat || member.notes) && (
            <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons name="heart-outline" size={16} color="#DA7756" />
                  <AppText variant="subheading" style={styles.sectionHeading}>
                    Sanctuary Traits & Notes
                  </AppText>
                </View>
              </View>

              {member.superpower && (
                <View style={styles.traitBox}>
                  <Ionicons name="star" size={14} color="#D97706" style={{ marginRight: 8 }} />
                  <AppText variant="caption" style={{ flex: 1, color: colors.text.primary }}>
                    <AppText style={{ fontWeight: "700" }}>Superpower: </AppText>
                    {member.superpower}
                  </AppText>
                </View>
              )}

              {member.favoriteTreat && (
                <View style={[styles.traitBox, { marginTop: 8 }]}>
                  <Ionicons name="heart" size={14} color="#DA7756" style={{ marginRight: 8 }} />
                  <AppText variant="caption" style={{ flex: 1, color: colors.text.primary }}>
                    <AppText style={{ fontWeight: "700" }}>Favorite Treat: </AppText>
                    {member.favoriteTreat}
                  </AppText>
                </View>
              )}

              {member.notes && (
                <View
                  style={[
                    styles.traitBox,
                    { marginTop: 8, backgroundColor: colors.surface2, borderRadius: 12 },
                  ]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={colors.text.muted}
                    style={{ marginRight: 8 }}
                  />
                  <AppText variant="caption" style={{ flex: 1, color: colors.text.secondary }}>
                    {member.notes}
                  </AppText>
                </View>
              )}
            </Card>
          )}

          {/* ── Family Circles / Clusters ── */}
          {memberClusters.length > 0 && (
            <View style={{ marginTop: 8, marginBottom: 24 }}>
              <AppText style={styles.relationTypeLabel}>BELONGS TO SANCTUARY CIRCLES</AppText>
              <View style={styles.clustersWrap}>
                {memberClusters.map((c) => (
                  <View
                    key={c.id}
                    style={[
                      styles.clusterChip,
                      { backgroundColor: c.color + "15", borderColor: c.color + "40" },
                    ]}
                  >
                    <View style={[styles.clusterDot, { backgroundColor: c.color }]} />
                    <AppText
                      variant="caption"
                      style={{ fontWeight: "700", color: colors.text.primary }}
                    >
                      {c.name}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </AppBottomSheetModal>

      <SanctuaryNudgeSheet
        visible={nudgeSheetVisible}
        onClose={() => setNudgeSheetVisible(false)}
        member={member}
        locationData={locationData}
      />
    </>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 48,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  onlineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    position: "absolute",
    bottom: -2,
    right: -2,
  },
  heroInfo: {
    flex: 1,
    marginLeft: 14,
  },
  memberNameText: {
    fontWeight: "800",
    fontSize: 20,
    letterSpacing: -0.3,
  },
  nicknameBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  nicknameBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 14,
    gap: 6,
  },
  actionBtnTextWhite: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionBtnTextPrimary: {
    fontSize: 14,
    fontWeight: "700",
  },
  sectionCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionHeading: {
    fontWeight: "700",
    fontSize: 15,
  },
  locationDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  statVal: {
    fontWeight: "800",
    fontSize: 13,
    marginTop: 2,
  },
  statLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 1,
  },
  relationGroup: {
    marginTop: 8,
  },
  relationTypeLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#9CA3AF",
    marginBottom: 6,
  },
  relativeRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    marginBottom: 6,
  },
  relAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  relAvatarText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  taskItemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    marginBottom: 6,
  },
  traitBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  clustersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  clusterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  clusterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})
