/**
 * BlinkQuest Unified Root Store
 * Consolidates all application slices into a single unified Zustand store
 * with centralized MMKV persistence, slice-based modularity, and Immer mutations.
 */

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

import { storage } from "../utils/storage"
import { createAppSlice, type AppSlice } from "./slices/createAppSlice"
import { createAuthSlice, type AuthSlice } from "./slices/createAuthSlice"
import { createEyeHealthSlice, type EyeHealthSlice } from "./slices/createEyeHealthSlice"
import { createProfileSlice, type ProfileSlice } from "./slices/createProfileSlice"
import { createUiSlice, type UiSlice } from "./slices/createUiSlice"

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
      ...createEyeHealthSlice(...a),
      ...createUiSlice(...a),
      ...createProfileSlice(...a),
      ...createAuthSlice(...a),
    })),
    {
      name: "neev_root_v1",
      storage: createJSONStorage(() => rootMMKVStorage),
      partialize: (state) => ({
        // App Preferences
        themePreference: state.themePreference,
        theme: state.theme,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        gameHistory: state.gameHistory,

        // Eye Health
        sessionHistory: state.sessionHistory,
        autoSaveHistory: state.autoSaveHistory,
        notificationsEnabled: state.notificationsEnabled,
        overlayMode: state.overlayMode,

        // Profile & Routine
        profileId: state.profileId,
        displayName: state.displayName,
        homeSections: state.homeSections,
        favorites: state.favorites,
        routine: state.routine,

        // Auth
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Survives Android killing BlinkQuest while Setu asks for approval.
        pendingSsoState: state.pendingSsoState,
      }),
    },
  ),
)
