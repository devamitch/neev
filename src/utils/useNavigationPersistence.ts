/**
 * Neev Navigation Persistence & State Restoration
 * Powered by Zustand Slice Architecture (`createNavigationSlice`) with synchronous MMKV persistence.
 *
 * Consolidates all navigation persistence into useRootStore:
 * - Eliminates bespoke storage parsing and duplicate keys
 * - Keeps navigation history synchronized with app state in real-time
 * - Restores routes safely with auth & onboarding gating
 */

import { useRootStore, useShallow } from "@/stores/useRootStore"
import {
  isRouteRestorable,
  type NavigationHistoryEntry,
  VALID_RESTORABLE_PREFIXES,
} from "@/stores/slices/createNavigationSlice"

export { isRouteRestorable, VALID_RESTORABLE_PREFIXES }
export type { NavigationHistoryEntry }

/**
 * Persists an active navigation transition via Zustand slice (MMKV backed)
 */
export function recordNavigationTransition(
  path: string,
  segments: string[] = [],
  params?: Record<string, any>,
): void {
  useRootStore.getState().recordNavigationTransition(path, segments, params)
}

/**
 * Retrieves the persisted active navigation path from Zustand store
 */
export function getPersistedNavigationPath(): string | null {
  return useRootStore.getState().getRestorablePath()
}

/**
 * Clears navigation history and resets state in Zustand store
 */
export function clearCompleteNavigationData(): void {
  useRootStore.getState().clearNavigationHistory()
}

/**
 * Retrieves the recorded navigation history stack from Zustand store
 */
export function loadNavigationHistory(): NavigationHistoryEntry[] {
  return useRootStore.getState().navigationHistory
}

// Backwards-compatible aliases
export const persistNavigationPath = recordNavigationTransition
export const clearPersistedNavigationPath = clearCompleteNavigationData

/**
 * React hook to observe and interact with navigation persistence in components
 */
export function useNavigationPersistence() {
  const { currentPath, navigationHistory, recordNavigationTransition, clearNavigationHistory } =
    useRootStore(
      useShallow((s) => ({
        currentPath: s.currentPath,
        navigationHistory: s.navigationHistory,
        recordNavigationTransition: s.recordNavigationTransition,
        clearNavigationHistory: s.clearNavigationHistory,
      })),
    )

  return {
    isRestored: true,
    currentPath,
    history: navigationHistory,
    onNavigationStateChange: recordNavigationTransition,
    clearNavigation: clearNavigationHistory,
  }
}
