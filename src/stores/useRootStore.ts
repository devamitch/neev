/**
 * Neev Unified Root Store
 * Consolidates all application slices into a single unified Zustand store
 * with centralized MMKV persistence, slice-based modularity, and Immer mutations.
 */

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

import { storage } from "../utils/storage"
import { createAppSlice } from "./slices/createAppSlice"
import { createAuthSlice } from "./slices/createAuthSlice"
import { createIntentionsSlice } from "./slices/createIntentionsSlice"
import { createProfileSlice } from "./slices/createProfileSlice"
import { createUiSlice } from "./slices/createUiSlice"
import { createFamilySlice } from "./slices/createFamilySlice"
import { createScheduleSlice } from "./slices/createScheduleSlice"
import { createKnowledgeSlice } from "./slices/createKnowledgeSlice"
import { createRoutineSlice } from "./slices/createRoutineSlice"
import { createSpacesSlice } from "./slices/createSpacesSlice"

import type { RootStoreState } from "./types"
export { useShallow } from "zustand/react/shallow"
export type { RootStoreState }

const rootMMKVStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
}

export const useRootStore = create<RootStoreState>()(
  persist(
    immer<RootStoreState, [["zustand/persist", unknown]]>((...a) => ({
      ...createAppSlice(...a),
      ...createIntentionsSlice(...a),
      ...createUiSlice(...a),
      ...createProfileSlice(...a),
      ...createAuthSlice(...a),
      ...createFamilySlice(...a),
      ...createScheduleSlice(...a),
      ...createKnowledgeSlice(...a),
      ...createRoutineSlice(...a),
      ...createSpacesSlice(...a),
    })),
    {
      name: "neev_root_v2",
      storage: createJSONStorage(() => rootMMKVStorage),
      partialize: (state) => ({
        // App Preferences
        themePreference: state.themePreference,
        theme: state.theme,
        hasCompletedOnboarding: state.hasCompletedOnboarding,

        // Sacred Spaces & Tasks
        currentSpace: state.currentSpace,
        tasks: state.tasks,
        meetings: state.meetings,
        aiBriefings: state.aiBriefings,

        // Family Sanctuary & Household
        household: state.household,
        members: state.members,
        activeMemberId: state.activeMemberId,

        // Functions & Invitations
        functions: state.functions,

        // Knowledge Archive
        entries: state.entries,
        selectedCategory: state.selectedCategory,

        // Daily Rhythms
        routines: state.routines,

        // Family Intentions & Pet Projects
        intentions: state.intentions,
        activeCategory: state.activeCategory,

        // Profile & Auth
        profileId: state.profileId,
        displayName: state.displayName,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        pendingSsoState: state.pendingSsoState,
      }),
    },
  ),
)
