/**
 * Family Sanctuary Store Hook
 * Powered by unified RootStore slice
 */

import { useRootStore } from "./useRootStore"
export type { FamilyRole, FamilyMember, HouseholdInfo, FamilySlice } from "./slices/createFamilySlice"

export const useFamilyStore = useRootStore
