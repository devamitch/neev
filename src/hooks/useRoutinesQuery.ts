/**
 * TanStack React Query Hook for Daily Family Routines
 *
 * Implements:
 * - Query for routines with offline caching
 * - Mutation for toggling routine completion
 * - Mutation for adding routines
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRoutineStore, type FamilyRoutineItem } from "@/stores/useRoutineStore"

export const ROUTINES_QUERY_KEYS = {
  all: ["routines"] as const,
}

export function useRoutinesQuery() {
  const allRoutines = useRoutineStore((s) => s.routines)

  return useQuery<FamilyRoutineItem[]>({
    queryKey: ROUTINES_QUERY_KEYS.all,
    queryFn: async () => allRoutines,
    initialData: () => allRoutines,
    staleTime: 1000 * 60,
  })
}

export function useToggleRoutineMutation() {
  const queryClient = useQueryClient()
  const toggleRoutineInStore = useRoutineStore((s) => s.toggleRoutine)

  return useMutation({
    mutationFn: async (routineId: string) => {
      toggleRoutineInStore(routineId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINES_QUERY_KEYS.all })
    },
  })
}

export function useAddRoutineMutation() {
  const queryClient = useQueryClient()
  const addRoutineInStore = useRoutineStore((s) => s.addRoutine)

  return useMutation({
    mutationFn: async (item: Omit<FamilyRoutineItem, "id" | "isCompleted">) => {
      addRoutineInStore(item)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINES_QUERY_KEYS.all })
    },
  })
}
