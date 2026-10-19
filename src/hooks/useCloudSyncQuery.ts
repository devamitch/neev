/**
 * Neev TanStack React Query Cloud Sync Hooks
 * Synchronizes Members, Functions, Intentions, Knowledge, and Routines
 * with 2-tier resilient Supabase execution and Zustand store synchronization.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { resilientNetworkClient } from "@/services/network/resilientNetworkClient"
import { QueryKeys } from "@/services/query/queryClient"
import { useRootStore } from "@/stores/useRootStore"
import type { FamilyMember } from "@/stores/slices/createFamilySlice"
import type { FamilyFunction } from "@/stores/slices/createScheduleSlice"
import type { FamilyIntention } from "@/stores/slices/createIntentionsSlice"
import type { KnowledgeEntry } from "@/stores/slices/createKnowledgeSlice"
import type { FamilyRoutineItem } from "@/stores/slices/createRoutineSlice"

export function useSyncMemberMutation() {
  const queryClient = useQueryClient()
  const householdId = useRootStore((s) => s.household?.id) || "sharma_household_root"

  return useMutation({
    mutationFn: (member: FamilyMember) => resilientNetworkClient.syncMember(householdId, member),
    onSuccess: (savedMember) => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.householdMembers(householdId) })
    },
    onError: (err) => {
      console.warn("[useSyncMemberMutation] Resilient sync member failed on both tiers:", err)
    },
  })
}

export function useSyncFunctionMutation() {
  const queryClient = useQueryClient()
  const householdId = useRootStore((s) => s.household?.id) || "sharma_household_root"

  return useMutation({
    mutationFn: (fn: FamilyFunction) => resilientNetworkClient.syncFunction(householdId, fn),
    onSuccess: (savedFn) => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.familyFunctions(householdId) })
    },
    onError: (err) => {
      console.warn("[useSyncFunctionMutation] Resilient sync function failed on both tiers:", err)
    },
  })
}

export function useSyncIntentionMutation() {
  const queryClient = useQueryClient()
  const householdId = useRootStore((s) => s.household?.id) || "sharma_household_root"

  return useMutation({
    mutationFn: (intention: FamilyIntention) =>
      resilientNetworkClient.syncIntention(householdId, intention),
    onSuccess: (savedIntention) => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.familyIntentions(householdId) })
    },
    onError: (err) => {
      console.warn("[useSyncIntentionMutation] Resilient sync intention failed on both tiers:", err)
    },
  })
}

export function useSyncKnowledgeMutation() {
  const queryClient = useQueryClient()
  const householdId = useRootStore((s) => s.household?.id) || "sharma_household_root"

  return useMutation({
    mutationFn: (entry: KnowledgeEntry) => resilientNetworkClient.syncKnowledge(householdId, entry),
    onSuccess: (savedEntry) => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.knowledgeEntries(householdId) })
    },
    onError: (err) => {
      console.warn("[useSyncKnowledgeMutation] Resilient sync knowledge failed on both tiers:", err)
    },
  })
}

export function useSyncRoutineMutation() {
  const queryClient = useQueryClient()
  const householdId = useRootStore((s) => s.household?.id) || "sharma_household_root"

  return useMutation({
    mutationFn: (routine: FamilyRoutineItem) =>
      resilientNetworkClient.syncRoutine(householdId, routine),
    onSuccess: (savedRoutine) => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.familyRoutines(householdId) })
    },
    onError: (err) => {
      console.warn("[useSyncRoutineMutation] Resilient sync routine failed on both tiers:", err)
    },
  })
}
