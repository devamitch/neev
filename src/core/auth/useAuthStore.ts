/**
 * Authentication Store for BlinkQuest.
 * Backed by unified RootStore Auth slice.
 */

import type { AuthSlice } from "@/stores/slices/createAuthSlice"
import { useRootStore, type RootStoreState } from "@/stores/useRootStore"

export * from "@/stores/slices/createAuthSlice"
export type AuthState = AuthSlice

export const GOOGLE_WEB_CLIENT_ID =
  "955342531861-d0dscnslcjibu8ndu37ad40cglqvihe3.apps.googleusercontent.com"

export const useAuthStore = Object.assign(
  <T = AuthSlice>(selector?: (state: AuthSlice) => T) =>
    useRootStore((s) => (selector ? selector(s) : (s as unknown as T))),
  {
    getState: () => useRootStore.getState() as AuthSlice,
    setState: (
      partial: Partial<RootStoreState> | ((state: RootStoreState) => Partial<RootStoreState>),
    ) => useRootStore.setState(partial),
    subscribe: useRootStore.subscribe,
  },
)
