/**
 * Family Schedule & Functions Hook
 * Powered by unified RootStore slice
 */

import { useRootStore } from "./useRootStore"
export type { FunctionCategory, FunctionTask, FamilyFunction, ScheduleSlice } from "./slices/createScheduleSlice"

export const useScheduleStore = useRootStore
