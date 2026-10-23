/**
 * Neev Cloud Sync Engine (Firebase Firestore).
 *
 * Every signed-in Firebase user (Google or anonymous) belongs to one household:
 *   users/{uid}.householdId -> households/{householdId}
 *   households/{id}/{members|functions|knowledge|routines|intentions|tasks}/{itemId}
 *   households/{id}/locations/{uid}   (opt-in live location)
 *   inviteCodes/{code} -> { householdId }   (join another device / family member)
 *
 * The Zustand store stays the UI's source of truth and works offline. This engine
 * mirrors it both ways: remote snapshots are merged into the store, and local store
 * changes are diffed against the last known remote state and written in batches.
 */

import { onAuthStateChanged, type User } from "firebase/auth"
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore"
import { create } from "zustand"

import { auth, db, type HealthTelemetry } from "@/services/firebase/firebaseClient"
import { familyLocationService } from "@/services/location/familyLocationService"
import { queryClient } from "@/services/query/queryClient"
import { useRootStore, type RootStoreState } from "@/stores/useRootStore"
import { storage } from "@/utils/storage"

export type SyncStatus = "connected" | "syncing" | "idle" | "offline" | "error"

/** Firestore subcollection -> store array it mirrors. */
const SYNCED_COLLECTIONS = [
  { name: "members", key: "members" },
  { name: "functions", key: "functions" },
  { name: "knowledge", key: "entries" },
  { name: "routines", key: "routines" },
  { name: "intentions", key: "intentions" },
  { name: "tasks", key: "tasks" },
] as const

type CollectionName = (typeof SYNCED_COLLECTIONS)[number]["name"]
type StoreKey = (typeof SYNCED_COLLECTIONS)[number]["key"]
type SyncedItem = { id: string } & Record<string, unknown>

const HOUSEHOLD_FIELDS = ["name", "motto", "city", "establishedYear"] as const
const PUSH_DEBOUNCE_MS = 400
const MAX_BATCH_OPS = 450
const LOCATION_SHARING_KEY = "neev_location_sharing_enabled"

interface CloudSyncState {
  status: SyncStatus
  lastSyncedAt: string | null
  lastError: string | null
  householdId: string | null
  inviteCode: string | null
  isHouseholdOwner: boolean
  householdAccountCount: number
  healthMetrics: HealthTelemetry[]
  autoSyncEnabled: boolean
  isGoogleConnected: boolean
  isSharingLocation: boolean
  syncAll: () => Promise<{ ok: boolean; error?: string }>
  joinHousehold: (code: string) => Promise<{ ok: boolean; error?: string }>
  setLocationSharing: (enabled: boolean) => Promise<{ ok: boolean; error?: string }>
  loadHealthTelemetry: () => Promise<void>
  setAutoSync: (enabled: boolean) => void
}

const nowLabel = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

/** JSON-safe copy with keys sorted, so two equal records always serialize the same. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v,
  )
}

/** Drops the `_updatedAt` / `_updatedBy` bookkeeping fields added on write. */
function stripMeta(data: DocumentData): SyncedItem {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) if (!k.startsWith("_")) out[k] = v
  return out as SyncedItem
}

const toPlain = (item: unknown) => JSON.parse(JSON.stringify(item)) as Record<string, unknown>

/** 8 characters, no 0/O/1/I so codes survive being read aloud. */
function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = new Uint8Array(8)
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")
}

export const formatInviteCode = (code: string | null) => (code ? `${code.slice(0, 4)}-${code.slice(4)}` : "")

// ── Engine state (module scope: one session at a time) ──────────────────────

let session: {
  uid: string
  householdId: string
  unsubscribers: Unsubscribe[]
  /** Last known remote record per collection, as stableJson strings. */
  mirrors: Map<CollectionName, Map<string, string>>
  /** Collections whose first snapshot has been merged. */
  ready: Set<CollectionName>
  householdMirror: string | null
} | null = null

let pushTimer: ReturnType<typeof setTimeout> | null = null
let applyingRemote = false
let storeUnsubscribe: (() => void) | null = null
let locationWatch: { remove: () => void } | null = null
let authListenerInstalled = false

const knownIdsKey = (householdId: string, name: CollectionName) => `neev_sync_known_${householdId}_${name}`

