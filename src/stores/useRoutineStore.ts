import { create } from "zustand"

export interface FamilyRoutineItem {
  id: string
  title: string
  time: string // e.g. "06:30 AM"
  category: "morning" | "afternoon" | "evening" | "night"
  assignedMember: string
  isCompleted: boolean
  isShared: boolean
}

interface RoutineState {
  routines: FamilyRoutineItem[]
  toggleRoutine: (id: string) => void
  addRoutine: (item: Omit<FamilyRoutineItem, "id" | "isCompleted">) => void
}

const INITIAL_ROUTINES: FamilyRoutineItem[] = [
  {
    id: "r-1",
    title: "Morning Sun Pranam & Mandir Diya",
    time: "06:15 AM",
    category: "morning",
    assignedMember: "Dadu & Maa",
    isCompleted: true,
    isShared: true,
  },
  {
    id: "r-2",
    title: "Grandparents Morning Blood Pressure & Warm Water",
    time: "07:30 AM",
    category: "morning",
    assignedMember: "Papa",
    isCompleted: true,
    isShared: false,
  },
  {
    id: "r-3",
    title: "Aarav's School Bus Departure & Nutrition Box",
    time: "08:10 AM",
    category: "morning",
    assignedMember: "Maa",
    isCompleted: true,
    isShared: true,
  },
  {
    id: "r-4",
    title: "Afternoon Herbal Tea & Newspaper Reading with Elders",
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
    title: "Bedtime Storytelling (Mahabharata Tales by Dadu)",
    time: "09:30 PM",
    category: "night",
    assignedMember: "Dadu & Aarav",
    isCompleted: false,
    isShared: true,
  },
]

export const useRoutineStore = create<RoutineState>((set) => ({
  routines: INITIAL_ROUTINES,
  toggleRoutine: (id) =>
    set((state) => ({
      routines: state.routines.map((r) => (r.id === id ? { ...r, isCompleted: !r.isCompleted } : r)),
    })),
  addRoutine: (item) =>
    set((state) => ({
      routines: [...state.routines, { ...item, id: `r-${Date.now()}`, isCompleted: false }],
    })),
}))
