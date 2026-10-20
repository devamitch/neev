import { Ionicons } from "@expo/vector-icons"
import { useQueryClient } from "@tanstack/react-query"
import * as Haptics from "expo-haptics"
import React, { memo, useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"

import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { PressableScale } from "@/components/ui/PressableScale"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useRootStore } from "@/stores/useRootStore"
import { useScheduleStore } from "@/stores/useScheduleStore"
import { useColors } from "@/theme/useTheme"

export interface RealFamilyGame {
  id: string
  title: string
  tagline: string
  vibe: string
  durationMins: number
  recommendedDay: string
  minPlayers: string
  icon: keyof typeof Ionicons.glyphMap
  rules: string[]
  scoring: string
}

const REAL_FAMILY_GAMES: RealFamilyGame[] = [
  {
    id: "game-carrom",
    title: "Carrom & Chai Championship",
    tagline: "Wooden board match in the family living room",
    vibe: "Intergenerational Friendly Rivalry",
    durationMins: 45,
    recommendedDay: "Sunday 05:00 PM",
    minPlayers: "2 to 4 Players",
    icon: "disc-outline",
    rules: [
      "No device screens during match time.",
      "Pair an elder with a younger player for balanced teams.",
      "Winning team is exempted from post-dinner kitchen chores!",
    ],
    scoring: "White: 10 pts, Black: 5 pts, Queen: 25 pts",
  },
  {
    id: "game-antakshari",
    title: "Family Melodies Circle",
    tagline: "Vocal singing and classic song recollection",
    vibe: "Heartwarming Nostalgia & Chorus",
    durationMins: 30,
    recommendedDay: "Friday 08:30 PM",
    minPlayers: "All Generations",
    icon: "musical-notes-outline",
    rules: [
      "Songs must be sung aloud together — zero playback streaming.",
      "Elders introduce a vintage classic for every modern track picked.",
      "Singing the chorus together earns bonus points.",
    ],
    scoring: "3 pts per song started within 10 seconds of letter call.",
  },
  {
    id: "game-charades",
    title: "Family Dumb Charades",
    tagline: "Physical silent acting of movies and shared family quirks",
    vibe: "High Laughter & Motion",
    durationMins: 35,
    recommendedDay: "Saturday 08:00 PM",
    minPlayers: "4+ Players",
    icon: "body-outline",
    rules: [
      "Act out classic movies, traditions, or habits without speaking.",
      "60-second timer per turn.",
      "Pure physical expression — zero props or mouthing words.",
    ],
    scoring: "1 pt per successful family guess within 60 seconds.",
  },
  {
    id: "game-trivia",
    title: "Oral History & Memory Quest",
    tagline: "Elders share real childhood memories; kids solve the clues",
    vibe: "Oral History & Wisdom Passing",
    durationMins: 40,
    recommendedDay: "Wednesday Evening",
    minPlayers: "All Generations",
    icon: "book-outline",
    rules: [
      "An elder shares a genuine story from their youth or ancestral home.",
      "Younger members listen carefully to solve three riddle questions.",
      "Best recollection is recorded into the Family Sanctuary Vault.",
    ],
    scoring: "Story immortalized into Knowledge Sanctuary.",
  },
]

export interface FamilyWeeklyGamesCardProps {
  compact?: boolean
}

