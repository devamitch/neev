/**
 * Neev Family Intentions & Pet Projects Store
 * Backed by unified RootStore Intentions slice with MMKV persistence
 */

import { useRootStore } from "./useRootStore"
import type { IntentionsSlice } from "./slices/createIntentionsSlice"

export * from "./slices/createIntentionsSlice"
export type IntentionsState = IntentionsSlice

export const useIntentionsStore = Object.assign(
  <T = IntentionsSlice>(selector?: (state: IntentionsSlice) => T) =>
    useRootStore(selector ? (state) => selector(state as IntentionsSlice) : (state) => state as unknown as T),
  {
    getState: () => useRootStore.getState() as IntentionsSlice,
  },
)
