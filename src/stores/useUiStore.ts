/**
 * UI Store
 * Backed by unified RootStore UI slice
 */

import type { UiSlice } from "./slices/createUiSlice"
import { useRootStore, type RootStoreState } from "./useRootStore"

export * from "./slices/createUiSlice"

export const useUiStore = Object.assign(
  <T = UiSlice>(selector?: (state: UiSlice) => T) =>
    useRootStore((s) => (selector ? selector(s) : (s as unknown as T))),
  {
    getState: () => useRootStore.getState() as UiSlice,
    setState: (partial: Partial<RootStoreState> | ((state: RootStoreState) => Partial<RootStoreState>)) =>
      useRootStore.setState(partial),
    subscribe: useRootStore.subscribe,
  },
)
