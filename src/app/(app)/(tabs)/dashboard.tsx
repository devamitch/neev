import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { router } from "expo-router"
import React from "react"
import { Linking, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { openAppDrawer } from "@/components/navigation/AppDrawer"
import { useTabBarInset } from "@/components/navigation/CustomTabBar"
import { AppHeader, HeaderIconButton } from "@/components/ui/AppHeader"
import { SanctuaryHeader, SanctuaryLargeTitle } from "@/components/ui/SanctuaryHeader"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { PressableScale } from "@/components/ui/PressableScale"
import { FamilySanctuaryMap } from "@/components/location/FamilySanctuaryMap"
import { FamilyWeeklyGamesCard } from "@/components/family/FamilyWeeklyGamesCard"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { ErrorBoundary } from "@/components/ErrorBoundary"

export { ErrorBoundary } from "@/components/ErrorBoundary"
import { neevAiOrchestrator, type LifeDomain } from "@/services/ai/neevAiOrchestrator"
import { neevHeuristicEngine } from "@/services/ai/neevHeuristicEngine"
import { googleServicesClient } from "@/services/google/googleServicesClient"
import { notificationsService } from "@/services/notifications/notificationsService"
import { useCloudSyncStore } from "@/services/sync/cloudSyncEngine"
import { useFamilyLocationsQuery } from "@/hooks/useFamilyLocationQuery"
import { useFamilyMembersQuery } from "@/hooks/useFamilyMembersQuery"
import { useIntentionsQuery, useCheerIntentionMutation } from "@/hooks/useIntentionsQuery"
import { useKnowledgeQuery } from "@/hooks/useKnowledgeQuery"
import { useRoutinesQuery, useToggleRoutineMutation } from "@/hooks/useRoutinesQuery"
import { useScheduleQuery } from "@/hooks/useScheduleQuery"
import {
  useSpacesTasksQuery,
  useToggleSpaceTaskMutation,
  useSpaceMeetingsQuery,
  useSpaceAiBriefingsQuery,
} from "@/hooks/useSpacesQuery"
import { useFamilyStore, type FamilyMember } from "@/stores/useFamilyStore"
import { useIntentionsStore } from "@/stores/useIntentionsStore"
import { useKnowledgeStore } from "@/stores/useKnowledgeStore"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { useRoutineStore } from "@/stores/useRoutineStore"
import { useScheduleStore } from "@/stores/useScheduleStore"
import { useSpacesStore, type SpaceType } from "@/stores/useSpacesStore"
import { useColors } from "@/theme/useTheme"
import { FamilyMemberDetailSheet } from "@/components/family/FamilyMemberDetailSheet"

const SPACES: {
  key: SpaceType
  label: string
  icon: keyof typeof Ionicons.glyphMap
  description: string
}[] = [
  {
    key: "personal",
    label: "Personal",
    icon: "lock-closed-outline",
    description: "Career switch, interview prep & private goals",
  },
  {
    key: "nuclear",
    label: "Nuclear",
    icon: "home-outline",
    description: "Child school, doctor appointments & daily chores",
  },
  {
    key: "family",
    label: "Family",
    icon: "people-outline",
    description: "Grandparents, festivals, heirloom recipes & pets",
  },
]

export default function DashboardScreen() {
  const colors = useColors()
  const bottomInset = useTabBarInset()
  const insets = useSafeAreaInsets()
  const showToast = useRootStore((s) => s.showToast)
  const easyMode = useRootStore((s) => s.easyMode)
  const toggleEasyMode = useRootStore((s) => s.toggleEasyMode)

  React.useEffect(() => {
    const root = useRootStore.getState()
    if (root.tasks.length === 0) root.loadDemoSpaces?.()
    if (root.functions.length === 0) root.loadDemoSchedule?.()
    if (root.routines.length === 0) root.loadDemoRoutine?.()
    if (root.entries.length === 0) root.loadDemoKnowledge?.()
    if (root.members.length === 0) root.loadDemoFamily?.()
  }, [])

  // TanStack React Query for offline-first caching & synchronization
  const { data: scheduleData } = useScheduleQuery()
  const { data: knowledgeData } = useKnowledgeQuery()
  useFamilyLocationsQuery()

  const household = useFamilyStore((s) => s.household)
  const { data: queryMembers } = useFamilyMembersQuery()
  const storeMembers = useFamilyStore((s) => s.members)
  const members = queryMembers ?? storeMembers
  const rawFunctions = useScheduleStore((s) => s.functions)
  const rawEntries = useKnowledgeStore((s) => s.entries)
  const functions = scheduleData ?? rawFunctions
  const entries = knowledgeData ?? rawEntries
  const pinnedEntries = React.useMemo(() => entries.filter((e) => e.isPinned), [entries])

  const { data: routines = [] } = useRoutinesQuery()
  const toggleRoutineMutation = useToggleRoutineMutation()

  const { data: intentions = [] } = useIntentionsQuery()
  const cheerIntentionMutation = useCheerIntentionMutation()

  const { status, lastSyncedAt, healthMetrics } = useCloudSyncStore(
    useShallow((s) => ({ status: s.status, lastSyncedAt: s.lastSyncedAt, healthMetrics: s.healthMetrics })),
  )

  const { currentSpace, setSpace } = useSpacesStore(
    useShallow((s) => ({
      currentSpace: s.currentSpace,
      setSpace: s.setSpace,
    })),
  )

  const { data: currentSpaceTasks = [] } = useSpacesTasksQuery(currentSpace)
  const toggleSpaceTaskMutation = useToggleSpaceTaskMutation()
  const { data: currentSpaceMeetings = [] } = useSpaceMeetingsQuery(currentSpace)
  const { data: spaceAiBriefings = [] } = useSpaceAiBriefingsQuery(currentSpace)

  const activeSpaceConfig = React.useMemo(
    () => SPACES.find((s) => s.key === currentSpace) || SPACES[1],
    [currentSpace],
  )
  const currentSpaceBriefing = React.useMemo(
    () => spaceAiBriefings[0],
    [spaceAiBriefings],
  )

  const nextFunction = functions[0]
  const completedRoutines = React.useMemo(
    () => routines.filter((r) => r.isCompleted).length,
    [routines],
  )

  const handleSyncToGoogle = async () => {
    if (!nextFunction) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const res = await googleServicesClient.exportFunctionToCalendar(nextFunction)
    if (res.success) {
      showToast({ message: "Function exported to Google Calendar!", type: "success" })
    }
  }

  const handleTriggerAiPrep = async (context: LifeDomain) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const res = await neevAiOrchestrator.activatePlan(context)
    showToast({
      message: `Plan activated! ${res.tasksCreated} tasks created & ${res.nudgesScheduled} escalating reminders scheduled. (0 Tokens)`,
      type: "success",
    })
  }

  const [selectedDetailMember, setSelectedDetailMember] = React.useState<FamilyMember | null>(null)
  const handleTestLiveNotification = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    await notificationsService.dispatchImmediateNotification(
      "[Neev Escalating Nudge]",
      "Child school milestone & interview prep reminder active. 0 AI tokens consumed.",
    )
    showToast({ message: "Escalating reminder dispatched to device tray!", type: "success" })
  }

  const familyLoad = React.useMemo(
    () => neevHeuristicEngine.computeFamilyLoadBalance(currentSpaceTasks, members),
    [currentSpaceTasks, members],
  )

  const choreBalanceStats = React.useMemo(() => {
    if (familyLoad.length === 0) return { label: "100% Balanced", tone: "success" as const }
    const balancedCount = familyLoad.filter((f) => f.loadLevel === "balanced").length
    const pct = Math.round((balancedCount / familyLoad.length) * 100)
    const tone = pct >= 80 ? ("success" as const) : pct >= 50 ? ("warning" as const) : ("error" as const)
    return { label: `${pct}% Balanced`, tone }
  }, [familyLoad])

  const openMeetingLink = (url?: string) => {
    if (!url) return
    void Haptics.selectionAsync()
    void Linking.openURL(url)
  }

  return (
    <ErrorBoundary>
      <ScreenContainer
      safeArea
      scrollable
      header={
        <SanctuaryHeader
          eyebrow="FAMILY SANCTUARY"
          title={household.name || "Neev"}
          subtitle={household.motto}
          rightAction={
            <HeaderIconButton icon="menu-outline" label="Sanctuary Spaces" onPress={openAppDrawer} />
          }
        />
      }
    >
      <SanctuaryLargeTitle
        title={household.name || "Neev Family Sanctuary"}
        subtitle={household.motto || "Roots in reverence, wings in harmony"}
      />


        {/* ── Grandparent Easy Mode Accessibility Bar ── */}
        {easyMode && (
          <View style={[styles.easyModeBanner, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="sunny" size={20} color="#D97706" />
                <AppText variant="bodyMedium" style={{ fontWeight: "800", color: colors.text.primary, fontSize: 16 }}>
                  Grandparent Easy Mode Active
                </AppText>
              </View>
              <PressableScale onPress={toggleEasyMode} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                <AppText variant="caption" style={{ color: colors.primary, fontWeight: "700" }}>
                  Exit
                </AppText>
              </PressableScale>
            </View>
            <View style={styles.easyModeQuickRow}>
              <PressableScale
                onPress={() => router.push("/(app)/map")}
                style={[styles.easyModeBtn, { backgroundColor: colors.surface2 }]}
              >
                <Ionicons name="location" size={24} color={colors.primary} />
                <AppText style={styles.easyModeBtnText}>Family Map</AppText>
              </PressableScale>

              <PressableScale
                onPress={() => router.push("/(app)/(tabs)/schedule")}
                style={[styles.easyModeBtn, { backgroundColor: colors.surface2 }]}
              >
                <Ionicons name="calendar" size={24} color="#D97706" />
                <AppText style={styles.easyModeBtnText}>Schedule</AppText>
              </PressableScale>

              <PressableScale
                onPress={() => router.push("/(app)/(tabs)/family")}
                style={[styles.easyModeBtn, { backgroundColor: colors.surface2 }]}
              >
                <Ionicons name="call" size={24} color="#10B981" />
                <AppText style={styles.easyModeBtnText}>Care Circle</AppText>
              </PressableScale>
            </View>
          </View>
        )}

        {/* ── Sacred Spaces Switcher Bar (Zero Borders) ── */}
        <View style={styles.spacesSelectorRow}>
          {SPACES.map((space) => {
            const isActive = currentSpace === space.key
            return (
              <PressableScale
                key={space.key}
                style={[
                  styles.spaceTabBtn,
                  {
                    backgroundColor: isActive ? colors.primary : colors.surface2,
                  },
                ]}
                onPress={() => {
                  void Haptics.selectionAsync()
                  setSpace(space.key)
                }}
              >
                <Ionicons
                  name={space.icon}
                  size={14}
                  color={isActive ? "#FFFFFF" : colors.text.secondary}
                  style={{ marginRight: 5 }}
                />
                <AppText
                  variant="caption"
                  style={{
                    fontWeight: "700",
                    fontSize: 12,
                    color: isActive ? "#FFFFFF" : colors.text.primary,
                  }}
                  numberOfLines={1}
                >
                  {space.label}
                </AppText>
              </PressableScale>
            )
          })}
        </View>

        {/* Active Space Hint (Zero Borders) */}
        <View style={[styles.activeSpaceBanner, { backgroundColor: colors.surface2 }]}>
          <Ionicons
            name="information-circle-outline"
            size={15}
            color={colors.primary}
            style={{ marginRight: 6 }}
          />
          <AppText variant="caption" style={{ flex: 1, color: colors.text.secondary }}>
            {activeSpaceConfig.description}
          </AppText>
        </View>

        {/* ── Live Free Family Sanctuary Map & Telemetry ── */}
        <FamilySanctuaryMap compact />

        {/* ── Real Weekly Multigenerational Family Games ── */}
        <FamilyWeeklyGamesCard compact />

        {/* ── Family Intelligence & Routines Card (Zero Borders) ── */}
        <Card style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <View style={[styles.aiIconWrap, { backgroundColor: colors.surface2 }]}>
              <Ionicons name="leaf-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <AppText variant="subheading" style={{ fontWeight: "700", flex: 1 }} numberOfLines={1}>
                  Family Intelligence & Routines
                </AppText>
                <Badge label="Private & Local" tone="success" size="small" style={{ flexShrink: 0 }} />
              </View>
              <AppText variant="caption" style={{ color: colors.text.muted, marginTop: 1 }}>
                On-device heuristics · Private family schedules
              </AppText>
            </View>
          </View>

          {/* Active AI Briefing */}
          {currentSpaceBriefing && (
            <View style={[styles.briefingBox, { backgroundColor: colors.surface2 }]}>
              <AppText
                variant="body"
                style={{ fontWeight: "700", color: colors.text.primary, marginBottom: 4 }}
              >
                {currentSpaceBriefing.title}
              </AppText>
              <AppText
                variant="caption"
                style={{ color: colors.text.secondary, lineHeight: 18, marginBottom: 8 }}
              >
                {currentSpaceBriefing.summary}
              </AppText>
              <View style={styles.briefingActionItems}>
                {currentSpaceBriefing.actionItems.map((item, idx) => (
                  <View key={idx} style={styles.briefingBulletRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={colors.primary}
                      style={{ marginRight: 6, marginTop: 2 }}
                    />
                    <AppText variant="caption" style={{ flex: 1, color: colors.text.primary }}>
                      {item}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Quick Preparation Generators */}
          <AppText
            variant="caption"
            style={{ fontWeight: "700", color: colors.text.muted, marginTop: 12, marginBottom: 6, letterSpacing: 0.4 }}
          >
            PREPARE PROACTIVELY FOR:
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.aiQuickChips}
          >
            <PressableScale
              style={[styles.aiChip, { backgroundColor: colors.surface2 }]}
              onPress={() => handleTriggerAiPrep("school_prep")}
            >
              <Ionicons name="school-outline" size={14} color={colors.primary} />
              <AppText
                variant="caption"
                style={{ color: colors.primary, fontWeight: "700", marginLeft: 5 }}
              >
                Child School
              </AppText>
            </PressableScale>

            <PressableScale
              style={[styles.aiChip, { backgroundColor: colors.surface2 }]}
              onPress={() => handleTriggerAiPrep("doctor_visit")}
            >
              <Ionicons name="medkit-outline" size={14} color={colors.primary} />
              <AppText
                variant="caption"
                style={{ color: colors.primary, fontWeight: "700", marginLeft: 5 }}
              >
                Doctor Visit
              </AppText>
            </PressableScale>

            <PressableScale
              style={[styles.aiChip, { backgroundColor: colors.surface2 }]}
              onPress={() => handleTriggerAiPrep("career_interview")}
            >
              <Ionicons name="briefcase-outline" size={14} color={colors.primary} />
              <AppText
                variant="caption"
                style={{ color: colors.primary, fontWeight: "700", marginLeft: 5 }}
              >
                Career Prep
              </AppText>
            </PressableScale>

            <PressableScale
              style={[styles.aiChip, { backgroundColor: colors.surface2 }]}
              onPress={() => handleTriggerAiPrep("office_work")}
            >
              <Ionicons name="business-outline" size={14} color={colors.primary} />
              <AppText
                variant="caption"
                style={{ color: colors.primary, fontWeight: "700", marginLeft: 5 }}
              >
                Office Deadlines
              </AppText>
            </PressableScale>

            <PressableScale
              style={[styles.aiChip, { backgroundColor: colors.surface2 }]}
              onPress={() => handleTriggerAiPrep("family_event")}
            >
              <Ionicons name="calendar-outline" size={14} color={colors.primary} />
              <AppText
                variant="caption"
                style={{ color: colors.primary, fontWeight: "700", marginLeft: 5 }}
              >
                Gatherings
              </AppText>
            </PressableScale>
          </ScrollView>

          {/* Live Escalating Nudge Dispatcher (Zero Borders) */}
          <View style={[styles.notificationTriggerRow, { backgroundColor: colors.surface2 }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <AppText variant="caption" style={{ fontWeight: "700", color: colors.text.primary }}>
                Escalating Reminders
              </AppText>
              <AppText
                variant="caption"
                style={{ color: colors.text.muted, fontSize: 11, marginTop: 1 }}
              >
                Gentle nudges keep household members aligned
              </AppText>
            </View>
            <PressableScale
              style={[styles.testNudgeBtn, { backgroundColor: colors.primary }]}
              onPress={handleTestLiveNotification}
            >
              <Ionicons name="notifications-outline" size={13} color="#FFFFFF" />
              <AppText
                variant="caption"
                style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: 4 }}
              >
                Test Nudge
              </AppText>
            </PressableScale>
          </View>
        </Card>

        {/* ── Space Meetings & Google Meet Links ── */}
        {currentSpaceMeetings.length > 0 && (
          <View>
            <SectionHeader
              title="Upcoming Meetings & Calls"
              subtitle="Google Calendar & Google Meet connected"
            />

            {currentSpaceMeetings.map((mtg) => (
              <Card key={mtg.id} style={styles.meetingCard}>
                <View style={styles.meetingTopRow}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="subheading" style={{ fontWeight: "700" }}>
                      {mtg.title}
                    </AppText>
                    <View style={styles.meetingMetaRow}>
                      <Ionicons name="time-outline" size={13} color={colors.text.muted} />
                      <AppText
                        variant="caption"
                        style={{ color: colors.text.muted, marginLeft: 4, marginRight: 8 }}
                      >
                        {mtg.date} · {mtg.time}
                      </AppText>
                      <Ionicons name="videocam-outline" size={13} color={colors.primary} />
                      <AppText
                        variant="caption"
                        style={{ color: colors.primary, marginLeft: 4, fontWeight: "600" }}
                      >
                        Google Meet
                      </AppText>
                    </View>
                  </View>
                  {mtg.meetLink && (
                    <PressableScale
                      style={[styles.joinMeetBtn, { backgroundColor: colors.primary }]}
                      onPress={() => openMeetingLink(mtg.meetLink)}
                    >
                      <Ionicons name="videocam" size={14} color="#FFFFFF" />
                      <AppText
                        variant="caption"
                        style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: 4 }}
                      >
                        Join Call
                      </AppText>
                    </PressableScale>
                  )}
                </View>
                {mtg.preparationNotes ? (
                  <View style={[styles.meetingNotesBox, { backgroundColor: colors.surface2 }]}>
                    <Ionicons
                      name="document-text-outline"
                      size={13}
                      color={colors.text.muted}
                      style={{ marginRight: 6 }}
                    />
                    <AppText variant="caption" style={{ color: colors.text.secondary, flex: 1 }}>
                      {mtg.preparationNotes}
                    </AppText>
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}

        {/* ── Space Priority Tasks & Delegations ── */}
        <SectionHeader
          title={`${activeSpaceConfig.label} Tasks & Nudges`}
          subtitle={`${currentSpaceTasks.filter((t) => t.isCompleted).length} of ${currentSpaceTasks.length} tasks ready`}
          action={
            <PressableScale
              style={[styles.addTaskBtn, { backgroundColor: colors.primaryAlpha }]}
              onPress={() => router.push("/modal/add-task")}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <AppText variant="label" style={{ color: colors.primary, fontSize: 13, marginLeft: 4 }}>
                Add Task
              </AppText>
            </PressableScale>
          }
        />

        <View style={styles.spaceTasksList}>
          {currentSpaceTasks.map((task) => (
            <PressableScale
              key={task.id}
              style={[styles.taskCard, { backgroundColor: colors.surface }]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                toggleSpaceTaskMutation.mutate(task.id)
              }}
            >
              <Ionicons
                name={task.isCompleted ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={task.isCompleted ? colors.success : colors.text.muted}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <AppText
                    style={[
                      styles.taskTitleText,
                      { flex: 1 },
                      task.isCompleted && {
                        textDecorationLine: "line-through",
                        color: colors.text.muted,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {task.title}
                  </AppText>
                  {task.priority === "urgent" && !task.isCompleted && (
                    <Badge label="URGENT" tone="error" size="small" style={{ flexShrink: 0 }} />
                  )}
                </View>
                <AppText variant="caption" style={{ color: colors.text.secondary, marginTop: 2 }}>
                  Due {task.dueDate} · {task.time} · Assigned to {task.assignedTo}
                </AppText>
              </View>
            </PressableScale>
          ))}
        </View>

        {/* ── Calculated Family Load & Effort Balance (Refined Apple Aesthetics) ── */}
        <Card style={[styles.loadCard, { backgroundColor: colors.surface }]}>
          <View style={styles.loadHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="pie-chart" size={18} color={colors.primary} />
                <AppText variant="subheading" style={{ fontWeight: "800", fontSize: 16 }}>
                  Family Effort & Chore Balance
                </AppText>
              </View>
              <Badge label={choreBalanceStats.label} tone={choreBalanceStats.tone} size="small" />
            </View>
            <AppText variant="caption" style={{ color: colors.text.secondary, marginTop: 4 }}>
              Algorithmic distribution ensures balanced household harmony
            </AppText>
          </View>

          {/* Household Chores Overview Progress Bar */}
          <View style={[styles.overallLoadBanner, { backgroundColor: colors.surface2 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <AppText variant="caption" style={{ fontWeight: "700", color: colors.text.primary }}>
                Weekly Sanctuary Chores
              </AppText>
              <AppText variant="caption" style={{ color: colors.text.secondary, fontWeight: "600" }}>
                {currentSpaceTasks.filter((t) => t.isCompleted).length} Done · {currentSpaceTasks.filter((t) => !t.isCompleted).length} Active
              </AppText>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${
                      currentSpaceTasks.length > 0
                        ? Math.round(
                            (currentSpaceTasks.filter((t) => t.isCompleted).length /
                              currentSpaceTasks.length) *
                              100,
                          )
                        : 0
                    }%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
          </View>

          {/* Per-Member Effort Distribution Rows */}
          <View style={styles.loadStatsList}>
            {familyLoad.length === 0 ? (
              <View style={styles.emptyLoadState}>
                <Ionicons name="leaf-outline" size={20} color={colors.primary} />
                <AppText variant="caption" style={{ color: colors.text.secondary, textAlign: "center", marginTop: 4 }}>
                  No chores assigned yet. Add tasks or family members to track workload balance.
                </AppText>
              </View>
            ) : (
              familyLoad.slice(0, 4).map((fl) => {
                const fullMem = members.find((m) => m.id === fl.memberId)
                const maxTasks = Math.max(...familyLoad.map((f) => f.taskCount), 1)
                const percentage = Math.round((fl.taskCount / maxTasks) * 100)
                return (
                  <PressableScale
                    key={fl.memberId}
                    style={[styles.loadMemberRow, { backgroundColor: colors.surface2 }]}
                    onPress={() => {
                      void Haptics.selectionAsync()
                      if (fullMem) setSelectedDetailMember(fullMem)
                    }}
                  >
                    <View style={[styles.miniAvatar, { backgroundColor: fullMem?.avatarColor || colors.primary }]}>
                      <AppText style={styles.miniAvatarText}>
                        {fullMem?.avatarText || fl.memberName[0]}
                      </AppText>
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <AppText variant="body" style={{ fontWeight: "700", fontSize: 13.5 }}>
                          {fl.memberName}
                        </AppText>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <AppText variant="caption" style={{ fontWeight: "700", color: colors.text.secondary }}>
                            {fl.taskCount} {fl.taskCount === 1 ? "chore" : "chores"}
                          </AppText>
                          <Badge
                            label={fl.loadLevel.toUpperCase()}
                            tone={
                              fl.loadLevel === "heavy"
                                ? "error"
                                : fl.loadLevel === "balanced"
                                  ? "success"
                                  : "neutral"
                            }
                            size="small"
                          />
                        </View>
                      </View>

                      {/* Member Load Bar */}
                      <View style={styles.memberLoadTrack}>
                        <View
                          style={[
                            styles.memberLoadFill,
                            {
                              width: `${Math.max(percentage, 12)}%`,
                              backgroundColor:
                                fl.loadLevel === "heavy"
                                  ? "#EF4444"
                                  : fl.loadLevel === "balanced"
                                    ? colors.primary
                                    : "#10B981",
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </PressableScale>
                )
              })
            )}
          </View>
        </Card>

        {/* ── Multigenerational Family & Pets Row ── */}
        <SectionHeader
          title="Family & Beloved Pets"
          action={
            <PressableScale onPress={() => router.push("/(app)/(tabs)/family")}>
              <AppText variant="caption" style={{ color: colors.primary, fontWeight: "600" }}>
                {members.length > 0 ? `View All (${members.length}) →` : "Manage →"}
              </AppText>
            </PressableScale>
          }
        />

        {members.length === 0 ? (
          <Card style={styles.emptyFamilyCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <View style={[styles.avatarCircle, { backgroundColor: colors.primaryAlpha }]}>
                <Ionicons name="people" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium" style={{ fontWeight: "700" }}>
                  Start Your Family Sanctuary
                </AppText>
                <AppText variant="caption" color={colors.text.secondary}>
                  Add children, elders, tutors, or caregivers to begin coordinating schedules and care.
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <PressableScale
                onPress={() => router.push("/(app)/(tabs)/family")}
                style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
                <AppText variant="caption" style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  Add Member
                </AppText>
              </PressableScale>

              <PressableScale
                onPress={() => {
                  useRootStore.getState().loadDemoFamily?.()
                  useRootStore.getState().loadDemoSpaces?.()
                  showToast("Sample Family Preview Loaded", "info")
                }}
                style={[styles.emptyActionBtn, { backgroundColor: colors.surface2 }]}
              >
                <Ionicons name="play-outline" size={15} color={colors.primary} />
                <AppText variant="caption" style={{ color: colors.primary, fontWeight: "600" }}>
                  Preview Sample Family
                </AppText>
              </PressableScale>
            </View>
          </Card>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.membersRow}
          >
            {members.map((member) => (
              <PressableScale
                key={member.id}
                style={styles.memberPill}
                onPress={() => {
                  void Haptics.selectionAsync()
                  setSelectedDetailMember(member)
                }}
              >
                <View style={[styles.avatarCircle, { backgroundColor: member.avatarColor }]}>
                  <AppText style={styles.avatarText}>{member.avatarText}</AppText>
                </View>
                <AppText variant="caption" style={styles.memberName} numberOfLines={1}>
                  {member.nickname || member.name.split(" ")[0]}
                </AppText>
                <AppText style={styles.memberRole} numberOfLines={1}>
                  {member.role === "pet" ? "Pet Pup" : member.role}
                </AppText>
              </PressableScale>
            ))}
          </ScrollView>
        )}

        {/* ── Active Family Intentions & Pet Projects ── */}
        <SectionHeader
          title="Intentions & Pet Projects"
          subtitle="Shared family intentions & weekend bonding"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.intentionsRow}
        >
          {intentions.map((item) => (
            <Card key={item.id} style={styles.intentionCard}>
              <View style={styles.intentionTop}>
                <Badge
                  label={item.category.toUpperCase()}
                  tone={item.category === "bonding" ? "warning" : "info"}
                  size="small"
                />
                <PressableScale
                  style={[styles.cheerBtn, { backgroundColor: colors.primaryAlpha }]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    cheerIntentionMutation.mutate(item.id)
                  }}
                >
                  <Ionicons name="heart" size={13} color={colors.primary} />
                  <AppText
                    variant="caption"
                    style={{ color: colors.primary, fontWeight: "700", marginLeft: 4 }}
                  >
                    {item.cheerCount}
                  </AppText>
                </PressableScale>
              </View>
              <AppText variant="subheading" style={styles.intentionTitle} numberOfLines={2}>
                {item.title}
              </AppText>
              <AppText variant="caption" style={styles.intentionDesc} numberOfLines={2}>
                {item.description}
              </AppText>
              <View style={styles.progressContainer}>
                <View style={styles.progressLabelRow}>
                  <AppText variant="caption" style={{ color: colors.text.muted }}>
                    Progress
                  </AppText>
                  <AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>
                    {item.progress}%
                  </AppText>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.surface2 }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: colors.primary, width: `${item.progress}%` },
                    ]}
                  />
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>

        {/* ── Family Health & Daily Movement Telemetry ── */}
        <SectionHeader
          title="Family Movement & Wellness"
          subtitle="Google Fit & Health Connect daily telemetry"
        />

        <Card style={styles.healthCard}>
          <View style={styles.healthHeader}>
            <Ionicons name="heart-circle-outline" size={20} color={colors.primary} />
            <AppText
              variant="body"
              style={{ fontWeight: "700", color: colors.text.primary, flex: 1, marginLeft: 8 }}
            >
              Today&apos;s Gentle Movement Pulse
            </AppText>
            <Badge label={healthMetrics.length > 0 ? "Google Fit Sync" : "Health Telemetry"} tone={healthMetrics.length > 0 ? "success" : "neutral"} size="small" />
          </View>
          {healthMetrics.length > 0 ? (
            <View style={styles.healthStatsRow}>
              {healthMetrics.map((hm) => (
                <View key={hm.memberId} style={styles.healthStatItem}>
                  <AppText variant="caption" style={{ fontWeight: "700" }}>
                    {hm.memberName}
                  </AppText>
                  <AppText variant="h3" style={{ color: colors.primary, marginTop: 2 }}>
                    {hm.dailySteps.toLocaleString()}
                  </AppText>
                  <AppText variant="caption" style={{ color: colors.text.muted, fontSize: 10 }}>
                    steps · {hm.sleepHours}h sleep
                  </AppText>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ paddingVertical: 12, alignItems: "center" }}>
              <AppText variant="caption" style={{ color: colors.text.muted, textAlign: "center", lineHeight: 18 }}>
                No active device health telemetry connected yet. Connect Google Fit or Health Connect in Settings to track family steps and resting sleep.
              </AppText>
            </View>
          )}
        </Card>

        {/* ── Next Upcoming Function & Invitations ── */}
        {nextFunction && (
          <View>
            <SectionHeader
              title="Next Family Function"
              subtitle="Invitations & shared preparations"
              action={
                <PressableScale onPress={() => router.push("/(app)/(tabs)/schedule")}>
                  <AppText variant="caption" style={{ color: colors.primary, fontWeight: "600" }}>
                    All Events →
                  </AppText>
                </PressableScale>
              }
            />

            <Card style={styles.eventCard}>
              <View style={styles.eventCardHeader}>
                <View style={[styles.eventDateBadge, { backgroundColor: colors.surface2 }]}>
                  <AppText style={[styles.eventDateMonth, { color: colors.primary }]}>
                    {new Date(nextFunction.date)
                      .toLocaleString("default", { month: "short" })
                      .toUpperCase()}
                  </AppText>
                  <AppText style={[styles.eventDateDay, { color: colors.primary }]}>
                    {new Date(nextFunction.date).getDate()}
                  </AppText>
                </View>
                <View style={styles.eventHeaderInfo}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Badge
                      label={nextFunction.category.toUpperCase()}
                      tone={nextFunction.category === "ritual" ? "warning" : "info"}
                      size="small"
                    />
                    {nextFunction.invitationsCount ? (
                      <Badge
                        label={`${nextFunction.rsvpConfirmed || nextFunction.invitationsCount} Attending`}
                        tone="success"
                        size="small"
                      />
                    ) : null}
                  </View>
                  <AppText variant="subheading" style={styles.eventTitle} numberOfLines={1}>
                    {nextFunction.title}
                  </AppText>
                  <View style={styles.eventMetaRow}>
                    <Ionicons name="time-outline" size={13} color={colors.text.muted} />
                    <AppText variant="caption" style={styles.eventMetaText}>
                      {nextFunction.time}
                    </AppText>
                    <Ionicons
                      name="location-outline"
                      size={13}
                      color={colors.text.muted}
                      style={{ marginLeft: 8 }}
                    />
                    <AppText variant="caption" style={styles.eventMetaText} numberOfLines={1}>
                      {nextFunction.location}
                    </AppText>
                  </View>
                </View>
              </View>

              <AppText variant="body" style={styles.eventDescription} numberOfLines={2}>
                {nextFunction.description}
              </AppText>

              <View style={[styles.eventFooterRow, { borderTopColor: colors.surface2 }]}>
                <AppText variant="caption" style={{ color: colors.text.secondary }}>
                  {nextFunction.tasks.filter((t: { isDone: boolean }) => t.isDone).length} of {nextFunction.tasks.length}{" "}
                  preparations ready
                </AppText>
                <PressableScale
                  style={[styles.gcalBtn, { backgroundColor: colors.primaryAlpha }]}
                  onPress={handleSyncToGoogle}
                >
                  <Ionicons name="calendar-outline" size={13} color={colors.primary} />
                  <AppText
                    variant="caption"
                    style={{ color: colors.primary, fontWeight: "700", marginLeft: 4 }}
                  >
                    Google Sync
                  </AppText>
                </PressableScale>
              </View>
            </Card>
          </View>
        )}

        {/* ── Daily Rhythms Checklist ── */}
        <SectionHeader
          title="Daily Family Rhythms"
          subtitle={`${completedRoutines} of ${routines.length} completed today`}
        />

        <View style={styles.routinesList}>
          {routines.slice(0, 4).map((routine) => (
            <PressableScale
              key={routine.id}
              style={[styles.routineItem, { backgroundColor: colors.surface }]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                toggleRoutineMutation.mutate(routine.id)
              }}
            >
              <View style={styles.routineCheckWrap}>
                <Ionicons
                  name={routine.isCompleted ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={routine.isCompleted ? colors.success : colors.text.muted}
                />
              </View>
              <View style={styles.routineContent}>
                <AppText
                  style={[
                    styles.routineTitle,
                    routine.isCompleted && {
                      textDecorationLine: "line-through",
                      color: colors.text.muted,
                    },
                  ]}
                >
                  {routine.title}
                </AppText>
                <View style={styles.routineMeta}>
                  <AppText variant="caption" style={{ color: colors.text.secondary }}>
                    {routine.time} · {routine.assignedMember}
                  </AppText>
                </View>
              </View>
            </PressableScale>
          ))}
        </View>

        {/* ── Elder Wisdom of the Day (Zero Borders) ── */}
        {pinnedEntries[0] && (
          <Card style={[styles.wisdomCard, { backgroundColor: colors.surface }]}>
            <View style={styles.wisdomTopRow}>
              <Badge label="HEIRLOOM WISDOM" tone="warning" size="small" />
              <AppText variant="caption" style={{ color: colors.text.muted }}>
                Vault Archive
              </AppText>
            </View>
            <AppText variant="subheading" style={styles.wisdomTitle}>
              {pinnedEntries[0].title}
            </AppText>
            <AppText variant="body" style={styles.wisdomBody}>
              &ldquo;{pinnedEntries[0].excerpt}&rdquo;
            </AppText>
            <AppText variant="caption" style={styles.wisdomAuthor}>
              — {pinnedEntries[0].authorName} ({pinnedEntries[0].authorRole})
            </AppText>
          </Card>
        )}

        {/* ── Family Member Detail Sheet ── */}
        <FamilyMemberDetailSheet
          visible={selectedDetailMember !== null}
          member={selectedDetailMember}
          onClose={() => setSelectedDetailMember(null)}
          onSelectRelative={(rel) => setSelectedDetailMember(rel)}
        />
      </ScreenContainer>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  spacesSelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  spaceTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 14,
  },
  activeSpaceBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  aiCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  aiIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  briefingBox: {
    padding: 12,
    borderRadius: 14,
  },
  briefingActionItems: {
    gap: 4,
  },
  briefingBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  aiQuickChips: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 2,
    paddingBottom: 4,
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  notificationTriggerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  testNudgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginLeft: 8,
  },
  loadCard: {
    padding: 16,
    borderRadius: 22,
    marginBottom: 12,
  },
  loadHeader: {
    marginBottom: 12,
  },
  overallLoadBanner: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  progressBarTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  loadStatsList: {
    gap: 8,
  },
  loadMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
  },
  miniAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  miniAvatarText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  memberLoadTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.06)",
    marginTop: 6,
    overflow: "hidden",
  },
  memberLoadFill: {
    height: "100%",
    borderRadius: 3,
  },
  meetingCard: {
    padding: 14,
    borderRadius: 18,
    marginBottom: 8,
  },
  meetingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  meetingMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  joinMeetBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  meetingNotesBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 10,
    marginTop: 10,
  },
  spaceTasksList: {
    gap: 8,
    marginBottom: 8,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
  },
  taskTitleText: {
    fontWeight: "600",
    fontSize: 14,
  },
  membersRow: {
    paddingRight: 16,
    gap: 12,
  },
  memberPill: {
    alignItems: "center",
    width: 72,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    elevation: 1,
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  memberName: {
    fontWeight: "600",
    fontSize: 12,
  },
  memberRole: {
    fontSize: 10,
    color: "#888",
  },
  intentionsRow: {
    gap: 12,
    paddingRight: 16,
  },
  intentionCard: {
    width: 240,
    padding: 14,
    borderRadius: 18,
  },
  intentionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cheerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  intentionTitle: {
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 4,
  },
  intentionDesc: {
    opacity: 0.75,
    marginBottom: 10,
  },
  progressContainer: {
    marginTop: 6,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressBar: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  healthCard: {
    padding: 14,
    borderRadius: 18,
  },
  healthHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  healthStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  healthStatItem: {
    flex: 1,
    alignItems: "center",
  },
  eventCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  eventCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
  },
  eventDateBadge: {
    width: 48,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  eventDateMonth: {
    fontSize: 11,
    fontWeight: "700",
  },
  eventDateDay: {
    fontSize: 18,
    fontWeight: "800",
  },
  eventHeaderInfo: {
    flex: 1,
    gap: 3,
  },
  eventTitle: {
    fontWeight: "700",
  },
  eventMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  eventMetaText: {
    marginLeft: 4,
    opacity: 0.7,
  },
  eventDescription: {
    opacity: 0.85,
    marginBottom: 12,
    lineHeight: 20,
  },
  eventFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  gcalBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  routinesList: {
    gap: 8,
  },
  routineItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
  },
  routineCheckWrap: {
    marginRight: 12,
  },
  routineContent: {
    flex: 1,
  },
  routineTitle: {
    fontWeight: "600",
    fontSize: 14,
  },
  routineMeta: {
    marginTop: 2,
  },
  wisdomCard: {
    padding: 16,
    borderRadius: 18,
    marginTop: 18,
  },
  wisdomTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  wisdomTitle: {
    fontWeight: "700",
    marginBottom: 6,
  },
  wisdomBody: {
    fontStyle: "italic",
    lineHeight: 22,
    opacity: 0.85,
    marginBottom: 8,
  },
  wisdomAuthor: {
    textAlign: "right",
    opacity: 0.7,
  },
  addTaskBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  easyModeBanner: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
  },
  easyModeQuickRow: {
    flexDirection: "row",
    gap: 10,
  },
  easyModeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 6,
  },
  easyModeBtnText: {
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  emptyLoadState: {
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  emptyFamilyCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
})
