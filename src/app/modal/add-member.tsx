import React, { useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import * as Haptics from "expo-haptics"

import { AppHeader } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { TextField } from "@/components/ui/TextField"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { PressableScale } from "@/components/ui/PressableScale"
import { useColors } from "@/theme/useTheme"
import { useFamilyStore, type FamilyRole } from "@/stores/useFamilyStore"
import { useRootStore } from "@/stores/useRootStore"

const ROLES: { key: FamilyRole; label: string; description: string; defaultColor: string }[] = [
  { key: "elder", label: "Elder", description: "Pillar of wisdom & traditions", defaultColor: "#D97706" },
  { key: "parent", label: "Parent", description: "Organizer & protector", defaultColor: "#3B82F6" },
  { key: "youth", label: "Youth & Child", description: "Learner & bright future", defaultColor: "#8B5CF6" },
  { key: "pet", label: "Pet", description: "Beloved furry companion", defaultColor: "#10B981" },
]

const AVATAR_COLORS = ["#D97706", "#C85A32", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#06B6D4"]

export default function AddMemberModal() {
  const colors = useColors()
  const addMember = useFamilyStore((s) => s.addMember)
  const showToast = useRootStore((s) => s.showToast)

  const [name, setName] = useState("")
  const [nickname, setNickname] = useState("")
  const [relationship, setRelationship] = useState("Grandmother")
  const [role, setRole] = useState<FamilyRole>("elder")
  const [phone, setPhone] = useState("")
  const [superpower, setSuperpower] = useState("")
  const [favoriteTreat, setFavoriteTreat] = useState("")
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0])
  const [notes, setNotes] = useState("")

  const handleSave = () => {
    if (!name.trim()) {
      showToast({ message: "Please enter the member's full name.", type: "error" })
      return
    }

    const initials = name
      .trim()
      .split(" ")
      .map((part) => part[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "N"

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    addMember({
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      relationship: relationship.trim() || "Family Member",
      role,
      avatarText: initials,
      avatarColor: selectedColor,
      phone: phone.trim() || undefined,
      superpower: superpower.trim() || undefined,
      favoriteTreat: favoriteTreat.trim() || undefined,
      notes: notes.trim() || undefined,
    })

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
        subtitle="Add Multigenerational Member or Pet"
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
              label="Nickname (Calling Name)"
              placeholder="e.g. Anu, Dadu"
              value={nickname}
              onChangeText={setNickname}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <TextField
              label="Relationship"
              placeholder="e.g. Aunt, Sister"
              value={relationship}
              onChangeText={setRelationship}
            />
          </View>
        </View>

        {/* Role Selector */}
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
          label="Favorite Treat / Comfort Food"
          placeholder="e.g. Ginger chai, mango kulfi, chew treats"
          value={favoriteTreat}
          onChangeText={setFavoriteTreat}
        />

        <TextField
          label="Contact Phone (Optional)"
          placeholder="+91 98765 43210"
          value={phone}
          onChangeText={setPhone}
        />

        {/* Save Button */}
        <View style={styles.btnWrap}>
          <AppButton
            title="Save to Family Sanctuary"
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
