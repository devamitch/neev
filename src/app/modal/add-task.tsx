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
import { useSpacesStore, type SpaceType } from "@/stores/useSpacesStore"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useRootStore } from "@/stores/useRootStore"

const SPACES: { key: SpaceType; label: string; icon: string }[] = [
  { key: "personal", label: "Personal Space (Private)", icon: "lock" },
  { key: "nuclear", label: "Nuclear Space (Home & Kids)", icon: "home" },
  { key: "family", label: "Family Sanctuary (All)", icon: "people" },
]

const CATEGORIES: { key: "school" | "doctor" | "career" | "home" | "ritual"; label: string }[] = [
  { key: "school", label: "Child & School" },
  { key: "doctor", label: "Doctor & Health" },
  { key: "career", label: "Career & Interview" },
  { key: "home", label: "Household & Chores" },
  { key: "ritual", label: "Ritual & Tradition" },
]

const PRIORITIES: { key: "urgent" | "normal" | "low"; label: string; color: string }[] = [
  { key: "urgent", label: "Urgent (Escalating)", color: "#EF4444" },
  { key: "normal", label: "Normal Priority", color: "#3B82F6" },
  { key: "low", label: "Low & Flexible", color: "#10B981" },
]

export default function AddTaskModal() {
  const colors = useColors()
  const { currentSpace, addTask } = useSpacesStore()
  const members = useFamilyStore((s) => s.members)
  const showToast = useRootStore((s) => s.showToast)

  const [title, setTitle] = useState("")
  const [selectedSpace, setSelectedSpace] = useState<SpaceType>(currentSpace)
  const [category, setCategory] = useState<"school" | "doctor" | "career" | "home" | "ritual">("school")
  const [priority, setPriority] = useState<"urgent" | "normal" | "low">("normal")
  const [dueDate, setDueDate] = useState("Today, 05:00 PM")
  const [assignedTo, setAssignedTo] = useState(members[0]?.name || "Me")

  const handleSave = () => {
    if (!title.trim()) {
      showToast({ message: "Please provide a task or milestone title.", type: "error" })
      return
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    addTask({
      title: title.trim(),
      space: selectedSpace,
      category,
      priority,
      dueDate,
      time: "05:00 PM",
      assignedTo,
    })

    showToast({
      message: `Task added to ${selectedSpace.toUpperCase()} space! Reminders active.`,
      type: "success",
    })
    router.back()
  }

  return (
    <ScreenContainer scrollable={false} style={{ backgroundColor: colors.background }}>
      <AppHeader
        title="Add Space Task"
        subtitle="School, Doctor, Career & Family Milestones"
        showBack
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Space Selection */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            TARGET SPACE
          </AppText>
          <View style={styles.pillsCol}>
            {SPACES.map((sp) => {
              const active = selectedSpace === sp.key
              return (
                <PressableScale
                  key={sp.key}
                  style={[
                    styles.spacePill,
                    {
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setSelectedSpace(sp.key)
                  }}
                >
                  <AppText
                    variant="bodyMedium"
                    style={{ color: active ? "#FFFFFF" : colors.text.primary, fontWeight: "600" }}
                  >
                    {sp.label}
                  </AppText>
                </PressableScale>
              )
            })}
          </View>
        </View>

        {/* Task Title */}
        <TextField
          label="Task or Milestone Title"
          placeholder="e.g. Schedule pediatrician vaccine, System Design prep"
          value={title}
          onChangeText={setTitle}
        />

        {/* Category Selection */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            CATEGORY
          </AppText>
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.key
              return (
                <PressableScale
                  key={cat.key}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setCategory(cat.key)
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{ color: active ? "#FFFFFF" : colors.text.secondary, fontWeight: "600" }}
                  >
                    {cat.label}
                  </AppText>
                </PressableScale>
              )
            })}
          </View>
        </View>

        {/* Priority Selection */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            PRIORITY & ESCALATION
          </AppText>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const active = priority === p.key
              return (
                <PressableScale
                  key={p.key}
                  style={[
                    styles.priorityChip,
                    {
                      backgroundColor: active ? p.color : colors.surface,
                      borderColor: active ? p.color : colors.border,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setPriority(p.key)
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{ color: active ? "#FFFFFF" : colors.text.primary, fontWeight: "600" }}
                  >
                    {p.label}
                  </AppText>
                </PressableScale>
              )
            })}
          </View>
        </View>

        {/* Assignee & Due Date */}
        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextField
              label="Assigned To"
              placeholder="Family member"
              value={assignedTo}
              onChangeText={setAssignedTo}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <TextField
              label="Due Date"
              placeholder="e.g. Tomorrow"
              value={dueDate}
              onChangeText={setDueDate}
            />
          </View>
        </View>

        {/* Submit */}
        <View style={styles.btnWrap}>
          <AppButton
            title="Create Space Task"
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
  pillsCol: {
    gap: 8,
  },
  spacePill: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInputs: {
    flexDirection: "row",
    marginBottom: 16,
  },
  btnWrap: {
    marginTop: 20,
  },
})
