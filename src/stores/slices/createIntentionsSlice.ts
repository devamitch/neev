/**
 * Family Intentions, Milestones & Pet Projects Slice
 * Brings the family closer through shared intentions (Sankalpa),
 * weekend pet projects, bonding goals, and cheerful milestones.
 */

import type { ImmerStateCreator } from "../types"

export type IntentionCategory = "bonding" | "project" | "learning" | "outing" | "tradition"

export interface FamilyIntention {
  id: string
  title: string
  description: string
  category: IntentionCategory
  championMemberId: string // The family member leading this project
  targetDate: string
  progress: number // 0 to 100
  cheerCount: number // "Praise/High Five" count from family members
  isCompleted: boolean
  tags: string[]
}

export interface IntentionsSlice {
  intentions: FamilyIntention[]
  activeCategory: IntentionCategory | "all"
  addIntention: (intention: Omit<FamilyIntention, "id" | "cheerCount" | "isCompleted">) => void
  toggleIntentionComplete: (id: string) => void
  updateIntentionProgress: (id: string, progress: number) => void
  cheerIntention: (id: string) => void
  removeIntention: (id: string) => void
  setActiveCategory: (cat: IntentionCategory | "all") => void
  resetIntentionsToClean: () => void
  loadDemoIntentions: () => void
}

export const DEMO_INTENTIONS: FamilyIntention[] = [
  {
    id: "int-1",
    title: "Balcony Herb & Tulsi Garden Sanctuary",
    description: "Planting organic mint, basil, lemongrass, and marigold with Dida and Aarav this Sunday.",
    category: "project",
    championMemberId: "m-4",
    targetDate: "2026-11-01",
    progress: 70,
    cheerCount: 12,
    isCompleted: false,
    tags: ["Green", "Gardening", "Weekend Fun"],
  },
  {
    id: "int-2",
    title: "Weekly Sunday Screen-Free Family Picnic",
    description: "Outdoor picnic at Cubbon Park with Simba, badminton rackets, homemade kachoris, and board games.",
    category: "bonding",
    championMemberId: "m-3",
    targetDate: "2026-11-08",
    progress: 90,
    cheerCount: 18,
    isCompleted: false,
    tags: ["Simba", "Picnic", "NoScreens"],
  },
  {
    id: "int-3",
    title: "Grandparents' Oral Life Chronicles Recording",
    description: "Recording Dadu's childhood stories of Old Kolkata & Shantiniketan to preserve in the family vault.",
    category: "tradition",
    championMemberId: "m-5",
    targetDate: "2026-11-15",
    progress: 40,
    cheerCount: 15,
    isCompleted: false,
    tags: ["OralHistory", "DaduStories", "Memories"],
  },
  {
    id: "int-4",
    title: "Simba's Backyard Agility & Trick Training",
    description: "Teaching Simba to leap over the bamboo hurdle and bring the frisbee gently to Chotu.",
    category: "project",
    championMemberId: "m-5",
    targetDate: "2026-11-20",
    progress: 60,
    cheerCount: 22,
    isCompleted: false,
    tags: ["PetLove", "SimbaTricks", "Playtime"],
  },
]

export const INITIAL_INTENTIONS = DEMO_INTENTIONS

export const createIntentionsSlice: ImmerStateCreator<IntentionsSlice> = (set) => ({
  intentions: [],
  activeCategory: "all",

  addIntention: (intention) =>
    set((state) => {
      state.intentions.unshift({
        ...intention,
        id: `int-${Date.now()}`,
        cheerCount: 0,
        isCompleted: false,
      })
    }),

  toggleIntentionComplete: (id) =>
    set((state) => {
      const item = state.intentions.find((i) => i.id === id)
      if (item) {
        item.isCompleted = !item.isCompleted
        if (item.isCompleted) item.progress = 100
      }
    }),

  updateIntentionProgress: (id, progress) =>
    set((state) => {
      const item = state.intentions.find((i) => i.id === id)
      if (item) {
        item.progress = Math.min(100, Math.max(0, progress))
        if (item.progress === 100) item.isCompleted = true
      }
    }),

  cheerIntention: (id) =>
    set((state) => {
      const item = state.intentions.find((i) => i.id === id)
      if (item) {
        item.cheerCount += 1
      }
    }),

  removeIntention: (id) =>
    set((state) => {
      state.intentions = state.intentions.filter((i) => i.id !== id)
    }),

  setActiveCategory: (cat) =>
    set((state) => {
      state.activeCategory = cat
    }),

  resetIntentionsToClean: () =>
    set((state) => {
      state.intentions = []
    }),

  loadDemoIntentions: () =>
    set((state) => {
      state.intentions = DEMO_INTENTIONS
    }),
})
