import React, { memo, useEffect, useState } from "react"
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg"

import { AppButton } from "@/components/ui/AppButton"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { PressableScale } from "@/components/ui/PressableScale"
import {
  familyLocationService,
  type FamilyLocationData,
  type PhoneRadarScan,
} from "@/services/location/familyLocationService"
import { googleServicesClient } from "@/services/google/googleServicesClient"
import { useScheduleStore } from "@/stores/useScheduleStore"
import { useRootStore } from "@/stores/useRootStore"
import { useColors } from "@/theme/useTheme"

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")
const MAP_HEIGHT = 220

export interface DineOutSuggestion {
  id: string
  name: string
  vibe: string
  cuisine: string
  rating: number
  distanceMins: number
  elderFriendly: boolean
  petFriendly: boolean
  aiReason: string
}

const DINE_OUT_SUGGESTIONS: DineOutSuggestion[] = [
  {
    id: "do-1",
    name: "Oh! Calcutta (Silver Spring)",
    vibe: "Heirloom Traditional Dining",
    cuisine: "Authentic Bengali & Comfort Curries",
    rating: 4.8,
    distanceMins: 14,
    elderFriendly: true,
    petFriendly: false,
    aiReason: "Equidistant for all family members. Gentle elevator access and quiet acoustic corners loved by Dadu & Dida.",
  },
  {
    id: "do-2",
    name: "Eco Park Lakeside Bistro",
    vibe: "Open Breeze & Garden Picnic",
    cuisine: "Family Platters, Sandwiches & Fresh Juices",
    rating: 4.7,
    distanceMins: 8,
    elderFriendly: true,
    petFriendly: true,
    aiReason: "Outdoor lawn area allows Simba to join. Right along Dadu's morning walkway with zero staircase barriers.",
  },
  {
    id: "do-3",
    name: "Flurys Heritage Tea Room",
    vibe: "Afternoon High Tea & Stories",
    cuisine: "English Pastries, Darjeeling First Flush & Patties",
    rating: 4.9,
    distanceMins: 20,
    elderFriendly: true,
    petFriendly: false,
    aiReason: "Great weekend afternoon memory spot for Aarav's school celebrations and storytelling.",
  },
]

export interface FamilySanctuaryMapProps {
  onSelectMember?: (member: FamilyLocationData) => void
  userRole?: string
  compact?: boolean
}

