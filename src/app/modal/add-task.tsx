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
import { useSpacesStore, type SpaceType } from "@/stores/useSpacesStore"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useFamilyNetworkStore } from "@/stores/useFamilyNetworkStore"
import { deterministicEngine, type ConstraintTask } from "@/services/engine/deterministicEngine"
import { useRootStore } from "@/stores/useRootStore"
import { toLocalDateInput } from "@/utils/textUtils"

const SPACES: { key: SpaceType; label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
  { key: "personal", label: "Personal Space (Private)", icon: "lock-closed-outline", desc: "Confidential goals & career" },
  { key: "nuclear", label: "Nuclear Space (Home & Kids)", icon: "home-outline", desc: "School, doctor & daily needs" },
  { key: "family", label: "Family Sanctuary (All)", icon: "people-outline", desc: "Grandparents, rituals & pets" },
]

const CATEGORIES: { key: "school" | "doctor" | "career" | "home" | "ritual"; label: string }[] = [
  { key: "school", label: "Child & School" },
  { key: "doctor", label: "Doctor & Health" },
  { key: "career", label: "Career & Interview" },
  { key: "home", label: "Household & Chores" },
  { key: "ritual", label: "Ritual & Tradition" },
]

const DURATIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
  { label: "120 min", value: 120 },
]

