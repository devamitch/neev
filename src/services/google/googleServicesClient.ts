/**
 * Google services used by Neev, all through the signed-in user's own Google account
 * with incremental authorization (see GOOGLE_FEATURE_SCOPES):
 * 1. Google Calendar — add a family function as a real event, and import upcoming events.
 * 2. Google Tasks — add a delegated chore to the user's task list.
 * 3. Google Meet — a real Meet link, created on a Calendar event (conferenceData).
 * 4. Google Drive — back up the household's records as a file only Neev can see (drive.file).
 * Health data is not read: Google Fit's APIs are being shut down and Health Connect
 * needs an on-device integration Neev doesn't ship, so nothing is invented instead.
 */

import { Platform } from "react-native"

import {
  getGoogleAccessToken,
  GOOGLE_FEATURE_SCOPES,
  invalidateGoogleAccessToken,
  type GoogleAccessResult,
  type GoogleFeatureScope,
} from "@/services/auth/googleSignIn"
import type { HealthTelemetry } from "@/services/firebase/firebaseClient"
import type { FamilyFunction, FunctionCategory } from "@/stores/useScheduleStore"

/**
 * A fresh access token carrying `requiredScopes`. On Android/iOS this asks Google Sign-In
 * (which refreshes expired tokens and prompts once for scopes not yet granted). The token
 * stored at sign-in only carries profile/email and expires after an hour, so it is used
 * solely on web, where the Firebase popup is the only source.
 */
async function resolveAccessToken(requiredScopes: GoogleFeatureScope[]): Promise<{ token: string } | { reason: string }> {
  if (Platform.OS === "web") {
    try {
      const { useRootStore } = require("@/stores/useRootStore")
      const stored = useRootStore.getState()?.user?.googleAccessToken
      if (stored) return { token: stored }
    } catch {
      /* store not available */
    }
    return { reason: "not_signed_in" }
  }
  const access = await getGoogleAccessToken(requiredScopes)
  if (access.status === "granted") return { token: access.accessToken }
  return { reason: access.status }
}

/** Authorized request; on 401 drops the cached token and retries once with a fresh one. */
async function googleRequest(
  scopes: GoogleFeatureScope[],
  url: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string>; rawBody?: string } = {},
): Promise<{ ok: true; res: Response } | { ok: false; reason: GoogleSyncFailure }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const resolved = await resolveAccessToken(scopes)
    if ("reason" in resolved) return { ok: false, reason: resolved.reason as GoogleSyncFailure }
    try {
      const res = await fetch(url, {
        method: init.method ?? (init.body !== undefined || init.rawBody !== undefined ? "POST" : "GET"),
        headers: {
          Authorization: `Bearer ${resolved.token}`,
          ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
        body: init.rawBody ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      })
      if (res.status === 401 && attempt === 0) {
        await invalidateGoogleAccessToken(resolved.token)
        continue
      }
      if (!res.ok) {
        console.warn("[GoogleServices]", res.status, url.split("?")[0], await res.text().catch(() => ""))
        return { ok: false, reason: "request_failed" }
      }
      return { ok: true, res }
    } catch {
      return { ok: false, reason: "request_failed" }
    }
  }
  return { ok: false, reason: "request_failed" }
}

export interface GoogleServiceConnectionStatus {
  calendarConnected: boolean
  tasksConnected: boolean
  meetConnected: boolean
  healthConnected: boolean
  driveConnected: boolean
  lastSyncTimestamp: number | null
}

export type GoogleSyncFailure = Exclude<GoogleAccessResult["status"], "granted"> | "request_failed"

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

/** "06:30 PM" / "18:30" -> [18, 30]; null when unparseable. */
function parseClock(time: string | undefined): [number, number] | null {
  const m = time?.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/)
  if (!m) return null
  let h = Number(m[1]) % 24
  const min = Number(m[2])
  const ampm = m[3]?.toUpperCase()
  if (ampm === "PM" && h < 12) h += 12
  if (ampm === "AM" && h === 12) h = 0
  return [h, min]
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Local wall-clock start/end for a date + time; all-day when the time is unknown. */
function eventWindow(date: string, time?: string, durationMin = 120) {
  const clock = parseClock(time)
  if (!clock) {
    const next = new Date(`${date}T00:00:00`)
    next.setDate(next.getDate() + 1)
    const end = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
    return { start: { date }, end: { date: end } }
  }
  const startLocal = new Date(`${date}T${pad(clock[0])}:${pad(clock[1])}:00`)
  const endLocal = new Date(startLocal.getTime() + durationMin * 60_000)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  const timeZone = deviceTimeZone()
  return { start: { dateTime: fmt(startLocal), timeZone }, end: { dateTime: fmt(endLocal), timeZone } }
}

