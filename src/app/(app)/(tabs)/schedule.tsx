import React, { useCallback, useMemo, useState } from "react"
import { FlatList, ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppHeader, HeaderIconButton } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { PressableScale } from "@/components/ui/PressableScale"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { FamilyWeeklyGamesCard } from "@/components/family/FamilyWeeklyGamesCard"
import { useColors } from "@/theme/useTheme"
import { useTabBarInset } from "@/components/navigation/CustomTabBar"
import { useScheduleStore, type FunctionCategory, type FamilyFunction, type FunctionTask } from "@/stores/useScheduleStore"
import { useFamilyStore } from "@/stores/useFamilyStore"

import { googleServicesClient } from "@/services/google/googleServicesClient"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { useScheduleQuery, useToggleScheduleTaskMutation } from "@/hooks/useScheduleQuery"

const CATEGORIES: { key: FunctionCategory | "all"; label: string }[] = [
  { key: "all", label: "All Functions" },
  { key: "celebration", label: "Celebrations" },
  { key: "gathering", label: "Family Gatherings" },
  { key: "outing", label: "Outings & Picnics" },
  { key: "ritual", label: "Traditions & Observances" },
  { key: "project", label: "Pet & House Projects" },
]

export default function ScheduleScreen() {
  const colors = useColors()
  const bottomInset = useTabBarInset()
  const [selectedCat, setSelectedCat] = useState<FunctionCategory | "all">("all")

  const { data: queryFunctions } = useScheduleQuery()
  const toggleTaskMutation = useToggleScheduleTaskMutation()
  const storeFunctions = useScheduleStore((s) => s.functions)
  const functions = queryFunctions || storeFunctions

  const toggleTask = useCallback(
    (functionId: string, taskId: string) => {
      toggleTaskMutation.mutate({ functionId, taskId })
    },
    [toggleTaskMutation],
  )

  const members = useFamilyStore((s) => s.members)

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m.name.split(" ")[0]])),
    [members],
  )

  const filteredFunctions = useMemo(
    () =>
      selectedCat === "all"
        ? functions
        : functions.filter((f) => f.category === selectedCat),
    [selectedCat, functions],
  )

  const renderItem = useCallback(
    ({ item: event }: { item: FamilyFunction }) => {
      const daysLeft = Math.ceil(
        (new Date(event.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      )

      return (
        <Card style={[styles.eventCard, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <View style={styles.badgeGroup}>
              <Badge
                label={event.category.toUpperCase()}
                tone={event.category === "ritual" ? "warning" : "info"}
                size="small"
              />
              {daysLeft >= 0 && (
                <View style={[styles.countdownPill, { backgroundColor: colors.primaryAlpha }]}>
                  <AppText variant="caption" style={{ color: colors.primary, fontWeight: "700" }}>
                    {daysLeft === 0 ? "TODAY" : `${daysLeft} DAYS AWAY`}
                  </AppText>
                </View>
              )}
            </View>
            <AppText variant="caption" style={{ color: colors.text.muted }}>
              {event.date}
            </AppText>
          </View>

          <AppText variant="subheading" style={styles.eventTitle}>
            {event.title}
          </AppText>

          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={colors.text.muted} />
            <AppText variant="caption" style={styles.metaText}>
              {event.time}
            </AppText>
            <Ionicons name="location-outline" size={14} color={colors.text.muted} style={{ marginLeft: 10 }} />
            <AppText variant="caption" style={styles.metaText} numberOfLines={1}>
              {event.location}
            </AppText>
          </View>

          <AppText variant="body" style={styles.description}>
            {event.description}
          </AppText>

          {/* Family Preparations / Delegated Tasks */}
          {event.tasks && event.tasks.length > 0 && (
            <View style={styles.tasksSection}>
              <AppText variant="caption" style={styles.tasksHeader}>
                FAMILY RESPONSIBILITIES ({event.tasks.filter((t: FunctionTask) => t.isDone).length}/{event.tasks.length})
              </AppText>

              {event.tasks.map((task: FunctionTask) => (
                <PressableScale
                  key={task.id}
                  style={styles.taskItem}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    toggleTask(event.id, task.id)
                  }}
                >
                  <Ionicons
                    name={task.isDone ? "checkbox" : "square-outline"}
                    size={20}
                    color={task.isDone ? colors.success : colors.text.muted}
                  />
                  <AppText
                    style={[
                      styles.taskTitle,
                      task.isDone && { textDecorationLine: "line-through", color: colors.text.muted },
                    ]}
                  >
                    {task.title}
                  </AppText>
                  <View style={[styles.assigneeChip, { backgroundColor: colors.surface2 }]}>
                    <AppText variant="caption" style={styles.assigneeText}>
                      {memberMap.get(task.assignedToMemberId) || "Family"}
                    </AppText>
                  </View>
                </PressableScale>
              ))}
            </View>
          )}
        </Card>
      )
    },
    [colors, memberMap, toggleTask],
  )

  const listHeader = useMemo(
    () => (
      <View style={{ marginBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {CATEGORIES.map((cat) => {
            const active = selectedCat === cat.key
            return (
              <PressableScale
                key={cat.key}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? colors.primary : colors.surface2,
                  },
                ]}
                onPress={() => {
                  void Haptics.selectionAsync()
                  setSelectedCat(cat.key)
                }}
              >
                <AppText
                  variant="caption"
                  style={[styles.filterPillText, { color: active ? "#FFFFFF" : colors.text.secondary }]}
                >
                  {cat.label}
                </AppText>
              </PressableScale>
            )
          })}
        </ScrollView>
      </View>
    ),
    [colors, selectedCat],
  )

  const listFooter = useMemo(
    () => (
      <View style={{ paddingTop: 16, paddingBottom: bottomInset + 32 }}>
        <FamilyWeeklyGamesCard />
        <AppButton
          title="+ Schedule New Family Function"
          variant="primary"
          onPress={() => router.push("/modal/add-event")}
          style={{ marginTop: 20 }}
        />
      </View>
    ),
    [bottomInset],
  )

  const emptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={40} color={colors.text.muted} />
        <AppText variant="subheading" style={{ marginTop: 8, color: colors.text.secondary }}>
          No functions scheduled in this category
        </AppText>
      </View>
    ),
    [colors],
  )

  return (
    <ScreenContainer
      safeArea
      scrollable={false}
      header={
        <AppHeader
          sticky
          title="Family Functions"
          subtitle="Shared Schedulers, Rituals & Delegations"
          showBack={false}
          rightAction={
            <HeaderIconButton
              icon="add"
              label="Schedule Function"
              onPress={() => router.push("/modal/add-event")}
            />
          }
        />
      }
    >
      <FlatList
        data={filteredFunctions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={emptyComponent}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  filterRow: {
    gap: 8,
    marginBottom: 16,
    paddingRight: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterPillText: {
    fontWeight: "600",
  },
  eventCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeGroup: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  countdownPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  eventTitle: {
    fontWeight: "700",
    fontSize: 17,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 8,
  },
  metaText: {
    marginLeft: 3,
    fontSize: 12,
  },
  description: {
    color: "#555",
    lineHeight: 20,
    fontSize: 13,
  },
  tasksSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  tasksHeader: {
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 0.5,
    color: "#888",
    marginBottom: 8,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 10,
  },
  taskTitle: {
    flex: 1,
    fontSize: 13,
  },
  assigneeChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  assigneeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#555",
  },
})