/** Ids this device has seen on the server; lets a cold start tell "deleted remotely" from "created offline". */
function loadKnownIds(householdId: string, name: CollectionName): Set<string> {
  try {
    const raw = storage.getString(knownIdsKey(householdId, name))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveKnownIds(householdId: string, name: CollectionName, ids: Iterable<string>) {
  try {
    storage.set(knownIdsKey(householdId, name), JSON.stringify([...ids]))
  } catch {
    /* best effort */
  }
}

const storeItems = (key: StoreKey) => ((useRootStore.getState() as RootStoreState)[key] ?? []) as unknown as SyncedItem[]

function setStoreItems(key: StoreKey, items: SyncedItem[]) {
  applyingRemote = true
  try {
    useRootStore.setState({ [key]: items } as Partial<RootStoreState>)
  } finally {
    applyingRemote = false
  }
}

function applyRemoteCollection(name: CollectionName, key: StoreKey, remoteDocs: SyncedItem[]) {
  if (!session) return
  const remote = new Map(remoteDocs.map((d) => [d.id, d]))
  const previousMirror = session.mirrors.get(name) ?? new Map<string, string>()
  const local = storeItems(key)
  const firstSnapshot = !session.ready.has(name)

  let merged: SyncedItem[]
  if (firstSnapshot) {
    // Server wins for records it has; local-only records are kept (and pushed) unless
    // this device saw them on the server before, which means someone deleted them.
    const known = loadKnownIds(session.householdId, name)
    merged = [
      ...local
        .filter((item) => remote.has(item.id) || !known.has(item.id))
        .map((item) => remote.get(item.id) ?? item),
      ...remoteDocs.filter((d) => !local.some((item) => item.id === d.id)),
    ]
    session.ready.add(name)
  } else {
    // Local edits not yet pushed (differ from the previous mirror) win over the snapshot.
    const localIds = new Set(local.map((i) => i.id))
    const kept = local.flatMap((item) => {
      const unpushed = previousMirror.get(item.id) !== stableJson(toPlain(item))
      if (unpushed) return [item]
      const fresh = remote.get(item.id)
      return fresh ? [fresh] : []
    })
    const locallyDeleted = (id: string) => previousMirror.has(id) && !localIds.has(id)
    merged = [...kept, ...remoteDocs.filter((d) => !localIds.has(d.id) && !locallyDeleted(d.id))]
  }

  session.mirrors.set(name, new Map(remoteDocs.map((d) => [d.id, stableJson(d)])))
  saveKnownIds(session.householdId, name, remote.keys())
  if (stableJson(merged) !== stableJson(local)) {
    setStoreItems(key, merged)
    void queryClient.invalidateQueries()
  }
  schedulePush()
}

function applyRemoteHousehold(data: DocumentData) {
  if (!session) return
  const fields = Object.fromEntries(HOUSEHOLD_FIELDS.map((f) => [f, data[f]]))
  session.householdMirror = stableJson(fields)
  const current = useRootStore.getState().household
  const next = { ...current, ...fields, id: session.householdId }
  if (stableJson(next) !== stableJson(current)) {
    applyingRemote = true
    try {
      useRootStore.getState().setHousehold(next)
    } finally {
      applyingRemote = false
    }
  }
  const memberUids = Array.isArray(data.memberUids) ? (data.memberUids as string[]) : []
  useCloudSyncStore.setState({
    inviteCode: typeof data.inviteCode === "string" ? data.inviteCode : null,
    isHouseholdOwner: data.ownerUid === session.uid,
    householdAccountCount: memberUids.length,
  })
}

function schedulePush() {
  if (!session) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pushLocalChanges()
  }, PUSH_DEBOUNCE_MS)
}

