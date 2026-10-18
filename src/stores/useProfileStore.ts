/**
 * Local profile and preferences.
 * Backed by unified RootStore Profile slice.
 */

import type { ProfileSlice } from "./slices/createProfileSlice"
import { useRootStore, type RootStoreState } from "./useRootStore"

export * from "./slices/createProfileSlice"
export type ProfileState = ProfileSlice

export const useProfileStore = Object.assign(
  <T = ProfileSlice>(selector?: (state: ProfileSlice) => T) =>
    useRootStore((s) => (selector ? selector(s) : (s as unknown as T))),
  {
    getState: () => useRootStore.getState() as ProfileSlice,
    setState: (
      partial: Partial<RootStoreState> | ((state: RootStoreState) => Partial<RootStoreState>),
    ) => useRootStore.setState(partial),
    subscribe: useRootStore.subscribe,
  },
)
