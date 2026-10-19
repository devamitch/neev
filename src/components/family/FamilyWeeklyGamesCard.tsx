import React, { memo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppButton } from "@/components/ui/AppButton"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { PressableScale } from "@/components/ui/PressableScale"
import { useScheduleStore } from "@/stores/useScheduleStore"
import { useRootStore } from "@/stores/useRootStore"
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
    title: "Sunday Carrom & Chai Championship",
    tagline: "Real wooden board match in the living room",
    vibe: "Intergenerational Friendly Rivalry",
    durationMins: 45,
    recommendedDay: "Sunday 05:00 PM",
    minPlayers: "2 to 4 Players",
    icon: "disc-outline",
    rules: [
      "No screens allowed during match time.",
      "Pair one elder with one youth for fair team balance (e.g. Dadu + Aarav vs Papa + Maa).",
      "Winning team is exempted from post-dinner kitchen chores!",
    ],
    scoring: "White: 10 pts, Black: 5 pts, Queen + Cover: 25 pts",
  },
  {
    id: "game-antakshari",
    title: "Antakshari & Old Melodies Circle",
    tagline: "Vocal singing and golden era song recollection",
    vibe: "Heartwarming Nostalgia & Chorus",
    durationMins: 30,
    recommendedDay: "Friday 08:30 PM",
    minPlayers: "Entire Family",
    icon: "musical-notes-outline",
    rules: [
      "Songs must be sung aloud together — zero playback streaming.",
      "Elders introduce a 1960s-1980s classic for every Bollywood track youth pick.",
      "Singing the mukhda together earns a bonus point.",
    ],
    scoring: "3 pts per song started within 10 seconds of letter call.",
  },
  {
    id: "game-charades",
    title: "Family Dumb Charades & Mimicry",
    tagline: "Physical silent acting of movies and family quirks",
    vibe: "High Laughter & Motion",
    durationMins: 35,
    recommendedDay: "Saturday 08:00 PM",
    minPlayers: "4+ Players",
    icon: "body-outline",
    rules: [
      "Act out classic movies, family traditions, or elder habits without speaking.",
      "60-second sand/phone timer per turn.",
      "Pure physical expression — zero props or mouth movement.",
    ],
    scoring: "1 pt per successful family guess within 60 seconds.",
  },
  {
    id: "game-trivia",
    title: "Ancestral Storytelling & Memory Treasure",
    tagline: "Elders share real childhood tales; youth solve the puzzle",
    vibe: "Oral History & Wisdom Passing",
    durationMins: 40,
    recommendedDay: "Wednesday Evening",
    minPlayers: "All Generations",
    icon: "sparkles-outline",
    rules: [
      "Dadu or Dida shares a real memory from their ancestral home or youth.",
      "Grandkids listen carefully and must answer 3 riddle questions about the story.",
      "Best answer earns the official story badge in Neev Vault.",
    ],
    scoring: "Story recorded directly into Knowledge Sanctuary Vault.",
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

  const [activeGameIdx, setActiveGameIdx] = useState(0)
  const [teamScoreA, setTeamScoreA] = useState(0)
  const [teamScoreB, setTeamScoreB] = useState(0)
  const [isScorerActive, setIsScorerActive] = useState(false)

  const game = REAL_FAMILY_GAMES[activeGameIdx]

  const handleNextGame = () => {
    void Haptics.selectionAsync()
    setActiveGameIdx((prev) => (prev + 1) % REAL_FAMILY_GAMES.length)
    setTeamScoreA(0)
    setTeamScoreB(0)
  }

  const handleScheduleWeekly = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    addFunction({
      title: `Weekly Real Family Game: ${game.title}`,
      date: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
      time: "06:00 PM",
      location: "Sanctuary Living Room",
      category: "celebration",
      description: `${game.tagline}\n\nVibe: ${game.vibe}\nRules:\n• ${game.rules.join("\n• ")}`,
      vibe: game.vibe,
      invitationsCount: 5,
      reminderSet: true,
      tasks: [
        { id: `t-${Date.now()}-1`, title: "Set up game area & chairs", assignedToMemberId: "m-3", isDone: false },
        { id: `t-${Date.now()}-2`, title: "Prepare evening snacks & chai", assignedToMemberId: "m-4", isDone: false },
      ],
    })
    showToast({
      message: `Weekly real game ritual scheduled in Family Functions!`,
      type: "success",
    })
  }

  return (
    <Card style={styles.card}>
      {/* ── Header Row ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrap, { backgroundColor: colors.surface2 }]}>
            <Ionicons name={game.icon} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <AppText variant="subheading" style={{ fontWeight: "700" }}>
                Real Family Game of the Week
              </AppText>
              <Badge label="100% Real · No Screens" tone="success" size="small" />
            </View>
            <AppText variant="caption" style={{ color: colors.text.muted }}>
              Screen-free multigenerational laughter & bonding
            </AppText>
          </View>
        </View>

        <PressableScale
          style={[styles.switchGameBtn, { backgroundColor: colors.surface2 }]}
          onPress={handleNextGame}
        >
          <Ionicons name="shuffle-outline" size={14} color={colors.primary} />
          <AppText variant="caption" style={{ color: colors.primary, fontWeight: "700", marginLeft: 4 }}>
            Spin
          </AppText>
        </PressableScale>
      </View>

      {/* ── Active Game Details ── */}
      <View style={[styles.gameBox, { backgroundColor: colors.surface2 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <AppText variant="h3" style={{ fontWeight: "800", color: colors.text.primary, flex: 1 }}>
            {game.title}
          </AppText>
          <Badge label={game.minPlayers} tone="neutral" size="small" />
        </View>

        <AppText variant="body" style={{ color: colors.primary, fontWeight: "600", marginTop: 2 }}>
          {game.tagline}
        </AppText>

        {(!compact || isScorerActive) && (
          <View style={styles.rulesList}>
            {game.rules.map((rule, idx) => (
              <View key={idx} style={styles.ruleItem}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginRight: 6, marginTop: 2 }} />
                <AppText variant="caption" style={{ flex: 1, color: colors.text.secondary, lineHeight: 18 }}>
                  {rule}
                </AppText>
              </View>
            ))}
          </View>
        )}

        {/* Real Scorekeeper Widget */}
        {isScorerActive ? (
          <View style={[styles.scorekeeperBox, { backgroundColor: colors.surface }]}>
            <AppText variant="caption" style={{ fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
              REAL MATCH SCOREBOARD
            </AppText>
            <View style={styles.scoreRow}>
              {/* Team Elders & Youth */}
              <View style={styles.teamCol}>
                <AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>
                  Team Dadu & Aarav
                </AppText>
                <AppText variant="h1" style={{ fontWeight: "800", marginVertical: 4 }}>
                  {teamScoreA}
                </AppText>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <PressableScale
                    style={[styles.scoreBtn, { backgroundColor: colors.surface2 }]}
                    onPress={() => setTeamScoreA((s) => s + 5)}
                  >
                    <AppText style={{ fontWeight: "700" }}>+5</AppText>
                  </PressableScale>
                  <PressableScale
                    style={[styles.scoreBtn, { backgroundColor: colors.surface2 }]}
                    onPress={() => setTeamScoreA((s) => s + 10)}
                  >
                    <AppText style={{ fontWeight: "700" }}>+10</AppText>
                  </PressableScale>
                </View>
              </View>

              <View style={styles.scoreDivider} />

              {/* Team Parents */}
              <View style={styles.teamCol}>
                <AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>
                  Team Papa & Maa
                </AppText>
                <AppText variant="h1" style={{ fontWeight: "800", marginVertical: 4 }}>
                  {teamScoreB}
                </AppText>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <PressableScale
                    style={[styles.scoreBtn, { backgroundColor: colors.surface2 }]}
                    onPress={() => setTeamScoreB((s) => s + 5)}
                  >
                    <AppText style={{ fontWeight: "700" }}>+5</AppText>
                  </PressableScale>
                  <PressableScale
                    style={[styles.scoreBtn, { backgroundColor: colors.surface2 }]}
                    onPress={() => setTeamScoreB((s) => s + 10)}
                  >
                    <AppText style={{ fontWeight: "700" }}>+10</AppText>
                  </PressableScale>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <AppButton
            title={isScorerActive ? "Hide Scorekeeper" : "📊 Real Scorekeeper"}
            variant="outline"
            size="sm"
            onPress={() => {
              void Haptics.selectionAsync()
              setIsScorerActive((v) => !v)
            }}
            style={{ flex: 1 }}
          />

          <AppButton
            title="📅 Schedule Match"
            variant="primary"
            size="sm"
            onPress={handleScheduleWeekly}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Card>
  )
})

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  switchGameBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  gameBox: {
    padding: 14,
    borderRadius: 16,
  },
  rulesList: {
    marginTop: 8,
    gap: 6,
  },
  ruleItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  scorekeeperBox: {
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
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
  scoreDivider: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  scoreBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
})

export default FamilyWeeklyGamesCard
