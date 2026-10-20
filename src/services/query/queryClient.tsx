/**
 * Neev TanStack Query + React Native MMKV Offline Persistence Configuration
 * Specification: Neev_Complete_Supabase_First_Master_Implementation.md
 *
 * Implements:
 * - QueryClient with offlineFirst network mode and 24-hour cache retention
 * - MMKV sync storage persister via @tanstack/query-sync-storage-persister
 * - PersistQueryClientProvider from @tanstack/react-query-persist-client
 * - React Native AppState focusManager subscription
 * - Network onlineManager checking connectivity and reachability
 */

import React, { PropsWithChildren, useEffect } from "react"
import { AppState, type AppStateStatus, Platform } from "react-native"
import {
  QueryClient,
  focusManager,
  onlineManager,
} from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { storage } from "@/utils/storage"

// 24 hours offline cache retention in MMKV
export const CACHE_GC_TIME = 1000 * 60 * 60 * 24
// 5 minutes default freshness
export const DEFAULT_STALE_TIME = 1000 * 60 * 5

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: CACHE_GC_TIME,
      staleTime: DEFAULT_STALE_TIME,
      networkMode: "offlineFirst",
      retry: (failureCount, error: any) => {
        // Do not retry 401 or 403 authorization failures
        if (error?.status === 401 || error?.status === 403) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: Platform.OS === "web",
      refetchOnReconnect: true,
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: 1,
    },
  },
})

// MMKV synchronous storage persister adapter
const clientStorage = {
  setItem: (key: string, value: string) => {
    try {
      storage.set(key, value)
    } catch (e) {
      console.warn("[QueryPersist] Failed to write query cache to MMKV:", e)
    }
  },
  getItem: (key: string) => {
    try {
      const val = storage.getString(key)
      return val === undefined ? null : val
    } catch (e) {
      console.warn("[QueryPersist] Failed to read query cache from MMKV:", e)
      return null
    }
  },
  removeItem: (key: string) => {
    try {
      storage.delete(key)
    } catch (e) {
      console.warn("[QueryPersist] Failed to delete query cache key from MMKV:", e)
    }
  },
}

export const mmkvPersister = createSyncStoragePersister({
  storage: clientStorage,
  key: "NEEV_OFFLINE_REACT_QUERY_CACHE",
  throttleTime: 1000,
})

/**
 * Configure onlineManager and focusManager for React Native
 */
export function setupReactQueryNativeManagers() {
  // 1. AppState listener for focusManager
  if (Platform.OS !== "web") {
    focusManager.setEventListener((handleFocus) => {
      const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
        handleFocus(status === "active")
      })
      return () => subscription.remove()
    })
  }

  // 2. Network connectivity check for onlineManager
  if (Platform.OS === "web" && typeof window !== "undefined") {
    onlineManager.setEventListener((setOnline) => {
      const handleOnline = () => setOnline(true)
      const handleOffline = () => setOnline(false)
      window.addEventListener("online", handleOnline)
      window.addEventListener("offline", handleOffline)
      return () => {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
      }
    })
  } else {
    // React Native mobile connectivity & reachability verification
    onlineManager.setEventListener((setOnline) => {
      let isOnline = true
      const interval = setInterval(async () => {
        try {
          const res = await fetch("https://kwrdugillyakxgvgbrsu.supabase.co/rest/v1/", {
            method: "HEAD",
            headers: { apikey: "anon" },
          }).catch(() => null)
          const onlineNow = res !== null
          if (onlineNow !== isOnline) {
            isOnline = onlineNow
            setOnline(onlineNow)
          }
        } catch {
          if (isOnline) {
            isOnline = false
            setOnline(false)
          }
        }
      }, 30000)

      return () => clearInterval(interval)
    })
  }
}

// Initialize managers on module load
setupReactQueryNativeManagers()

/**
 * Query keys enumeration for type-safe invalidation and caching
 */
export const QueryKeys = {
  familyRealms: (userId: string) => ["family_realms", userId] as const,
  kinshipGraph: (realmId: string) => ["kinship_graph", realmId] as const,
  familyClusters: (realmId: string) => ["family_clusters", realmId] as const,
  familyBridges: (realmId: string) => ["family_bridges", realmId] as const,
  familyInvitations: (realmId: string) => ["family_invitations", realmId] as const,
  householdMembers: (householdId: string) => ["household_members", householdId] as const,
  familyFunctions: (householdId: string) => ["family_functions", householdId] as const,
  familyIntentions: (householdId: string) => ["family_intentions", householdId] as const,
  knowledgeEntries: (householdId: string) => ["knowledge_entries", householdId] as const,
  familyRoutines: (householdId: string) => ["family_routines", householdId] as const,
}

/**
 * PersistQueryClientProvider wrapping with MMKV persister
 */
export function QueryProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    setupReactQueryNativeManagers()
  }, [])

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: mmkvPersister,
        maxAge: CACHE_GC_TIME,
        buster: "neev_rn_cache_v3",
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