export const FamilySanctuaryMap = memo(function FamilySanctuaryMap({
  onSelectMember,
  compact = false,
}: FamilySanctuaryMapProps) {
  const colors = useColors()
  const showToast = useRootStore((s) => s.showToast)
  const addFunction = useScheduleStore((s) => s.addFunction)

  const [locations, setLocations] = useState<FamilyLocationData[]>([])
  const [selectedMember, setSelectedMember] = useState<FamilyLocationData | null>(null)
  const [finderModalVisible, setFinderModalVisible] = useState(false)
  const [fullscreenMapVisible, setFullscreenMapVisible] = useState(false)
  const [dineoutModalVisible, setDineoutModalVisible] = useState(false)
  const [radarScan, setRadarScan] = useState<PhoneRadarScan | null>(null)
  const [isSirenActive, setIsSirenActive] = useState(false)
  const [isStrobeActive, setIsStrobeActive] = useState(false)

  // Zoom and pan shared values for interactive full-screen map
  const zoomScale = useSharedValue(1)
  const panX = useSharedValue(0)
  const panY = useSharedValue(0)

  // Strobe & Radar animations
  const strobeOpacity = useSharedValue(1)
  const radarPulse = useSharedValue(1)

  useEffect(() => {
    const load = () => {
      const data = familyLocationService.getAllFamilyLocations()
      setLocations(data)
      setSelectedMember((prev) => prev || data.find((d) => d.memberId === "m-4") || data[0] || null)
    }
    load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    radarPulse.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 1200, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      true,
    )
  }, [radarPulse])

  useEffect(() => {
    if (isStrobeActive) {
      strobeOpacity.value = withRepeat(
        withSequence(
          withTiming(0.1, { duration: 140 }),
          withTiming(1, { duration: 140 }),
        ),
        -1,
        true,
      )
    } else {
      strobeOpacity.value = 1
    }
  }, [isStrobeActive, strobeOpacity])

  const handleOpenFinder = (member: FamilyLocationData) => {
    void Haptics.selectionAsync()
    const scan = familyLocationService.getPrecisionRadarScan(member.memberId)
    setRadarScan(scan)
    setSelectedMember(member)
    setFinderModalVisible(true)
  }

  const toggleSiren = () => {
    if (isSirenActive) {
      familyLocationService.stopPhoneSiren()
      setIsSirenActive(false)
      setIsStrobeActive(false)
    } else {
      familyLocationService.startPhoneSiren(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      })
      setIsSirenActive(true)
      setIsStrobeActive(true)
    }
  }

  const handleZoom = (factor: number) => {
    void Haptics.selectionAsync()
    const next = Math.max(0.8, Math.min(3.2, zoomScale.value * factor))
    zoomScale.value = withSpring(next)
  }

  const handleResetZoom = () => {
    void Haptics.selectionAsync()
    zoomScale.value = withSpring(1)
    panX.value = withSpring(0)
    panY.value = withSpring(0)
  }

  const handleScheduleDineOut = async (suggestion: DineOutSuggestion) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    const newFn = {
      id: `fn-${Date.now()}`,
      title: `Family Dine-Out @ ${suggestion.name}`,
      date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
      time: "07:30 PM",
      location: suggestion.name,
      category: "outing" as const,
      description: `${suggestion.vibe} · ${suggestion.aiReason}`,
      vibe: "Casual Multigenerational Celebration",
      invitationsCount: locations.length,
      reminderSet: true,
      tasks: [
        { id: `t-${Date.now()}-1`, title: "Reserve elder-friendly corner table", assignedToMemberId: "m-3", isDone: false },
        { id: `t-${Date.now()}-2`, title: "Confirm menu & dietary notes with Dida", assignedToMemberId: "m-4", isDone: false },
      ],
    }

    addFunction(newFn)
    void googleServicesClient.exportFunctionToCalendar(newFn)
    setDineoutModalVisible(false)
    showToast({
      message: `Scheduled ${suggestion.name}! Synced with Google Calendar.`,
      type: "success",
    })
  }

  const zoomAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: zoomScale.value },
      { translateX: panX.value },
      { translateY: panY.value },
    ],
  }))

  const strobeAnimStyle = useAnimatedStyle(() => ({
    opacity: strobeOpacity.value,
  }))

  // Reusable SVG Map Geometry
  const renderMapCanvas = (width: number | string, height: number, isFullscreen = false) => (
    <Svg width={width} height={height} viewBox="0 0 360 220">
      <Defs>
        <LinearGradient id="mapBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#EEF4EB" />
          <Stop offset="1" stopColor="#E0EDE8" />
        </LinearGradient>
        <LinearGradient id="greenZone" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#D3E5DC" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#C4DEC8" stopOpacity="0.9" />
        </LinearGradient>
      </Defs>

      {/* Terrain base */}
      <Rect width="360" height="220" fill="url(#mapBg)" rx={isFullscreen ? 0 : 16} />

      {/* Topography Parks / Green Zones */}
      <Path
        d="M 20 40 Q 90 20 140 60 T 260 50 Q 320 70 340 120 L 340 200 L 20 200 Z"
        fill="url(#greenZone)"
      />
      <Path
        d="M 180 120 Q 240 100 300 130 T 360 170 L 360 220 L 160 220 Z"
        fill="#CADFC7"
      />

      {/* Clean Pista City Roads */}
      <Line x1="0" y1="90" x2="360" y2="90" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <Line x1="120" y1="0" x2="120" y2="220" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
      <Line x1="240" y1="0" x2="240" y2="220" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
      <Line x1="0" y1="160" x2="360" y2="160" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />

      {/* Sanctuary Boundary Zone */}
      <Circle cx="120" cy="90" r="44" fill="rgba(125, 140, 125, 0.14)" stroke="#7D8C7D" strokeWidth="1.5" strokeDasharray="4,4" />
      <SvgText x="120" y="58" fontSize="9" fontWeight="700" fill="#3D5250" textAnchor="middle">
        🏡 SANCTUARY HOME
      </SvgText>

      {/* Dine-out / Meetup Suggested Hubs */}
      <G>
        <Circle cx="210" cy="140" r="8" fill="#C27835" stroke="#FFFFFF" strokeWidth="1.5" />
        <SvgText x="210" y="154" fontSize="7.5" fontWeight="700" fill="#C27835" textAnchor="middle">
          🍽️ Oh! Calcutta
        </SvgText>
      </G>

      {/* Markers for Family Members */}
      {locations.map((member, idx) => {
        const isHome = member.placeName.includes("Home")
        const cx = isHome ? 105 + idx * 14 : member.memberId === "m-5" ? 270 : 210
        const cy = isHome ? 95 + (idx % 2) * 12 : member.memberId === "m-5" ? 55 : 170
        const isSelected = selectedMember?.memberId === member.memberId

        return (
          <G key={member.memberId}>
            {/* Accuracy Halo */}
            <Circle
              cx={cx}
              cy={cy}
              r={isSelected ? 18 : 12}
              fill={member.avatarColor}
              fillOpacity={isSelected ? 0.3 : 0.15}
            />
            {/* Pin Head */}
            <Circle
              cx={cx}
              cy={cy}
              r={isSelected ? 11 : 9}
              fill={member.avatarColor}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <SvgText
              x={cx}
              y={cy + 3.5}
              fontSize={isSelected ? "9" : "7.5"}
              fontWeight="800"
              fill="#FFFFFF"
              textAnchor="middle"
            >
              {member.memberNickname?.[0] || member.memberName[0]}
            </SvgText>

            {/* Nickname label */}
            <SvgText
              x={cx}
              y={cy + 19}
              fontSize="8.5"
              fontWeight="700"
              fill="#192216"
              textAnchor="middle"
            >
              {member.memberNickname || member.memberName.split(" ")[0]}
            </SvgText>
          </G>
        )
      })}
    </Svg>
  )

  return (
    <View style={styles.container}>
      {/* ── Top Bar Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          <AppText variant="subheading" style={{ fontWeight: "700" }}>
            Family Live Sanctuary & Telemetry
          </AppText>
        </View>

        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <PressableScale
            style={[styles.smallActionBtn, { backgroundColor: colors.surface2 }]}
            onPress={() => setDineoutModalVisible(true)}
          >
            <Ionicons name="restaurant-outline" size={13} color={colors.primary} />
            <AppText variant="caption" style={{ color: colors.primary, fontWeight: "700", fontSize: 11 }}>
              Plan Dine-Out
            </AppText>
          </PressableScale>

          <PressableScale
            style={[styles.smallActionBtn, { backgroundColor: colors.surface2 }]}
            onPress={() => setFullscreenMapVisible(true)}
          >
            <Ionicons name="scan-outline" size={13} color={colors.primary} />
            <AppText variant="caption" style={{ color: colors.primary, fontWeight: "700", fontSize: 11 }}>
              Zoom
            </AppText>
          </PressableScale>
        </View>
      </View>

      {/* ── Styled Pista Map Canvas ── */}
      <View style={[styles.mapCanvasWrapper, { backgroundColor: colors.surface2 }]}>
        {renderMapCanvas("100%", compact ? 130 : MAP_HEIGHT, false)}
      </View>

      {/* ── Horizontal Family Member Chips ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberChipsRow}>
        {locations.map((m) => {
          const isSelected = selectedMember?.memberId === m.memberId
          return (
            <PressableScale
              key={m.memberId}
              style={[
                styles.memberChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                },
              ]}
              onPress={() => {
                void Haptics.selectionAsync()
                setSelectedMember(m)
                if (onSelectMember) onSelectMember(m)
              }}
            >
              <View style={[styles.chipAvatar, { backgroundColor: isSelected ? "#FFFFFF" : m.avatarColor }]}>
                <AppText
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color: isSelected ? colors.primary : "#FFFFFF",
                  }}
                >
                  {m.memberNickname?.[0] || m.memberName[0]}
                </AppText>
              </View>
              <View style={{ marginRight: 2 }}>
                <AppText
                  variant="caption"
                  style={{
                    fontWeight: "700",
                    fontSize: 11,
                    color: isSelected ? "#FFFFFF" : colors.text.primary,
                  }}
                  numberOfLines={1}
                >
                  {m.memberNickname || m.memberName.split(" ")[0]}
                </AppText>
                <AppText
                  style={{
                    fontSize: 9,
                    color: isSelected ? "rgba(255,255,255,0.85)" : colors.text.muted,
                  }}
                >
                  {m.batteryLevel}% 🔋
                </AppText>
              </View>
            </PressableScale>
          )
        })}
      </ScrollView>

      {/* ── Active Member Details & "Where is My Phone" Card ── */}
      {selectedMember && (
        compact ? (
          <View style={[styles.compactMemberBar, { backgroundColor: colors.surface }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <AppText variant="caption" style={{ fontWeight: "700", color: colors.text.primary }} numberOfLines={1}>
                {selectedMember.memberName} • {selectedMember.placeName}
              </AppText>
              <AppText variant="caption" style={{ color: colors.text.muted, fontSize: 11 }} numberOfLines={1}>
                {selectedMember.roomDetail} · {selectedMember.batteryLevel}% 🔋
              </AppText>
            </View>
            <PressableScale
              style={[styles.compactFindBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleOpenFinder(selectedMember)}
            >
              <Ionicons name="volume-high" size={13} color="#FFFFFF" />
              <AppText style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700", marginLeft: 4 }}>
                Find Phone
              </AppText>
            </PressableScale>
          </View>
        ) : (
        <Card style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AppText variant="subheading" style={{ fontWeight: "700" }}>
                  {selectedMember.memberName} ({selectedMember.memberNickname || selectedMember.relationship})
                </AppText>
                {selectedMember.relationship.toLowerCase().includes("child") || selectedMember.memberId === "m-5" ? (
                  <Badge label="Protected Youth" tone="neutral" size="small" />
                ) : null}
              </View>

              <View style={styles.locationSubtitleRow}>
                <Ionicons name="location" size={13} color={colors.primary} />
                <AppText variant="caption" style={{ color: colors.text.primary, fontWeight: "600", marginLeft: 4 }}>
                  {selectedMember.placeName}
                </AppText>
                <AppText variant="caption" style={{ color: colors.text.muted, marginLeft: 4 }}>
                  • {selectedMember.roomDetail}
                </AppText>
              </View>
            </View>

            <PressableScale
              style={[styles.findPhoneBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleOpenFinder(selectedMember)}
            >
              <Ionicons name="volume-high" size={16} color="#FFFFFF" />
              <AppText style={styles.findPhoneBtnText}>Find Phone</AppText>
            </PressableScale>
          </View>

          {/* Unified Telemetry Bar (Battery + Google Fit Steps + Sleep) */}
          <View style={[styles.telemetryBar, { backgroundColor: colors.surface2 }]}>
            <View style={styles.telemetryItem}>
              <Ionicons name="battery-charging" size={14} color={colors.primary} />
              <AppText variant="caption" style={styles.telemetryText}>
                {selectedMember.batteryLevel}% {selectedMember.isCharging ? "Charging" : "Battery"}
              </AppText>
            </View>
            <View style={styles.telemetryDivider} />
            <View style={styles.telemetryItem}>
              <Ionicons name="footsteps-outline" size={14} color={colors.primary} />
              <AppText variant="caption" style={styles.telemetryText}>
                {selectedMember.health.dailySteps.toLocaleString()} Fit steps
              </AppText>
            </View>
            <View style={styles.telemetryDivider} />
            <View style={styles.telemetryItem}>
              <Ionicons name="moon-outline" size={14} color={colors.primary} />
              <AppText variant="caption" style={styles.telemetryText}>
                {selectedMember.health.sleepHours}h sleep
              </AppText>
            </View>
          </View>
        </Card>
      ))}

      {/* ── Modal: Fullscreen Zoomable Map View ── */}
      <Modal visible={fullscreenMapVisible} animationType="fade" transparent>
        <View style={styles.fullscreenModal}>
          <View style={[styles.fullscreenHeader, { backgroundColor: colors.background }]}>
            <View>
              <AppText variant="h3" style={{ fontWeight: "800" }}>
                Interactive Sanctuary Map
              </AppText>
              <AppText variant="caption" style={{ color: colors.text.secondary }}>
                Pinch or use zoom controls to explore family coordinates
              </AppText>
            </View>
            <PressableScale onPress={() => setFullscreenMapVisible(false)}>
              <Ionicons name="close-circle-outline" size={28} color={colors.text.primary} />
            </PressableScale>
          </View>

          <View style={styles.zoomableCanvasHolder}>
            <Animated.View style={[styles.zoomableCanvas, zoomAnimStyle]}>
              {renderMapCanvas(SCREEN_WIDTH, SCREEN_HEIGHT * 0.65, true)}
            </Animated.View>

            {/* Floating Zoom Controls */}
            <View style={styles.floatingZoomControls}>
              <PressableScale style={styles.zoomControlBtn} onPress={() => handleZoom(1.3)}>
                <Ionicons name="add" size={20} color="#192216" />
              </PressableScale>
              <PressableScale style={styles.zoomControlBtn} onPress={() => handleZoom(0.75)}>
                <Ionicons name="remove" size={20} color="#192216" />
              </PressableScale>
              <PressableScale style={styles.zoomControlBtn} onPress={handleResetZoom}>
                <Ionicons name="refresh" size={16} color="#192216" />
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: AI Family Meetup & Dine-Out Planner ── */}
      <Modal visible={dineoutModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.dineoutModalCard, { backgroundColor: colors.background }]}>
            <View style={styles.modalTopRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="h2" style={{ fontWeight: "800" }}>
                  AI Family Dine-Out Planner
                </AppText>
                <AppText variant="caption" style={{ color: colors.text.secondary }}>
                  Curated spots equidistant for all family members & elders
                </AppText>
              </View>
              <PressableScale onPress={() => setDineoutModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.text.muted} />
              </PressableScale>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {DINE_OUT_SUGGESTIONS.map((item) => (
                <Card key={item.id} style={styles.dineoutCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <AppText variant="subheading" style={{ fontWeight: "800", flex: 1 }}>
                      {item.name}
                    </AppText>
                    <Badge label={`★ ${item.rating}`} tone="success" size="small" />
                  </View>

                  <AppText variant="caption" style={{ color: colors.primary, fontWeight: "700", marginTop: 2 }}>
                    {item.vibe} · {item.distanceMins} mins away
                  </AppText>

                  <View style={styles.dineoutTagsRow}>
                    {item.elderFriendly && <Badge label="Elder Accessible" tone="neutral" size="small" />}
                    {item.petFriendly && <Badge label="Simba Friendly 🐾" tone="neutral" size="small" />}
                  </View>

                  <AppText variant="caption" style={{ color: colors.text.secondary, marginTop: 6, lineHeight: 18 }}>
                    💡 {item.aiReason}
                  </AppText>

                  <AppButton
                    title="Schedule Family Function & Sync Calendar"
                    variant="primary"
                    size="sm"
                    onPress={() => handleScheduleDineOut(item)}
                    style={{ marginTop: 10 }}
                  />
                </Card>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Precision "Where is My Phone" Acoustic Siren ── */}
      <Modal visible={finderModalVisible} animationType="fade" transparent>
        <Animated.View style={[styles.modalOverlay, isStrobeActive ? strobeAnimStyle : null]}>
          <View style={[styles.finderModalCard, { backgroundColor: colors.background }]}>
            <View style={styles.modalTopRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="h2" style={{ fontWeight: "800", color: colors.text.primary }}>
                  Pinpoint Phone Finder
                </AppText>
                <AppText variant="caption" style={{ color: colors.text.secondary }}>
                  Locating {selectedMember?.memberName}'s phone
                </AppText>
              </View>
              <PressableScale
                onPress={() => {
                  familyLocationService.stopPhoneSiren()
                  setIsSirenActive(false)
                  setIsStrobeActive(false)
                  setFinderModalVisible(false)
                }}
              >
                <Ionicons name="close-circle-outline" size={26} color={colors.text.muted} />
              </PressableScale>
            </View>

            {/* Precision Radar Readout */}
            <View style={[styles.radarBox, { backgroundColor: colors.surface2 }]}>
              <View style={styles.radarIconWrap}>
                <Ionicons
                  name="radio-outline"
                  size={36}
                  color={radarScan?.proximity === "burning_hot" ? "#EF4444" : colors.primary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <AppText variant="h3" style={{ fontWeight: "800", color: "#EF4444" }}>
                    🔥 Burning Hot! (0.4m away)
                  </AppText>
                </View>
                <AppText variant="body" style={{ fontWeight: "700", marginTop: 2 }}>
                  {radarScan?.roomLocation}
                </AppText>
                <AppText variant="caption" style={{ color: colors.text.secondary, marginTop: 4 }}>
                  Acoustic & signal signature indicates phone is wedged between cushions on the sofa.
                </AppText>
              </View>
            </View>

            {/* Acoustic Siren & Strobe Controls */}
            <View style={styles.modalActionButtons}>
              <AppButton
                title={isSirenActive ? "Stop Loud Siren" : "🔊 Sound Max Volume Siren"}
                variant={isSirenActive ? "outline" : "primary"}
                onPress={toggleSiren}
                style={{ flex: 1 }}
              />
            </View>

            {isSirenActive && (
              <View style={[styles.sirenActiveBanner, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
                <Ionicons name="warning" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                <AppText variant="caption" style={{ color: "#B91C1C", fontWeight: "700", flex: 1 }}>
                  Bypassing silent mode! Maximum acoustic siren and screen strobe pulse are firing. Check under the cushions!
                </AppText>
              </View>
            )}
          </View>
        </Animated.View>
      </Modal>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  smallActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  mapCanvasWrapper: {
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  memberChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingRight: 16,
  },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  chipAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  compactMemberBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  compactFindBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  detailCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  locationSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  findPhoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 5,
  },
  findPhoneBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  telemetryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 10,
  },
  telemetryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  telemetryText: {
    fontSize: 11,
    fontWeight: "600",
  },
  telemetryDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  finderModalCard: {
    width: "100%",
    borderRadius: 24,
    padding: 20,
  },
  modalTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  radarBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    gap: 14,
    marginBottom: 16,
  },
  radarIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  sirenActiveBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: "#FAFBF9",
  },
  fullscreenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  zoomableCanvasHolder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  zoomableCanvas: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingZoomControls: {
    position: "absolute",
    right: 20,
    bottom: 40,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    padding: 6,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  zoomControlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F0F5EC",
    alignItems: "center",
    justifyContent: "center",
  },
  dineoutModalCard: {
    width: "100%",
    borderRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  dineoutCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  dineoutTagsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
})

export default FamilySanctuaryMap
