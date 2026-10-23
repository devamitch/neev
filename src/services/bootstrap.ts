/**
 * Neev Cold-Start Bootstrap Service:
 * Initializes the local SQLite database, removes sample records left by older builds,
 * and starts Firestore sync for the signed-in household.
 */
import { create } from "zustand"
import { initDatabase } from "./db/database"
import { purgeLegacyDemoData } from "@/stores/purgeLegacyDemoData"
import { initGoogleSync } from "./google/googleSyncService"
import { initCloudSync } from "./sync/cloudSyncEngine"

export const useBootstrapStore = create<{
  ready: boolean
  error: string | null
  dataVersion: number
}>(() => ({ ready: false, error: null, dataVersion: 0 }))

export const bumpDataVersion = () => {
  useBootstrapStore.setState((s) => ({ dataVersion: s.dataVersion + 1 }))
}

let started: Promise<void> | null = null

export function bootstrapLocalData(): Promise<void> {
  if (started) return started
  started = (async () => {
    try {
      await initDatabase()
      purgeLegacyDemoData()
      initCloudSync()
      initGoogleSync()
      useBootstrapStore.setState({ ready: true })
      bumpDataVersion()
    } catch (error) {
      useBootstrapStore.setState({
        ready: true,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })()
  return started
}
