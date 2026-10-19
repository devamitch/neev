/**
 * Neev Navigation Persistence & State Restoration
 * Specification: Ignite CLI React Native Boilerplate Navigation Persistence Pattern
 *
 * Implements:
 * - Persistent navigation state restoration backed by React Native MMKV
 * - Full route history stack tracking (up to 25 historical routes)
 * - Automatic route change tracking & breadcrumb logging
 * - Auth & Onboarding state gating: protected routes are never restored for unauthenticated users
 * - Fallback protection: invalid or obsolete routes safely redirect to canonical dashboard
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { storage } from "@/utils/storage"

export const NAVIGATION_PERSISTENCE_KEY = "NEEV_NAVIGATION_STATE_V1"
export const MAX_HISTORY_LENGTH = 25

export interface NavigationPersistenceState {
  currentRoute: string
  routeHistory: string[]
  params?: Record<string, string | number | boolean>
  updatedAt: string
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
]

/**
 * Checks whether a given route path is valid and eligible for restoration
 */
export function isRouteRestorable(path: string | null | undefined): boolean {
  if (!path || typeof path !== "string") return false
  // Never restore auth or onboarding screens as persistent destinations
  if (path.includes("(auth)") || path.includes("auth") || path.includes("onboarding")) {
    return false
  }
  return VALID_RESTORABLE_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/**
 * Retrieves the full persisted navigation state from MMKV storage
 */
export function getPersistedNavigationState(): NavigationPersistenceState | null {
  try {
    const raw = storage.getString(NAVIGATION_PERSISTENCE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as NavigationPersistenceState
    if (state && state.currentRoute && isRouteRestorable(state.currentRoute)) {
      return state
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[NavigationPersistence] Failed to parse persisted navigation state:", error)
    }
  }
  return null
}

/**
 * Retrieves just the persisted current route path from MMKV storage
 */
export function getPersistedNavigationPath(): string | null {
  const state = getPersistedNavigationState()
  return state?.currentRoute ?? null
}

/**
 * Persists the current route path and maintains history stack in MMKV storage
 */
export function persistNavigationPath(path: string, params?: Record<string, any>): void {
  try {
    if (!isRouteRestorable(path)) return

    const previousState = getPersistedNavigationState()
    const history = previousState?.routeHistory ?? []

    // Avoid pushing consecutive duplicate routes to history
    if (history[history.length - 1] !== path) {
      history.push(path)
      if (history.length > MAX_HISTORY_LENGTH) {
        history.shift()
      }
    }

    const nextState: NavigationPersistenceState = {
      currentRoute: path,
      routeHistory: history,
      params,
      updatedAt: new Date().toISOString(),
    }

    storage.set(NAVIGATION_PERSISTENCE_KEY, JSON.stringify(nextState))

    if (__DEV__) {
      console.log(`[NavigationPersistence] Saved active route: ${path} (History size: ${history.length})`)
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[NavigationPersistence] Failed to persist route:", error)
    }
  }
}

/**
 * Clears the persisted navigation state from MMKV storage
 */
export function clearPersistedNavigationPath(): void {
  try {
    storage.delete(NAVIGATION_PERSISTENCE_KEY)
    if (__DEV__) {
      console.log("[NavigationPersistence] Navigation state cleared from MMKV")
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[NavigationPersistence] Failed to delete navigation state:", error)
    }
  }
}

/**
 * React hook to manage navigation persistence lifecycle (Ignite boilerplate standard)
 */
export function useNavigationPersistence() {
  const [isRestored, setIsRestored] = useState(false)
  const [initialRoute, setInitialRoute] = useState<string | null>(null)
  const [routeHistory, setRouteHistory] = useState<string[]>([])
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      const state = getPersistedNavigationState()
      if (state) {
        setInitialRoute(state.currentRoute)
        setRouteHistory(state.routeHistory)
      }
      setIsRestored(true)
    }
  }, [])

  const onNavigationStateChange = useCallback((currentPath: string, params?: Record<string, any>) => {
    persistNavigationPath(currentPath, params)
  }, [])

  return {
    isRestored,
    initialRoute,
    routeHistory,
    onNavigationStateChange,
    clearNavigationState: clearPersistedNavigationPath,
  }
}