/** Writes every local difference from the last known remote state. */
async function pushLocalChanges(): Promise<void> {
  const active = session
  if (!active) return
  const ops: { ref: ReturnType<typeof doc>; data: Record<string, unknown> | null }[] = []
  const pendingMirrors: [CollectionName, Map<string, string>][] = []

  for (const { name, key } of SYNCED_COLLECTIONS) {
    if (!active.ready.has(name)) continue
    const mirror = active.mirrors.get(name) ?? new Map<string, string>()
    const nextMirror = new Map(mirror)
    const local = storeItems(key).filter((item) => typeof item?.id === "string" && item.id.length > 0)
    const localIds = new Set(local.map((i) => i.id))
    for (const item of local) {
      const plain = toPlain(item)
      const json = stableJson(plain)
      if (mirror.get(item.id) === json) continue
      nextMirror.set(item.id, json)
      ops.push({
        ref: doc(db, "households", active.householdId, name, item.id),
        data: { ...plain, _updatedAt: serverTimestamp(), _updatedBy: active.uid },
      })
    }
    for (const id of mirror.keys()) {
      if (localIds.has(id)) continue
      nextMirror.delete(id)
      ops.push({ ref: doc(db, "households", active.householdId, name, id), data: null })
    }
    pendingMirrors.push([name, nextMirror])
  }

  const household = useRootStore.getState().household
  const householdFields = Object.fromEntries(HOUSEHOLD_FIELDS.map((f) => [f, household[f]]))
  const householdJson = stableJson(householdFields)
  const householdChanged = active.householdMirror !== null && householdJson !== active.householdMirror

  if (ops.length === 0 && !householdChanged) return

  // Optimistic: treat these as written so the echoing snapshot doesn't re-trigger a push.
  for (const [name, mirror] of pendingMirrors) active.mirrors.set(name, mirror)
  if (householdChanged) active.householdMirror = householdJson

  useCloudSyncStore.setState({ status: "syncing" })
  try {
    for (let i = 0; i < ops.length; i += MAX_BATCH_OPS) {
      const batch = writeBatch(db)
      for (const op of ops.slice(i, i + MAX_BATCH_OPS)) {
        if (op.data) batch.set(op.ref, op.data)
        else batch.delete(op.ref)
      }
      await batch.commit()
    }
    if (householdChanged) {
      await updateDoc(doc(db, "households", active.householdId), {
        ...householdFields,
        updatedAt: serverTimestamp(),
      })
    }
    useCloudSyncStore.setState({ status: "connected", lastSyncedAt: nowLabel(), lastError: null })
  } catch (err) {
    // Forget the optimistic mirror so the next change or "Sync now" retries everything.
    if (session === active) {
      for (const [name] of pendingMirrors) active.mirrors.set(name, new Map())
      active.householdMirror = null
    }
    useCloudSyncStore.setState({ status: "error", lastError: errorMessage(err, "Cloud sync failed") })
  }
}

// ── Household membership ─────────────────────────────────────────────────────

