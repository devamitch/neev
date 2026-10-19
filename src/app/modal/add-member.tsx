import React, { useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppHeader } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { TextField } from "@/components/ui/TextField"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { PressableScale } from "@/components/ui/PressableScale"
import { Badge } from "@/components/ui/Badge"
import { useColors } from "@/theme/useTheme"
import { useFamilyStore, type FamilyRole } from "@/stores/useFamilyStore"
import { useFamilyNetworkStore, type KinshipType, type ClusterType } from "@/stores/useFamilyNetworkStore"
import { familyNetworkService } from "@/services/network/familyNetworkService"
import { useRootStore } from "@/stores/useRootStore"

const ROLES: { key: FamilyRole; label: string; description: string; defaultColor: string }[] = [
  { key: "elder", label: "Elder", description: "Pillar of wisdom & traditions", defaultColor: "#D97706" },
  { key: "parent", label: "Parent", description: "Organizer & protector", defaultColor: "#3B82F6" },
  { key: "youth", label: "Youth & Child", description: "Learner & bright future", defaultColor: "#8B5CF6" },
  { key: "pet", label: "Pet", description: "Beloved furry companion", defaultColor: "#10B981" },
]

const AVATAR_COLORS = ["#D97706", "#C85A32", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#06B6D4"]

const KINSHIP_OPTIONS: { relation: KinshipType; label: string }[] = [
  { relation: "parent", label: "Parent of" },
  { relation: "child", label: "Child of" },
  { relation: "spouse", label: "Spouse / Partner of" },
  { relation: "sibling", label: "Sibling of" },
  { relation: "grandparent", label: "Grandparent of" },
  { relation: "grandchild", label: "Grandchild of" },
  { relation: "in_law", label: "In-law of" },
  { relation: "relative", label: "Relative of" },
]

export default function AddMemberModal() {
  const colors = useColors()
  const members = useFamilyStore((s) => s.members)
  const addMember = useFamilyStore((s) => s.addMember)
  const { clusters, addKinshipEdge, assignMemberToCluster, createInvitation } = useFamilyNetworkStore()
  const showToast = useRootStore((s) => s.showToast)
  const showAlert = useRootStore((s) => s.showAlert)

  const [name, setName] = useState("")
  const [nickname, setNickname] = useState("")
  const [relationship, setRelationship] = useState("Aunt")
  const [role, setRole] = useState<FamilyRole>("elder")
  const [hasPhone, setHasPhone] = useState(false)
  const [phone, setPhone] = useState("")
  const [superpower, setSuperpower] = useState("")
  const [favoriteTreat, setFavoriteTreat] = useState("")
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0])
  const [notes, setNotes] = useState("")

  // Kinship edge state
  const [selectedRelativeId, setSelectedRelativeId] = useState<string>(members[0]?.id || "")
  const [selectedRelation, setSelectedRelation] = useState<KinshipType>("parent")

  // Cluster assignment state
  const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>(
    clusters.filter((c) => c.type === "care_circle" || c.type === "puja_tradition").map((c) => c.id),
  )

  const toggleCluster = (clusterId: string) => {
    void Haptics.selectionAsync()
    setSelectedClusterIds((prev) =>
      prev.includes(clusterId) ? prev.filter((id) => id !== clusterId) : [...prev, clusterId],
    )
  }

  const handleSave = () => {
    if (!name.trim()) {
      showToast({ message: "Please enter the member's full name.", type: "error" })
      return
    }

    const initials =
      name
        .trim()
        .split(" ")
        .map((part) => part[0]?.toUpperCase())
        .filter(Boolean)
        .slice(0, 2)
        .join("") || "N"

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // 1. Add member to Family Store
    const newMemberId = addMember({
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      relationship: relationship.trim() || "Family Member",
      role,
      avatarText: initials,
      avatarColor: selectedColor,
      phone: hasPhone && phone.trim() ? phone.trim() : undefined,
      superpower: superpower.trim() || undefined,
      favoriteTreat: favoriteTreat.trim() || undefined,
      notes: notes.trim() || undefined,
    })

    // 2. Add Kinship Graph Edge if relative selected
    if (selectedRelativeId) {
      const targetRelative = members.find((m) => m.id === selectedRelativeId)
      const relLabel = KINSHIP_OPTIONS.find((k) => k.relation === selectedRelation)?.label || "Relative of"
      addKinshipEdge({
        sourceMemberId: newMemberId,
        targetMemberId: selectedRelativeId,
        relation: selectedRelation,
        label: `${relLabel} ${targetRelative ? targetRelative.name.split(" ")[0] : "Family"}`,
      })
    }

    // 3. Assign to selected clusters
    selectedClusterIds.forEach((clusterId) => {
      assignMemberToCluster(clusterId, newMemberId)
    })

    // 4. If sanctuary profile (no phone), generate private claim code
    if (!hasPhone) {
      const inv = createInvitation(name.trim(), "Sanctuary Circle")
      void familyNetworkService.syncInvitation(inv)

      showAlert({
        title: "Sanctuary Profile Created 🕊️",
        message: `${name} has been welcomed to the family graph without requiring a phone number or app installation.\n\n🔑 One-Time Claim Code:\n${inv.inviteCode}\n\nThey or a trusted guardian can claim this profile at any time.`,
        confirmText: "Copy Code & Continue",
        onConfirm: async () => {
          showToast({ message: `Welcomed ${name} to Family Sanctuary!`, type: "success" })
          router.back()
        },
      })
      return
    }

    showToast({
      message: `Welcomed ${name} to the family sanctuary!`,
      type: "success",
    })
    router.back()
  }

  return (
    <ScreenContainer scrollable={false} style={{ backgroundColor: colors.background }}>
      <AppHeader
        title="Welcome Family Member"
        subtitle="Multi-Generational Kinship & Clusters"
        showBack
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Name Fields */}
        <TextField
          label="Full Name"
          placeholder="e.g. Anandita Sen"
          value={name}
          onChangeText={setName}
        />

        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextField
              label="Calling Name / Nickname"
              placeholder="e.g. Anu, Dadu, Chotu"
              value={nickname}
              onChangeText={setNickname}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <TextField
              label="Kinship Label"
              placeholder="e.g. Aunt, Boroma"
              value={relationship}
              onChangeText={setRelationship}
            />
          </View>
        </View>

        {/* Generational Role Selector */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            GENERATIONAL ROLE
          </AppText>
          <View style={styles.rolesCol}>
            {ROLES.map((r) => {
              const active = role === r.key
              return (
                <PressableScale
                  key={r.key}
                  style={[
                    styles.roleCard,
                    {
                      backgroundColor: active ? colors.primaryAlpha : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setRole(r.key)
                    setSelectedColor(r.defaultColor)
                  }}
                >
                  <View style={[styles.roleColorDot, { backgroundColor: r.defaultColor }]} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <AppText variant="subheading" style={{ fontSize: 15, fontWeight: "700" }}>
                      {r.label}
                    </AppText>
                    <AppText variant="caption" style={{ color: colors.text.secondary }}>
                      {r.description}
                    </AppText>
                  </View>
                </PressableScale>
              )
            })}
          </View>
        </View>

        {/* Sanctuary Profile vs Phone Account Toggle */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            ACCOUNT & PHONE ACCESS (SECTION 45 & 53)
          </AppText>
          <View style={styles.phoneModeRow}>
            <PressableScale
              style={[
                styles.modeCard,
                !hasPhone
                  ? [styles.modeCardActive, { backgroundColor: colors.primaryAlpha, borderColor: colors.primary }]
                  : [styles.modeCardInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
              ]}
              onPress={() => {
                void Haptics.selectionAsync()
                setHasPhone(false)
              }}
            >
              <Ionicons name="sparkles" size={18} color={!hasPhone ? colors.primary : colors.text.muted} />
              <AppText variant="bodyMedium" style={{ fontWeight: "700", marginTop: 4 }}>
                Sanctuary Profile
              </AppText>
              <AppText variant="caption" style={{ color: colors.text.secondary, textAlign: "center" }}>
                No phone required. Ideal for elders, children & pets.
              </AppText>
            </PressableScale>

            <PressableScale
              style={[
                styles.modeCard,
                hasPhone
                  ? [styles.modeCardActive, { backgroundColor: colors.primaryAlpha, borderColor: colors.primary }]
                  : [styles.modeCardInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
              ]}
              onPress={() => {
                void Haptics.selectionAsync()
                setHasPhone(true)
              }}
            >
              <Ionicons name="phone-portrait-outline" size={18} color={hasPhone ? colors.primary : colors.text.muted} />
              <AppText variant="bodyMedium" style={{ fontWeight: "700", marginTop: 4 }}>
                Phone Account
              </AppText>
              <AppText variant="caption" style={{ color: colors.text.secondary, textAlign: "center" }}>
                Active app login with mobile number.
              </AppText>
            </PressableScale>
          </View>

          {hasPhone && (
            <View style={{ marginTop: 12 }}>
              <TextField
                label="Mobile Phone"
                placeholder="+91 98765 43210"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          )}
        </View>

        {/* Kinship Connection to Existing Member */}
        {members.length > 0 && (
          <View style={styles.sectionMargin}>
            <AppText variant="caption" style={styles.label}>
              KINSHIP GRAPH CONNECTION (SECTION 52)
            </AppText>
            <View style={[styles.kinshipBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.kinshipHeaderRow}>
                <Ionicons name="git-branch-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <AppText variant="caption" style={{ fontWeight: "700", color: colors.text.primary }}>
                  Connect to relative in the tree:
                </AppText>
              </View>

              {/* Relative Selector Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {members.map((m) => {
                  const isTarget = selectedRelativeId === m.id
                  return (
                    <PressableScale
                      key={m.id}
                      style={[
                        styles.relativeChip,
                        {
                          backgroundColor: isTarget ? colors.primary : colors.surface2,
                          borderColor: isTarget ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        void Haptics.selectionAsync()
                        setSelectedRelativeId(m.id)
                      }}
                    >
                      <AppText
                        variant="caption"
                        style={{ color: isTarget ? "#FFFFFF" : colors.text.primary, fontWeight: "600" }}
                      >
                        {m.name.split(" ")[0]} ({m.relationship})
                      </AppText>
                    </PressableScale>
                  )
                })}
              </ScrollView>

              {/* Relation Type Chips */}
              <View style={styles.relationGrid}>
                {KINSHIP_OPTIONS.map((k) => {
                  const isRelActive = selectedRelation === k.relation
                  return (
                    <PressableScale
                      key={k.relation}
                      style={[
                        styles.relTypeChip,
                        {
                          backgroundColor: isRelActive ? colors.primaryAlpha : colors.surface2,
                          borderColor: isRelActive ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        void Haptics.selectionAsync()
                        setSelectedRelation(k.relation)
                      }}
                    >
                      <AppText
                        variant="caption"
                        style={{
                          fontSize: 11,
                          color: isRelActive ? colors.primary : colors.text.secondary,
                          fontWeight: isRelActive ? "700" : "500",
                        }}
                      >
                        {k.label}
                      </AppText>
                    </PressableScale>
                  )
                })}
              </View>
            </View>
          </View>
        )}

        {/* Overlapping Cluster Membership */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            FAMILY CLUSTERS (SECTION 47)
          </AppText>
          <AppText variant="caption" style={{ color: colors.text.muted, marginBottom: 8 }}>
            Assign this member to one or more overlapping circles:
          </AppText>

          <View style={styles.clusterGrid}>
            {clusters.map((c) => {
              const isSelected = selectedClusterIds.includes(c.id)
              return (
                <PressableScale
                  key={c.id}
                  style={[
                    styles.clusterCard,
                    {
                      backgroundColor: isSelected ? c.color + "18" : colors.surface,
                      borderColor: isSelected ? c.color : colors.border,
                    },
                  ]}
                  onPress={() => toggleCluster(c.id)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons
                      name={c.icon as any}
                      size={16}
                      color={isSelected ? c.color : colors.text.secondary}
                      style={{ marginRight: 6 }}
                    />
                    <AppText
                      variant="caption"
                      style={{
                        fontWeight: "700",
                        color: isSelected ? c.color : colors.text.primary,
                        flex: 1,
                      }}
                    >
                      {c.name}
                    </AppText>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={16} color={c.color} />
                    )}
                  </View>
                </PressableScale>
              )
            })}
          </View>
        </View>

        {/* Color Palette */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            AVATAR COLOR TONE
          </AppText>
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map((col) => {
              const active = selectedColor === col
              return (
                <PressableScale
                  key={col}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: col },
                    active && styles.colorCircleActive,
                  ]}
                  onPress={() => setSelectedColor(col)}
                />
              )
            })}
          </View>
        </View>

        {/* Superpower & Treats */}
        <TextField
          label="Unique Superpower"
          placeholder="e.g. Calming storyteller, master gardener, math wizard"
          value={superpower}
          onChangeText={setSuperpower}
        />

        <TextField
          label="Favorite Comfort Food / Treat"
          placeholder="e.g. Warm ginger chai, mango kulfi, peanut butter biscuits"
          value={favoriteTreat}
          onChangeText={setFavoriteTreat}
        />

        <TextField
          label="Sanctuary Notes & Traditions"
          placeholder="e.g. Morning walk cadence, likes classical rabindra sangeet"
          value={notes}
          onChangeText={setNotes}
        />

        {/* Save Button */}
        <View style={styles.btnWrap}>
          <AppButton
            title="Welcome to Family Sanctuary"
            onPress={handleSave}
            variant="primary"
            size="large"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  sectionMargin: {
    marginBottom: 20,
  },
  label: {
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
    color: "#8A8A8A",
  },
  rowInputs: {
    flexDirection: "row",
    marginBottom: 16,
  },
  rolesCol: {
    gap: 8,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  roleColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  phoneModeRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
  },
  modeCardActive: {},
  modeCardInactive: {},
  kinshipBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  kinshipHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  chipsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 10,
  },
  relativeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  relationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  relTypeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  clusterGrid: {
    gap: 8,
  },
  clusterCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  colorRow: {
    flexDirection: "row",
    gap: 12,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorCircleActive: {
    borderWidth: 3,
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.15 }],
  },
  btnWrap: {
    marginTop: 20,
  },
})
