/**
 * Daily Family Routine Hook
 * Powered by unified RootStore slice
 */

import { useRootStore } from "./useRootStore"
export type { FamilyRoutineItem, RoutineSlice } from "./slices/createRoutineSlice"

export const useRoutineStore = useRootStore