async function createHousehold(user: User): Promise<string> {
  const local = useRootStore.getState().household
  const firstName = (user.displayName || "").trim().split(/\s+/)[0]
  const ref = doc(collection(db, "households"))
  const inviteCode = generateInviteCode()
  await setDoc(ref, {
    ownerUid: user.uid,
    memberUids: [user.uid],
    inviteCode,
    name: local.name || (firstName ? `${firstName}'s Family` : "Our Family"),
    motto: local.motto || "",
    city: local.city || "",
    establishedYear: local.establishedYear || new Date().getFullYear(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await setDoc(doc(db, "inviteCodes", inviteCode), {
    householdId: ref.id,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(db, "users", user.uid), { uid: user.uid, householdId: ref.id }, { merge: true })
  return ref.id
}

async function resolveHouseholdId(user: User): Promise<string> {
  const userSnap = await getDoc(doc(db, "users", user.uid))
  const existing = userSnap.exists() ? (userSnap.data().householdId as string | undefined) : undefined
  if (existing) {
    try {
      const household = await getDoc(doc(db, "households", existing))
      const uids = household.exists() ? (household.data().memberUids as string[] | undefined) : undefined
      if (uids?.includes(user.uid)) return existing
    } catch {
      // Removed from that household (permission denied): fall through to a fresh one.
    }
  }
  return createHousehold(user)
}

// ── Location sharing ─────────────────────────────────────────────────────────

async function publishLocation(coords: { latitude: number; longitude: number; accuracy: number | null }) {
  const active = session
  if (!active) return
  const state = useRootStore.getState()
  await setDoc(doc(db, "households", active.householdId, "locations", active.uid), {
    uid: active.uid,
    memberName: state.user?.displayName || state.displayName || "Family member",
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracyMeters: Math.round(coords.accuracy ?? 0),
    _updatedAt: serverTimestamp(),
    _updatedBy: active.uid,
  })
}

async function startLocationWatch(): Promise<{ ok: boolean; error?: string }> {
  const Location = await import("expo-location")
  const permission = await Location.requestForegroundPermissionsAsync()
  if (permission.status !== "granted") {
    return { ok: false, error: "Location permission was not granted." }
  }
  const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
  await publishLocation(first.coords)
  locationWatch?.remove()
  locationWatch = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 60_000 },
    (pos) => void publishLocation(pos.coords).catch(() => undefined),
  )
  return { ok: true }
}

function stopLocationWatch() {
  locationWatch?.remove()
  locationWatch = null
}

// ── Session lifecycle ────────────────────────────────────────────────────────

function stopSession() {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = null
  session?.unsubscribers.forEach((u) => u())
  session = null
  stopLocationWatch()
  familyLocationService.clearAllLocations()
  useCloudSyncStore.setState({
    status: "idle",
    householdId: null,
    inviteCode: null,
    isHouseholdOwner: false,
    householdAccountCount: 0,
  })
}

async function startSession(user: User, householdIdOverride?: string) {
  stopSession()
  useCloudSyncStore.setState({ status: "syncing", lastError: null })
  try {
    const householdId = householdIdOverride ?? (await resolveHouseholdId(user))
    const active = {
      uid: user.uid,
      householdId,
      unsubscribers: [] as Unsubscribe[],
      mirrors: new Map<CollectionName, Map<string, string>>(),
      ready: new Set<CollectionName>(),
      householdMirror: null as string | null,
    }
    session = active
    useCloudSyncStore.setState({ householdId })

    const onError = (err: unknown) => {
      if (session !== active) return
      useCloudSyncStore.setState({ status: "error", lastError: errorMessage(err, "Lost connection to cloud") })
    }

    active.unsubscribers.push(
      onSnapshot(
        doc(db, "households", householdId),
        (snap) => {
          if (session !== active) return
          if (!snap.exists()) {
            onError(new Error("Household no longer exists"))
            return
          }
          applyRemoteHousehold(snap.data())
        },
        onError,
      ),
    )

    for (const { name, key } of SYNCED_COLLECTIONS) {
      active.unsubscribers.push(
        onSnapshot(
          collection(db, "households", householdId, name),
          (snap) => {
            if (session !== active) return
            applyRemoteCollection(
              name,
              key,
              snap.docs.map((d) => ({ ...stripMeta(d.data()), id: d.id })),
            )
            if (!snap.metadata.hasPendingWrites && !snap.metadata.fromCache) {
              useCloudSyncStore.setState((s) => ({
                status: s.status === "syncing" && !pushTimer ? "connected" : s.status,
                lastSyncedAt: nowLabel(),
              }))
            }
          },
          onError,
        ),
      )
    }

    active.unsubscribers.push(
      onSnapshot(
        collection(db, "households", householdId, "locations"),
        (snap) => {
          if (session !== active) return
          familyLocationService.setSharedLocations(
            snap.docs.map((d) => d.data() as Parameters<typeof familyLocationService.setSharedLocations>[0][number]),
            active.uid,
          )
          void queryClient.invalidateQueries()
        },
        onError,
      ),
    )

    if (useCloudSyncStore.getState().isSharingLocation) {
      void startLocationWatch().catch(() => undefined)
    }
  } catch (err) {
    session = null
    useCloudSyncStore.setState({ status: "error", lastError: errorMessage(err, "Couldn't reach the cloud") })
  }
}

/**
 * Installs the Firebase auth listener once. Sync starts whenever a Firebase user is
 * signed in (Google or guest) and stops on sign-out.
 */
export function initCloudSync() {
  if (authListenerInstalled) return
  authListenerInstalled = true

  storeUnsubscribe = useRootStore.subscribe((state, prev) => {
    if (applyingRemote || !session || !state.isAuthenticated) return
    if (!useCloudSyncStore.getState().autoSyncEnabled) return
    const changed =
      state.household !== prev.household || SYNCED_COLLECTIONS.some(({ key }) => state[key] !== prev[key])
    if (changed) schedulePush()
  })

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopSession()
      return
    }
    if (session?.uid === user.uid) return
    void startSession(user)
  })
}

