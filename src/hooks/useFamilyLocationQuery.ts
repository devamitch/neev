/**
 * TanStack React Query Hook for Family Location & Offline Sanctuary Map Pack
 * Specification: Neev_Family_Network_Privacy_and_Implementation_Master.md
 *
 * Implements:
 * - Query for live/cached family member telemetry (staleTime 30s, offlineFirst)
 * - Query for local offline map pack status
 * - Mutation to download & cache sanctuary map tiles for offline usage
 * - Mutation to sync current device GPS coordinates
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  familyLocationService,
  type FamilyLocationData,
  type PhoneRadarScan,
} from "@/services/location/familyLocationService"
import {
  offlineMapTileService,
  type OfflineMapPack,
} from "@/services/location/offlineMapTileService"

export const LOCATION_QUERY_KEYS = {
  all: ["family", "locations"] as const,
  member: (id: string) => ["family", "locations", id] as const,
  radar: (id: string) => ["family", "radar", id] as const,
  offlinePack: ["map", "offlinePack"] as const,
}

/**
 * Fetch all authorized family member locations with TanStack React Query
 */
export function useFamilyLocationsQuery() {
  return useQuery<FamilyLocationData[]>({
    queryKey: LOCATION_QUERY_KEYS.all,
    queryFn: async () => {
      return familyLocationService.getAllFamilyLocations()
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute background poll
  })
}

/**
 * Fetch location for a single family member
 */
export function useMemberLocationQuery(memberId: string | null) {
  return useQuery<FamilyLocationData | null>({
    queryKey: memberId ? LOCATION_QUERY_KEYS.member(memberId) : ["family", "locations", "none"],
    queryFn: async () => {
      if (!memberId) return null
      return familyLocationService.getMemberLocation(memberId) || null
    },
    enabled: Boolean(memberId),
    staleTime: 1000 * 30,
  })
}

/**
 * Query honest device finder & acoustic radar scan
 */
export function usePhoneRadarScanQuery(memberId: string | null) {
  return useQuery<PhoneRadarScan | null>({
    queryKey: memberId ? LOCATION_QUERY_KEYS.radar(memberId) : ["family", "radar", "none"],
    queryFn: async () => {
      if (!memberId) return null
      return familyLocationService.getPrecisionRadarScan(memberId)
    },
    enabled: Boolean(memberId),
    staleTime: 1000 * 10,
  })
}

/**
 * Query active offline map pack state
 */
export function useOfflineMapPackQuery() {
  return useQuery<OfflineMapPack | null>({
    queryKey: LOCATION_QUERY_KEYS.offlinePack,
    queryFn: async () => {
      return offlineMapTileService.getStoredMapPack()
    },
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Mutation to download and cache a local map area for offline use
 */
export function useDownloadOfflineMapMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      centerLat,
      centerLon,
      areaName,
      onProgress,
    }: {
      centerLat: number
      centerLon: number
      areaName?: string
      onProgress?: (progress: number, total: number) => void
    }) => {
      return offlineMapTileService.downloadSanctuaryArea(centerLat, centerLon, areaName, onProgress)
    },
    onSuccess: (pack) => {
      queryClient.setQueryData(LOCATION_QUERY_KEYS.offlinePack, pack)
      queryClient.invalidateQueries({ queryKey: LOCATION_QUERY_KEYS.offlinePack })
    },
  })
}

/**
 * Mutation to clear the offline map pack
 */
export function useClearOfflineMapMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      offlineMapTileService.clearMapPack()
    },
    onSuccess: () => {
      queryClient.setQueryData(LOCATION_QUERY_KEYS.offlinePack, null)
      queryClient.invalidateQueries({ queryKey: LOCATION_QUERY_KEYS.offlinePack })
    },
  })
}

/**
 * Mutation to sync current device GPS coordinates
 */
export function useSyncDeviceLocationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (memberId?: string) => {
      await familyLocationService.syncCurrentDeviceLocation(memberId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOCATION_QUERY_KEYS.all })
    },
  })
}
