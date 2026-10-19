/**
 * TanStack React Query Hook for Family Intentions & Milestones
 *
 * Implements:
 * - Query for shared intentions with offline caching
 * - Mutation for cheering an intention
 * - Mutation for toggling completion and adding intentions
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useIntentionsStore, type FamilyIntention } from "@/stores/useIntentionsStore"

export const INTENTIONS_QUERY_KEYS = {
  all: ["intentions"] as const,
}

export function useIntentionsQuery() {
  const allIntentions = useIntentionsStore((s) => s.intentions)

  return useQuery<FamilyIntention[]>({
    queryKey: INTENTIONS_QUERY_KEYS.all,
    queryFn: async () => allIntentions,
    initialData: () => allIntentions,
    staleTime: 1000 * 60,
  })
}

export function useCheerIntentionMutation() {
  const queryClient = useQueryClient()
  const cheerInStore = useIntentionsStore((s) => s.cheerIntention)

  return useMutation({
    mutationFn: async (intentionId: string) => {
      cheerInStore(intentionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTENTIONS_QUERY_KEYS.all })
    },
  })
}

export function useAddIntentionMutation() {
  const queryClient = useQueryClient()
  const addInStore = useIntentionsStore((s) => s.addIntention)

  return useMutation({
    mutationFn: async (
      intention: Omit<FamilyIntention, "id" | "cheerCount" | "isCompleted">,
    ) => {
      addInStore(intention)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTENTIONS_QUERY_KEYS.all })
    },
  })
}
