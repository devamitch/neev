/**
 * TanStack React Query Hook for Knowledge Sanctuary Vault
 *
 * Implements:
 * - Query for knowledge vault entries with offline caching
 * - Mutations for toggling pin and adding entries
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useKnowledgeStore, type KnowledgeEntry } from "@/stores/useKnowledgeStore"

export const KNOWLEDGE_QUERY_KEYS = {
  all: ["knowledge", "entries"] as const,
  detail: (id: string) => ["knowledge", "entries", id] as const,
}

export function useKnowledgeQuery() {
  const storeEntries = useKnowledgeStore((s) => s.entries)

  return useQuery<KnowledgeEntry[]>({
    queryKey: KNOWLEDGE_QUERY_KEYS.all,
    queryFn: async () => {
      return storeEntries
    },
    initialData: storeEntries,
    staleTime: 1000 * 60,
  })
}

export function useToggleKnowledgePinMutation() {
  const queryClient = useQueryClient()
  const togglePinInStore = useKnowledgeStore((s) => s.togglePin)

  return useMutation({
    mutationFn: async (id: string) => {
      togglePinInStore(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KNOWLEDGE_QUERY_KEYS.all })
    },
  })
}

export function useAddKnowledgeEntryMutation() {
  const queryClient = useQueryClient()
  const addEntryInStore = useKnowledgeStore((s) => s.addEntry)

  return useMutation({
    mutationFn: async (entry: Omit<KnowledgeEntry, "id" | "createdAt">) => {
      return addEntryInStore(entry)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KNOWLEDGE_QUERY_KEYS.all })
    },
  })
}