/** Detaches listeners without touching cloud data (used before sign-out clears local state). */
export function stopCloudSync() {
  stopSession()
}

/** For tests / hot reload. */
export function disposeCloudSync() {
  stopSession()
  storeUnsubscribe?.()
  storeUnsubscribe = null
}

export const useCloudSyncStore = create<CloudSyncState>((set, get) => ({
  status: "idle",
  lastSyncedAt: null,
  lastError: null,
  householdId: null,
  inviteCode: null,
  isHouseholdOwner: false,
  householdAccountCount: 0,
  healthMetrics: [],
  autoSyncEnabled: true,
  isGoogleConnected: false,
  isSharingLocation: (() => {
    try {
      return storage.getBoolean(LOCATION_SHARING_KEY) ?? false
    } catch {
      return false
    }
  })(),

  syncAll: async () => {
    const user = auth.currentUser
    if (!user) {
      return { ok: false, error: "Sign in with Google (or continue as guest) to enable cloud sync." }
    }
    if (!session || session.uid !== user.uid) await startSession(user)
    if (!session) return { ok: false, error: get().lastError || "Couldn't reach the cloud" }
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = null
    await pushLocalChanges()
    const { status, lastError } = get()
    if (status === "error") return { ok: false, error: lastError || "Cloud sync failed" }
    set({ status: "connected", lastSyncedAt: nowLabel() })
    return { ok: true }
  },

  joinHousehold: async (rawCode) => {
    const user = auth.currentUser
    if (!user) return { ok: false, error: "Sign in first to join a family household." }
    const code = rawCode.replace(/[^a-z0-9]/gi, "").toUpperCase()
    if (code.length < 6) return { ok: false, error: "That invite code looks incomplete." }
    if (session && get().inviteCode === code) return { ok: false, error: "You're already in this household." }
    try {
      const invite = await getDoc(doc(db, "inviteCodes", code))
      const householdId = invite.exists() ? (invite.data().householdId as string) : null
      if (!householdId) return { ok: false, error: "No household uses that invite code." }
      await updateDoc(doc(db, "households", householdId), {
        memberUids: arrayUnion(user.uid),
        joinCode: code,
        updatedAt: serverTimestamp(),
      })
      await setDoc(doc(db, "users", user.uid), { householdId }, { merge: true })
      // Start from the family's data instead of merging this device's records into it.
      // Detach first so the local reset isn't pushed as deletions to the old household.
      stopSession()
      const root = useRootStore.getState()
      root.resetFamilyToClean?.()
      root.resetScheduleToClean?.()
      root.resetKnowledgeToClean?.()
      root.resetRoutineToClean?.()
      root.resetIntentionsToClean?.()
      root.resetSpacesToClean?.()
      saveKnownIdsForFreshJoin(householdId)
      await startSession(user, householdId)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: errorMessage(err, "Couldn't join that household.") }
    }
  },

  setLocationSharing: async (enabled) => {
    try {
      storage.set(LOCATION_SHARING_KEY, enabled)
    } catch {
      /* best effort */
    }
    set({ isSharingLocation: enabled })
    if (!enabled) {
      stopLocationWatch()
      const active = session
      if (active) {
        await deleteDoc(doc(db, "households", active.householdId, "locations", active.uid)).catch(() => undefined)
      }
      return { ok: true }
    }
    if (!session) {
      set({ isSharingLocation: false })
      return { ok: false, error: "Cloud sync isn't connected yet. Sign in and try again." }
    }
    try {
      const res = await startLocationWatch()
      if (!res.ok) set({ isSharingLocation: false })
      return res
    } catch (err) {
      set({ isSharingLocation: false })
      return { ok: false, error: errorMessage(err, "Couldn't read this device's location.") }
    }
  },

  loadHealthTelemetry: async () => {
    // No health source (Health Connect) is integrated; never show estimated numbers.
    set({ healthMetrics: [] })
  },

  setAutoSync: (enabled) => set({ autoSyncEnabled: enabled }),
}))

function saveKnownIdsForFreshJoin(householdId: string) {
  for (const { name } of SYNCED_COLLECTIONS) saveKnownIds(householdId, name, [])
}
