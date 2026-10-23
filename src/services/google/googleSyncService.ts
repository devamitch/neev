/**
 * Two-way sync between Neev and the signed-in user's own Google Calendar and Google Tasks.
 *
 * Pull: events from every calendar the user shows in Google Calendar (7 days back,
 * 90 days ahead) appear in Schedule as `gcal_…` functions; tasks from every Google
 * Tasks list appear in the Personal space as `gtask_…` tasks. These mirrors are this
 * user's personal data, so they stay on this device and are never uploaded to the
 * shared household (see isDeviceOnlyId in the cloud sync engine).
 *
 * Push: family functions go to the user's primary calendar, and tasks in the Personal
 * space or assigned to the user go to their default task list. Pushed items carry
 * Neev's id (event extendedProperties / task notes) so a reinstall re-links instead of
 * duplicating, edits flow both ways, and deleting in Neev deletes the Google copy.
 *
 * Background runs never show a consent screen; Calendar/Tasks access is granted once
 * right after Google sign-in, or from Settings.
 */

import { AppState } from "react-native"
import { create } from "zustand"

import {
  connectGoogleServices,
  getGrantedFeatureScopes,
  GOOGLE_FEATURE_SCOPES,
} from "@/services/auth/googleSignIn"
import { eventWindow, googleRequest } from "@/services/google/googleServicesClient"
import type { FamilyFunction, FunctionCategory } from "@/stores/slices/createScheduleSlice"
import type { SpaceTask } from "@/stores/slices/createSpacesSlice"
import { useRootStore } from "@/stores/useRootStore"
import { storage } from "@/utils/storage"

export type GoogleSyncStatus = "idle" | "syncing" | "synced" | "needs_consent" | "unavailable" | "error"

interface GoogleSyncState {
  status: GoogleSyncStatus
  lastSyncedAt: string | null
  lastError: string | null
  calendarConnected: boolean
  tasksConnected: boolean
  importedEvents: number
  importedTasks: number
}

export const useGoogleSyncStore = create<GoogleSyncState>(() => ({
  status: "idle",
  lastSyncedAt: null,
  lastError: null,
  calendarConnected: false,
  tasksConnected: false,
  importedEvents: 0,
  importedTasks: 0,
}))

const CAL = "https://www.googleapis.com/calendar/v3"
const TASKS = "https://tasks.googleapis.com/tasks/v1"
const CAL_SCOPES = [GOOGLE_FEATURE_SCOPES.calendarEvents]
const TASK_SCOPES = [GOOGLE_FEATURE_SCOPES.tasks]
const FULL_SYNC_INTERVAL_MS = 15 * 60_000
const PUSH_DEBOUNCE_MS = 3_000
const MAX_PAGES = 5

export const GCAL_PREFIX = "gcal_"
export const GTASK_PREFIX = "gtask_"
export const isGoogleMirrorId = (id: string) => id.startsWith(GCAL_PREFIX) || id.startsWith(GTASK_PREFIX)

// ── Per-account link map (device-local) ─────────────────────────────────────

interface LinkMap {
  /** Neev function id -> pushed event. */
  events: Record<string, { eventId: string; calendarId: string; hash: string; updated?: string }>
  /** Neev task id -> pushed Google task. */
  tasks: Record<string, { taskId: string; listId: string; hash: string; updated?: string }>
  /** Mirrored gtask_ id -> where it lives and its last pulled state. */
  mirrorTasks: Record<string, { taskId: string; listId: string; hash: string }>
}

const mapKey = (uid: string) => `neev_gsync_${uid}`

function loadMap(uid: string): LinkMap {
  try {
    const raw = storage.getString(mapKey(uid))
    if (raw) return { events: {}, tasks: {}, mirrorTasks: {}, ...(JSON.parse(raw) as Partial<LinkMap>) }
  } catch {
    /* fall through */
  }
  return { events: {}, tasks: {}, mirrorTasks: {} }
}

