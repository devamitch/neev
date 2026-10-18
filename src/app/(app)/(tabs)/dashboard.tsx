import React from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppHeader, HeaderIconButton } from "@/components/ui/AppHeader"
import { openAppDrawer } from "@/components/navigation/AppDrawer"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { PressableScale } from "@/components/ui/PressableScale"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { Squircle } from "@/components/ui/Squircle"
import { useColors } from "@/theme/useTheme"
import { useTabBarInset } from "@/components/navigation/CustomTabBar"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useScheduleStore } from "@/stores/useScheduleStore"
import { useKnowledgeStore } from "@/stores/useKnowledgeStore"
import { useRoutineStore } from "@/stores/useRoutineStore"

export default function DashboardScreen() {
  const colors = useColors()
  const bottomInset = useTabBarInset()

  const household = useFamilyStore((s) => s.household)
  const members = useFamilyStore((s) => s.members)
  const functions = useScheduleStore((s) => s.functions)
  const pinnedEntries = useKnowledgeStore((s) => s.entries.filter((e) => e.isPinned))
  const { routines, toggleRoutine } = useRoutineStore()

  const nextFunction = functions[0]
  const completedRoutines = routines.filter((r) => r.isCompleted).length

  return (
    <ScreenContainer scrollable={false} style={{ backgroundColor: colors.background }}>
      <AppHeader
        title={household.name}
        subtitle={household.motto}
        rightAction={
          <HeaderIconButton
            icon="menu-outline"
            label="Sanctuary Spaces"
            onPress={openAppDrawer}
          />
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Multigenerational Family Row ── */}
        <View style={styles.sectionHeader}>
          <AppText variant="subheading" style={styles.sectionTitle}>
            Family Sanctuary
          </AppText>
          <PressableScale onPress={() => router.push("/(app)/(tabs)/family")}>
            <AppText variant="caption" style={{ color: colors.primary, fontWeight: "600" }}>
              View All ({members.length})
            </AppText>
          </PressableScale>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.membersRow}>
          {members.map((member) => (
            <PressableScale
              key={member.id}
              style={styles.memberPill}
              onPress={() => {
                void Haptics.selectionAsync()
                router.push("/(app)/(tabs)/family")
              }}
            >
              <View style={[styles.avatarCircle, { backgroundColor: member.avatarColor }]}>
                <AppText style={styles.avatarText}>{member.avatarText}</AppText>
              </View>
              <AppText variant="caption" style={styles.memberName} numberOfLines={1}>
                {member.name.split(" ")[0]}
              </AppText>
              <AppText variant="caption" style={styles.memberRole}>
                {member.role === "elder" ? "Elder" : member.role === "parent" ? "Parent" : "Youth"}
              </AppText>
            </PressableScale>
          ))}
        </ScrollView>

        {/* ── Daily Elder Wisdom Card ── */}
        {pinnedEntries.length > 0 && (
          <Card style={[styles.wisdomCard, { backgroundColor: colors.surface }]}>
            <View style={styles.wisdomTopRow}>
              <Badge label="Elder Wisdom" tone="warning" size="small" />
              <Ionicons name="sparkles" size={16} color={colors.primary} />
            </View>
            <AppText variant="body" style={styles.wisdomQuote}>
              "{pinnedEntries[0].body.slice(0, 140)}..."
            </AppText>
            <View style={styles.wisdomAuthorRow}>
              <AppText variant="caption" style={styles.wisdomAuthor}>
                — {pinnedEntries[0].authorName} ({pinnedEntries[0].authorRole})
              </AppText>
              <PressableScale onPress={() => router.push("/(app)/(tabs)/knowledge")}>
                <AppText variant="caption" style={{ color: colors.primary, fontWeight: "600" }}>
                  Read Archive →
                </AppText>
              </PressableScale>
            </View>
          </Card>
        )}

        {/* ── Next Upcoming Family Function ── */}
        {nextFunction && (
          <View style={styles.functionBlock}>
            <View style={styles.sectionHeader}>
              <AppText variant="subheading" style={styles.sectionTitle}>
                Next Family Gathering
              </AppText>
              <PressableScale onPress={() => router.push("/(app)/(tabs)/schedule")}>
                <AppText variant="caption" style={{ color: colors.primary, fontWeight: "600" }}>
                  All Events →
                </AppText>
              </PressableScale>
            </View>

            <Card style={[styles.eventCard, { backgroundColor: colors.surface }]}>
              <View style={styles.eventCardHeader}>
                <View style={styles.eventDateBadge}>
                  <AppText style={styles.eventDateMonth}>
                    {new Date(nextFunction.date).toLocaleString("default", { month: "short" }).toUpperCase()}
                  </AppText>
                  <AppText style={styles.eventDateDay}>
                    {new Date(nextFunction.date).getDate()}
                  </AppText>
                </View>
                <View style={styles.eventHeaderInfo}>
                  <Badge
                    label={nextFunction.category.toUpperCase()}
                    tone={nextFunction.category === "ritual" ? "warning" : "info"}
                    size="small"
                  />
                  <AppText variant="subheading" style={styles.eventTitle} numberOfLines={1}>
                    {nextFunction.title}
                  </AppText>
                  <View style={styles.eventMetaRow}>
                    <Ionicons name="time-outline" size={13} color={colors.text.muted} />
                    <AppText variant="caption" style={styles.eventMetaText}>
                      {nextFunction.time}
                    </AppText>
                    <Ionicons name="location-outline" size={13} color={colors.text.muted} style={{ marginLeft: 8 }} />
                    <AppText variant="caption" style={styles.eventMetaText} numberOfLines={1}>
                      {nextFunction.location}
                    </AppText>
                  </View>
                </View>
              </View>

              <AppText variant="body" style={styles.eventDescription} numberOfLines={2}>
                {nextFunction.description}
              </AppText>

              {/* Task checklist progress */}
              <View style={styles.eventTaskRow}>
                <AppText variant="caption" style={{ color: colors.text.secondary }}>
                  {nextFunction.tasks.filter((t) => t.isDone).length} of {nextFunction.tasks.length} family preparations complete
                </AppText>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${(nextFunction.tasks.filter((t) => t.isDone).length / nextFunction.tasks.length) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* ── Daily Rhythms Checklist ── */}
        <View style={styles.sectionHeader}>
          <View>
            <AppText variant="subheading" style={styles.sectionTitle}>
              Daily Family Rhythms
            </AppText>
            <AppText variant="caption" style={{ color: colors.text.muted }}>
              {completedRoutines} of {routines.length} completed today
            </AppText>
          </View>
        </View>

        <View style={styles.routinesList}>
          {routines.slice(0, 4).map((routine) => (
            <PressableScale
              key={routine.id}
              style={[
                styles.routineItem,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
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
                    routine.isCompleted && { textDecorationLine: "line-through", color: colors.text.muted },
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
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 16,
  },
  sectionTitle: {
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  membersRow: {
    paddingRight: 16,
    gap: 12,
  },
  memberPill: {
    alignItems: "center",
    width: 68,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
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
  wisdomCard: {
    padding: 16,
    borderRadius: 18,
    marginTop: 18,
    borderLeftWidth: 4,
    borderLeftColor: "#DA7756",
  },
  wisdomTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  wisdomQuote: {
    fontStyle: "italic",
    lineHeight: 22,
    color: "#333",
  },
  wisdomAuthorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  wisdomAuthor: {
    fontWeight: "600",
    color: "#777",
  },
  functionBlock: {
    marginTop: 4,
  },
  eventCard: {
    padding: 16,
    borderRadius: 18,
  },
  eventCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  eventDateBadge: {
    backgroundColor: "rgba(218, 119, 86, 0.12)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  eventDateMonth: {
    fontSize: 10,
    fontWeight: "800",
    color: "#DA7756",
  },
  eventDateDay: {
    fontSize: 20,
    fontWeight: "800",
    color: "#DA7756",
  },
  eventHeaderInfo: {
    flex: 1,
  },
  eventTitle: {
    fontWeight: "700",
    fontSize: 16,
    marginTop: 2,
  },
  eventMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  eventMetaText: {
    marginLeft: 3,
    fontSize: 11,
  },
  eventDescription: {
    color: "#555",
    lineHeight: 20,
    fontSize: 13,
  },
  eventTaskRow: {
    marginTop: 14,
    gap: 6,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  routinesList: {
    gap: 8,
  },
  routineItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  routineCheckWrap: {
    marginRight: 12,
  },
  routineContent: {
    flex: 1,
  },
  routineTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  routineMeta: {
    flexDirection: "row",
    marginTop: 2,
  },
})
