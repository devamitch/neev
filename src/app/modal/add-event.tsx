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
import { useScheduleStore, type FunctionCategory } from "@/stores/useScheduleStore"

const CATEGORIES: { key: FunctionCategory; label: string }[] = [
  { key: "celebration", label: "Celebration" },
  { key: "gathering", label: "Family Dinner" },
  { key: "outing", label: "Outing & Picnic" },
  { key: "ritual", label: "Puja / Ritual" },
  { key: "project", label: "Pet & House Project" },
]

export default function AddEventModal() {
  const colors = useColors()
  const addFunction = useScheduleStore((s) => s.addFunction)

  const [title, setTitle] = useState("")
  const [date, setDate] = useState("2026-11-20")
  const [time, setTime] = useState("06:30 PM")
  const [location, setLocation] = useState("Home Courtyard")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<FunctionCategory>("celebration")

  const handleSave = () => {
    if (!title.trim()) return
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    addFunction({
      title: title.trim(),
      date,
      time,
      location: location.trim() || "Family Sanctuary",
      description: description.trim() || "Multigenerational family gathering.",
      category,
      reminderSet: true,
      tasks: [
        { id: `t-${Date.now()}-1`, title: "Coordinate attendance & transport", assignedToMemberId: "m-3", isDone: false },
        { id: `t-${Date.now()}-2`, title: "Prepare refreshments & seating for elders", assignedToMemberId: "m-4", isDone: false },
      ],
    })
    router.back()
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
          label="Function or Ritual Title"
          placeholder="e.g. Dadu's Golden Anniversary, Diwali Puja"
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

        <AppButton
          title="Save Function to Family Calendar"
          variant="primary"
          onPress={handleSave}
          disabled={!title.trim()}
          style={{ marginTop: 24, marginBottom: 40 }}
        />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
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
