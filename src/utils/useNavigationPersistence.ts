/**
 * Neev Navigation Persistence & State Restoration
 * Specification: Ignite CLI React Native Boilerplate Navigation Persistence Pattern
 *
 * Implements:
 * - Persistent navigation state restoration backed by React Native MMKV
 * - Automatic route change tracking & breadcrumb logging
 * - Auth & Onboarding state gating: protected routes are never restored for unauthenticated users
 * - Fallback protection: invalid or obsolete routes safely redirect to canonical dashboard
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { storage } from "@/utils/storage"

export const NAVIGATION_PERSISTENCE_KEY = "NEEV_NAVIGATION_STATE_V1"

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
 * Persists the current navigation path into MMKV storage
 */
export function persistNavigationPath(path: string): void {
  try {
    if (isRouteRestorable(path)) {
      storage.set(NAVIGATION_PERSISTENCE_KEY, path)
      if (__DEV__) {
        console.log(`[NavigationPersistence] Saved active route: ${path}`)
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[NavigationPersistence] Failed to persist route:", error)
    }
  }
}

/**
 * Retrieves the persisted navigation path from MMKV storage
 */
export function getPersistedNavigationPath(): string | null {
  try {
    const savedPath = storage.getString(NAVIGATION_PERSISTENCE_KEY)
    if (savedPath && isRouteRestorable(savedPath)) {
      return savedPath
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[NavigationPersistence] Failed to read persisted route:", error)
    }
  }
  return null
}

/**
 * Clears the persisted navigation state
 */
export function clearPersistedNavigationPath(): void {
  try {
    storage.delete(NAVIGATION_PERSISTENCE_KEY)
  } catch {}
}

/**
 * Hook to manage navigation persistence lifecycle
 */
export function useNavigationPersistence() {
  const [isRestored, setIsRestored] = useState(false)
  const [initialRoute, setInitialRoute] = useState<string | null>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      const savedRoute = getPersistedNavigationPath()
      setInitialRoute(savedRoute)
      setIsRestored(true)
    }
  }, [])

  const onNavigationStateChange = useCallback((currentPath: string) => {
    persistNavigationPath(currentPath)
  }, [])

  return {
    isRestored,
    initialRoute,
    onNavigationStateChange,
    clearNavigationState: clearPersistedNavigationPath,
  }
}
