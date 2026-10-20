import type { ImmerStateCreator } from "../types"

export interface FamilyRoutineItem {
  id: string
  title: string
  time: string // e.g. "06:30 AM"
  category: "morning" | "afternoon" | "evening" | "night"
  assignedMember: string
  isCompleted: boolean
  isShared: boolean
}

export interface RoutineSlice {
  routines: FamilyRoutineItem[]
  toggleRoutine: (id: string) => void
  addRoutine: (item: Omit<FamilyRoutineItem, "id" | "isCompleted">) => void
  resetRoutineToClean: () => void
  loadDemoRoutine: () => void
}

export const DEMO_ROUTINES: FamilyRoutineItem[] = [
  {
    id: "r-1",
    title: "Morning Sun Salutation & Mandir Diya",
    time: "06:15 AM",
    category: "morning",
    assignedMember: "Dadu & Maa",
    isCompleted: true,
    isShared: true,
  },
  {
    id: "r-2",
    title: "Morning Walk & Park Frisbee with Simba",
    time: "07:00 AM",
    category: "morning",
    assignedMember: "Papa & Simba",
    isCompleted: true,
    isShared: true,
  },
  {
    id: "r-3",
    title: "Aarav's School Bus Departure & Pancake Box",
    time: "08:10 AM",
    category: "morning",
    assignedMember: "Maa",
    isCompleted: true,
    isShared: true,
  },
  {
    id: "r-4",
    title: "Afternoon Ginger Chai & Balcony Chat with Elders",
    time: "04:30 PM",
    category: "afternoon",
    assignedMember: "Dida & Papa",
    isCompleted: false,
    isShared: true,
  },
  {
    id: "r-5",
    title: "Screen-Free Family Dinner & Daily Highlights Sharing",
    time: "08:15 PM",
    category: "evening",
    assignedMember: "Entire Household",
    isCompleted: false,
    isShared: true,
  },
  {
    id: "r-6",
    title: "Bedtime Storytelling (Old Kolkata Tales by Dadu)",
    time: "09:30 PM",
    category: "night",
    assignedMember: "Dadu & Aarav",
    isCompleted: false,
    isShared: true,
  },
]

export const INITIAL_ROUTINES = DEMO_ROUTINES

export const createRoutineSlice: ImmerStateCreator<RoutineSlice> = (set) => ({
  routines: [],

  toggleRoutine: (id) =>
    set((state) => {
      const routine = state.routines.find((r) => r.id === id)
      if (routine) {
        routine.isCompleted = !routine.isCompleted
      }
    }),

  addRoutine: (item) =>
    set((state) => {
      state.routines.push({ ...item, id: `r-${Date.now()}`, isCompleted: false })
    }),

  resetRoutineToClean: () =>
    set((state) => {
      state.routines = []
    }),

  loadDemoRoutine: () =>
    set((state) => {
      state.routines = DEMO_ROUTINES
    }),
})
