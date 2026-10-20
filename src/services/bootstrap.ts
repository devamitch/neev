/**
 * Neev Cold-Start Bootstrap Service:
 * Initializes local-first SQLite database and loads stored family data.
 */
import { create } from "zustand"
import { initDatabase } from "./db/database"
import { useRootStore } from "@/stores/useRootStore"

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
      const root = useRootStore.getState()
      if (root.isAuthenticated) {
        if (root.tasks.length === 0) root.loadDemoSpaces?.()
        if (root.functions.length === 0) root.loadDemoSchedule?.()
        if (root.routines.length === 0) root.loadDemoRoutine?.()
        if (root.entries.length === 0) root.loadDemoKnowledge?.()
        if (root.members.length === 0) root.loadDemoFamily?.()
      }
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
