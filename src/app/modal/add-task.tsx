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
import { useSpacesStore, type SpaceType, type SpaceTask } from "@/stores/useSpacesStore"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useFamilyNetworkStore, type ClusterType } from "@/stores/useFamilyNetworkStore"
import { deterministicEngine, type ConstraintTask } from "@/services/engine/deterministicEngine"
import { useRootStore } from "@/stores/useRootStore"

const SPACES: { key: SpaceType; label: string; icon: string; desc: string }[] = [
  { key: "personal", label: "Personal Space (Private)", icon: "lock-closed", desc: "Confidential goals & career" },
  { key: "nuclear", label: "Nuclear Space (Home & Kids)", icon: "home", desc: "School, doctor & daily needs" },
  { key: "family", label: "Family Sanctuary (All)", icon: "people", desc: "Grandparents, rituals & pets" },
]

const CATEGORIES: { key: "school" | "doctor" | "career" | "home" | "ritual"; label: string }[] = [
  { key: "school", label: "Child & School" },
  { key: "doctor", label: "Doctor & Health" },
  { key: "career", label: "Career & Interview" },
  { key: "home", label: "Household & Chores" },
  { key: "ritual", label: "Ritual & Tradition" },
]

const PRIORITIES: { key: "urgent" | "normal" | "low"; label: string; color: string; val: number }[] = [
  { key: "urgent", label: "Urgent (Escalating)", color: "#EF4444", val: 5 },
  { key: "normal", label: "Normal Priority", color: "#3B82F6", val: 3 },
  { key: "low", label: "Low & Flexible", color: "#10B981", val: 1 },
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
  const [dueDate, setDueDate] = useState("Today, 05:00 PM")
  const [assignedTo, setAssignedTo] = useState(members[0]?.name || "Me")
  const [selectedDepTaskId, setSelectedDepTaskId] = useState<string | null>(null)

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
    if (!title.trim()) {
      showToast({ message: "Please provide a task or milestone title.", type: "error" })
      return
    }

    // Check for cycle if dependency was chosen
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

    const prioVal = PRIORITIES.find((p) => p.key === priority)?.val || 3
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
      time: "05:00 PM",
      assignedTo,
      clusterType: selectedClusterType !== "all" ? selectedClusterType : undefined,
      estimatedMinutes: durationMinutes,
      dependsOn: selectedDepTaskId ? [selectedDepTaskId] : undefined,
      priorityScore: calculatedScore,
    })

    showToast({
      message: `Task added to ${selectedSpace.toUpperCase()} space! Priority score: ${calculatedScore} (0 Tokens)`,
      type: "success",
    })
    router.back()
  }

  return (
    <ScreenContainer scrollable={false} style={{ backgroundColor: colors.background }}>
      <AppHeader
        title="Add Space Plan & Task"
        subtitle="Deterministic Planning & Workload Balancer"
        showBack
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setSelectedSpace(sp.key)
                  }}
                >
                  <Ionicons
                    name={sp.icon as any}
                    size={18}
                    color={active ? colors.primary : colors.text.secondary}
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText
                      variant="bodyMedium"
                      style={{ color: active ? colors.primary : colors.text.primary, fontWeight: "700" }}
                    >
                      {sp.label}
                    </AppText>
                    <AppText variant="caption" style={{ color: colors.text.muted }}>
                      {sp.desc}
                    </AppText>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </PressableScale>
              )
            })}
          </View>
        </View>

        {/* Cluster Scope Target */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            FAMILY CLUSTER SCOPE (SECTION 47)
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clusterPillsScroll}>
            <PressableScale
              style={[
                styles.clusterPill,
                selectedClusterType === "all"
                  ? [styles.clusterPillActive, { backgroundColor: colors.primary }]
                  : [styles.clusterPillInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
              ]}
              onPress={() => setSelectedClusterType("all")}
            >
              <AppText
                variant="caption"
                style={{
                  fontWeight: "600",
                  color: selectedClusterType === "all" ? "#FFFFFF" : colors.text.secondary,
                }}
              >
                All Space Members
              </AppText>
            </PressableScale>

            {clusters.map((c) => {
              const isSelected = selectedClusterType === c.type
              return (
                <PressableScale
                  key={c.id}
                  style={[
                    styles.clusterPill,
                    isSelected
                      ? [styles.clusterPillActive, { backgroundColor: c.color }]
                      : [styles.clusterPillInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
                  ]}
                  onPress={() => setSelectedClusterType(c.type)}
                >
                  <Ionicons
                    name={c.icon as any}
                    size={13}
                    color={isSelected ? "#FFFFFF" : c.color}
                    style={{ marginRight: 5 }}
                  />
                  <AppText
                    variant="caption"
                    style={{
                      fontWeight: "600",
                      color: isSelected ? "#FFFFFF" : colors.text.primary,
                    }}
                  >
                    {c.name}
                  </AppText>
                </PressableScale>
              )
            })}
          </ScrollView>
        </View>

        {/* Task Title */}
        <TextField
          label="Task or Milestone Title"
          placeholder="e.g. Schedule pediatrician vaccine, Order puja ghee"
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

        {/* Estimated Duration (Deterministic Planning Section 8.1) */}
        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            ESTIMATED DURATION (EFFORT BUDGET)
          </AppText>
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => {
              const isSelected = durationMinutes === d.value
              return (
                <PressableScale
                  key={d.value}
                  style={[
                    styles.durationChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
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
                      fontWeight: isSelected ? "700" : "500",
                      color: isSelected ? "#FFFFFF" : colors.text.secondary,
                    }}
                  >
                    {d.label}
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
              label="Assigned Caregiver / Member"
              placeholder="e.g. Papa, Maa, Dadu"
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

        {/* Caregiver Workload Health Alert (Section 8.2 & 8.4) */}
        {isOverloaded && (
          <View style={[styles.workloadAlert, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
            <Ionicons name="warning-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" style={{ fontWeight: "700", color: "#92400E" }}>
                Caregiver Workload Limit Reached
              </AppText>
              <AppText variant="caption" style={{ color: "#B45309", fontSize: 11, marginTop: 2 }}>
                {assignedTo} already has {existingAssigneeMinutes}m scheduled today. Adding {durationMinutes}m exceeds 6 hours. Deterministic load balancer suggests re-assigning.
              </AppText>
            </View>
          </View>
        )}

        {/* Task Dependency Selector (Acyclic DAG Section 7.4) */}
        {uncompletedTasksInSpace.length > 0 && (
          <View style={styles.sectionMargin}>
            <AppText variant="caption" style={styles.label}>
              PREREQUISITE TASK (DEPENDS ON)
            </AppText>
            <AppText variant="caption" style={{ color: colors.text.muted, marginBottom: 8 }}>
              This task will be blocked until the prerequisite task completes:
            </AppText>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.depScroll}>
              <PressableScale
                style={[
                  styles.depChip,
                  selectedDepTaskId === null
                    ? [styles.depChipActive, { backgroundColor: colors.primary }]
                    : [styles.depChipInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
                ]}
                onPress={() => setSelectedDepTaskId(null)}
              >
                <AppText
                  variant="caption"
                  style={{
                    color: selectedDepTaskId === null ? "#FFFFFF" : colors.text.secondary,
                    fontWeight: "600",
                  }}
                >
                  No Prerequisite (Ready Now)
                </AppText>
              </PressableScale>

              {uncompletedTasksInSpace.map((t) => {
                const isSelected = selectedDepTaskId === t.id
                return (
                  <PressableScale
                    key={t.id}
                    style={[
                      styles.depChip,
                      isSelected
                        ? [styles.depChipActive, { backgroundColor: colors.primary }]
                        : [styles.depChipInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
                    ]}
                    onPress={() => {
                      void Haptics.selectionAsync()
                      setSelectedDepTaskId(t.id)
                    }}
                  >
                    <Ionicons
                      name="git-commit-outline"
                      size={14}
                      color={isSelected ? "#FFFFFF" : colors.text.muted}
                      style={{ marginRight: 4 }}
                    />
                    <AppText
                      variant="caption"
                      style={{
                        color: isSelected ? "#FFFFFF" : colors.text.primary,
                        fontWeight: isSelected ? "700" : "500",
                      }}
                      numberOfLines={1}
                    >
                      {t.title}
                    </AppText>
                  </PressableScale>
                )
              })}
            </ScrollView>
          </View>
        )}

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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  clusterPillsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  clusterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  clusterPillActive: {},
  clusterPillInactive: {},
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
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
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
    borderWidth: 1,
    marginBottom: 16,
  },
  depScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  depChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 220,
  },
  depChipActive: {},
  depChipInactive: {},
  btnWrap: {
    marginTop: 20,
  },
})
