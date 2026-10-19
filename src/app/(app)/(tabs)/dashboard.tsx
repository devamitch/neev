import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { router } from "expo-router"
import React from "react"
import { Linking, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { openAppDrawer } from "@/components/navigation/AppDrawer"
import { useTabBarInset } from "@/components/navigation/CustomTabBar"
import { AppHeader, HeaderIconButton } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { PressableScale } from "@/components/ui/PressableScale"
import { FamilySanctuaryMap } from "@/components/location/FamilySanctuaryMap"
import { FamilyWeeklyGamesCard } from "@/components/family/FamilyWeeklyGamesCard"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { neevAiOrchestrator, type LifeDomain } from "@/services/ai/neevAiOrchestrator"
import { neevHeuristicEngine } from "@/services/ai/neevHeuristicEngine"
import { googleServicesClient } from "@/services/google/googleServicesClient"
import { notificationsService } from "@/services/notifications/notificationsService"
import { useCloudSyncStore } from "@/services/sync/cloudSyncEngine"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useIntentionsStore } from "@/stores/useIntentionsStore"
import { useKnowledgeStore } from "@/stores/useKnowledgeStore"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { useRoutineStore } from "@/stores/useRoutineStore"
import { useScheduleStore } from "@/stores/useScheduleStore"
import { useSpacesStore, type SpaceType } from "@/stores/useSpacesStore"
import { useColors } from "@/theme/useTheme"

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

  const household = useFamilyStore((s) => s.household)
  const members = useFamilyStore((s) => s.members)
  const functions = useScheduleStore((s) => s.functions)
  const entries = useKnowledgeStore((s) => s.entries)
  const pinnedEntries = React.useMemo(() => entries.filter((e) => e.isPinned), [entries])

  const { routines, toggleRoutine } = useRoutineStore(
    useShallow((s) => ({ routines: s.routines, toggleRoutine: s.toggleRoutine })),
  )
  const { intentions, cheerIntention } = useIntentionsStore(
    useShallow((s) => ({ intentions: s.intentions, cheerIntention: s.cheerIntention })),
  )
  const { status, lastSyncedAt, healthMetrics } = useCloudSyncStore(
    useShallow((s) => ({ status: s.status, lastSyncedAt: s.lastSyncedAt, healthMetrics: s.healthMetrics })),
  )

  const {
    currentSpace,
    setSpace,
    spaceTasks,
    meetings,
    aiBriefings,
    toggleTask,
  } = useSpacesStore(
    useShallow((s) => ({
      currentSpace: s.currentSpace,
      setSpace: s.setSpace,
      spaceTasks: s.tasks,
      meetings: s.meetings,
      aiBriefings: s.aiBriefings,
      toggleTask: s.toggleTask,
    })),
  )

  const activeSpaceConfig = React.useMemo(
    () => SPACES.find((s) => s.key === currentSpace) || SPACES[1],
    [currentSpace],
  )
  const currentSpaceTasks = React.useMemo(
    () => spaceTasks.filter((t) => t.space === currentSpace),
    [spaceTasks, currentSpace],
  )
  const currentSpaceMeetings = React.useMemo(
    () => meetings.filter((m) => m.space === currentSpace),
    [meetings, currentSpace],
  )
  const currentSpaceBriefing = React.useMemo(
    () => aiBriefings.find((b) => b.space === currentSpace) || aiBriefings[0],
    [aiBriefings, currentSpace],
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

  const handleTestLiveNotification = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    await notificationsService.dispatchImmediateNotification(
      "🔔 [Neev Escalating Nudge]",
      "Child school milestone & interview prep reminder active. 0 AI tokens consumed.",
    )
    showToast({ message: "Escalating reminder dispatched to device tray!", type: "success" })
  }

  const familyLoad = React.useMemo(
    () => neevHeuristicEngine.computeFamilyLoadBalance(spaceTasks, members),
    [spaceTasks, members],
  )

  const openMeetingLink = (url?: string) => {
    if (!url) return
    void Haptics.selectionAsync()
    void Linking.openURL(url)
  }

  return (
    <ScreenContainer
      safeArea
      scrollable
      header={
        <AppHeader
          sticky
          eyebrow="FAMILY SANCTUARY"
          title={household.name || "Neev"}
          subtitle={household.motto}
          rightAction={
            <HeaderIconButton icon="menu-outline" label="Sanctuary Spaces" onPress={openAppDrawer} />
          }
        />
      }
    >

        {/* ── Real-Time Cloud Sync Bar (Zero Borders) ── */}
        <PressableScale
          style={[styles.cloudBar, { backgroundColor: colors.surface }]}
          onPress={() => router.push("/(app)/(profile)/settings")}
        >
          <View style={styles.cloudStatusLeft}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: status === "syncing" ? "#C27835" : "#709758" },
              ]}
            />
            <AppText variant="caption" style={{ fontWeight: "700", color: colors.text.primary }} numberOfLines={1}>
              {status === "syncing" ? "Syncing to Cloud..." : "Supabase Cloud Connected"}
            </AppText>
          </View>
          <View style={styles.cloudStatusRight}>
            <Ionicons name="cloud-done-outline" size={14} color={colors.primary} />
            <AppText variant="caption" style={{ color: colors.primary, fontWeight: "600", marginLeft: 4 }} numberOfLines={1}>
              {lastSyncedAt ? `Synced ${lastSyncedAt}` : "Live Sync"}
            </AppText>
          </View>
        </PressableScale>

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
        <FamilySanctuaryMap />

        {/* ── Real Weekly Multigenerational Family Games ── */}
        <FamilyWeeklyGamesCard />

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
                toggleTask(task.id)
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

        {/* ── Calculated Family Load & Effort Balance (Zero Borders) ── */}
        <Card style={styles.loadCard}>
          <View style={styles.loadHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <AppText variant="subheading" style={{ fontWeight: "700", flex: 1 }} numberOfLines={1}>
                Family Effort & Chore Balance
              </AppText>
              <Badge label="Heuristic Math" tone="info" size="small" style={{ flexShrink: 0 }} />
            </View>
            <AppText variant="caption" style={{ color: colors.text.muted, marginTop: 2 }}>
              Algorithmic task distribution ensures no single member is overwhelmed
            </AppText>
          </View>
          <View style={styles.loadStatsRow}>
            {familyLoad.slice(0, 4).map((fl) => (
              <View
                key={fl.memberId}
                style={[styles.loadStatItem, { backgroundColor: colors.surface2 }]}
              >
                <AppText variant="caption" style={{ fontWeight: "700" }}>
                  {fl.memberName}
                </AppText>
                <AppText
                  variant="body"
                  style={{ color: colors.primary, fontWeight: "700", marginTop: 2 }}
                >
                  {fl.taskCount} {fl.taskCount === 1 ? "task" : "tasks"}
                </AppText>
                <Badge
                  label={fl.loadLevel.toUpperCase()}
                  tone={
                    fl.loadLevel === "heavy"
                      ? "error"
                      : fl.loadLevel === "balanced"
                        ? "warning"
                        : "success"
                  }
                  size="small"
                  style={{ marginTop: 2 }}
                />
              </View>
            ))}
          </View>
        </Card>

        {/* ── Multigenerational Family & Pets Row ── */}
        <SectionHeader
          title="Family & Beloved Pets"
          action={
            <PressableScale onPress={() => router.push("/(app)/(tabs)/family")}>
              <AppText variant="caption" style={{ color: colors.primary, fontWeight: "600" }}>
                View All ({members.length}) →
              </AppText>
            </PressableScale>
          }
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.membersRow}
        >
          {members.map((member) => (
            <PressableScale
              key={member.id}
              style={styles.memberPill}
              onPress={() => router.push("/(app)/(tabs)/family")}
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

        {/* ── Active Family Intentions & Pet Projects ── */}
        <SectionHeader
          title="Intentions & Pet Projects"
          subtitle="Shared Sankalpas & weekend bonding"
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
                    cheerIntention(item.id)
                  }}
                >
                  <AppText style={{ fontSize: 13 }}>👏</AppText>
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
              Today's Gentle Movement Pulse
            </AppText>
            <Badge label="Google Fit Sync" tone="success" size="small" />
          </View>
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
                        label={`✉️ ${nextFunction.rsvpConfirmed || nextFunction.invitationsCount} Attending`}
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
                  {nextFunction.tasks.filter((t) => t.isDone).length} of {nextFunction.tasks.length}{" "}
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
                toggleRoutine(routine.id)
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
              "{pinnedEntries[0].excerpt}"
            </AppText>
            <AppText variant="caption" style={styles.wisdomAuthor}>
              — {pinnedEntries[0].authorName} ({pinnedEntries[0].authorRole})
            </AppText>
          </Card>
        )}
      </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  topBarLeft: {
    flex: 1,
    marginRight: 12,
  },
  topBarTitle: {
    fontWeight: "700",
    fontSize: 16,
  },
  mottoSection: {
    marginBottom: 12,
    marginTop: 4,
  },
  heroTitle: {
    fontWeight: "800",
    fontSize: 22,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cloudBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 10,
  },
  cloudStatusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cloudStatusRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
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
    borderRadius: 20,
    marginBottom: 8,
  },
  loadHeader: {
    marginBottom: 12,
  },
  loadStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  loadStatItem: {
    width: "48.5%",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    gap: 4,
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
})
