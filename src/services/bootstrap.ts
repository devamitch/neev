/**
 * Neev Cold-Start Bootstrap Service:
 * Initializes local-first SQLite database and loads stored family data.
 */
import { create } from "zustand"
import { initDatabase } from "./db/database"

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