function saveMap(uid: string, map: LinkMap) {
  try {
    storage.set(mapKey(uid), JSON.stringify(map))
  } catch {
    /* best effort */
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const clockLabel = (d: Date) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })

/** Short, stable, id-safe hash (FNV-1a) for calendar ids that contain '@' and '.'. */
function shortHash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

const fnHash = (fn: FamilyFunction) =>
  JSON.stringify([fn.title, fn.date, fn.time, fn.location ?? "", fn.description ?? ""])

const taskHash = (t: SpaceTask) => JSON.stringify([t.title, t.dueDate ?? "", t.isCompleted])

const NEEV_NOTE = /\[neev:([A-Za-z0-9_-]+)\]/

function guessCategory(title: string): FunctionCategory {
  const t = title.toLowerCase()
  if (/birthday|anniversary|wedding|party|celebrat/.test(t)) return "celebration"
  if (/puja|pooja|prayer|festival|diwali|eid|christmas|ritual/.test(t)) return "ritual"
  if (/trip|outing|picnic|movie|vacation|holiday/.test(t)) return "outing"
  if (/project|homework|school|exam/.test(t)) return "project"
  return "gathering"
}

/**
 * Tasks that belong in this user's Google Tasks: assigned to them by name, or created on
 * their account and either private (Personal space) or assigned to "Me".
 */
function isMine(task: SpaceTask): boolean {
  const state = useRootStore.getState()
  const me = (state.user?.displayName || state.displayName || "").trim().toLowerCase()
  const who = (task.assignedTo || "").trim().toLowerCase()
  if (me && who && (who === me || who === me.split(/\s+/)[0])) return true
  const createdByMe = !!task.createdBy && task.createdBy === state.user?.uid
  return createdByMe && (task.space === "personal" || who === "me")
}

let applying = false
function applyToStore(update: (state: ReturnType<typeof useRootStore.getState>) => void) {
  applying = true
  try {
    useRootStore.setState(update)
  } finally {
    applying = false
  }
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

class GoogleSyncAbort extends Error {}

async function getOrThrow<T>(scopes: string[], url: string): Promise<T> {
  const r = await googleRequest(scopes as never, url, { interactive: false })
  if (!r.ok) throw new GoogleSyncAbort(r.reason)
  return json<T>(r.res)
}

// ── Calendar ─────────────────────────────────────────────────────────────────

interface GEvent {
  id: string
  status?: string
  summary?: string
  description?: string
  location?: string
  htmlLink?: string
  updated?: string
  start?: { date?: string; dateTime?: string }
  extendedProperties?: { private?: Record<string, string> }
}

function eventFields(e: GEvent) {
  const start = e.start?.dateTime ? new Date(e.start.dateTime) : null
  return {
    title: e.summary?.trim() || "Untitled event",
    date: start ? ymd(start) : (e.start?.date as string),
    time: start ? clockLabel(start) : "All day",
    location: e.location ?? "",
    description: e.description ?? "",
  }
}

async function pullCalendar(map: LinkMap, linkedThisRun: Set<string>): Promise<number> {
  const calendars = await getOrThrow<{
    items?: { id: string; summary?: string; summaryOverride?: string; selected?: boolean; primary?: boolean }[]
  }>(CAL_SCOPES, `${CAL}/users/me/calendarList?minAccessRole=reader&maxResults=250`)

  const now = Date.now()
  const timeMin = new Date(now - 7 * 86_400_000).toISOString()
  const timeMax = new Date(now + 90 * 86_400_000).toISOString()
  const mirrors: FamilyFunction[] = []
  const pulledEdits = new Map<string, ReturnType<typeof eventFields>>()
  const localById = new Map(useRootStore.getState().functions.map((f) => [f.id, f]))

  for (const cal of (calendars.items ?? []).filter((c) => c.primary || c.selected)) {
    const calName = cal.summaryOverride || cal.summary || "Google Calendar"
    let pageToken: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      })
      if (pageToken) params.set("pageToken", pageToken)
      const data = await getOrThrow<{ items?: GEvent[]; nextPageToken?: string }>(
        CAL_SCOPES,
        `${CAL}/calendars/${encodeURIComponent(cal.id)}/events?${params.toString()}`,
      )
      for (const e of data.items ?? []) {
        if (e.status === "cancelled" || !(e.start?.date || e.start?.dateTime)) continue
        const neevId = e.extendedProperties?.private?.neevId
        if (neevId) {
          // A family function this account pushed earlier (maybe from another install).
          const local = localById.get(neevId)
          const link = map.events[neevId]
          if (!link) {
            map.events[neevId] = {
              eventId: e.id,
              calendarId: cal.id,
              hash: local ? fnHash(local) : "",
              updated: e.updated,
            }
            linkedThisRun.add(neevId)
          } else if (local && e.updated && link.updated && e.updated > link.updated && fnHash(local) === link.hash) {
            pulledEdits.set(neevId, eventFields(e))
            link.updated = e.updated
          }
          continue
        }
        const fields = eventFields(e)
        mirrors.push({
          id: `${GCAL_PREFIX}${shortHash(cal.id)}_${e.id}`,
          ...fields,
          category: guessCategory(fields.title),
          tasks: localById.get(`${GCAL_PREFIX}${shortHash(cal.id)}_${e.id}`)?.tasks ?? [],
          reminderSet: false,
          source: "google",
          calendarName: calName,
          htmlLink: e.htmlLink,
        })
      }
      pageToken = data.nextPageToken
      if (!pageToken) break
    }
  }

  applyToStore((state) => {
    const own = state.functions.filter((f) => !f.id.startsWith(GCAL_PREFIX))
    for (const f of own) {
      const edit = pulledEdits.get(f.id)
      if (edit) {
        Object.assign(f, edit)
        map.events[f.id].hash = fnHash({ ...f, ...edit })
      }
    }
    state.functions = [...own, ...mirrors].sort((a, b) => a.date.localeCompare(b.date))
  })
  return mirrors.length
}

