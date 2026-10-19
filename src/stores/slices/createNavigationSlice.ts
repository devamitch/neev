/**
 * Neev Navigation Slice
 * Integrates full navigation state and history stack directly into the unified Zustand store
 * with automatic MMKV persistence, zero manual storage overhead, and Immer mutations.
 */

import type { ImmerStateCreator } from "../types"

export const MAX_NAVIGATION_HISTORY_ITEMS = 50

export interface NavigationHistoryEntry {
  path: string
  segments: string[]
  params?: Record<string, string | number | boolean>
  timestamp: string
}

// Whitelist of valid app routes eligible for state restoration
export const VALID_RESTORABLE_PREFIXES = [
  "/(app)",
  "/(app)/(tabs)",
  "/(app)/(tabs)/dashboard",
  "/(app)/(tabs)/activities",
  "/(app)/(tabs)/family",
  "/(app)/(tabs)/discover",
  "/(app)/(tabs)/you",
  "/(app)/spaces",
  "/(app)/kinship-map",
  "/(app)/bridges",
  "/(app)/settings",
  "/(app)/household",
]

/**
 * Checks whether a given route path is valid and eligible for restoration
 */
export function isRouteRestorable(path: string | null | undefined): boolean {
  if (!path || typeof path !== "string") return false
  if (path.includes("(auth)") || path.includes("auth") || path.includes("onboarding")) {
    return false
  }
  return VALID_RESTORABLE_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export interface NavigationSlice {
  currentPath: string
  segments: string[]
  routeParams: Record<string, string | number | boolean>
  navigationHistory: NavigationHistoryEntry[]
  lastNavigatedAt: string

  recordNavigationTransition: (
    path: string,
    segments: string[],
    params?: Record<string, string | number | boolean>,
  ) => void
  clearNavigationHistory: () => void
  getRestorablePath: () => string | null
}

export const createNavigationSlice: ImmerStateCreator<NavigationSlice> = (set, get) => ({
  currentPath: "/(app)/(tabs)/dashboard",
  segments: ["(app)", "(tabs)", "dashboard"],
  routeParams: {},
  navigationHistory: [],
  lastNavigatedAt: new Date().toISOString(),

  recordNavigationTransition: (path, segments, params) => {
    if (!isRouteRestorable(path)) return

    set((state) => {
      const now = new Date().toISOString()
      const history = state.navigationHistory

      // Avoid sequential duplicate entries in history
      const last = history[history.length - 1]
      if (!last || last.path !== path) {
        history.push({
          path,
          segments,
          params,
          timestamp: now,
        })

        if (history.length > MAX_NAVIGATION_HISTORY_ITEMS) {
          history.shift()
        }
      }

      state.currentPath = path
      state.segments = segments
      state.routeParams = params || {}
      state.lastNavigatedAt = now
    })
  },

  clearNavigationHistory: () => {
    set((state) => {
      state.navigationHistory = []
      state.currentPath = "/(app)/(tabs)/dashboard"
      state.segments = ["(app)", "(tabs)", "dashboard"]
      state.routeParams = {}
      state.lastNavigatedAt = new Date().toISOString()
    })
  },

  getRestorablePath: () => {
    const current = get().currentPath
    return isRouteRestorable(current) ? current : null
  },
})
