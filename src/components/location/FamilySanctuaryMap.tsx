import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { Image } from "expo-image"
import React, { memo, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"
import Animated, {
  cancelAnimation,
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

import { FamilyMemberDetailSheet } from "@/components/family/FamilyMemberDetailSheet"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { AppBottomSheetModal } from "@/components/ui/AppBottomSheetModal"
import { AppButton } from "@/components/ui/AppButton"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { PressableScale } from "@/components/ui/PressableScale"
import {
  useDownloadOfflineMapMutation,
  useFamilyLocationsQuery,
  useOfflineMapPackQuery,
} from "@/hooks/useFamilyLocationQuery"
import { googleServicesClient } from "@/services/google/googleServicesClient"
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
import { useScheduleStore } from "@/stores/useScheduleStore"
import { useColors } from "@/theme/useTheme"
import { router } from "expo-router"

const MAP_HEIGHT = 220
const TILE_SIZE = 256

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
    cuisine: "Authentic Comfort Curries",
    rating: 4.8,
    distanceMins: 14,
    elderFriendly: true,
    petFriendly: false,
    aiReason:
      "Equidistant for family members. Gentle elevator access and quiet acoustic corners loved by grandparents.",
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
    aiReason:
      "Outdoor lawn area allows family pets to join. Right along morning walkway with zero staircase barriers.",
  },
  {
    id: "do-3",
    name: "Flurys Heritage Tea Room",
    vibe: "Afternoon High Tea & Stories",
    cuisine: "Pastries, Darjeeling First Flush & Savory Bakes",
    rating: 4.9,
    distanceMins: 20,
    elderFriendly: true,
    petFriendly: false,
    aiReason: "Great weekend afternoon memory spot for school celebrations and storytelling.",
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const colors = useColors()
  const showToast = useRootStore((s) => s.showToast)
  const addFunction = useScheduleStore((s) => s.addFunction)
  const familyMembers = useFamilyStore((s) => s.members)

  // TanStack React Query Hooks
  const { data: queryLocations = [] } = useFamilyLocationsQuery()
  const { data: offlinePack } = useOfflineMapPackQuery()
  const downloadMapMutation = useDownloadOfflineMapMutation()

  const [mapMode, setMapMode] = useState<"tile" | "schematic">("tile")
  const [downloadProgress, setDownloadProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const [detailSheetVisible, setDetailSheetVisible] = useState(false)
  const [selectedMember, setSelectedMember] = useState<FamilyLocationData | null>(null)
  const [finderModalVisible, setFinderModalVisible] = useState(false)
  const [fullscreenMapVisible, setFullscreenMapVisible] = useState(false)
  const [dineoutModalVisible, setDineoutModalVisible] = useState(false)
  const [radarScan, setRadarScan] = useState<PhoneRadarScan | null>(null)
  const [isSirenActive, setIsSirenActive] = useState(false)
  const [isStrobeActive, setIsStrobeActive] = useState(false)

  const activeFullMember = useMemo(() => {
    return familyMembers.find((m) => m.id === selectedMember?.memberId) || null
  }, [familyMembers, selectedMember])

  // Interactive zoom level for real tile map (zoom 14 = neighbourhood level)
  const [tileZoom, setTileZoom] = useState(14)

  // Zoom and pan shared values for interactive full-screen map
  const zoomScale = useSharedValue(1)
  const panX = useSharedValue(0)
  const panY = useSharedValue(0)

  // Strobe & Radar animations
  const strobeOpacity = useSharedValue(1)
  const radarPulse = useSharedValue(1)

  const locations = useMemo(() => {
    if (queryLocations.length > 0) return queryLocations
    return familyLocationService.getAllFamilyLocations()
  }, [queryLocations])

  useEffect(() => {
    if (!selectedMember && locations.length > 0) {
      setSelectedMember(locations[0])
    }
  }, [locations, selectedMember])

  useEffect(() => {
    if (finderModalVisible) {
      radarPulse.value = withRepeat(
        withSequence(
          withTiming(1.35, { duration: 1200, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 1200, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        true,
      )
    } else {
      cancelAnimation(radarPulse)
      radarPulse.value = 1
    }
    return () => {
      cancelAnimation(radarPulse)
    }
  }, [finderModalVisible, radarPulse])

  useEffect(() => {
    if (isStrobeActive) {
      strobeOpacity.value = withRepeat(
        withSequence(withTiming(0.1, { duration: 140 }), withTiming(1, { duration: 140 })),
        -1,
        true,
      )
    } else {
      cancelAnimation(strobeOpacity)
      strobeOpacity.value = 1
    }
    return () => {
      cancelAnimation(strobeOpacity)
    }
  }, [isStrobeActive, strobeOpacity])

  // Center coordinate: default to Sanctuary Home (Kolkata)
  const centerLat = 22.57264
  const centerLon = 88.36389

  // Calculate 3x3 grid of tiles around center
  const centerTile = useMemo(() => {
    return latLonToTileXY(centerLat, centerLon, tileZoom)
  }, [centerLat, centerLon, tileZoom])

  const tileGrid = useMemo(() => {
    const tiles = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = centerTile.x + dx
        const y = centerTile.y + dy
        const url = getTileUrl(x, y, tileZoom, TILE_SERVERS.osmHot)
        tiles.push({ x, y, dx, dy, url, key: `${tileZoom}_${x}_${y}` })
      }
    }
    return tiles
  }, [centerTile, tileZoom])

  // Converts member lat/lon into screen X/Y offset from center
  const getScreenCoordinates = (
    lat: number,
    lon: number,
    canvasWidth: number,
    canvasHeight: number,
  ) => {
    const n = Math.pow(2, tileZoom)
    const centerWorldX = ((centerLon + 180) / 360) * (TILE_SIZE * n)
    const centerLatRad = (centerLat * Math.PI) / 180
    const centerWorldY = ((1 - Math.asinh(Math.tan(centerLatRad)) / Math.PI) / 2) * (TILE_SIZE * n)

    const pointWorldX = ((lon + 180) / 360) * (TILE_SIZE * n)
    const pointLatRad = (lat * Math.PI) / 180
    const pointWorldY = ((1 - Math.asinh(Math.tan(pointLatRad)) / Math.PI) / 2) * (TILE_SIZE * n)

    const x = canvasWidth / 2 + (pointWorldX - centerWorldX)
    const y = canvasHeight / 2 + (pointWorldY - centerWorldY)
    return { x, y }
  }

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

  const handleDownloadMapArea = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setDownloadProgress({ current: 1, total: 49 })
    try {
      const pack = await downloadMapMutation.mutateAsync({
        centerLat,
        centerLon,
        areaName: "Home Sanctuary & Vicinity",
        onProgress: (current, total) => setDownloadProgress({ current, total }),
      })
      showToast({
        message: `Offline map saved! ${pack.tileCount} tiles cached (${Math.round(pack.sizeBytes / 1024)} KB) for zero-data use.`,
        type: "success",
      })
    } catch {
      showToast({ message: "Could not complete offline map download.", type: "error" })
    } finally {
      setDownloadProgress(null)
    }
  }

  const handleZoom = (factor: number) => {
    void Haptics.selectionAsync()
    const next = Math.max(0.8, Math.min(3.2, zoomScale.value * factor))
    zoomScale.value = withSpring(next)
  }

  const handleTileZoomStep = (delta: number) => {
    void Haptics.selectionAsync()
    setTileZoom((prev) => Math.max(13, Math.min(16, prev + delta)))
  }

  const handleResetZoom = () => {
    void Haptics.selectionAsync()
    zoomScale.value = withSpring(1)
    panX.value = withSpring(0)
    panY.value = withSpring(0)
    setTileZoom(14)
  }

  const handleScheduleDineOut = async (suggestion: DineOutSuggestion) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    const validMemberIds = familyMembers.map((m) => m.id)
    const primaryAssignee = validMemberIds[0] || locations[0]?.memberId || "m-1"
    const secondaryAssignee = validMemberIds[1] || locations[1]?.memberId || primaryAssignee

    const newFn = {
      id: `fn-${Date.now()}`,
      title: `Family Outing @ ${suggestion.name}`,
      date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
      time: "07:30 PM",
      location: suggestion.name,
      category: "outing" as const,
      description: `${suggestion.vibe} · ${suggestion.aiReason}`,
      vibe: "Casual Multigenerational Celebration",
      invitationsCount: locations.length,
      reminderSet: true,
      tasks: [
        {
          id: `t-${Date.now()}-1`,
          title: `Reserve table at ${suggestion.name}`,
          assignedToMemberId: primaryAssignee,
          isDone: false,
        },
        {
          id: `t-${Date.now()}-2`,
          title: "Confirm transportation & elder seating",
          assignedToMemberId: secondaryAssignee,
          isDone: false,
        },
      ],
    }

    addFunction(newFn)
    setDineoutModalVisible(false)
    showToast({
      message: `Scheduled ${suggestion.name}!`,
      type: "success",
    })
  }

  const zoomAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }, { translateX: panX.value }, { translateY: panY.value }],
  }))

  const strobeAnimStyle = useAnimatedStyle(() => ({
    opacity: strobeOpacity.value,
  }))

  // Render Real Free OpenStreetMap / CartoDB Slippy Map
  const renderTileMap = (width: number, height: number, isFullscreen = false) => {
    const halfW = width / 2
    const halfH = height / 2

    return (
      <View style={[styles.tileMapContainer, { width, height }]}>
        {/* Render 3x3 Tile Matrix */}
        {tileGrid.map((tile) => {
          const left = halfW + tile.dx * TILE_SIZE - TILE_SIZE / 2
          const top = halfH + tile.dy * TILE_SIZE - TILE_SIZE / 2

          return (
            <Image
              key={tile.key}
              source={{
                uri: tile.url,
                headers: {
                  "User-Agent": "NeevFamilySanctuary/1.0 (contact@neev.family)",
                },
              }}
              style={[
                styles.mapTileImage,
                {
                  left,
                  top,
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                },
              ]}
              contentFit="cover"
              cachePolicy="disk"
            />
          )
        })}

        {/* Soft Pista Theme Tint Layer to Harmonize OpenStreetMap with Neev Palette */}
        <View style={styles.tileTintOverlay} pointerEvents="none" />

        {/* Sanctuary Geofenced Perimeter Ring */}
        <View
          style={[
            styles.geofenceRing,
            {
              left: halfW - 48,
              top: halfH - 48,
              width: 96,
              height: 96,
              borderRadius: 48,
              borderColor: colors.primary,
            },
          ]}
          pointerEvents="none"
        />

        {/* Dining Suggestions Pins */}
        <View style={[styles.dineOutPinWrap, { left: halfW + 64, top: halfH + 32 }]}>
          <View style={[styles.dineOutDot, { backgroundColor: colors.warning }]}>
            <Ionicons name="restaurant" size={10} color="#FFFFFF" />
          </View>
          <View style={[styles.pinLabelBox, { backgroundColor: colors.surface }]}>
            <AppText style={{ fontSize: 9, fontWeight: "700", color: colors.text.primary }}>
              Oh! Calcutta
            </AppText>
          </View>
        </View>

        {/* Member Pins Overlaid at Real Lat/Lon */}
        {locations.map((member) => {
          const pos = getScreenCoordinates(member.latitude, member.longitude, width, height)
          const isSelected = selectedMember?.memberId === member.memberId

          // Clamp within visible boundaries
          const clampedX = Math.max(24, Math.min(width - 24, pos.x))
          const clampedY = Math.max(24, Math.min(height - 24, pos.y))

          return (
            <PressableScale
              key={member.memberId}
              style={[
                styles.memberPinMarker,
                {
                  left: clampedX - 16,
                  top: clampedY - 16,
                },
              ]}
              onPress={() => {
                void Haptics.selectionAsync()
                setSelectedMember(member)
                if (onSelectMember) onSelectMember(member)
              }}
            >
              {/* Accuracy Pulse Ring */}
              <View
                style={[
                  styles.memberHalo,
                  {
                    backgroundColor: member.avatarColor,
                    transform: [{ scale: isSelected ? 1.5 : 1.1 }],
                    opacity: isSelected ? 0.35 : 0.2,
                  },
                ]}
              />

              {/* Pin Head */}
              <View
                style={[
                  styles.memberPinHead,
                  {
                    backgroundColor: member.avatarColor,
                    borderColor: isSelected ? "#FFFFFF" : "rgba(255,255,255,0.85)",
                    borderWidth: isSelected ? 2.5 : 1.5,
                  },
                ]}
              >
                <AppText style={styles.memberPinText}>
                  {member.memberNickname?.[0] || member.memberName[0]}
                </AppText>
              </View>

              {/* Pin Tag */}
              <View style={[styles.memberPinTag, { backgroundColor: colors.surface }]}>
                <AppText style={styles.memberPinTagText} numberOfLines={1}>
                  {member.memberNickname || member.memberName.split(" ")[0]}
                </AppText>
              </View>
            </PressableScale>
          )
        })}

        {/* Zoom Controls for Tile Map */}
        <View style={styles.tileZoomBar}>
          <PressableScale style={styles.tileZoomBtn} onPress={() => handleTileZoomStep(1)}>
            <Ionicons name="add" size={16} color="#192216" />
          </PressableScale>
          <View style={styles.tileZoomDivider} />
          <PressableScale style={styles.tileZoomBtn} onPress={() => handleTileZoomStep(-1)}>
            <Ionicons name="remove" size={16} color="#192216" />
          </PressableScale>
        </View>

        {/* Provider Attribution Badge */}
        <View style={styles.osmAttributionBadge}>
          <AppText style={styles.osmAttributionText}>© OpenStreetMap contributors</AppText>
        </View>
      </View>
    )
  }

  // Reusable SVG Architectural Layout
  const renderSchematicCanvas = (width: number | string, height: number, isFullscreen = false) => (
    <Svg width={width} height={height} viewBox="0 0 360 220">
      <Defs>
        <LinearGradient id="mapBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FAF8F5" />
          <Stop offset="1" stopColor="#F2EDE4" />
        </LinearGradient>
        <LinearGradient id="greenZone" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E8E2D7" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#DDD6C9" stopOpacity="0.9" />
        </LinearGradient>
      </Defs>

      {/* Terrain base */}
      <Rect width="360" height="220" fill="url(#mapBg)" rx={isFullscreen ? 0 : 16} />

      {/* Topography Parks / Green Zones */}
      <Path
        d="M 20 40 Q 90 20 140 60 T 260 50 Q 320 70 340 120 L 340 200 L 20 200 Z"
        fill="url(#greenZone)"
      />
      <Path d="M 180 120 Q 240 100 300 130 T 360 170 L 360 220 L 160 220 Z" fill="#DDD6C9" />

      {/* Clean Pista City Roads */}
      <Line
        x1="0"
        y1="90"
        x2="360"
        y2="90"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Line
        x1="120"
        y1="0"
        x2="120"
        y2="220"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Line
        x1="240"
        y1="0"
        x2="240"
        y2="220"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Line
        x1="0"
        y1="160"
        x2="360"
        y2="160"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Sanctuary Boundary Zone */}
      <Circle
        cx="120"
        cy="90"
        r="44"
        fill="rgba(218, 119, 86, 0.08)"
        stroke="#DA7756"
        strokeWidth="1.5"
        strokeDasharray="4,4"
      />
      <SvgText x="120" y="58" fontSize="9" fontWeight="700" fill="#8C3E23" textAnchor="middle">
        HOME SANCTUARY
      </SvgText>

      {/* Dine-out / Meetup Suggested Hubs */}
      <G>
        <Circle cx="210" cy="140" r="8" fill="#C27835" stroke="#FFFFFF" strokeWidth="1.5" />
        <SvgText x="210" y="154" fontSize="7.5" fontWeight="700" fill="#C27835" textAnchor="middle">
          Oh! Calcutta
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
            <Circle
              cx={cx}
              cy={cy}
              r={isSelected ? 18 : 12}
              fill={member.avatarColor}
              fillOpacity={isSelected ? 0.3 : 0.15}
            />
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

  const activeCanvasWidth = windowWidth - 32
  const activeCanvasHeight = compact ? 150 : MAP_HEIGHT

  return (
    <ErrorBoundary>
      <View style={styles.container}>
      {/* ── Top Bar Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          <AppText
            variant={"bodyMedium"}
            style={{ fontWeight: "600" }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Family Live Sanctuary & Map
          </AppText>
        </View>

        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {/* Mode Switcher Pill */}
          <PressableScale
            style={[styles.smallActionBtn, { backgroundColor: colors.surface2 }]}
            onPress={() => {
              void Haptics.selectionAsync()
              setMapMode((m) => (m === "tile" ? "schematic" : "tile"))
            }}
          >
            <Ionicons
              name={mapMode === "tile" ? "map-outline" : "grid-outline"}
              size={10}
              color={colors.primary}
            />
            <AppText
              variant="caption"
              style={{ color: colors.primary, fontWeight: "700", fontSize: 9 }}
            >
              {mapMode === "tile" ? "OSM Map" : "Layout"}
            </AppText>
          </PressableScale>

          <PressableScale
            style={[styles.smallActionBtn, { backgroundColor: colors.surface2 }]}
            onPress={() => setDineoutModalVisible(true)}
          >
            <Ionicons name="restaurant-outline" size={10} color={colors.primary} />
            <AppText
              variant="caption"
              style={{ color: colors.primary, fontWeight: "700", fontSize: 9 }}
            >
              Outings
            </AppText>
          </PressableScale>

          <PressableScale
            style={[styles.smallActionBtn, { backgroundColor: colors.surface2 }]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push("/(app)/map")
            }}
          >
            <Ionicons name="expand" size={10} color={colors.primary} />
            <AppText
              variant="caption"
              style={{ color: colors.primary, fontWeight: "700", fontSize: 9 }}
            >
              Full Map
            </AppText>
          </PressableScale>
        </View>
      </View>

      {/* ── Offline Map Pack Status Bar ── */}
      <View style={[styles.offlineStatusBar, { backgroundColor: colors.surface2 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <Ionicons
            name={offlinePack?.isOfflineReady ? "cloud-done" : "cloud-download-outline"}
            size={14}
            color={offlinePack?.isOfflineReady ? colors.success : colors.text.muted}
            style={{ marginRight: 6 }}
          />
          <AppText
            variant="caption"
            style={{ color: colors.text.secondary, fontSize: 11, flex: 1 }}
            numberOfLines={1}
          >
            {offlinePack?.isOfflineReady
              ? `Offline Map Ready (${offlinePack.tileCount} tiles · ${Math.round(offlinePack.sizeBytes / 1024)} KB)`
              : "Download local map for zero-network offline resilience"}
          </AppText>
        </View>

        <PressableScale
          style={[styles.downloadMapBtn, { backgroundColor: colors.primaryAlpha }]}
          onPress={handleDownloadMapArea}
          disabled={downloadMapMutation.isPending}
        >
          {downloadMapMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="download-outline" size={12} color={colors.primary} />
              <AppText
                style={{ fontSize: 10, fontWeight: "700", color: colors.primary, marginLeft: 4 }}
              >
                {offlinePack?.isOfflineReady ? "Update Pack" : "Download Area"}
              </AppText>
            </>
          )}
        </PressableScale>
      </View>

      {downloadProgress && (
        <View style={[styles.progressDownloadBar, { backgroundColor: colors.surface2 }]}>
          <AppText
            variant="caption"
            style={{ color: colors.primary, fontWeight: "700", fontSize: 10 }}
          >
            Caching tiles: {downloadProgress.current} / {downloadProgress.total}…
          </AppText>
        </View>
      )}

      {/* ── Active Map Canvas (Tile Map or Architectural Schematic) ── */}
      <View style={[styles.mapCanvasWrapper, { backgroundColor: colors.surface2 }]}>
        {mapMode === "tile"
          ? renderTileMap(activeCanvasWidth, activeCanvasHeight, false)
          : renderSchematicCanvas(activeCanvasWidth, activeCanvasHeight, false)}
      </View>

      {/* ── Horizontal Family Member Chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.memberChipsRow}
      >
        {locations.map((m) => {
          const isSelected = selectedMember?.memberId === m.memberId
          const distKm = calculateDistanceKm(centerLat, centerLon, m.latitude, m.longitude)
          const distStr = formatDistance(distKm)
          return (
            <PressableScale
              key={m.memberId}
              style={[
                styles.memberChip,
                {
                  backgroundColor: isSelected ? "#FFFDF9" : colors.surface2,
                  borderColor: isSelected ? "#DA7756" : "rgba(0,0,0,0.06)",
                  borderWidth: isSelected ? 1.5 : 1,
                },
              ]}
              onPress={() => {
                void Haptics.selectionAsync()
                setSelectedMember(m)
                if (onSelectMember) onSelectMember(m)
              }}
            >
              <View style={[styles.chipAvatar, { backgroundColor: m.avatarColor }]}>
                <AppText
                  style={{
                    fontSize: 10.5,
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
                    fontWeight: isSelected ? "800" : "600",
                    fontSize: 11.5,
                    color: isSelected ? colors.text.primary : colors.text.secondary,
                  }}
                  numberOfLines={1}
                >
                  {m.memberNickname || m.memberName.split(" ")[0]}
                </AppText>
                <AppText
                  style={{
                    fontSize: 9.5,
                    fontWeight: isSelected ? "700" : "500",
                    color: isSelected ? "#DA7756" : colors.text.muted,
                  }}
                >
                  {distStr} · {m.batteryLevel}%
                </AppText>
              </View>
            </PressableScale>
          )
        })}
      </ScrollView>

      {/* ── Active Member Details & "Where is My Phone" Card ── */}
      {selectedMember &&
        (compact ? (
          <PressableScale
            style={[
              styles.compactMemberBar,
              { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => {
              void Haptics.selectionAsync()
              setDetailSheetVisible(true)
            }}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AppText
                  variant="caption"
                  style={{ fontWeight: "800", color: colors.text.primary, fontSize: 13 }}
                  numberOfLines={1}
                >
                  {selectedMember.memberName}
                </AppText>
                {selectedMember.memberNickname ? (
                  <Badge label={selectedMember.memberNickname} tone="neutral" size="small" />
                ) : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Ionicons name="location" size={11} color="#DA7756" />
                <AppText
                  variant="caption"
                  style={{ color: colors.text.secondary, fontSize: 11 }}
                  numberOfLines={1}
                >
                  {selectedMember.placeName} • {selectedMember.roomDetail}
                </AppText>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <PressableScale
                style={[styles.compactFindBtn, { backgroundColor: "#DA7756" }]}
                onPress={() => handleOpenFinder(selectedMember)}
              >
                <Ionicons name="volume-high" size={13} color="#FFFFFF" />
                <AppText
                  style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700", marginLeft: 4 }}
                >
                  Find Phone
                </AppText>
              </PressableScale>

              <PressableScale
                style={[styles.compactFindBtn, { backgroundColor: colors.surface2 }]}
                onPress={() => setDetailSheetVisible(true)}
              >
                <Ionicons name="person-outline" size={13} color={colors.primary} />
              </PressableScale>
            </View>
          </PressableScale>
        ) : (
          <Card style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}
                >
                  <AppText variant="subheading" style={{ fontWeight: "700" }}>
                    {selectedMember.memberName}
                  </AppText>
                  {selectedMember.memberNickname && (
                    <Badge label={selectedMember.memberNickname} tone="neutral" size="small" />
                  )}
                  <Badge
                    label={formatDistance(
                      calculateDistanceKm(
                        centerLat,
                        centerLon,
                        selectedMember.latitude,
                        selectedMember.longitude,
                      ),
                    )}
                    tone="info"
                    size="small"
                  />
                </View>

                <View style={styles.locationSubtitleRow}>
                  <Ionicons name="location" size={13} color={colors.primary} />
                  <AppText
                    variant="caption"
                    style={{ color: colors.text.primary, fontWeight: "600", marginLeft: 4 }}
                  >
                    {selectedMember.placeName}
                  </AppText>
                  {selectedMember.roomDetail ? (
                    <AppText variant="caption" style={{ color: colors.text.muted, marginLeft: 4 }}>
                      • {selectedMember.roomDetail}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Action Buttons: Find Phone + Full Profile */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10, marginBottom: 12 }}>
              <PressableScale
                style={[styles.findPhoneBtn, { backgroundColor: colors.primary, flex: 1.2 }]}
                onPress={() => handleOpenFinder(selectedMember)}
              >
                <Ionicons name="volume-high" size={15} color="#FFFFFF" />
                <AppText style={styles.findPhoneBtnText}>Find Phone</AppText>
              </PressableScale>

              <PressableScale
                style={[styles.findPhoneBtn, { backgroundColor: colors.surface2, flex: 1 }]}
                onPress={() => setDetailSheetVisible(true)}
              >
                <Ionicons name="person-circle-outline" size={16} color={colors.primary} />
                <AppText style={[styles.findPhoneBtnText, { color: colors.primary }]}>
                  Full Profile
                </AppText>
              </PressableScale>
            </View>

            {/* Telemetry bar: only values the member's phone actually reported */}
            <View style={[styles.telemetryBar, { backgroundColor: colors.surface2 }]}>
              <View style={styles.telemetryItem}>
                <Ionicons name="locate-outline" size={14} color={colors.primary} />
                <AppText variant="caption" style={styles.telemetryText}>
                  ±{Math.max(1, Math.round(selectedMember.accuracyMeters))} m
                </AppText>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryItem}>
                <Ionicons name="time-outline" size={14} color={colors.primary} />
                <AppText variant="caption" style={styles.telemetryText}>
                  {selectedMember.lastUpdated}
                </AppText>
              </View>
            </View>
          </Card>
        ))}

      {/* ── Detail Sheet Modal for Selected Member ── */}
      {activeFullMember && (
        <FamilyMemberDetailSheet
          visible={detailSheetVisible}
          member={activeFullMember}
          onClose={() => setDetailSheetVisible(false)}
          onFindPhone={() => selectedMember && handleOpenFinder(selectedMember)}
        />
      )}

      {/* ── Modal: Fullscreen Zoomable Map View ── */}
      <Modal visible={fullscreenMapVisible} animationType="fade" transparent>
        <View style={styles.fullscreenModal}>
          <View style={[styles.fullscreenHeader, { backgroundColor: colors.background }]}>
            <View>
              <AppText variant="h3" style={{ fontWeight: "800" }}>
                Interactive Sanctuary Map
              </AppText>
              <AppText variant="caption" style={{ color: colors.text.secondary }}>
                Free OpenStreetMap · Zoom and pan family coordinates
              </AppText>
            </View>
            <PressableScale onPress={() => setFullscreenMapVisible(false)}>
              <Ionicons name="close-circle-outline" size={28} color={colors.text.primary} />
            </PressableScale>
          </View>

          <View style={styles.zoomableCanvasHolder}>
            <Animated.View style={[styles.zoomableCanvas, zoomAnimStyle]}>
              {renderTileMap(windowWidth, windowHeight * 0.65, true)}
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

      {/* ── Modal: Family Gathering & Dine-Out Planner ── */}
      <AppBottomSheetModal
        visible={dineoutModalVisible}
        onClose={() => setDineoutModalVisible(false)}
        title="Family Gathering & Dine-Out"
        subtitle="Recommended community spots & accessible venues for multigenerational gatherings"
      >
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          {DINE_OUT_SUGGESTIONS.map((item) => (
            <Card key={item.id} style={styles.dineoutCard}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <AppText variant="subheading" style={{ fontWeight: "800", flex: 1 }}>
                  {item.name}
                </AppText>
                <Badge label={`Rating: ${item.rating}`} tone="success" size="small" />
              </View>

              <AppText
                variant="caption"
                style={{ color: colors.primary, fontWeight: "700", marginTop: 2 }}
              >
                {item.vibe} · {item.distanceMins} mins away
              </AppText>

              <View style={styles.dineoutTagsRow}>
                {item.elderFriendly && (
                  <Badge label="Elder Accessible" tone="neutral" size="small" />
                )}
                {item.petFriendly && <Badge label="Pet Friendly" tone="neutral" size="small" />}
              </View>

              <AppText
                variant="caption"
                style={{ color: colors.text.secondary, marginTop: 6, lineHeight: 18 }}
              >
                {item.aiReason}
              </AppText>

              <AppButton
                title="Schedule Family Outing & Sync Calendar"
                variant="primary"
                size="sm"
                onPress={() => handleScheduleDineOut(item)}
                style={{ marginTop: 10 }}
              />
            </Card>
          ))}
        </ScrollView>
      </AppBottomSheetModal>

      {/* ── Modal: Precision "Where is My Phone" Acoustic Siren ── */}
      <AppBottomSheetModal
        visible={finderModalVisible}
        onClose={() => {
          familyLocationService.stopPhoneSiren()
          setIsSirenActive(false)
          setIsStrobeActive(false)
          setFinderModalVisible(false)
        }}
        title="Pinpoint Phone Finder"
        subtitle={`Locating ${selectedMember?.memberName || "Family Member"}'s phone`}
      >
        {/* Honest Telemetry & 3D Spatial Radar Readout */}
        <View style={[styles.radarBox, { backgroundColor: colors.surface2 }]}>
          <View style={styles.radarIconWrap}>
            <Ionicons
              name={
                radarScan?.planeEstimate === "cushion_sofa_bed"
                  ? "bed-outline"
                  : radarScan?.planeEstimate === "basement_subterranean"
                    ? "cube-outline"
                    : "radio-outline"
              }
              size={34}
              color={radarScan?.status === "last_location_available" ? colors.primary : "#9CA3AF"}
            />
          </View>

          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <AppText variant="h3" style={{ fontWeight: "800", color: colors.text.primary }}>
                Accuracy: ±{radarScan?.accuracyMeters ?? 5}m
              </AppText>
              {radarScan?.altitudeMeters !== undefined && (
                <Badge
                  label={`Alt: ${radarScan.altitudeMeters > 0 ? "+" : ""}${radarScan.altitudeMeters.toFixed(1)}m`}
                  tone="info"
                  size="small"
                />
              )}
            </View>

            <AppText variant="body" style={{ fontWeight: "700", marginTop: 2 }}>
              {radarScan?.areaDescription || "Last-Known Sanctuary Area"}
            </AppText>

            {/* 3D Vertical Plane & Micro-Location Estimation */}
            <View style={{ marginTop: 6, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="layers-outline" size={13} color={colors.primary} />
                <AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>
                  3D Plane: {radarScan?.planeDescription || "Floor / Counter Surface"}
                </AppText>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="wifi-outline" size={13} color={colors.text.secondary} />
                <AppText variant="caption" style={{ color: colors.text.secondary }}>
                  RF Occlusion: {radarScan?.rfOcclusionNote || "Direct RF Line of Sight"}
                </AppText>
              </View>
            </View>
          </View>
        </View>

        {/* Action Controls: Acoustic Siren */}
        <View style={styles.modalActionButtons}>
          <AppButton
            title={isSirenActive ? "Stop Audio Siren" : "Sound Audio & Haptic Siren"}
            variant={isSirenActive ? "outline" : "primary"}
            onPress={toggleSiren}
            style={{ flex: 1 }}
          />
        </View>

        {/* Lost Outside / Left in Public: Google Find My Device */}
        <View style={[styles.googleFindBox, { backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.accentText} />
            <AppText variant="caption" style={{ fontWeight: "800", color: colors.text.primary }}>
              Lost Outside or Left at Bank/Market?
            </AppText>
          </View>
          <AppText variant="caption" style={{ color: colors.text.secondary, marginBottom: 8 }}>
            If the device was left in a shop, bank, market, or suspected stolen, launch Google Find
            My Device to lock, remotely wipe, or ring through Google Play Services.
          </AppText>
          <PressableScale
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              void Linking.openURL("https://www.google.com/android/find")
            }}
            style={[styles.googleFindBtn, { borderColor: colors.border }]}
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

        {isSirenActive && (
          <View style={[styles.sirenActiveBanner, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
            <Ionicons name="warning" size={16} color="#EF4444" style={{ marginRight: 6 }} />
            <AppText variant="caption" style={{ color: "#B91C1C", fontWeight: "700", flex: 1 }}>
              Audible chirp and haptic pulses are active. Listen carefully nearby! Note: volume is
              bounded by Android system audio policy.
            </AppText>
          </View>
        )}
      </AppBottomSheetModal>
      </View>
    </ErrorBoundary>
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
    marginBottom: 8,
    gap: 16,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  smallActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 8,
  },
  offlineStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  downloadMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  progressDownloadBar: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
    alignItems: "center",
  },
  mapCanvasWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileMapContainer: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 16,
  },
  mapTileImage: {
    position: "absolute",
  },
  tileTintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(125, 140, 125, 0.08)",
  },
  geofenceRing: {
    position: "absolute",
    borderWidth: 2,
    borderStyle: "dashed",
    backgroundColor: "rgba(125, 140, 125, 0.12)",
  },
  dineOutPinWrap: {
    position: "absolute",
    alignItems: "center",
  },
  dineOutDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  pinLabelBox: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 0,
  },
  memberPinMarker: {
    position: "absolute",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  memberHalo: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  memberPinHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    elevation: 0,
  },
  memberPinText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  memberPinTag: {
    position: "absolute",
    bottom: -13,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 0,
  },
  memberPinTagText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#192216",
  },
  tileZoomBar: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 0,
  },
  tileZoomBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  tileZoomDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  osmAttributionBadge: {
    position: "absolute",
    left: 8,
    bottom: 6,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  osmAttributionText: {
    fontSize: 7.5,
    fontWeight: "600",
    color: "#4A5568",
  },
  memberChipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 2,
    marginBottom: 10,
  },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  chipAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  compactMemberBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  compactFindBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  detailCard: {
    padding: 14,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  locationSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  findPhoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  findPhoneBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 5,
  },
  telemetryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  telemetryItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  telemetryText: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  telemetryDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  fullscreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  zoomableCanvasHolder: {
    backgroundColor: "#FAF9F5",
    height: "75%",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  zoomableCanvas: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingZoomControls: {
    position: "absolute",
    right: 16,
    bottom: 24,
    gap: 8,
  },
  zoomControlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 0,
  },
  dineoutCard: {
    padding: 14,
    marginBottom: 12,
  },
  dineoutTagsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  radarBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  radarIconWrap: {
    marginRight: 14,
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  sirenActiveBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
  },
  googleFindBox: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  googleFindBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
})
