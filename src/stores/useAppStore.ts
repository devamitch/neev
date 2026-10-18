/**
 * App Preferences Store
 * Backed by unified RootStore App slice
 */

import type { AppSlice } from "./slices/createAppSlice"
import { useRootStore, type RootStoreState } from "./useRootStore"

export * from "./slices/createAppSlice"
export type AppState = AppSlice

export const useAppStore = Object.assign(
  <T = AppSlice>(selector?: (state: AppSlice) => T) =>
    useRootStore((s) => (selector ? selector(s) : (s as unknown as T))),
  {
    getState: () => useRootStore.getState() as AppSlice,
    setState: (
      partial: Partial<RootStoreState> | ((state: RootStoreState) => Partial<RootStoreState>),
    ) => useRootStore.setState(partial),
    subscribe: useRootStore.subscribe,
  },
)