export default function AddTaskModal() {
  const colors = useColors()
  const { currentSpace, tasks: allTasks, addTask } = useSpacesStore()
  const members = useFamilyStore((s) => s.members)
  const clusters = useFamilyNetworkStore((s) => s.clusters)
  const showToast = useRootStore((s) => s.showToast)

  const [title, setTitle] = useState("")
  const [selectedSpace, setSelectedSpace] = useState<SpaceType>(currentSpace)
  const [selectedClusterType, setSelectedClusterType] = useState<string>("all")
  const [category, setCategory] = useState<"school" | "doctor" | "career" | "home" | "ritual">("school")
  const [priority, setPriority] = useState<"urgent" | "normal" | "low">("normal")
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [dueDate, setDueDate] = useState(() => toLocalDateInput())
  const [time, setTime] = useState("05:00 PM")
  const [assignedTo, setAssignedTo] = useState(members[0]?.name || "Me")
  const [selectedDepTaskId, setSelectedDepTaskId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const priorities = [
    { key: "urgent" as const, label: "Urgent", color: colors.error, val: 5 },
    { key: "normal" as const, label: "Normal", color: colors.primary, val: 3 },
    { key: "low" as const, label: "Low & Flexible", color: colors.success, val: 1 },
  ]

  // Candidate prerequisite tasks in the same space
  const uncompletedTasksInSpace = allTasks.filter(
    (t) => t.space === selectedSpace && !t.isCompleted,
  )

  // Compute deterministic workload for selected assignee
  const assigneeTasks = allTasks.filter(
    (t) => t.assignedTo.toLowerCase() === assignedTo.toLowerCase() && !t.isCompleted,
  )
  const existingAssigneeMinutes = assigneeTasks.reduce(
    (acc, t) => acc + (t.estimatedMinutes || 45),
    0,
  )
  const totalProjectedMinutes = existingAssigneeMinutes + durationMinutes
  const isOverloaded = totalProjectedMinutes > 360 // > 6 hours per day

  const handleSave = () => {
    if (isSaving) return
    if (!title.trim()) {
      showToast({ message: "Please provide a task or milestone title.", type: "error" })
      return
    }
    setIsSaving(true)
    try {
      if (selectedDepTaskId) {
        const tempTasks: ConstraintTask[] = [
          ...allTasks.map((t) => ({
            id: t.id,
            title: t.title,
            estimatedMinutes: t.estimatedMinutes || 30,
            priority: t.priority === "urgent" ? 5 : t.priority === "normal" ? 3 : 1,
            dependsOn: t.dependsOn || [],
          })),
          {
            id: "temp_new_task",
            title: title.trim(),
            estimatedMinutes: durationMinutes,
            priority: priority === "urgent" ? 5 : priority === "normal" ? 3 : 1,
            dependsOn: [selectedDepTaskId],
          },
        ]

        const analysis = deterministicEngine.analyzeDependencies(tempTasks)
        if (analysis.hasCycles) {
          showToast({
            message: "Circular dependency detected. This prerequisite would cause a deadlock.",
            type: "error",
          })
          return
        }
      }

      const prioVal = priorities.find((p) => p.key === priority)?.val || 3
      const calculatedScore = deterministicEngine.calculatePriorityScore(
        {
          id: "new",
          title: title.trim(),
          estimatedMinutes: durationMinutes,
          priority: prioVal,
          dueAt: new Date().toISOString(),
        },
        selectedDepTaskId ? 1 : 0,
      )

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      addTask({
        title: title.trim(),
        space: selectedSpace,
        category,
        priority,
        dueDate,
        time,
        assignedTo,
        clusterType: selectedClusterType !== "all" ? selectedClusterType : undefined,
        estimatedMinutes: durationMinutes,
        dependsOn: selectedDepTaskId ? [selectedDepTaskId] : undefined,
        priorityScore: calculatedScore,
      })

      showToast({
        message: `Task added to ${selectedSpace.toUpperCase()} space! Priority score: ${calculatedScore}`,
        type: "success",
      })
      router.back()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ScreenContainer
      safeArea
      scrollable
      header={
        <AppHeader
          title="Add Space Plan & Task"
          subtitle="Deterministic Planning & Workload Balancer"
          showBack
        />
      }
    >
        {/* Space Selection */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            TARGET SACRED SPACE
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
                      backgroundColor: active ? colors.primaryAlpha : colors.surface,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setSelectedSpace(sp.key)
                  }}
                >
                  <Ionicons
                    name={sp.icon}
                    size={18}
                    color={active ? colors.primary : colors.text.secondary}
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText
                      variant="body"
                      style={{
                        fontWeight: "700",
                        color: active ? colors.primary : colors.text.primary,
                      }}
                      numberOfLines={1}
                    >
                      {sp.label}
                    </AppText>
                    <AppText variant="caption" style={{ color: colors.text.secondary }}>
                      {sp.desc}
                    </AppText>
                  </View>
                </PressableScale>
              )
            })}
          </View>
        </View>

        {/* Task Title Input */}
        <TextField
          label="Task or Milestone Title"
          placeholder="e.g. Schedule Pediatrician Booster, Submit Project Brief"
          value={title}
          onChangeText={setTitle}
        />

        {/* Category Chips */}
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
                    style={{
                      color: active ? "#FFFFFF" : colors.text.secondary,
                      fontWeight: "600",
                    }}
                  >
                    {cat.label}
                  </AppText>
                </PressableScale>
              )
            })}
          </View>
        </View>

        {/* Priority Selector */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            PRIORITY & ESCALATING NUDGE
          </AppText>
          <View style={styles.priorityRow}>
            {priorities.map((p) => {
              const active = priority === p.key
              return (
                <PressableScale
                  key={p.key}
                  style={[
                    styles.priorityChip,
                    {
                      backgroundColor: active ? p.color : colors.surface2,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setPriority(p.key)
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: active ? "#FFFFFF" : colors.text.primary,
                      fontWeight: "700",
                    }}
                    numberOfLines={1}
                  >
                    {p.label}
                  </AppText>
                </PressableScale>
              )
            })}
          </View>
        </View>

        {/* Estimated Duration */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            ESTIMATED DURATION
          </AppText>
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => {
              const active = durationMinutes === d.value
              return (
                <PressableScale
                  key={d.value}
                  style={[
                    styles.durationChip,
                    {
                      backgroundColor: active ? colors.primary : colors.surface2,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setDurationMinutes(d.value)
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: active ? "#FFFFFF" : colors.text.secondary,
                      fontWeight: "600",
                    }}
                  >
                    {d.label}
                  </AppText>
                </PressableScale>
              )
            })}
          </View>
        </View>

        {/* Workload Telemetry Alert */}
        {isOverloaded && (
          <View style={[styles.workloadAlert, { backgroundColor: colors.warningSurface }]}>
            <Ionicons name="warning-outline" size={18} color={colors.warning} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" style={{ fontWeight: "700", color: colors.warning }}>
                High Daily Load: {assignedTo}
              </AppText>
              <AppText variant="caption" style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }}>
                Current commitment: ~{Math.round(totalProjectedMinutes / 60)} hrs. Consider delegating.
              </AppText>
            </View>
          </View>
        )}

        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            ASSIGN TO MEMBER
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {members.map((m) => {
              const active = assignedTo.toLowerCase() === m.name.toLowerCase()
              return (
                <PressableScale
                  key={m.id}
                  style={[
                    styles.durationChip,
                    { backgroundColor: active ? colors.primary : colors.surface2 },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setAssignedTo(m.name)
                  }}
                >
                  <AppText variant="caption" style={{ color: active ? "#FFFFFF" : colors.text.primary, fontWeight: "600" }}>
                    {m.name}
                  </AppText>
                </PressableScale>
              )
            })}
          </ScrollView>
        </View>

        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextField label="Due Date" placeholder="YYYY-MM-DD" value={dueDate} onChangeText={setDueDate} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <TextField label="Time" placeholder="e.g. 05:00 PM" value={time} onChangeText={setTime} />
          </View>
        </View>

        <View style={styles.btnWrap}>
          <AppButton
            title="Save Space Task"
            variant="primary"
            onPress={handleSave}
            disabled={!title.trim()}
          />
        </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  sectionMargin: {
    marginBottom: 18,
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
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
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  rowInputs: {
    flexDirection: "row",
    marginBottom: 16,
  },
  workloadAlert: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  btnWrap: {
    marginTop: 10,
    marginBottom: 20,
  },
})
