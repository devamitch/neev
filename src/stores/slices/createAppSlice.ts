/**
 * App Preferences & Global State Slice
 */


export type ThemePreference = "system" | "light" | "dark"

export interface GameSessionSummary {
  id: string
  gameId: "orb-pop" | "slider-chase" | "orbit-follow" | "direction-trail"
  inputMode: "touch"
  score: number
  hits: number
  misses: number
  durationSeconds: number
  completedAt: string
}

export interface AppSlice {
  themePreference: ThemePreference
  theme: "light" | "dark"
  hasCompletedOnboarding: boolean
  notificationsEnabled: boolean
  intentionNudgesEnabled: boolean
  pujaTimersEnabled: boolean
  gameHistory: GameSessionSummary[]
  setThemePreference: (pref: ThemePreference) => void
  setTheme: (theme: "light" | "dark") => void
  setHasCompletedOnboarding: (completed: boolean) => void
  setNotificationsEnabled: (enabled: boolean) => void
  setIntentionNudgesEnabled: (enabled: boolean) => void
  setPujaTimersEnabled: (enabled: boolean) => void
  recordGameResult: (result: GameSessionSummary) => void
  resetPreferences: () => void
}

import type { ImmerStateCreator } from "../types"

export const createAppSlice: ImmerStateCreator<AppSlice> = (set) => ({
  themePreference: "system",
  theme: "light",
  hasCompletedOnboarding: false,
  notificationsEnabled: true,
  intentionNudgesEnabled: true,
  pujaTimersEnabled: true,
  gameHistory: [],

  setThemePreference: (themePreference) =>
    set((state) => {
      state.themePreference = themePreference
    }),
  setTheme: (theme) =>
    set((state) => {
      state.theme = theme
    }),
  setHasCompletedOnboarding: (hasCompletedOnboarding) =>
    set((state) => {
      state.hasCompletedOnboarding = hasCompletedOnboarding
    }),
  setNotificationsEnabled: (enabled) =>
    set((state) => {
      state.notificationsEnabled = enabled
    }),
  setIntentionNudgesEnabled: (enabled) =>
    set((state) => {
      state.intentionNudgesEnabled = enabled
    }),
  setPujaTimersEnabled: (enabled) =>
    set((state) => {
      state.pujaTimersEnabled = enabled
    }),

  recordGameResult: (result) =>
    set((state) => {
      state.gameHistory.unshift(result)
      if (state.gameHistory.length > 50) {
        state.gameHistory.pop()
      }
    }),

  resetPreferences: () =>
    set((state) => {
      state.themePreference = "system"
      state.theme = "light"
      state.hasCompletedOnboarding = false
      state.gameHistory = []
    }),
})
