/**
 * TanStack React Query Hook for Sacred Spaces (Personal / Nuclear / Family)
 *
 * Implements:
 * - Query for space tasks with space filter and offline MMKV caching
 * - Query for space meetings and AI briefings
 * - Mutations for adding tasks and toggling task completion
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  useSpacesStore,
  type SpaceType,
  type SpaceTask,
  type SpaceMeeting,
  type AiBriefing,
} from "@/stores/useSpacesStore"

export const SPACES_QUERY_KEYS = {
  allTasks: ["spaces", "tasks"] as const,
  tasksBySpace: (space: SpaceType) => ["spaces", "tasks", space] as const,
  allMeetings: ["spaces", "meetings"] as const,
  meetingsBySpace: (space: SpaceType) => ["spaces", "meetings", space] as const,
  allBriefings: ["spaces", "briefings"] as const,
  briefingsBySpace: (space: SpaceType) => ["spaces", "briefings", space] as const,
}

export function useSpacesTasksQuery(space?: SpaceType) {
  const allTasks = useSpacesStore((s) => s.tasks)

  return useQuery<SpaceTask[]>({
    queryKey: space ? SPACES_QUERY_KEYS.tasksBySpace(space) : SPACES_QUERY_KEYS.allTasks,
    queryFn: async () => {
      return space ? allTasks.filter((t) => t.space === space) : allTasks
    },
    initialData: () => (space ? allTasks.filter((t) => t.space === space) : allTasks),
    staleTime: 1000 * 60,
  })
}

export function useToggleSpaceTaskMutation() {
  const queryClient = useQueryClient()
  const toggleTaskInStore = useSpacesStore((s) => s.toggleTask)

  return useMutation({
    mutationFn: async (taskId: string) => {
      toggleTaskInStore(taskId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces", "tasks"] })
    },
  })
}

export function useAddSpaceTaskMutation() {
  const queryClient = useQueryClient()
  const addTaskInStore = useSpacesStore((s) => s.addTask)

  return useMutation({
    mutationFn: async (
      task: Omit<SpaceTask, "id" | "isCompleted" | "reminderNudgeCount">,
    ) => {
      addTaskInStore(task)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces", "tasks"] })
    },
  })
}

export function useSpaceMeetingsQuery(space?: SpaceType) {
  const allMeetings = useSpacesStore((s) => s.meetings)

  return useQuery<SpaceMeeting[]>({
    queryKey: space
      ? SPACES_QUERY_KEYS.meetingsBySpace(space)
      : SPACES_QUERY_KEYS.allMeetings,
    queryFn: async () => {
      return space ? allMeetings.filter((m) => m.space === space) : allMeetings
    },
    initialData: () => (space ? allMeetings.filter((m) => m.space === space) : allMeetings),
    staleTime: 1000 * 60,
  })
}

export function useSpaceAiBriefingsQuery(space?: SpaceType) {
  const allBriefings = useSpacesStore((s) => s.aiBriefings)

  return useQuery<AiBriefing[]>({
    queryKey: space
      ? SPACES_QUERY_KEYS.briefingsBySpace(space)
      : SPACES_QUERY_KEYS.allBriefings,
    queryFn: async () => {
      return space ? allBriefings.filter((b) => b.space === space) : allBriefings
    },
    initialData: () => (space ? allBriefings.filter((b) => b.space === space) : allBriefings),
    staleTime: 1000 * 60,
  })
}
