import { Platform } from "react-native"
import { CONFIG } from "@/constants/config"
import { storage } from "@/utils/storage"

export interface CrashReport {
  id: string
  timestamp: number
  message: string
  stack?: string
  componentStack?: string
  appVersion: string
  os: string
  isFatal?: boolean
}

const CRASH_STORAGE_KEY = "blinkquest.crash_reports.v1"
const MAX_SAVED_CRASHES = 10

class CrashReporter {
  private initialized = false

  public init(): void {
    if (this.initialized) return
    this.initialized = true

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crashlyticsModule = require("@react-native-firebase/crashlytics")
      const crashlytics = crashlyticsModule?.default ?? crashlyticsModule
      if (typeof crashlytics === "function") {
        const instance = crashlytics()
        void instance.setCrashlyticsCollectionEnabled(true).catch?.(() => undefined)
        void instance.sendUnsentReports().catch?.(() => undefined)
      }
    } catch {
      // Firebase Crashlytics not available in local dev or without google-services.json
    }

    this.registerGlobalErrorHandlers()
  }

  private registerGlobalErrorHandlers(): void {
    const targetObj = globalThis as unknown as {
      ErrorUtils?: {
        getGlobalHandler: () => (error: Error, isFatal?: boolean) => void
        setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void
      }
      onunhandledrejection?: (event: { reason: unknown }) => void
    }

    const originalHandler = targetObj.ErrorUtils?.getGlobalHandler()

    targetObj.ErrorUtils?.setGlobalHandler((error: Error, isFatal?: boolean) => {
      this.recordCrash(error, { isFatal })
      if (originalHandler) {
        originalHandler(error, isFatal)
      }
    })

    const prevRejectionHandler = targetObj.onunhandledrejection
    targetObj.onunhandledrejection = (event: { reason: unknown }) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      this.recordCrash(error, { unhandledPromise: true })
      if (prevRejectionHandler) {
        prevRejectionHandler(event)
      }
    }
  }

  public recordCrash(error: Error, extra?: Record<string, unknown>): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crashlyticsModule = require("@react-native-firebase/crashlytics")
      const crashlytics = crashlyticsModule?.default ?? crashlyticsModule
      if (typeof crashlytics === "function") {
        const instance = crashlytics()
        if (extra) {
          for (const [key, value] of Object.entries(extra)) {
            if (value !== undefined && value !== null) {
              void instance.setAttribute(key, String(value)).catch?.(() => undefined)
            }
          }
        }
        void instance.recordError(error).catch?.(() => undefined)
      }
    } catch {
      // Firebase Crashlytics not available or google-services.json missing
    }

    // Keep a local circular buffer of crashes in MMKV for diagnostics
    try {
      const report: CrashReport = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        message: error.message || "Unknown error",
        stack: error.stack,
        componentStack: (extra?.componentStack as string) || undefined,
        appVersion: CONFIG.VERSION,
        os: `${Platform.OS} ${Platform.Version}`,
        isFatal: Boolean(extra?.isFatal),
      }

      const existingReports = this.getCrashReports()
      const updated = [report, ...existingReports].slice(0, MAX_SAVED_CRASHES)
      storage.set(CRASH_STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // Safeguard against storage issues
    }
  }

  public captureException(error: Error, extra?: Record<string, unknown>): void {
    this.recordCrash(error, extra)
  }

  public log(message: string): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crashlyticsModule = require("@react-native-firebase/crashlytics")
      const crashlytics = crashlyticsModule?.default ?? crashlyticsModule
      if (typeof crashlytics === "function") {
        crashlytics().log(message)
      }
    } catch {
      // Ignore
    }
  }

  public captureMessage(message: string): void {
    this.log(message)
  }

  public getCrashReports(): CrashReport[] {
    try {
      const raw = storage.getString(CRASH_STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw) as CrashReport[]
    } catch {
      return []
    }
  }

  public getLastCrash(): CrashReport | null {
    const list = this.getCrashReports()
    return list.length > 0 ? list[0] : null
  }

  public clearCrashHistory(): void {
    try {
      storage.delete(CRASH_STORAGE_KEY)
    } catch {
      // Ignore
    }
  }
}

export const crashReporter = new CrashReporter()
export default crashReporter
