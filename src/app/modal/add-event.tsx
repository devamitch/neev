import React, { useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import * as Haptics from "expo-haptics"
import { Ionicons } from "@expo/vector-icons"

import { AppHeader } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { TextField } from "@/components/ui/TextField"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { PressableScale } from "@/components/ui/PressableScale"
import { useColors } from "@/theme/useTheme"
import { useScheduleStore, type FunctionCategory } from "@/stores/useScheduleStore"

import { useFamilyStore } from "@/stores/useFamilyStore"
import { toLocalDateInput } from "@/utils/textUtils"

const CATEGORIES: { key: FunctionCategory; label: string }[] = [
  { key: "celebration", label: "Celebration" },
  { key: "gathering", label: "Family Dinner" },
  { key: "outing", label: "Outing & Picnic" },
  { key: "ritual", label: "Tradition / Milestone" },
  { key: "project", label: "Pet & House Project" },
]

export default function AddEventModal() {
  const colors = useColors()
  const addFunction = useScheduleStore((s) => s.addFunction)
  const members = useFamilyStore((s) => s.members)

  const [title, setTitle] = useState("")
  const [date, setDate] = useState(() => toLocalDateInput())
  const [time, setTime] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<FunctionCategory>("celebration")
  const [isSaving, setIsSaving] = useState(false)
  const [taskTitle, setTaskTitle] = useState("")
  const [selectedAssignee, setSelectedAssignee] = useState<string>(members[0]?.id || "")
  const [customTasks, setCustomTasks] = useState<Array<{ id: string; title: string; assignedToMemberId: string; isDone: boolean }>>([])

  const handleAddTask = () => {
    if (!taskTitle.trim()) return
    setCustomTasks((prev) => [
      ...prev,
      {
        id: `task-${Date.now()}-${prev.length}`,
        title: taskTitle.trim(),
        assignedToMemberId: selectedAssignee,
        isDone: false,
      },
    ])
    setTaskTitle("")
  }

  const handleRemoveTask = (taskId: string) => {
    setCustomTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  const handleSave = () => {
    if (!title.trim() || isSaving) return
    setIsSaving(true)
    try {
      addFunction({
        title: title.trim(),
        date,
        time: time.trim() || "All Day",
        location: location.trim() || "Family Sanctuary",
        description: description.trim() || "Multigenerational family gathering.",
        category,
        reminderSet: true,
        tasks: customTasks,
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.back()
    } catch {
      setIsSaving(false)
    }
  }

  return (
    <ScreenContainer
      safeArea
      scrollable
      header={
        <AppHeader
          title="Schedule Function"
          subtitle="New Multigenerational Event"
          showBack
        />
      }
    >
        <TextField
          label="Event or Celebration Title"
          placeholder="e.g. Golden Anniversary, Family Gathering"
          value={title}
          onChangeText={setTitle}
        />

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
                      backgroundColor: active ? colors.primary : colors.surface2,
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

        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextField label="Date (YYYY-MM-DD)" placeholder="2026-11-20" value={date} onChangeText={setDate} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <TextField label="Time" placeholder="06:30 PM" value={time} onChangeText={setTime} />
          </View>
        </View>

        <TextField
          label="Location or Venue"
          placeholder="e.g. Home Mandir, Grand Hall"
          value={location}
          onChangeText={setLocation}
        />

        <TextField
          label="Notes & Arrangements"
          placeholder="Special bhog items, elder seating instructions, dietary preferences..."
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            PREPARATION TASKS (OPTIONAL)
          </AppText>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <TextField
                placeholder="e.g. Bring elder medicine kit, arrange chairs"
                value={taskTitle}
                onChangeText={setTaskTitle}
              />
            </View>
            <AppButton
              title="Add"
              variant="secondary"
              onPress={handleAddTask}
              disabled={!taskTitle.trim()}
              style={{ paddingHorizontal: 16 }}
            />
          </View>
          {customTasks.length > 0 && (
            <View style={{ gap: 6, marginTop: 4 }}>
              {customTasks.map((t) => (
                <View
                  key={t.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: colors.surface2,
                  }}
                >
                  <AppText variant="caption" style={{ flex: 1, color: colors.text.primary }}>
                    {t.title}
                  </AppText>
                  <PressableScale onPress={() => handleRemoveTask(t.id)}>
                    <Ionicons name="close-circle-outline" size={18} color={colors.text.muted} />
                  </PressableScale>
                </View>
              ))}
            </View>
          )}
        </View>

        <AppButton
          title={isSaving ? "Saving..." : "Save Function to Family Calendar"}
          variant="primary"
          onPress={handleSave}
          disabled={!title.trim() || isSaving}
          style={{ marginTop: 24, marginBottom: 40 }}
        />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  sectionMargin: {
    marginVertical: 4,
  },
  label: {
    fontWeight: "700",
    color: "#777",
    marginBottom: 8,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  rowInputs: {
    flexDirection: "row",
  },
})
