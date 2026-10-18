/**
 * Family Sanctuary Health Slice:
 * Manages notification preferences and health status for the household.
 */
import type { StateCreator } from "zustand"
import type { RootStoreState } from "../types"

export interface EyeHealthSlice {
  sessionHistory: any[]
  autoSaveHistory: boolean
  notificationsEnabled: boolean
  overlayMode: string
  setNotificationsEnabled: (enabled: boolean) => void
  setAutoSaveHistory: (enabled: boolean) => void
  addSession: (session: any) => void
  clearHistory: () => void
}

export const createEyeHealthSlice: StateCreator<
  RootStoreState,
  [["zustand/immer", never]],
  [],
  EyeHealthSlice
> = (set) => ({
  sessionHistory: [],
  autoSaveHistory: true,
  notificationsEnabled: true,
  overlayMode: "subtle",

  setNotificationsEnabled: (enabled) =>
    set((state) => {
      state.notificationsEnabled = enabled
    }),

  setAutoSaveHistory: (enabled) =>
    set((state) => {
      state.autoSaveHistory = enabled
    }),

  addSession: (session) =>
    set((state) => {
      state.sessionHistory.unshift(session)
    }),

  clearHistory: () =>
    set((state) => {
      state.sessionHistory = []
    }),
})