async function pushCalendar(map: LinkMap, linkedThisRun: Set<string>, allowDeletes: boolean) {
  const functions = useRootStore.getState().functions.filter((f) => !isGoogleMirrorId(f.id))
  const ids = new Set(functions.map((f) => f.id))

  for (const fn of functions) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fn.date)) continue
    const hash = fnHash(fn)
    const link = map.events[fn.id]
    if (link && link.hash === hash) continue
    const body = {
      summary: fn.title,
      description: fn.description || undefined,
      location: fn.location || undefined,
      ...eventWindow(fn.date, fn.time, 180),
      extendedProperties: { private: { neevId: fn.id } },
    }
    const r = link
      ? await googleRequest(
          CAL_SCOPES,
          `${CAL}/calendars/${encodeURIComponent(link.calendarId)}/events/${encodeURIComponent(link.eventId)}`,
          { method: "PATCH", body, interactive: false },
        )
      : await googleRequest(CAL_SCOPES, `${CAL}/calendars/primary/events`, { body, interactive: false })
    if (!r.ok) throw new GoogleSyncAbort(r.reason)
    const ev = await json<{ id: string; updated?: string }>(r.res)
    map.events[fn.id] = { eventId: ev.id, calendarId: link?.calendarId ?? "primary", hash, updated: ev.updated }
  }

  if (!allowDeletes) return
  for (const [neevId, link] of Object.entries(map.events)) {
    if (ids.has(neevId) || linkedThisRun.has(neevId)) continue
    const r = await googleRequest(
      CAL_SCOPES,
      `${CAL}/calendars/${encodeURIComponent(link.calendarId)}/events/${encodeURIComponent(link.eventId)}`,
      { method: "DELETE", interactive: false, acceptStatuses: [404, 410] },
    )
    if (!r.ok) throw new GoogleSyncAbort(r.reason)
    delete map.events[neevId]
  }
}

// ── Tasks ────────────────────────────────────────────────────────────────────

interface GTask {
  id: string
  title?: string
  notes?: string
  status?: "needsAction" | "completed"
  due?: string
  updated?: string
  deleted?: boolean
}