const newRequestId = () => `neev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export interface ImportedCalendarEvents {
  functions: FamilyFunction[]
  reason?: GoogleSyncFailure
}

const GCAL_PREFIX = "gcal_"

function guessCategory(title: string): FunctionCategory {
  const t = title.toLowerCase()
  if (/birthday|anniversary|wedding|party|celebrat/.test(t)) return "celebration"
  if (/puja|pooja|prayer|festival|diwali|eid|christmas|ritual/.test(t)) return "ritual"
  if (/trip|outing|picnic|movie|vacation|holiday/.test(t)) return "outing"
  if (/project|homework|school|exam/.test(t)) return "project"
  return "gathering"
}

function clockLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
}

export const googleServicesClient = {
  /** Adds the function to the user's primary Google Calendar. */
  async exportFunctionToCalendar(
    fn: FamilyFunction,
  ): Promise<{ success: boolean; eventId?: string; htmlLink?: string; reason?: GoogleSyncFailure }> {
    const result = await googleRequest(
      [GOOGLE_FEATURE_SCOPES.calendar],
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        body: {
          summary: fn.title,
          description: fn.description || undefined,
          location: fn.location || undefined,
          ...eventWindow(fn.date, fn.time, 180),
        },
      },
    )
    if (!result.ok) return { success: false, reason: result.reason }
    const event = (await result.res.json()) as { id: string; htmlLink?: string }
    return { success: true, eventId: event.id, htmlLink: event.htmlLink }
  },

  /** Upcoming events from the user's primary calendar, as Neev functions (ids prefixed `gcal_`). */
  async fetchUpcomingCalendarEvents(days = 30): Promise<ImportedCalendarEvents> {
    const now = new Date()
    const until = new Date(now.getTime() + days * 86_400_000)
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: until.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "100",
    })
    const result = await googleRequest(
      [GOOGLE_FEATURE_SCOPES.calendar],
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    )
    if (!result.ok) return { functions: [], reason: result.reason }
    const data = (await result.res.json()) as {
      items?: {
        id: string
        status?: string
        summary?: string
        description?: string
        location?: string
        start?: { date?: string; dateTime?: string }
      }[]
    }
    const functions = (data.items ?? [])
      .filter((e) => e.status !== "cancelled" && (e.start?.date || e.start?.dateTime))
      .map<FamilyFunction>((e) => {
        const start = e.start?.dateTime ? new Date(e.start.dateTime) : null
        const date = start
          ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
          : (e.start?.date as string)
        const title = e.summary?.trim() || "Untitled event"
        return {
          id: `${GCAL_PREFIX}${e.id}`,
          title,
          category: guessCategory(title),
          date,
          time: start ? clockLabel(start) : "All day",
          location: e.location ?? "",
          description: e.description ?? "",
          tasks: [],
          reminderSet: false,
        }
      })
    return { functions }
  },

  /** Adds a task to the user's default Google Tasks list. */
  async exportTaskToGoogleTasks(taskTitle: string, assigneeName: string, dueDate: string): Promise<boolean> {
    const result = await googleRequest(
      [GOOGLE_FEATURE_SCOPES.tasks],
      "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks",
      {
        body: {
          title: assigneeName ? `${taskTitle} (${assigneeName})` : taskTitle,
          // Google Tasks stores only the date part of `due`.
          due: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? `${dueDate}T00:00:00.000Z` : undefined,
        },
      },
    )
    return result.ok
  },

  /**
   * Creates a Calendar event with a Google Meet conference and returns its real join
   * link. Returns an empty url when Google access isn't available — never a made-up link.
   */
  async createGoogleMeetUrl(
    meetingTitle: string,
    scheduledTime: string,
  ): Promise<{ url: string; conferenceId: string; reason?: GoogleSyncFailure }> {
    const start = Number.isNaN(Date.parse(scheduledTime)) ? new Date() : new Date(scheduledTime)
    const end = new Date(start.getTime() + 60 * 60_000)
    const result = await googleRequest(
      [GOOGLE_FEATURE_SCOPES.calendar],
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
      {
        body: {
          summary: meetingTitle,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          conferenceData: {
            createRequest: {
              requestId: newRequestId(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        },
      },
    )
    if (!result.ok) return { url: "", conferenceId: "", reason: result.reason }
    const event = (await result.res.json()) as {
      hangoutLink?: string
      conferenceData?: { conferenceId?: string }
    }
    return { url: event.hangoutLink ?? "", conferenceId: event.conferenceData?.conferenceId ?? "" }
  },

  /**
   * Uploads a JSON backup of the household's records to the user's Google Drive.
   * drive.file only lets Neev see files it created, never the rest of the Drive.
   */
  async backupToDrive(
    fileName: string,
    payload: unknown,
  ): Promise<{ success: boolean; fileId?: string; webViewLink?: string; reason?: GoogleSyncFailure }> {
    const boundary = `neev-${Date.now().toString(36)}`
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: fileName, mimeType: "application/json" }) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      JSON.stringify(payload, null, 2) +
      `\r\n--${boundary}--`
    const result = await googleRequest(
      [GOOGLE_FEATURE_SCOPES.driveFile],
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      { rawBody: body, headers: { "Content-Type": `multipart/related; boundary=${boundary}` } },
    )
    if (!result.ok) return { success: false, reason: result.reason }
    const file = (await result.res.json()) as { id: string; webViewLink?: string }
    return { success: true, fileId: file.id, webViewLink: file.webViewLink }
  },

  /**
   * No health source is connected, so there is nothing to report. Returns null rather
   * than estimating steps, sleep or heart rate.
   */
  async fetchHealthTelemetry(_memberId: string, _memberName: string): Promise<HealthTelemetry | null> {
    return null
  },

  /** Shareable link carrying the function's details (opened by Neev's invite handler). */
  generateInvitationLink(fn: FamilyFunction, householdName: string): string {
    const params = new URLSearchParams({
      id: fn.id,
      title: fn.title,
      date: fn.date,
      time: fn.time,
      location: fn.location,
      household: householdName,
    })
    return `https://neev.app/invite?${params.toString()}`
  },
}
