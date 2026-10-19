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
import { useFamilyNetworkStore, type KinshipType } from "@/stores/useFamilyNetworkStore"
import { familyNetworkService } from "@/services/network/familyNetworkService"
import { useRootStore } from "@/stores/useRootStore"

const ROLES: { key: FamilyRole; label: string; description: string; defaultColor: string }[] = [
  { key: "elder", label: "Elder", description: "Pillar of wisdom & traditions", defaultColor: "#C27835" },
  { key: "parent", label: "Parent", description: "Organizer & protector", defaultColor: "#709758" },
  { key: "youth", label: "Youth & Child", description: "Learner & bright future", defaultColor: "#588D6A" },
  { key: "pet", label: "Pet", description: "Beloved furry companion", defaultColor: "#5A8B49" },
]

const AVATAR_COLORS = ["#709758", "#5A8B49", "#8EB574", "#C27835", "#588D6A", "#789262", "#485642"]

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

  const [selectedRelativeId, setSelectedRelativeId] = useState<string>(members[0]?.id || "")
  const [selectedRelation, setSelectedRelation] = useState<KinshipType>("parent")

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

    selectedClusterIds.forEach((clusterId) => {
      assignMemberToCluster(clusterId, newMemberId)
    })

    if (!hasPhone) {
      const inv = createInvitation(name.trim(), "Sanctuary Circle")
      void familyNetworkService.syncInvitation(inv)

      showAlert({
        title: "Sanctuary Profile Created",
        message: `${name} has been welcomed to the family graph.\n\nClaim Code:\n${inv.inviteCode}\n\nThey or a trusted guardian can claim this profile at any time.`,
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
    <ScreenContainer
      safeArea
      scrollable
      header={
        <AppHeader
          title="Welcome Family Member"
          subtitle="Multi-Generational Kinship & Clusters"
          showBack
        />
      }
    >
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
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setRole(r.key)
                    setSelectedColor(r.defaultColor)
                  }}
                >
                  <View style={[styles.roleColorDot, { backgroundColor: r.defaultColor, marginRight: 12 }]} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" style={{ fontWeight: "700", color: active ? colors.primary : colors.text.primary }}>
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

        {/* Profile Connection Mode */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            PROFILE ACCESS & CLAIM
          </AppText>
          <View style={styles.phoneModeRow}>
            <PressableScale
              style={[
                styles.modeCard,
                {
                  backgroundColor: !hasPhone ? colors.primaryAlpha : colors.surface2,
                },
              ]}
              onPress={() => {
                void Haptics.selectionAsync()
                setHasPhone(false)
              }}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={!hasPhone ? colors.primary : colors.text.secondary} />
              <AppText variant="caption" style={{ fontWeight: "700", marginTop: 4, color: !hasPhone ? colors.primary : colors.text.primary }}>
                Sanctuary Profile
              </AppText>
              <AppText variant="caption" style={{ color: colors.text.muted, fontSize: 10, textAlign: "center", marginTop: 2 }}>
                For elders or young children
              </AppText>
            </PressableScale>

            <PressableScale
              style={[
                styles.modeCard,
                {
                  backgroundColor: hasPhone ? colors.primaryAlpha : colors.surface2,
                },
              ]}
              onPress={() => {
                void Haptics.selectionAsync()
                setHasPhone(true)
              }}
            >
              <Ionicons name="phone-portrait-outline" size={20} color={hasPhone ? colors.primary : colors.text.secondary} />
              <AppText variant="caption" style={{ fontWeight: "700", marginTop: 4, color: hasPhone ? colors.primary : colors.text.primary }}>
                Mobile Connected
              </AppText>
              <AppText variant="caption" style={{ color: colors.text.muted, fontSize: 10, textAlign: "center", marginTop: 2 }}>
                Direct app invitations
              </AppText>
            </PressableScale>
          </View>

          {hasPhone && (
            <View style={{ marginTop: 12 }}>
              <TextField
                label="Mobile Number (Optional)"
                placeholder="+91 98765 43210"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          )}
        </View>

        {/* Color Palette Selector */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            AVATAR TONE
          </AppText>
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map((c) => {
              const active = selectedColor === c
              return (
                <PressableScale
                  key={c}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    active && styles.colorCircleActive,
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setSelectedColor(c)
                  }}
                />
              )
            })}
          </View>
        </View>

        {/* Superpower or Treat */}
        <TextField
          label={role === "pet" ? "Favorite Treat & Habits" : "Family Superpower & Role"}
          placeholder={role === "pet" ? "Chicken jerky, likes afternoon naps" : "Master storyteller, quick problem solver"}
          value={role === "pet" ? favoriteTreat : superpower}
          onChangeText={role === "pet" ? setFavoriteTreat : setSuperpower}
        />

        <View style={styles.btnWrap}>
          <AppButton
            title={`Welcome ${name.trim() ? name.trim().split(" ")[0] : "Member"} to Sanctuary`}
            variant="primary"
            onPress={handleSave}
            disabled={!name.trim()}
          />
        </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionMargin: {
    marginBottom: 18,
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
    alignItems: "center",
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
    marginTop: 16,
    marginBottom: 24,
  },
})
