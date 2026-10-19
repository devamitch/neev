/**
 * Neev TanStack React Query Hooks for Family Network
 * Specification: Neev_Complete_Supabase_First_Master_Implementation.md
 *
 * Integrates:
 * - 2-tier resilient Supabase calls (Edge Function first -> DB query fallback)
 * - TanStack React Query caching with React Native MMKV offline persistence
 * - Seamless automatic synchronization with Zustand root store slices
 */

import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { resilientNetworkClient } from "@/services/network/resilientNetworkClient"
import { QueryKeys } from "@/services/query/queryClient"
import { useRootStore } from "@/stores/useRootStore"
import type {
  FamilyRealm,
  KinshipEdge,
  FamilyCluster,
  FamilyBridge,
  FamilyInvitation,
} from "@/stores/slices/createFamilyNetworkSlice"

// ==========================================
// 1. FAMILY REALMS HOOKS
// ==========================================

export function useFamilyRealmsQuery(userId?: string) {
  const storeUserId = useRootStore((s) => s.user?.uid)
  const currentUserId = userId || storeUserId || "demo_guardian_01"
  const setRealms = useRootStore((s) => s.setRealms)

  const query = useQuery({
    queryKey: QueryKeys.familyRealms(currentUserId),
    queryFn: () => resilientNetworkClient.fetchRealms(currentUserId),
    enabled: !!currentUserId,
  })

  // Sync with Zustand store when data settles
  useEffect(() => {
    if (query.data && query.data.length > 0) {
      setRealms(query.data)
    }
  }, [query.data, setRealms])

  return query
}

export function useCreateRealmMutation() {
  const queryClient = useQueryClient()
  const addRealm = useRootStore((s) => s.addRealm)
  const currentUserId = useRootStore((s) => s.user?.uid) || "demo_guardian_01"

  return useMutation({
    mutationFn: (realm: FamilyRealm) => resilientNetworkClient.syncRealm(realm),
    onMutate: (newRealm) => {
      // Optimistic update in Zustand
      addRealm(newRealm)
    },
    onSuccess: (savedRealm) => {
      addRealm(savedRealm)
      queryClient.invalidateQueries({ queryKey: QueryKeys.familyRealms(currentUserId) })
    },
    onError: (error) => {
      console.error("[useCreateRealmMutation] Failed to establish realm:", error)
    },
  })
}

// ==========================================
// 2. KINSHIP GRAPH HOOKS
// ==========================================

export function useKinshipGraphQuery(realmId?: string) {
  const storeRealmId = useRootStore((s) => s.activeRealmId)
  const activeRealmId = realmId || storeRealmId || "realm_sharma_root"
  const setKinshipEdges = useRootStore((s) => s.setKinshipEdges)

  const query = useQuery({
    queryKey: QueryKeys.kinshipGraph(activeRealmId),
    queryFn: () => resilientNetworkClient.fetchKinshipEdges(activeRealmId),
    enabled: !!activeRealmId,
  })

  useEffect(() => {
    if (query.data && query.data.length > 0) {
      setKinshipEdges(query.data)
    }
  }, [query.data, setKinshipEdges])

  return query
}

export function useUpsertKinshipEdgeMutation() {
  const queryClient = useQueryClient()
  const addKinshipEdge = useRootStore((s) => s.addKinshipEdge)

  return useMutation({
    mutationFn: (edge: KinshipEdge) => resilientNetworkClient.syncKinshipEdge(edge),
    onMutate: (newEdge) => {
      addKinshipEdge(newEdge)
    },
    onSuccess: (savedEdge) => {
      addKinshipEdge(savedEdge)
      queryClient.invalidateQueries({ queryKey: QueryKeys.kinshipGraph(savedEdge.realmId) })
    },
    onError: (error) => {
      console.error("[useUpsertKinshipEdgeMutation] Failed to save kinship edge:", error)
    },
  })
}

// ==========================================
// 3. FAMILY CLUSTERS HOOKS
// ==========================================

export function useFamilyClustersQuery(realmId?: string) {
  const storeRealmId = useRootStore((s) => s.activeRealmId)
  const activeRealmId = realmId || storeRealmId || "realm_sharma_root"
  const setClusters = useRootStore((s) => s.setClusters)

  const query = useQuery({
    queryKey: QueryKeys.familyClusters(activeRealmId),
    queryFn: () => resilientNetworkClient.fetchClusters(activeRealmId),
    enabled: !!activeRealmId,
  })

  useEffect(() => {
    if (query.data && query.data.length > 0) {
      setClusters(query.data)
    }
  }, [query.data, setClusters])

  return query
}

