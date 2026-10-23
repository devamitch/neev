/**
 * Older builds auto-filled the store with sample family records (and offered a demo
 * account). Those persisted in MMKV on users' phones, and would otherwise be uploaded
 * to their real household on first cloud sync. This removes them once per install.
 */

import { storage } from "@/utils/storage"

import { DEMO_MEMBERS } from "./slices/createFamilySlice"
import {
  DEMO_BRIDGES,
  DEMO_CLUSTERS,
  DEMO_INVITATIONS,
  DEMO_KINSHIP_EDGES,
  DEMO_REALMS,
} from "./slices/createFamilyNetworkSlice"
import { DEMO_INTENTIONS } from "./slices/createIntentionsSlice"
import { DEMO_ENTRIES } from "./slices/createKnowledgeSlice"
import { DEMO_ROUTINES } from "./slices/createRoutineSlice"
import { DEMO_FUNCTIONS } from "./slices/createScheduleSlice"
import { DEMO_BRIEFINGS, DEMO_MEETINGS, DEMO_TASKS } from "./slices/createSpacesSlice"
import { useRootStore } from "./useRootStore"

const PURGE_FLAG = "neev_legacy_demo_purged_v1"

/** Records the removed "Try Demo Sanctuary" sign-in created. */
const DEMO_ACCOUNT_UID = "demo_amit_guardian"
const DEMO_ACCOUNT_IDS = [
  "realm_sharma_heritage",
  "cluster_core",
  "cluster_grandparents",
  "cluster_kids",
  "edge_amit_priya",
  "edge_amit_aarav",
  "edge_amit_dadaji",
  "bridge_jaipur_heritage",
]

const DEMO_HOUSEHOLD_NAMES = new Set(["Chakraborty Family Sanctuary"])

const idsOf = (...lists: { id: string }[][]) => new Set(lists.flat().map((x) => x.id).concat(DEMO_ACCOUNT_IDS))

export function purgeLegacyDemoData(): void {
  try {
    if (storage.getBoolean(PURGE_FLAG)) return
  } catch {
    return
  }

  const demoIds = idsOf(
    DEMO_MEMBERS,
    DEMO_FUNCTIONS,
    DEMO_ENTRIES,
    DEMO_ROUTINES,
    DEMO_INTENTIONS,
    DEMO_TASKS,
    DEMO_MEETINGS,
    DEMO_BRIEFINGS,
    DEMO_REALMS,
    DEMO_CLUSTERS,
    DEMO_KINSHIP_EDGES,
    DEMO_BRIDGES,
    DEMO_INVITATIONS,
  )
  const keep = <T extends { id: string }>(items: T[] | undefined) => (items ?? []).filter((i) => !demoIds.has(i.id))

  useRootStore.setState((state) => {
    state.members = keep(state.members)
    state.functions = keep(state.functions)
    state.entries = keep(state.entries)
    state.routines = keep(state.routines)
    state.intentions = keep(state.intentions)
    state.tasks = keep(state.tasks)
    state.meetings = keep(state.meetings)
    state.aiBriefings = keep(state.aiBriefings)
    state.realms = keep(state.realms)
    state.clusters = keep(state.clusters)
    state.kinshipEdges = keep(state.kinshipEdges)
    state.bridges = keep(state.bridges)
    state.invitations = keep(state.invitations)
    if (state.activeMemberId && demoIds.has(state.activeMemberId)) state.activeMemberId = state.members[0]?.id ?? null
    if (demoIds.has(state.activeRealmId)) state.activeRealmId = state.realms[0]?.id ?? ""
    if (DEMO_HOUSEHOLD_NAMES.has(state.household.name)) {
      state.household = { name: "", motto: "", city: "", establishedYear: new Date().getFullYear() }
    }
    if (state.user?.uid === DEMO_ACCOUNT_UID) {
      state.user = null
      state.isAuthenticated = false
      state.displayName = ""
    }
  })

  try {
    storage.set(PURGE_FLAG, true)
  } catch {
    /* retried next launch */
  }
}
