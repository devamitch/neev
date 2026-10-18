/**
 * Sacred Spaces Multi-Partition Hook
 * Powered by unified RootStore slice
 */

import { useRootStore } from "./useRootStore"
export type { SpaceType, SpaceTask, SpaceMeeting, AiBriefing, SpacesSlice } from "./slices/createSpacesSlice"

export const useSpacesStore = useRootStore
