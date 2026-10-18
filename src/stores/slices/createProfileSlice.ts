/**
 * Profile & Routine Slice
 * Backs user preferences, routine timings, and home layout customization
 */

export type ActivityId = string

export type HomeSectionId =
  | "continue"
  | "recommended"
  | "progress"
  | "recent"
  | "favorites"
  | "achievements"
  | "explore"
  | "live"

export interface HomeSection {
  id: HomeSectionId
  visible: boolean
}

export const HOME_SECTION_LABELS: Record<HomeSectionId, { title: string; caption: string }> = {
  continue: { title: "Continue", caption: "Your most recent activity" },
  recommended: { title: "Recommended", caption: "Suggestions and why they're shown" },
  progress: { title: "Today", caption: "Eye Battery, level, streak and daily goal" },
  recent: { title: "Recent results", caption: "Your latest scores" },
  favorites: { title: "Favourites", caption: "Activities you starred" },
  achievements: { title: "Achievements", caption: "Milestones you've reached" },
  explore: { title: "Scan & insights", caption: "Shortcuts to scanner, metrics and patterns" },
  live: { title: "Live scan summary", caption: "Shown only while a scan is running" },
}

export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  { id: "live", visible: true },
  { id: "progress", visible: true },
  { id: "continue", visible: true },
  { id: "recommended", visible: true },
  { id: "explore", visible: true },
  { id: "recent", visible: true },
  { id: "achievements", visible: true },
  { id: "favorites", visible: true },
]

export interface RoutineProfile {
  sleepTime: string | null
  wakeTime: string | null
  workStart: string | null
  workEnd: string | null
  breakIntervalMin: number | null
  preferredActivitySec: number | null
}

export const EMPTY_ROUTINE: RoutineProfile = {
  sleepTime: null,
  wakeTime: null,
  workStart: null,
  workEnd: null,
  breakIntervalMin: null,
  preferredActivitySec: null,
}

export function makeProfileId() {
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0")
  return `bq-${Date.now().toString(36)}-${hex()}${hex()}`
}

export function withAllSections(sections: HomeSection[]): HomeSection[] {
  const known = new Set(sections.map((s) => s.id))
  const valid = sections.filter((s) => s.id in HOME_SECTION_LABELS)
  return [...valid, ...DEFAULT_HOME_SECTIONS.filter((s) => !known.has(s.id))]
}

export interface ProfileSlice {
  profileId: string
  displayName: string
  homeSections: HomeSection[]
  favorites: ActivityId[]
  routine: RoutineProfile
  legacyGamesImported: boolean
  setDisplayName: (name: string) => void
  setHomeSections: (sections: HomeSection[]) => void
  resetHomeSections: () => void
  toggleFavorite: (id: ActivityId) => void
  setRoutine: (patch: Partial<RoutineProfile>) => void
  markLegacyGamesImported: () => void
  resetProfile: () => void
}

import type { ImmerStateCreator } from "../types"

export const createProfileSlice: ImmerStateCreator<ProfileSlice> = (set) => ({
  profileId: makeProfileId(),
  displayName: "",
  homeSections: DEFAULT_HOME_SECTIONS,
  favorites: [],
  routine: EMPTY_ROUTINE,
  legacyGamesImported: false,

  setDisplayName: (displayName) =>
    set((state) => {
      state.displayName = displayName.slice(0, 40)
    }),

  setHomeSections: (homeSections) =>
    set((state) => {
      state.homeSections = withAllSections(homeSections)
    }),

  resetHomeSections: () =>
    set((state) => {
      state.homeSections = DEFAULT_HOME_SECTIONS
    }),

  toggleFavorite: (id) =>
    set((state) => {
      const idx = state.favorites.indexOf(id)
      if (idx >= 0) {
        state.favorites.splice(idx, 1)
      } else {
        state.favorites.push(id)
      }
    }),

  setRoutine: (patch) =>
    set((state) => {
      state.routine = { ...state.routine, ...patch }
    }),

  markLegacyGamesImported: () =>
    set((state) => {
      state.legacyGamesImported = true
    }),

  resetProfile: () =>
    set((state) => {
      state.profileId = makeProfileId()
      state.displayName = ""
      state.homeSections = DEFAULT_HOME_SECTIONS
      state.favorites = []
      state.routine = EMPTY_ROUTINE
    }),
})
