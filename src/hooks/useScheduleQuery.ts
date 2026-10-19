/**
 * TanStack React Query Hook for Family Schedule & Functions
 *
 * Implements:
 * - Query for functions with offline caching
 * - Mutations for adding events and toggling tasks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useScheduleStore, type FamilyFunction } from "@/stores/useScheduleStore"

export const SCHEDULE_QUERY_KEYS = {
  all: ["schedule", "functions"] as const,
  detail: (id: string) => ["schedule", "functions", id] as const,
}

export function useScheduleQuery() {
  const storeFunctions = useScheduleStore((s) => s.functions)

  return useQuery<FamilyFunction[]>({
    queryKey: SCHEDULE_QUERY_KEYS.all,
    queryFn: async () => {
      return storeFunctions
    },
    initialData: storeFunctions,
    staleTime: 1000 * 60,
  })
}

export function useToggleScheduleTaskMutation() {
  const queryClient = useQueryClient()
  const toggleTaskInStore = useScheduleStore((s) => s.toggleTask)

  return useMutation({
    mutationFn: async ({ functionId, taskId }: { functionId: string; taskId: string }) => {
      toggleTaskInStore(functionId, taskId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.all })
    },
  })
}

export function useAddScheduleFunctionMutation() {
  const queryClient = useQueryClient()
  const addFunctionInStore = useScheduleStore((s) => s.addFunction)

  return useMutation({
    mutationFn: async (fn: Omit<FamilyFunction, "id">) => {
      return addFunctionInStore(fn)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.all })
    },
  })
}