export function useUpsertClusterMutation() {
  const queryClient = useQueryClient()
  const addCluster = useRootStore((s) => s.addCluster)

  return useMutation({
    mutationFn: (cluster: FamilyCluster) => resilientNetworkClient.syncCluster(cluster),
    onMutate: (newCluster) => {
      addCluster(newCluster)
    },
    onSuccess: (savedCluster) => {
      addCluster(savedCluster)
      queryClient.invalidateQueries({ queryKey: QueryKeys.familyClusters(savedCluster.realmId) })
    },
    onError: (error) => {
      console.error("[useUpsertClusterMutation] Failed to save cluster:", error)
    },
  })
}

// ==========================================
// 4. FAMILY BRIDGES HOOKS
// ==========================================

export function useFamilyBridgesQuery(realmId?: string) {
  const storeRealmId = useRootStore((s) => s.activeRealmId)
  const activeRealmId = realmId || storeRealmId || "realm_sharma_root"
  const setBridges = useRootStore((s) => s.setBridges)

  const query = useQuery({
    queryKey: QueryKeys.familyBridges(activeRealmId),
    queryFn: () => resilientNetworkClient.fetchBridges(activeRealmId),
    enabled: !!activeRealmId,
  })

  useEffect(() => {
    if (query.data && query.data.length > 0) {
      setBridges(query.data)
    }
  }, [query.data, setBridges])

  return query
}

export function useCreateBridgeMutation() {
  const queryClient = useQueryClient()
  const addBridgeRecord = useRootStore((s) => s.addBridgeRecord)

  return useMutation({
    mutationFn: (bridge: FamilyBridge) => resilientNetworkClient.syncBridge(bridge),
    onMutate: (newBridge) => {
      addBridgeRecord(newBridge)
    },
    onSuccess: (savedBridge) => {
      addBridgeRecord(savedBridge)
      queryClient.invalidateQueries({ queryKey: QueryKeys.familyBridges(savedBridge.fromRealmId) })
    },
    onError: (error) => {
      console.error("[useCreateBridgeMutation] Failed to initiate bridge:", error)
    },
  })
}

// ==========================================
// 5. INVITATIONS & CLAIMS HOOKS
// ==========================================

export function useFamilyInvitationsQuery(realmId?: string) {
  const storeRealmId = useRootStore((s) => s.activeRealmId)
  const activeRealmId = realmId || storeRealmId || "realm_sharma_root"
  const setInvitations = useRootStore((s) => s.setInvitations)

  const query = useQuery({
    queryKey: QueryKeys.familyInvitations(activeRealmId),
    queryFn: () => resilientNetworkClient.fetchInvitations(activeRealmId),
    enabled: !!activeRealmId,
  })

  useEffect(() => {
    if (query.data && query.data.length > 0) {
      setInvitations(query.data)
    }
  }, [query.data, setInvitations])

  return query
}

export function useCreateInvitationMutation() {
  const queryClient = useQueryClient()
  const addInvitationRecord = useRootStore((s) => s.addInvitationRecord)

  return useMutation({
    mutationFn: (invitation: FamilyInvitation) => resilientNetworkClient.syncInvitation(invitation),
    onMutate: (newInv) => {
      addInvitationRecord(newInv)
    },
    onSuccess: (savedInv) => {
      addInvitationRecord(savedInv)
      queryClient.invalidateQueries({ queryKey: QueryKeys.familyInvitations(savedInv.realmId) })
    },
    onError: (error) => {
      console.error("[useCreateInvitationMutation] Failed to issue invitation:", error)
    },
  })
}

export function useClaimInvitationMutation() {
  const claimInvitationStore = useRootStore((s) => s.claimInvitation)

  return useMutation({
    mutationFn: (inviteCode: string) => resilientNetworkClient.claimInvitation(inviteCode),
    onSuccess: (_, inviteCode) => {
      claimInvitationStore(inviteCode)
    },
    onError: (error) => {
      console.error("[useClaimInvitationMutation] Claim failed on both tiers:", error)
    },
  })
}

// ==========================================
// 6. DETERMINISTIC PLANNER & AI GUIDANCE HOOKS
// ==========================================

export function useGeneratePlanMutation() {
  return useMutation({
    mutationFn: (tasks: unknown[]) => resilientNetworkClient.generatePlan(tasks),
    onError: (error) => {
      console.error("[useGeneratePlanMutation] Plan generation failed:", error)
    },
  })
}

export function useSanctuaryAiMutation() {
  return useMutation({
    mutationFn: ({
      prompt,
      contextType,
      realmId,
    }: {
      prompt: string
      contextType?: string
      realmId?: string
    }) => resilientNetworkClient.requestAi(prompt, contextType, realmId),
    onError: (error) => {
      console.error("[useSanctuaryAiMutation] Sanctuary AI call failed on both tiers:", error)
    },
  })
}
