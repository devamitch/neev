/**
 * Eye Health Store
 * Backed by unified RootStore EyeHealth slice
 */

import type { EyeHealthSlice } from "./slices/createEyeHealthSlice"
import { useRootStore, type RootStoreState } from "./useRootStore"

export * from "./slices/createEyeHealthSlice"
export type EyeHealthState = EyeHealthSlice

export const useEyeHealthStore = Object.assign(
  <T = EyeHealthSlice>(selector?: (state: EyeHealthSlice) => T) =>
    useRootStore((s) => (selector ? selector(s) : (s as unknown as T))),
  {
    getState: () => useRootStore.getState() as EyeHealthSlice,
    setState: (
      partial: Partial<RootStoreState> | ((state: RootStoreState) => Partial<RootStoreState>),
    ) => useRootStore.setState(partial),
    subscribe: useRootStore.subscribe,
  },
)