const dueToDate = (due?: string) => (due ? due.slice(0, 10) : "")
const dateToDue = (date?: string) => (date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00.000Z` : undefined)

/** Completion/title changes made in Neev on mirrored Google tasks. */
async function pushMirrorTaskEdits(map: LinkMap) {
  for (const t of useRootStore.getState().tasks) {
    if (!t.id.startsWith(GTASK_PREFIX)) continue
    const link = map.mirrorTasks[t.id]
    if (!link || link.hash === taskHash(t)) continue
    const r = await googleRequest(
      TASK_SCOPES,
      `${TASKS}/lists/${encodeURIComponent(link.listId)}/tasks/${encodeURIComponent(link.taskId)}`,
      {
        method: "PATCH",
        body: { title: t.title, status: t.isCompleted ? "completed" : "needsAction", due: dateToDue(t.dueDate) ?? null },
        interactive: false,
      },
    )
    if (!r.ok) throw new GoogleSyncAbort(r.reason)
    link.hash = taskHash(t)
  }
}

async function pullTasks(map: LinkMap, linkedThisRun: Set<string>): Promise<number> {
  const lists = await getOrThrow<{ items?: { id: string; title?: string }[] }>(
    TASK_SCOPES,
    `${TASKS}/users/@me/lists?maxResults=100`,
  )
  const localById = new Map(useRootStore.getState().tasks.map((t) => [t.id, t]))
  const mirrors: SpaceTask[] = []
  const mirrorLinks: LinkMap["mirrorTasks"] = {}
  const pulledEdits = new Map<string, { title: string; isCompleted: boolean; dueDate: string }>()

  for (const list of lists.items ?? []) {
    let pageToken: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({ showCompleted: "true", showHidden: "true", maxResults: "100" })
      if (pageToken) params.set("pageToken", pageToken)
      const data = await getOrThrow<{ items?: GTask[]; nextPageToken?: string }>(
        TASK_SCOPES,
        `${TASKS}/lists/${encodeURIComponent(list.id)}/tasks?${params.toString()}`,
      )
      for (const gt of data.items ?? []) {
        if (gt.deleted || !gt.title?.trim()) continue
        // Skip long-finished tasks; Google keeps every completed task forever.
        if (gt.status === "completed" && gt.updated && Date.parse(gt.updated) < Date.now() - 14 * 86_400_000) continue
        const neevId = gt.notes?.match(NEEV_NOTE)?.[1]
        const fields = {
          title: gt.title.trim(),
          isCompleted: gt.status === "completed",
          dueDate: dueToDate(gt.due),
        }
        if (neevId) {
          const local = localById.get(neevId)
          const link = map.tasks[neevId]
          if (!link) {
            map.tasks[neevId] = { taskId: gt.id, listId: list.id, hash: local ? taskHash(local) : "", updated: gt.updated }
            linkedThisRun.add(neevId)
          } else if (local && gt.updated && link.updated && gt.updated > link.updated && taskHash(local) === link.hash) {
            pulledEdits.set(neevId, fields)
            link.updated = gt.updated
          }
          continue
        }
        const id = `${GTASK_PREFIX}${gt.id}`
        const existing = localById.get(id)
        const mirror: SpaceTask = {
          id,
          ...fields,
          space: "personal",
          category: existing?.category ?? "home",
          assignedTo: "Me",
          time: "",
          priority: existing?.priority ?? "normal",
          reminderNudgeCount: existing?.reminderNudgeCount ?? 0,
          googleTaskId: gt.id,
          source: "google",
          taskListName: list.title,
          notes: gt.notes,
        }
        mirrors.push(mirror)
        mirrorLinks[id] = { taskId: gt.id, listId: list.id, hash: taskHash(mirror) }
      }
      pageToken = data.nextPageToken
      if (!pageToken) break
    }
  }

  map.mirrorTasks = mirrorLinks
  applyToStore((state) => {
    const own = state.tasks.filter((t) => !t.id.startsWith(GTASK_PREFIX))
    for (const t of own) {
      const edit = pulledEdits.get(t.id)
      if (edit) {
        Object.assign(t, edit)
        map.tasks[t.id].hash = taskHash({ ...t, ...edit })
      }
    }
    state.tasks = [...own, ...mirrors]
  })
  return mirrors.length
}

async function pushTasks(map: LinkMap, linkedThisRun: Set<string>, allowDeletes: boolean) {
  const tasks = useRootStore.getState().tasks.filter((t) => !isGoogleMirrorId(t.id))
  const ids = new Set(tasks.map((t) => t.id))

  for (const t of tasks) {
    const link = map.tasks[t.id]
    if (!link && !isMine(t)) continue
    const hash = taskHash(t)
    if (link && link.hash === hash) continue
    const body = {
      title: t.title,
      notes: `Added from Neev [neev:${t.id}]`,
      status: t.isCompleted ? "completed" : "needsAction",
      due: dateToDue(t.dueDate) ?? null,
    }
    const r = link
      ? await googleRequest(
          TASK_SCOPES,
          `${TASKS}/lists/${encodeURIComponent(link.listId)}/tasks/${encodeURIComponent(link.taskId)}`,
          { method: "PATCH", body, interactive: false },
        )
      : await googleRequest(TASK_SCOPES, `${TASKS}/lists/@default/tasks`, { body, interactive: false })
    if (!r.ok) throw new GoogleSyncAbort(r.reason)
    const gt = await json<{ id: string; updated?: string }>(r.res)
    map.tasks[t.id] = { taskId: gt.id, listId: link?.listId ?? "@default", hash, updated: gt.updated }
  }

  if (!allowDeletes) return
  for (const [neevId, link] of Object.entries(map.tasks)) {
    if (ids.has(neevId) || linkedThisRun.has(neevId)) continue
    const r = await googleRequest(
      TASK_SCOPES,
      `${TASKS}/lists/${encodeURIComponent(link.listId)}/tasks/${encodeURIComponent(link.taskId)}`,
      { method: "DELETE", interactive: false, acceptStatuses: [404, 410] },
    )
    if (!r.ok) throw new GoogleSyncAbort(r.reason)
    delete map.tasks[neevId]
  }
}

// ── Orchestration ───────────────────────────────────────────────────────────

let running: Promise<GoogleSyncResult> | null = null
let rerunPushAfter = false
let lastFullSyncAt = 0

export type GoogleSyncResult = { ok: boolean; error?: string; events?: number; tasks?: number }

function canSync(): string | null {
  const user = useRootStore.getState().user
  if (!useRootStore.getState().isAuthenticated || user?.provider !== "google") {
    return "Sign in with Google to sync Calendar and Tasks."
  }
  return null
}

/** Deleting Google copies is only safe once this device holds the household's records. */
async function householdLoaded(): Promise<boolean> {
  try {
    const { useCloudSyncStore } = await import("@/services/sync/cloudSyncEngine")
    const s = useCloudSyncStore.getState()
    return s.householdId !== null && s.status !== "error" && s.lastSyncedAt !== null
  } catch {
    return false
  }
}

async function run(mode: "full" | "push"): Promise<GoogleSyncResult> {
  const blocked = canSync()
  if (blocked) {
    useGoogleSyncStore.setState({ status: "unavailable", lastError: blocked })
    return { ok: false, error: blocked }
  }
  const granted = getGrantedFeatureScopes()
  const calendarOk = granted.includes(GOOGLE_FEATURE_SCOPES.calendarEvents)
  const tasksOk = granted.includes(GOOGLE_FEATURE_SCOPES.tasks)
  useGoogleSyncStore.setState({ calendarConnected: calendarOk, tasksConnected: tasksOk })
  if (!calendarOk && !tasksOk) {
    useGoogleSyncStore.setState({ status: "needs_consent", lastError: null })
    return { ok: false, error: "Allow Calendar and Tasks access to sync." }
  }

  const uid = useRootStore.getState().user!.uid
  const map = loadMap(uid)
  const linked = new Set<string>()
  const allowDeletes = await householdLoaded()
  useGoogleSyncStore.setState({ status: "syncing" })
  try {
    let events = useGoogleSyncStore.getState().importedEvents
    let tasks = useGoogleSyncStore.getState().importedTasks
    if (calendarOk) {
      if (mode === "full") events = await pullCalendar(map, linked)
      await pushCalendar(map, linked, allowDeletes)
    }
    if (tasksOk) {
      await pushMirrorTaskEdits(map)
      if (mode === "full") tasks = await pullTasks(map, linked)
      await pushTasks(map, linked, allowDeletes)
    }
    saveMap(uid, map)
    if (mode === "full") lastFullSyncAt = Date.now()
    useGoogleSyncStore.setState({
      status: calendarOk && tasksOk ? "synced" : "needs_consent",
      lastSyncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      lastError: null,
      importedEvents: events,
      importedTasks: tasks,
    })
    return { ok: true, events, tasks }
  } catch (err) {
    saveMap(uid, map) // keep links for whatever was pushed before the failure
    const reason = err instanceof Error ? err.message : "Google sync failed"
    const message =
      reason === "needs_consent" || reason === "declined"
        ? "Calendar/Tasks access needs to be allowed again."
        : reason === "not_signed_in"
          ? "Google session expired. Sign in with Google again."
          : "Couldn't reach Google. Will retry automatically."
    useGoogleSyncStore.setState({
      status: reason === "needs_consent" || reason === "declined" ? "needs_consent" : "error",
      lastError: message,
    })
    return { ok: false, error: message }
  }
}

function schedule(mode: "full" | "push"): Promise<GoogleSyncResult> {
  if (running) {
    if (mode === "push") rerunPushAfter = true
    return running
  }
  running = run(mode).finally(() => {
    running = null
    if (rerunPushAfter) {
      rerunPushAfter = false
      void schedule("push")
    }
  })
  return running
}

/** Full two-way sync. `interactive` asks for Calendar/Tasks access first if missing. */
export async function syncGoogleNow(options: { interactive?: boolean } = {}): Promise<GoogleSyncResult> {
  if (options.interactive && !canSync()) {
    const granted = getGrantedFeatureScopes()
    if (granted.length < 3) {
      const res = await connectGoogleServices()
      if (res.status !== "granted" && granted.length === 0) {
        const error = res.status === "declined" ? "Google access was not allowed." : "Couldn't connect Google."
        useGoogleSyncStore.setState({ status: "needs_consent", lastError: error })
        return { ok: false, error }
      }
    }
  }
  return schedule("full")
}

let initialized = false
let pushTimer: ReturnType<typeof setTimeout> | null = null

/** Starts automatic Google sync: on launch, when the app returns to foreground, every 15 min, and after local edits. */
export function initGoogleSync() {
  if (initialized) return
  initialized = true

  useRootStore.subscribe((state, prev) => {
    if (applying || (state.functions === prev.functions && state.tasks === prev.tasks)) return
    if (state.user?.provider !== "google") return
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => void schedule("push"), PUSH_DEBOUNCE_MS)
  })

  AppState.addEventListener("change", (s) => {
    if (s === "active" && Date.now() - lastFullSyncAt > 5 * 60_000) void schedule("full")
  })

  setInterval(() => {
    if (AppState.currentState === "active") void schedule("full")
  }, FULL_SYNC_INTERVAL_MS)

  // Let cloud sync load the household first so pushes see family records.
  setTimeout(() => void schedule("full"), 4_000)
}

/** Forget links for an account (sign-out). Mirrored items are cleared with the rest of the store. */
export function resetGoogleSyncState() {
  lastFullSyncAt = 0
  useGoogleSyncStore.setState({
    status: "idle",
    lastSyncedAt: null,
    lastError: null,
    calendarConnected: false,
    tasksConnected: false,
    importedEvents: 0,
    importedTasks: 0,
  })
}