export const FamilyWeeklyGamesCard = memo(function FamilyWeeklyGamesCard({
  compact = false,
}: FamilyWeeklyGamesCardProps) {
  const colors = useColors()
  const showToast = useRootStore((s) => s.showToast)
  const addFunction = useScheduleStore((s) => s.addFunction)
  const queryClient = useQueryClient()

  const [activeGameIdx, setActiveGameIdx] = useState(0)
  const [teamScoreA, setTeamScoreA] = useState(0)
  const [teamScoreB, setTeamScoreB] = useState(0)
  const [isScorerActive, setIsScorerActive] = useState(false)

  const game = REAL_FAMILY_GAMES[activeGameIdx]
  const members = useFamilyStore((s) => s.members)

  const teamAName = useMemo(
    () => (members.length >= 1 ? `Team ${members[0].name.split(" ")[0]}` : "Team 1"),
    [members],
  )
  const teamBName = useMemo(
    () => (members.length >= 2 ? `Team ${members[1].name.split(" ")[0]}` : "Team 2"),
    [members],
  )

  const handleNextGame = () => {
    void Haptics.selectionAsync()
    setActiveGameIdx((prev) => (prev + 1) % REAL_FAMILY_GAMES.length)
    setTeamScoreA(0)
    setTeamScoreB(0)
  }

  const handleScheduleWeekly = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    const primaryAssignee = members[0]?.id || ""
    const secondaryAssignee = members[1]?.id || members[0]?.id || ""

    addFunction({
      title: `Family Ritual: ${game.title}`,
      date: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
      time: "06:00 PM",
      location: "Sanctuary Living Room",
      category: "celebration",
      description: `${game.tagline}\n\nVibe: ${game.vibe}\nRules:\n• ${game.rules.join("\n• ")}`,
      vibe: game.vibe,
      invitationsCount: members.length || 1,
      reminderSet: true,
      tasks: [
        {
          id: `t-${Date.now()}-1`,
          title: "Set up game area & seats",
          assignedToMemberId: primaryAssignee,
          isDone: false,
        },
        {
          id: `t-${Date.now()}-2`,
          title: "Prepare evening tea & refreshments",
          assignedToMemberId: secondaryAssignee,
          isDone: false,
        },
      ],
    })
    void queryClient.invalidateQueries({ queryKey: ["schedule", "functions"] })
    showToast({
      message: `Weekly game scheduled in Family Functions!`,
      type: "success",
    })
  }

  return (
    <Card style={[styles.card, { backgroundColor: colors.surface }]}>
      {/* ── Header Row ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrap, { backgroundColor: colors.surface2 }]}>
            <Ionicons name={game.icon} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <AppText variant="overline" style={{ color: colors.accentText, letterSpacing: 0.8 }}>
              SCREEN-FREE BONDING
            </AppText>
            <AppText variant="subheading" style={styles.cardTitle}>
              Family Game of the Week
            </AppText>
          </View>
        </View>

        <PressableScale
          style={[styles.switchGameBtn, { backgroundColor: colors.surface2 }]}
          onPress={handleNextGame}
        >
          <Ionicons name="dice-outline" size={15} color={colors.primary} />
          <AppText variant="caption" style={[styles.switchGameText, { color: colors.primary }]}>
            Change
          </AppText>
        </PressableScale>
      </View>

      {/* ── Active Game Details ── */}
      <View style={[styles.gameBox, { backgroundColor: colors.surface2 }]}>
        <View style={styles.gameTitleRow}>
          <AppText variant="h3" style={[styles.gameHeading, { color: colors.text.primary }]}>
            {game.title}
          </AppText>
          <Badge label={game.minPlayers} tone="neutral" size="small" />
        </View>

        <AppText variant="body" style={[styles.gameTagline, { color: colors.primary }]}>
          {game.tagline}
        </AppText>

        {(!compact || isScorerActive) && (
          <View style={styles.rulesList}>
            {game.rules.map((rule, idx) => (
              <View key={idx} style={styles.ruleItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={colors.primary}
                  style={styles.ruleIcon}
                />
                <AppText variant="caption" style={[styles.ruleText, { color: colors.text.secondary }]}>
                  {rule}
                </AppText>
              </View>
            ))}
          </View>
        )}

        {/* Real Scorekeeper Widget */}
        {isScorerActive && (
          <View style={[styles.scorekeeperBox, { backgroundColor: colors.surface }]}>
            <AppText variant="overline" style={styles.scoreboardTitle}>
              MATCH SCOREBOARD
            </AppText>
            <View style={styles.scoreRow}>
              {/* Team 1 */}
              <View style={styles.teamCol}>
                <AppText variant="caption" style={[styles.teamName, { color: colors.primary }]}>
                  {teamAName}
                </AppText>
                <AppText variant="display" style={styles.scoreDigits}>
                  {teamScoreA}
                </AppText>
                <View style={styles.scoreBtnRow}>
                  <PressableScale
                    style={[styles.scoreBtn, { backgroundColor: colors.surface2 }]}
                    onPress={() => setTeamScoreA((s) => Math.max(0, s - 1))}
                  >
                    <AppText style={styles.scoreBtnText}>-1</AppText>
                  </PressableScale>
                  <PressableScale
                    style={[styles.scoreBtn, { backgroundColor: colors.surface2 }]}
                    onPress={() => setTeamScoreA((s) => s + 1)}
                  >
                    <AppText style={styles.scoreBtnText}>+1</AppText>
                  </PressableScale>
                  <PressableScale
                    style={[styles.scoreBtn, { backgroundColor: colors.surface2 }]}
                    onPress={() => setTeamScoreA((s) => s + 5)}
                  >
                    <AppText style={styles.scoreBtnText}>+5</AppText>
                  </PressableScale>
                </View>
              </View>

              <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />

              {/* Team 2 */}
              <View style={styles.teamCol}>
                <AppText variant="caption" style={[styles.teamName, { color: colors.primary }]}>
                  {teamBName}
                </AppText>
                <AppText variant="display" style={styles.scoreDigits}>
                  {teamScoreB}
                </AppText>
                <View style={styles.scoreBtnRow}>
                  <PressableScale
                    style={[styles.scoreBtn, { backgroundColor: colors.surface2 }]}
                    onPress={() => setTeamScoreB((s) => Math.max(0, s - 1))}
                  >
                    <AppText style={styles.scoreBtnText}>-1</AppText>
                  </PressableScale>
                  <PressableScale
                    style={[styles.scoreBtn, { backgroundColor: colors.surface2 }]}
                    onPress={() => setTeamScoreB((s) => s + 1)}
                  >
                    <AppText style={styles.scoreBtnText}>+1</AppText>
                  </PressableScale>
                  <PressableScale
                    style={[styles.scoreBtn, { backgroundColor: colors.surface2 }]}
                    onPress={() => setTeamScoreB((s) => s + 5)}
                  >
                    <AppText style={styles.scoreBtnText}>+5</AppText>
                  </PressableScale>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <PressableScale
            style={[
              styles.actionBtn,
              { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
            ]}
            onPress={() => {
              void Haptics.selectionAsync()
              setIsScorerActive((v) => !v)
            }}
          >
            <Ionicons
              name={isScorerActive ? "chevron-up" : "trophy-outline"}
              size={15}
              color={colors.text.primary}
            />
            <AppText variant="caption" style={[styles.actionBtnLabel, { color: colors.text.primary }]}>
              {isScorerActive ? "Hide Scores" : "Scorekeeper"}
            </AppText>
          </PressableScale>

          <PressableScale
            style={[styles.actionBtn, { backgroundColor: "#DA7756" }]}
            onPress={handleScheduleWeekly}
          >
            <Ionicons name="calendar-outline" size={15} color="#FFFFFF" />
            <AppText variant="caption" style={[styles.actionBtnLabel, { color: "#FFFFFF" }]}>
              Add to Schedule
            </AppText>
          </PressableScale>
        </View>
      </View>
    </Card>
  )
})

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 22,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  switchGameBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  switchGameText: {
    fontWeight: "700",
    fontSize: 12,
  },
  gameBox: {
    padding: 14,
    borderRadius: 16,
  },
  gameTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gameHeading: {
    fontWeight: "800",
    fontSize: 17,
    flex: 1,
    marginRight: 8,
  },
  gameTagline: {
    fontWeight: "600",
    fontSize: 13,
    marginTop: 3,
  },
  rulesList: {
    marginTop: 10,
    gap: 6,
  },
  ruleItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  ruleIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  ruleText: {
    flex: 1,
    lineHeight: 18,
  },
  scorekeeperBox: {
    padding: 14,
    borderRadius: 16,
    marginTop: 12,
  },
  scoreboardTitle: {
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 1,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  teamCol: {
    alignItems: "center",
    flex: 1,
  },
  teamName: {
    fontWeight: "700",
    fontSize: 12,
  },
  scoreDigits: {
    fontWeight: "800",
    fontSize: 32,
    lineHeight: 38,
    marginVertical: 2,
  },
  scoreBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  scoreBtn: {
    minWidth: 40,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  scoreBtnText: {
    fontWeight: "700",
    fontSize: 13,
  },
  scoreDivider: {
    width: 1,
    height: 52,
    marginHorizontal: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  actionBtnLabel: {
    fontWeight: "700",
    fontSize: 13,
  },
})

export default FamilyWeeklyGamesCard
