/**
 * Google services used by Neev, all through the signed-in user's own Google account
 * with incremental authorization (see GOOGLE_FEATURE_SCOPES):
 * 1. Google Calendar — add a family function as a real event.
 * 2. Google Tasks — add a delegated chore to the user's task list.
 * 3. Google Meet — a real Meet link, created on a Calendar event (conferenceData).
 * Health data is not read: Google Fit's APIs are being shut down and Health Connect
 * needs an on-device integration Neev doesn't ship, so nothing is invented instead.
 */

import {
  getGoogleAccessToken,
  GOOGLE_FEATURE_SCOPES,
  type GoogleAccessResult,
} from "@/services/auth/googleSignIn"
import type { HealthTelemetry } from "@/services/firebase/firebaseClient"
import type { FamilyFunction } from "@/stores/useScheduleStore"

/**
 * Try the stored access token first (obtained at sign-in with all scopes).
 * Only fall back to incremental getGoogleAccessToken() if not available.
 */
async function resolveAccessToken(requiredScopes: string[]): Promise<{ token: string } | { reason: string }> {
  // 1. Try stored token from sign-in
  try {
    const { useRootStore } = require("@/stores/useRootStore")
    const stored = useRootStore.getState()?.user?.googleAccessToken
    if (stored) return { token: stored }
  } catch { /* store not available */ }

  // 2. Fall back to incremental auth
  const access = await getGoogleAccessToken(requiredScopes as any)
  if (access.status === "granted") return { token: access.accessToken }
  return { reason: access.status }
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

async function googleFetch(accessToken: string, url: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const newRequestId = () => `neev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const googleServicesClient = {
  /** Adds the function to the user's primary Google Calendar. */
  async exportFunctionToCalendar(
    fn: FamilyFunction,
  ): Promise<{ success: boolean; eventId?: string; htmlLink?: string; reason?: GoogleSyncFailure }> {
    const resolved = await resolveAccessToken([GOOGLE_FEATURE_SCOPES.calendar])
    if ("reason" in resolved) return { success: false, reason: resolved.reason as GoogleSyncFailure }
    try {
      const res = await googleFetch(
        resolved.token,
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          summary: fn.title,
          description: fn.description || undefined,
          location: fn.location || undefined,
          ...eventWindow(fn.date, fn.time, 180),
        },
      )
      if (!res.ok) return { success: false, reason: "request_failed" }
      const event = (await res.json()) as { id: string; htmlLink?: string }
      return { success: true, eventId: event.id, htmlLink: event.htmlLink }
    } catch {
      return { success: false, reason: "request_failed" }
    }
  },

  /** Adds a task to the user's default Google Tasks list. */
  async exportTaskToGoogleTasks(taskTitle: string, assigneeName: string, dueDate: string): Promise<boolean> {
    const resolved = await resolveAccessToken([GOOGLE_FEATURE_SCOPES.tasks])
    if ("reason" in resolved) return false
    try {
      const res = await googleFetch(resolved.token, "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks", {
        title: assigneeName ? `${taskTitle} (${assigneeName})` : taskTitle,
        // Google Tasks stores only the date part of `due`.
        due: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? `${dueDate}T00:00:00.000Z` : undefined,
      })
      return res.ok
    } catch {
      return false
    }
  },

  /**
   * Creates a Calendar event with a Google Meet conference and returns its real join
   * link. Returns an empty url when Google access isn't available — never a made-up link.
   */
  async createGoogleMeetUrl(
    meetingTitle: string,
    scheduledTime: string,
  ): Promise<{ url: string; conferenceId: string; reason?: GoogleSyncFailure }> {
    const resolved = await resolveAccessToken([GOOGLE_FEATURE_SCOPES.calendar])
    if ("reason" in resolved) return { url: "", conferenceId: "", reason: resolved.reason as GoogleSyncFailure }
    try {
      const start = Number.isNaN(Date.parse(scheduledTime)) ? new Date() : new Date(scheduledTime)
      const end = new Date(start.getTime() + 60 * 60_000)
      const res = await googleFetch(
        resolved.token,
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
        {
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
      )
      if (!res.ok) return { url: "", conferenceId: "", reason: "request_failed" }
      const event = (await res.json()) as {
        hangoutLink?: string
        conferenceData?: { conferenceId?: string }
      }
      return { url: event.hangoutLink ?? "", conferenceId: event.conferenceData?.conferenceId ?? "" }
    } catch {
      return { url: "", conferenceId: "", reason: "request_failed" }
    }
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
