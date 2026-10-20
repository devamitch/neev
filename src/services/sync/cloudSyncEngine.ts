/**
 * Neev Cloud Sync Engine
 * Manages bidirectional synchronization between local Zustand/SQLite and Firebase Firestore,
 * network connectivity listeners, and multi-user conflict resolution.
 */

import { create } from "zustand"
import { supabaseSyncService, type HealthTelemetry } from "@/services/supabase/supabaseSyncService"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useScheduleStore } from "@/stores/useScheduleStore"
import { useKnowledgeStore } from "@/stores/useKnowledgeStore"
import { useRoutineStore } from "@/stores/useRoutineStore"
import { useIntentionsStore } from "@/stores/useIntentionsStore"
import { useRootStore } from "@/stores/useRootStore"
import { googleServicesClient } from "@/services/google/googleServicesClient"

export type SyncStatus = "connected" | "syncing" | "idle" | "offline" | "error"

interface CloudSyncState {
  status: SyncStatus
  lastSyncedAt: string | null
  healthMetrics: HealthTelemetry[]
  autoSyncEnabled: boolean
  isGoogleConnected: boolean
  syncAll: () => Promise<{ ok: boolean; error?: string }>
  loadHealthTelemetry: () => Promise<void>
  setAutoSync: (enabled: boolean) => void
}

export const DEMO_HEALTH_METRICS: HealthTelemetry[] = [
  {
    memberId: "m-1",
    memberName: "Shyamal (Dadu)",
    date: new Date().toISOString().split("T")[0],
    dailySteps: 4200,
    activeMinutes: 38,
    sleepHours: 7.4,
    restingHeartRate: 72,
    source: "google_fit",
    lastUpdated: "Just now",
  },
  {
    memberId: "m-2",
    memberName: "Aparna (Dida)",
    date: new Date().toISOString().split("T")[0],
    dailySteps: 3800,
    activeMinutes: 32,
    sleepHours: 7.1,
    restingHeartRate: 74,
    source: "google_fit",
    lastUpdated: "Just now",
  },
  {
    memberId: "m-5",
    memberName: "Aarav (Chotu)",
    date: new Date().toISOString().split("T")[0],
    dailySteps: 10400,
    activeMinutes: 94,
    sleepHours: 8.5,
    restingHeartRate: 68,
    source: "google_fit",
    lastUpdated: "Just now",
  },
]

export const useCloudSyncStore = create<CloudSyncState>((set, get) => ({
  status: "idle",
  lastSyncedAt: null,
  healthMetrics: [],
  autoSyncEnabled: true,
  isGoogleConnected: false,

  syncAll: async () => {
    set({ status: "syncing" })
    try {
      const household = useFamilyStore.getState().household
      const members = useFamilyStore.getState().members
      const functions = useScheduleStore.getState().functions
      const intentions = useIntentionsStore.getState().intentions
      const entries = useKnowledgeStore.getState().entries
      const routines = useRoutineStore.getState().routines

      const householdId = "household_primary_01"

      // 1. Save household metadata
      await supabaseSyncService.saveHousehold({
        id: householdId,
        name: household.name,
        motto: household.motto,
        city: household.city,
        establishedYear: household.establishedYear,
        adminUserId: "usr_amit_01",
        inviteCode: "NEEV-7829-SANC",
        membersCount: members.length,
      })

      // 2. Batch push members
      for (const m of members) {
        await supabaseSyncService.syncMember(householdId, m)
      }

      // 3. Batch push functions
      for (const f of functions) {
        await supabaseSyncService.syncFunction(householdId, f)
      }

      // 4. Batch push intentions
      for (const i of intentions) {
        await supabaseSyncService.syncIntention(householdId, i)
      }

      // 5. Batch push knowledge
      for (const k of entries) {
        await supabaseSyncService.syncKnowledge(householdId, k)
      }

      // 6. Batch push routines
      for (const r of routines) {
        await supabaseSyncService.syncRoutine(householdId, r)
      }

      // 7. Batch push priority space tasks / chores
      const tasks = useRootStore.getState().tasks
      for (const t of tasks) {
        await supabaseSyncService.syncTask(householdId, t)
      }

      set({
        status: "connected",
        lastSyncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      })
      return { ok: true }
    } catch (err: any) {
      set({ status: "error" })
      return { ok: false, error: err?.message || "Sync connection interrupted" }
    }
  },

  loadHealthTelemetry: async () => {
    const members = useFamilyStore.getState().members
    const telemetryList: HealthTelemetry[] = []

    for (const m of members.filter((mem) => mem.role !== "pet")) {
      const data = await googleServicesClient.fetchHealthTelemetry(m.id, m.name)
      if (data) telemetryList.push(data)
    }

    set({ healthMetrics: telemetryList })
  },

  setAutoSync: (enabled) => set({ autoSyncEnabled: enabled }),
}))
