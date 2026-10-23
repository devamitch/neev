import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { Image } from "expo-image"
import { router } from "expo-router"
import React, { useEffect, useMemo, useState } from "react"
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg"

import { FamilyMemberDetailSheet } from "@/components/family/FamilyMemberDetailSheet"
import { SanctuaryNudgeSheet } from "@/components/family/SanctuaryNudgeSheet"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { AppBottomSheetModal } from "@/components/ui/AppBottomSheetModal"
import { HeaderBackButton } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { PressableScale } from "@/components/ui/PressableScale"
import { useFamilyLocationsQuery } from "@/hooks/useFamilyLocationQuery"
import {
  calculateDistanceKm,
  familyLocationService,
  formatDistance,
  type FamilyLocationData,
  type PhoneRadarScan,
} from "@/services/location/familyLocationService"
import { getTileUrl, latLonToTileXY, TILE_SERVERS } from "@/services/location/offlineMapTileService"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useRootStore } from "@/stores/useRootStore"
import { useColors } from "@/theme/useTheme"

export { ErrorBoundary } from "@/components/ErrorBoundary"

const TILE_SIZE = 256

export default function FullscreenFamilyMapScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const colors = useColors()
  const allMembers = useFamilyStore((s) => s.members)
  const showToast = useRootStore((s) => s.showToast)

  const { data: queryLocations = [], refetch: refetchLocations } = useFamilyLocationsQuery()
  const [localLocations, setLocalLocations] = useState<FamilyLocationData[]>([])

  const locations: FamilyLocationData[] = useMemo(() => {
    if (localLocations.length > 0) return localLocations
    if (queryLocations.length > 0) return queryLocations
    return familyLocationService.getAllFamilyLocations()
  }, [localLocations, queryLocations])

  const shareMyLocation = async () => {
    const res = await familyLocationService.syncCurrentDeviceLocation()
    if (!res.ok) {
      showToast(res.error || "Couldn't share your location", "error")
      return
    }
    await refetchLocations()
    const updated = familyLocationService.getAllFamilyLocations()
    setLocalLocations(updated)
    if (updated[0]) setSelectedMember(updated[0])
    showToast("Sharing your location with your household", "success")
  }

  const [mapMode, setMapMode] = useState<"tile" | "schematic">("tile")
  const [selectedMember, setSelectedMember] = useState<FamilyLocationData | null>(
    locations[0] || null,
  )

  useEffect(() => {
    if ((!selectedMember || !selectedMember.memberId) && locations.length > 0) {
      setSelectedMember(locations[0])
    }
  }, [locations, selectedMember])
  const [tileZoom, setTileZoom] = useState(14)
  const [detailSheetVisible, setDetailSheetVisible] = useState(false)
  const [nudgeSheetVisible, setNudgeSheetVisible] = useState(false)
  const [radarModalVisible, setRadarModalVisible] = useState(false)
  const [radarScan, setRadarScan] = useState<PhoneRadarScan | null>(null)
  const [isSirenActive, setIsSirenActive] = useState(false)

  // Sanctuary Center: Home Coordinates (Kolkata)
  const centerLat = 22.57264
  const centerLon = 88.36389

  // Zoom scale animation
  const zoomScale = useSharedValue(1)
  const radarPulse = useSharedValue(1)

  useEffect(() => {
    if (radarModalVisible) {
      radarPulse.value = withRepeat(
        withSequence(
          withTiming(1.35, { duration: 1100, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 1100, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        true,
      )
    } else {
      cancelAnimation(radarPulse)
      radarPulse.value = 1
    }
  }, [radarModalVisible, radarPulse])

  // Tile math for 4x4 grid around center
  const centerTile = useMemo(() => {
    return latLonToTileXY(centerLat, centerLon, tileZoom)
  }, [centerLat, centerLon, tileZoom])

  const tileGrid = useMemo(() => {
    const tiles = []
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = centerTile.x + dx
        const y = centerTile.y + dy
        const url = getTileUrl(x, y, tileZoom, TILE_SERVERS.osmHot)
        tiles.push({ x, y, dx, dy, url, key: `${tileZoom}_${x}_${y}` })
      }
    }
    return tiles
  }, [centerTile, tileZoom])

  const getScreenCoordinates = (lat: number, lon: number) => {
    const n = Math.pow(2, tileZoom)
    const centerWorldX = ((centerLon + 180) / 360) * (TILE_SIZE * n)
    const centerLatRad = (centerLat * Math.PI) / 180
    const centerWorldY = ((1 - Math.asinh(Math.tan(centerLatRad)) / Math.PI) / 2) * (TILE_SIZE * n)

    const pointWorldX = ((lon + 180) / 360) * (TILE_SIZE * n)
    const pointLatRad = (lat * Math.PI) / 180
    const pointWorldY = ((1 - Math.asinh(Math.tan(pointLatRad)) / Math.PI) / 2) * (TILE_SIZE * n)

    const x = screenWidth / 2 + (pointWorldX - centerWorldX)
    const y = screenHeight / 2 + (pointWorldY - centerWorldY)
    return { x, y }
  }

  const handleOpenRadar = (member: FamilyLocationData) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const scan = familyLocationService.getPrecisionRadarScan(member.memberId)
    setRadarScan(scan)
    setSelectedMember(member)
    setRadarModalVisible(true)
  }

  const toggleSiren = () => {
    if (isSirenActive) {
      familyLocationService.stopPhoneSiren()
      setIsSirenActive(false)
    } else {
      familyLocationService.startPhoneSiren(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      })
      setIsSirenActive(true)
    }
  }

  const activeFullMember = useMemo(() => {
    if (!selectedMember?.memberId) return null
    return allMembers.find((m) => m.id === selectedMember.memberId) || null
  }, [allMembers, selectedMember])

  const selectedDistance = useMemo(() => {
    if (!selectedMember || selectedMember.latitude == null || selectedMember.longitude == null) {
      return "0 m"
    }
    const km = calculateDistanceKm(
      centerLat,
      centerLon,
      selectedMember.latitude,
      selectedMember.longitude,
    )
    return formatDistance(km)
  }, [selectedMember, centerLat, centerLon])

  return (
    <ErrorBoundary>
      <View style={styles.container}>
      {/* ── Background Map Canvas ── */}
      {mapMode === "tile" ? (
        <View style={StyleSheet.absoluteFill}>
          <View
            style={[
              styles.tileGridWrap,
              {
                width: screenWidth,
                height: screenHeight,
              },
            ]}
          >
            {tileGrid.map((tile) => {
              const tileScreenX = screenWidth / 2 + tile.dx * TILE_SIZE - TILE_SIZE / 2
              const tileScreenY = screenHeight / 2 + tile.dy * TILE_SIZE - TILE_SIZE / 2
              return (
                <Image
                  key={tile.key}
                  source={{ uri: tile.url }}
                  style={[
                    styles.mapTile,
                    {
                      left: tileScreenX,
                      top: tileScreenY,
                      width: TILE_SIZE,
                      height: TILE_SIZE,
                    },
                  ]}
                  contentFit="cover"
                  transition={200}
                />
              )
            })}

            {/* Live Family Member Markers on Tile Canvas */}
            {locations.map((m) => {
              const pos = getScreenCoordinates(m.latitude, m.longitude)
              const isSelected = selectedMember?.memberId === m.memberId
              return (
                <View
                  key={m.memberId}
                  style={[
                    styles.markerContainer,
                    {
                      left: pos.x - 22,
                      top: pos.y - 40,
                    },
                  ]}
                >
                  <PressableScale
                    onPress={() => {
                      void Haptics.selectionAsync()
                      setSelectedMember(m)
                    }}
                    style={styles.markerInner}
                  >
                    {/* Pulsing selection aura */}
                    {isSelected && (
                      <View
                        style={[
                          styles.markerAura,
                          { borderColor: m.avatarColor, backgroundColor: m.avatarColor + "30" },
                        ]}
                      />
                    )}

                    {/* Member Avatar Pin */}
                    <View
                      style={[
                        styles.markerPin,
                        {
                          backgroundColor: m.avatarColor,
                          transform: [{ scale: isSelected ? 1.15 : 1 }],
                        },
                      ]}
                    >
                      <AppText style={styles.markerPinText}>
                        {m.memberNickname?.[0] || m.memberName[0]}
                      </AppText>
                    </View>

                    {/* Name & Battery Tag */}
                    <View style={[styles.markerTag, { backgroundColor: colors.surface }]}>
                      <AppText variant="caption" style={styles.markerTagName} numberOfLines={1}>
                        {m.memberNickname || m.memberName.split(" ")[0]}
                      </AppText>
                      <AppText variant="caption" style={styles.markerTagBattery}>
                        {m.batteryLevel}%
                      </AppText>
                    </View>
                  </PressableScale>
                </View>
              )
            })}
          </View>
        </View>
      ) : (
        /* Clean Vector Architectural Schematic Canvas */
        <View style={StyleSheet.absoluteFill}>
          <Svg
            width={screenWidth}
            height={screenHeight}
            viewBox={`0 0 ${screenWidth} ${screenHeight}`}
          >
            <Defs>
              <LinearGradient id="fullMapBg" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FAF8F5" />
                <Stop offset="1" stopColor="#F2EDE4" />
              </LinearGradient>
              <LinearGradient id="parkGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#E8E2D7" stopOpacity="0.8" />
                <Stop offset="1" stopColor="#DDD6C9" stopOpacity="0.85" />
              </LinearGradient>
            </Defs>

            <Rect width={screenWidth} height={screenHeight} fill="url(#fullMapBg)" />

            {/* City Roads */}
            <Line
              x1="0"
              y1={screenHeight * 0.4}
              x2={screenWidth}
              y2={screenHeight * 0.4}
              stroke="#FFFFFF"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <Line
              x1="0"
              y1={screenHeight * 0.65}
              x2={screenWidth}
              y2={screenHeight * 0.65}
              stroke="#FFFFFF"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <Line
              x1={screenWidth * 0.35}
              y1="0"
              x2={screenWidth * 0.35}
              y2={screenHeight}
              stroke="#FFFFFF"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <Line
              x1={screenWidth * 0.72}
              y1="0"
              x2={screenWidth * 0.72}
              y2={screenHeight}
              stroke="#FFFFFF"
              strokeWidth="6"
              strokeLinecap="round"
            />

            {/* Sanctuary Geofence Perimeter */}
            <Circle
              cx={screenWidth * 0.35}
              cy={screenHeight * 0.4}
              r={70}
              fill="rgba(218, 119, 86, 0.08)"
              stroke="#DA7756"
              strokeWidth="2"
              strokeDasharray="6,6"
            />
            <SvgText
              x={screenWidth * 0.35}
              y={screenHeight * 0.4 - 76}
              fontSize="11"
              fontWeight="800"
              fill="#8C3E23"
              textAnchor="middle"
            >
              SANCTUARY GEOFENCE (HOME)
            </SvgText>

            {/* Schematic Members */}
            {locations.map((m, idx) => {
              const isHome = m.placeName.includes("Home")
              const cx = isHome
                ? screenWidth * 0.35 + (idx % 2 === 0 ? -18 : 18)
                : screenWidth * 0.72
              const cy = isHome ? screenHeight * 0.4 + (idx * 16 - 24) : screenHeight * 0.65
              const isSelected = selectedMember?.memberId === m.memberId

              return (
                <G key={m.memberId}>
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 24 : 14}
                    fill={m.avatarColor}
                    fillOpacity={isSelected ? 0.35 : 0.18}
                  />
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 14 : 10}
                    fill={m.avatarColor}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                  />
                  <SvgText
                    x={cx}
                    y={cy + 4}
                    fontSize={isSelected ? "11" : "9"}
                    fontWeight="800"
                    fill="#FFFFFF"
                    textAnchor="middle"
                  >
                    {m.memberNickname?.[0] || m.memberName[0]}
                  </SvgText>
                  <SvgText
                    x={cx}
                    y={cy + 24}
                    fontSize="11"
                    fontWeight="800"
                    fill="#1A201A"
                    textAnchor="middle"
                  >
                    {m.memberNickname || m.memberName.split(" ")[0]}
                  </SvgText>
                </G>
              )
            })}
          </Svg>
        </View>
      )}

      {/* ── Top Floating Glass Header ── */}
      <View style={[styles.floatingHeader, { top: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <HeaderBackButton />
        </View>

        <View style={styles.headerCenter}>
          <AppText variant="h3" style={styles.headerTitle} numberOfLines={1}>
            Live Sanctuary Map
          </AppText>
          <View style={styles.headerSubtitleRow}>
            <View style={styles.liveGreenDot} />
            <AppText variant="caption" style={styles.headerSubtitleText}>
              All {locations.length} Members Connected
            </AppText>
          </View>
        </View>

        <View style={styles.headerRight}>
          <PressableScale
            style={[styles.headerModeBtn, { backgroundColor: colors.surface }]}
            onPress={() => {
              void Haptics.selectionAsync()
              setMapMode((m) => (m === "tile" ? "schematic" : "tile"))
            }}
          >
            <Ionicons
              name={mapMode === "tile" ? "layers-outline" : "map-outline"}
              size={18}
              color={colors.primary}
            />
          </PressableScale>
        </View>
      </View>

      {/* ── Floating Zoom & Re-Center Controls ── */}
      <View style={[styles.floatingControls, { top: insets.top + 80 }]}>
        <PressableScale
          style={[styles.floatingControlBtn, { backgroundColor: colors.surface }]}
          onPress={() => {
            void Haptics.selectionAsync()
            setTileZoom((z) => Math.min(16, z + 1))
          }}
        >
          <Ionicons name="add" size={20} color={colors.text.primary} />
        </PressableScale>

        <PressableScale
          style={[styles.floatingControlBtn, { backgroundColor: colors.surface }]}
          onPress={() => {
            void Haptics.selectionAsync()
            setTileZoom((z) => Math.max(12, z - 1))
          }}
        >
          <Ionicons name="remove" size={20} color={colors.text.primary} />
        </PressableScale>

        <PressableScale
          style={[styles.floatingControlBtn, { backgroundColor: colors.surface }]}
          onPress={async () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            setTileZoom(15)
            await shareMyLocation()
          }}
          accessibilityLabel="Locate and Center Sanctuary GPS"
        >
          <Ionicons name="navigate-outline" size={18} color={colors.primary} />
        </PressableScale>
      </View>

      {/* ── Uber/Ola Style Bottom Floating Member Card & Drawer ── */}
      <View style={[styles.bottomCardContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Card style={[styles.uberCard, { backgroundColor: colors.surface }]}>
          {locations.length === 0 ? (
            <View style={{ paddingVertical: 14, alignItems: "center" }}>
              <View
                style={[
                  styles.memberAvatarCircle,
                  { backgroundColor: colors.primaryAlpha, marginBottom: 10 },
                ]}
              >
                <Ionicons name="location-outline" size={24} color={colors.primary} />
              </View>
              <AppText variant="h3" style={{ fontWeight: "800", textAlign: "center" }}>
                No Active Location Sharing
              </AppText>
              <AppText
                variant="caption"
                style={{
                  color: colors.text.secondary,
                  textAlign: "center",
                  marginTop: 4,
                  paddingHorizontal: 16,
                }}
              >
                Each family member chooses whether to share their location. Share yours to
                see it here; others appear once they share from their own phones.
              </AppText>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <PressableScale
                  onPress={() => router.back()}
                  style={[
                    styles.primaryActionBtn,
                    { backgroundColor: colors.primary, paddingHorizontal: 16 },
                  ]}
                >
                  <AppText style={styles.primaryActionBtnText}>Back to Dashboard</AppText>
                </PressableScale>
                <PressableScale
                  onPress={() => void shareMyLocation()}
                  style={[
                    styles.secondaryActionBtn,
                    { backgroundColor: colors.surface2, paddingHorizontal: 12 },
                  ]}
                >
                  <AppText style={[styles.secondaryActionBtnText, { color: colors.primary }]}>
                    Share My Location
                  </AppText>
                </PressableScale>
              </View>
            </View>
          ) : (
            <>
              {/* Active Member Focus Row */}
              <View style={styles.activeMemberRow}>
                <View
                  style={[
                    styles.memberAvatarCircle,
                    { backgroundColor: selectedMember?.avatarColor || colors.primary },
                  ]}
                >
                  <AppText style={styles.memberAvatarText}>
                    {selectedMember?.memberNickname?.[0] || selectedMember?.memberName?.[0] || "F"}
                  </AppText>
                  <View
                    style={[
                      styles.batteryPill,
                      {
                        backgroundColor:
                          (selectedMember?.batteryLevel ?? 100) < 20 ? "#EF4444" : "#10B981",
                      },
                    ]}
                  >
                    <AppText style={styles.batteryPillText}>
                      {selectedMember?.batteryLevel ?? 100}%
                    </AppText>
                  </View>
                </View>

                <View style={styles.memberDetailsWrap}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AppText variant="h3" style={styles.memberNameTitle}>
                      {selectedMember?.memberName || "Family Member"}
                    </AppText>
                    {selectedMember?.memberNickname && (
                      <Badge label={selectedMember.memberNickname} tone="neutral" size="small" />
                    )}
                  </View>

                  <View style={styles.placeRow}>
                    <Ionicons name="location" size={12} color={colors.primary} />
                    <AppText variant="caption" style={styles.placeText} numberOfLines={1}>
                      {selectedMember?.placeName || "Sanctuary"} ·{" "}
                      {selectedMember?.roomDetail || "Vicinity"}
                    </AppText>
                  </View>

                  <View style={styles.metaRow}>
                    <Badge label={selectedDistance} tone="info" size="small" />
                    <AppText variant="caption" style={styles.timeAgoText}>
                      Updated {selectedMember?.lastUpdated || "Recently"}
                    </AppText>
                  </View>
                </View>
              </View>

              {/* Action Buttons Row */}
              <View style={styles.cardActionsRow}>
                <PressableScale
                  style={[styles.primaryActionBtn, { backgroundColor: "#DA7756" }]}
                  onPress={() => selectedMember && handleOpenRadar(selectedMember)}
                >
                  <Ionicons name="volume-high" size={13} color="#FFFFFF" />
                  <AppText style={styles.primaryActionBtnText}>Find Phone </AppText>
                </PressableScale>

                <PressableScale
                  style={[
                    styles.secondaryActionBtn,
                    {
                      backgroundColor: colors.surface2,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setNudgeSheetVisible(true)
                  }}
                  accessibilityLabel="Send Nudge and Location"
                >
                  <Ionicons name="paper-plane-outline" size={13} color={colors.primary} />
                  <AppText style={[styles.secondaryActionBtnText, { color: colors.primary }]}>
                    Send Nudge
                  </AppText>
                </PressableScale>

                <PressableScale
                  style={[
                    styles.secondaryActionBtn,
                    {
                      backgroundColor: colors.surface2,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => setDetailSheetVisible(true)}
                >
                  <Ionicons name="person-circle-outline" size={13} color={colors.primary} />
                  <AppText style={[styles.secondaryActionBtnText, { color: colors.primary }]}>
                    Profile
                  </AppText>
                </PressableScale>
              </View>

              {/* Horizontal Family Switcher Carousel */}
              <View style={styles.carouselHeaderRow}>
                <AppText style={styles.carouselSectionTitle}>FAMILY LIVE TELEMETRY</AppText>
                <AppText style={styles.carouselCounter}>{locations.length} Members</AppText>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalChipsRow}
              >
                {locations.map((m) => {
                  const isSelected = selectedMember?.memberId === m.memberId
                  const dist = formatDistance(
                    calculateDistanceKm(centerLat, centerLon, m.latitude, m.longitude),
                  )
                  return (
                    <PressableScale
                      key={m.memberId}
                      style={[
                        styles.familyChip,
                        {
                          backgroundColor: isSelected ? colors.surface : colors.surface2,
                          borderColor: isSelected ? "#DA7756" : colors.border,
                          borderWidth: isSelected ? 1.5 : 1,
                        },
                      ]}
                      onPress={() => {
                        void Haptics.selectionAsync()
                        setSelectedMember(m)
                      }}
                    >
                      <View style={[styles.chipAvatarMini, { backgroundColor: m.avatarColor }]}>
                        <AppText
                          style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: "#FFFFFF",
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
                            fontSize: 12,
                            color: isSelected ? "#DA7756" : colors.text.primary,
                          }}
                          numberOfLines={1}
                        >
                          {m.memberNickname || m.memberName.split(" ")[0]}
                        </AppText>
                        <AppText
                          style={{
                            fontSize: 10,
                            fontWeight: "500",
                            color: isSelected ? "#DA7756" : colors.text.muted,
                          }}
                        >
                          {dist} · {m.batteryLevel}%
                        </AppText>
                      </View>
                    </PressableScale>
                  )
                })}
              </ScrollView>
            </>
          )}
        </Card>
      </View>

      {/* ── Member Detail Bottom Sheet ── */}
      {activeFullMember && (
        <FamilyMemberDetailSheet
          visible={detailSheetVisible}
          member={activeFullMember}
          onClose={() => setDetailSheetVisible(false)}
          onFindPhone={() => selectedMember && handleOpenRadar(selectedMember)}
        />
      )}

      {/* ── Acoustic Radar / Find Phone Modal ── */}
      <AppBottomSheetModal
        visible={radarModalVisible}
        onClose={() => {
          familyLocationService.stopPhoneSiren()
          setIsSirenActive(false)
          setRadarModalVisible(false)
        }}
        title={`Find ${selectedMember?.memberName?.split(" ")[0] || "Member"}'s Phone`}
        subtitle="Precision Indoor & Acoustic Pinpoint Radar"
        eyebrow="PHONE FINDER"
      >
        <View style={[styles.radarModalBody, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
          <View style={styles.radarPulseContainer}>
            <Animated.View
              style={[
                styles.radarAuraOuter,
                {
                  transform: [{ scale: radarPulse }],
                  borderColor: isSirenActive ? "#EF4444" : colors.primary,
                },
              ]}
            />
            <View
              style={[
                styles.radarAuraInner,
                { backgroundColor: isSirenActive ? "#EF4444" : colors.primary },
              ]}
            >
              <Ionicons
                name={isSirenActive ? "megaphone" : "volume-high"}
                size={34}
                color="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.radarStatusBlock}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <AppText variant="h3" style={{ fontWeight: "800", textAlign: "center" }}>
                {selectedMember?.placeName || "Sanctuary Home"}
              </AppText>
              {radarScan?.altitudeMeters !== undefined && (
                <Badge
                  label={`Alt: ${radarScan.altitudeMeters > 0 ? "+" : ""}${radarScan.altitudeMeters.toFixed(1)}m`}
                  tone="info"
                  size="small"
                />
              )}
            </View>
            <AppText
              variant="caption"
              style={{ color: colors.text.secondary, textAlign: "center", marginTop: 4 }}
            >
              {selectedMember?.roomDetail || "Indoor Area"} · Accuracy ±
              {selectedMember?.accuracyMeters ?? 5}m
            </AppText>
          </View>

          {/* 3D Vertical Spatial Plane & RF Occlusion */}
          <View style={[styles.spatialPlaneBox, { backgroundColor: colors.surface2 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Ionicons name="layers-outline" size={15} color={colors.primary} />
              <AppText variant="caption" style={{ fontWeight: "800", color: colors.text.primary }}>
                3D Spatial Plane: {radarScan?.planeDescription || "Table / Counter Plane (~0.8m)"}
              </AppText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="wifi-outline" size={14} color={colors.text.secondary} />
              <AppText variant="caption" style={{ color: colors.text.secondary }}>
                {radarScan?.rfOcclusionNote || "Direct RF Line of Sight — Low Attenuation"}
              </AppText>
            </View>
          </View>

          {/* Exact Hardware & Geodetic Coordinates Telemetry */}
          <View style={[styles.telemetryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="navigate-circle" size={16} color="#DA7756" />
                <AppText variant="caption" style={{ fontWeight: "800", color: colors.text.primary }}>
                  EXACT GEODETIC COORDINATES
                </AppText>
              </View>
              <Badge label="WGS84 Datum" tone="neutral" size="small" />
            </View>

            <View style={styles.coordsRow}>
              <View style={styles.coordBox}>
                <AppText style={styles.coordLabel}>Latitude</AppText>
                <AppText style={styles.coordVal}>
                  {selectedMember?.latitude != null ? `${selectedMember.latitude.toFixed(6)}° N` : "--"}
                </AppText>
              </View>
              <View style={styles.coordBox}>
                <AppText style={styles.coordLabel}>Longitude</AppText>
                <AppText style={styles.coordVal}>
                  {selectedMember?.longitude != null ? `${selectedMember.longitude.toFixed(6)}° E` : "--"}
                </AppText>
              </View>
            </View>

            {/* Hardware Telemetry Grid */}
            <View style={styles.hardwareGrid}>
              <View style={styles.hardwareItem}>
                <Ionicons name="speedometer-outline" size={13} color={colors.text.muted} />
                <AppText style={styles.hardwareText}>
                  {selectedMember?.speedKmH && selectedMember.speedKmH > 0
                    ? `${selectedMember.speedKmH.toFixed(1)} km/h • Walking`
                    : "0 km/h • Stationary"}
                </AppText>
              </View>
              <View style={styles.hardwareItem}>
                <Ionicons name="battery-charging-outline" size={13} color={colors.text.muted} />
                <AppText style={styles.hardwareText}>
                  {selectedMember?.batteryLevel ?? 80}% {selectedMember?.isCharging ? "• Charging" : "• Battery"}
                </AppText>
              </View>
              <View style={styles.hardwareItem}>
                <Ionicons name="radio-outline" size={13} color={colors.text.muted} />
                <AppText style={styles.hardwareText}>
                  {radarScan?.signalStrengthDbm ?? -52} dBm • 5GHz
                </AppText>
              </View>
              <View style={styles.hardwareItem}>
                <Ionicons name="locate-outline" size={13} color={colors.text.muted} />
                <AppText style={styles.hardwareText}>
                  Radius ±{selectedMember?.accuracyMeters ?? 4}m
                </AppText>
              </View>
            </View>

            {/* Quick Action Navigation Buttons */}
            <View style={styles.coordsActionRow}>
              <PressableScale
                style={[styles.coordActionBtn, { borderColor: colors.border }]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  if (selectedMember?.latitude != null && selectedMember?.longitude != null) {
                    showToast({
                      message: `Exact coordinates: ${selectedMember.latitude.toFixed(6)}, ${selectedMember.longitude.toFixed(6)}`,
                      type: "info",
                    })
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Copy coordinates"
              >
                <Ionicons name="copy-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                <AppText style={[styles.coordActionBtnText, { color: colors.primary }]}>
                  Copy Coords
                </AppText>
              </PressableScale>

              <PressableScale
                style={[styles.coordActionBtn, { borderColor: colors.border }]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  if (selectedMember?.latitude != null && selectedMember?.longitude != null) {
                    void Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${selectedMember.latitude},${selectedMember.longitude}`,
                    )
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Navigate to coordinates in Google Maps"
              >
                <Ionicons name="map-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                <AppText style={[styles.coordActionBtnText, { color: colors.primary }]}>
                  Navigate in Maps
                </AppText>
              </PressableScale>
            </View>
          </View>

          <PressableScale
            style={[
              styles.radarSirenBtn,
              { backgroundColor: isSirenActive ? "#EF4444" : colors.primary },
            ]}
            onPress={toggleSiren}
            accessibilityRole="button"
            accessibilityLabel={isSirenActive ? "Stop Acoustic Siren" : "Play Maximum Loud Acoustic Siren"}
          >
            <Ionicons
              name={isSirenActive ? "stop-circle" : "play-circle"}
              size={20}
              color="#FFFFFF"
            />
            <AppText style={styles.radarSirenBtnText}>
              {isSirenActive ? "Stop Acoustic Siren" : "Play Maximum Loud Acoustic Siren"}
            </AppText>
          </PressableScale>

          <AppText variant="caption" style={styles.radarNoticeText}>
            Sounds audible chirp & vibration pattern even if device is set on silent/vibrate,
            penetrating sofa cushions and pillows.
          </AppText>

          {/* Lost in Public / Stolen: Google Find My Device */}
          <View style={[styles.googleFindContainer, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.accentText} />
              <AppText variant="caption" style={{ fontWeight: "800", color: colors.text.primary }}>
                Lost Outside in Bank, Market or Transit?
              </AppText>
            </View>
            <AppText
              variant="caption"
              style={{ color: colors.text.secondary, marginBottom: 8, fontSize: 11 }}
            >
              If your phone was left at a shop, bank, or transit hub, launch Google Find My Device
              to remotely locate, lock, or secure your phone.
            </AppText>
            <PressableScale
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                void Linking.openURL("https://www.google.com/android/find")
              }}
              style={[styles.googleFindButton, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Open Google Find My Device"
            >
              <Ionicons
                name="open-outline"
                size={14}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>
                Open Google Find My Device →
              </AppText>
            </PressableScale>
          </View>
        </View>
      </AppBottomSheetModal>

      {/* ── Thoughtful Sanctuary Nudge Sheet ── */}
      <SanctuaryNudgeSheet
        visible={nudgeSheetVisible}
        onClose={() => setNudgeSheetVisible(false)}
        member={activeFullMember}
        locationData={selectedMember || undefined}
      />
    </View>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F5F2",
  },
  tileGridWrap: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  mapTile: {
    position: "absolute",
  },
  markerContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  markerInner: {
    alignItems: "center",
  },
  markerAura: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    top: -6,
  },
  markerPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    elevation: 0,
  },
  markerPinText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  markerTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 0,
    gap: 4,
  },
  markerTagName: {
    fontSize: 11,
    fontWeight: "800",
  },
  markerTagBattery: {
    fontSize: 9.5,
    color: "#6B7280",
  },
  floatingHeader: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 30,
    backgroundColor: "#FAFBF9",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 0,
  },
  headerLeft: {
    minWidth: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#192216",
    letterSpacing: -0.3,
  },
  headerSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 1,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  headerSubtitleText: {
    fontSize: 11,
    color: "#5C6A5B",
    fontWeight: "600",
  },
  headerRight: {
    minWidth: 40,
    alignItems: "flex-end",
  },
  headerModeBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 0,
  },
  floatingControls: {
    position: "absolute",
    right: 16,
    gap: 8,
    zIndex: 30,
  },
  floatingControlBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 0,
  },
  bottomCardContainer: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 0,
    zIndex: 30,
  },
  uberCard: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 0,
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  activeMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  memberAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  memberAvatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  batteryPill: {
    position: "absolute",
    bottom: -4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  batteryPillText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  memberDetailsWrap: {
    flex: 1,
    marginLeft: 14,
  },
  memberNameTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  placeText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  timeAgoText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  primaryActionBtn: {
    flex: 1.3,
    height: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  secondaryActionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  secondaryActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  carouselHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  carouselSectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#9CA3AF",
  },
  carouselCounter: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
  },
  horizontalChipsRow: {
    gap: 8,
  },
  familyChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  chipAvatarMini: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  radarModalBody: {
    alignItems: "center",
    paddingVertical: 12,
  },
  radarPulseContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  radarAuraOuter: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
  },
  radarAuraInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 0,
  },
  radarStatusBlock: {
    marginBottom: 20,
  },
  radarSirenBtn: {
    width: "100%",
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  radarSirenBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  radarNoticeText: {
    fontSize: 11.5,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  spatialPlaneBox: {
    width: "100%",
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  googleFindContainer: {
    width: "100%",
    padding: 14,
    borderRadius: 14,
    marginTop: 14,
  },
  googleFindButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  telemetryCard: {
    width: "100%",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  coordsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  coordBox: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 10,
  },
  coordLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coordVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1F2937",
    marginTop: 2,
  },
  hardwareGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  hardwareItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.02)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  hardwareText: {
    fontSize: 11,
    color: "#4B5563",
    fontWeight: "600",
  },
  coordsActionRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  coordActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  coordActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
})
