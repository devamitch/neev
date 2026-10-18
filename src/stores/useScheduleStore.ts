import { create } from "zustand"

export type FunctionCategory = "ritual" | "celebration" | "gathering" | "school" | "health"

export interface FunctionTask {
  id: string
  title: string
  assignedToMemberId: string
  isDone: boolean
}

export interface FamilyFunction {
  id: string
  title: string
  category: FunctionCategory
  date: string // YYYY-MM-DD
  time: string // HH:mm AM/PM
  location: string
  description: string
  tasks: FunctionTask[]
  reminderSet: boolean
}

interface ScheduleState {
  functions: FamilyFunction[]
  addFunction: (fn: Omit<FamilyFunction, "id">) => void
  toggleTask: (functionId: string, taskId: string) => void
  removeFunction: (id: string) => void
}

const INITIAL_FUNCTIONS: FamilyFunction[] = [
  {
    id: "fn-1",
    title: "Dida's 75th Amrit Mahotsav",
    category: "celebration",
    date: "2026-11-05",
    time: "11:30 AM",
    location: "Ancestral Home Courtyard, Kolkata",
    description: "Milestone 75th birthday celebration with extended relatives, special Bengali bhog lunch, and photo retrospective.",
    reminderSet: true,
    tasks: [
      { id: "t-1", title: "Arrange sweet delivery (Nolen Gur Sandesh)", assignedToMemberId: "m-3", isDone: true },
      { id: "t-2", title: "Prepare flower garland & sandalwood paste", assignedToMemberId: "m-4", isDone: false },
      { id: "t-3", title: "Print childhood framed photograph album", assignedToMemberId: "m-3", isDone: false },
      { id: "t-4", title: "Practice flute prayer piece for evening", assignedToMemberId: "m-5", isDone: false },
    ],
  },
  {
    id: "fn-2",
    title: "Deepavali Lakshmi Ganesh Puja",
    category: "ritual",
    date: "2026-11-09",
    time: "06:30 PM",
    location: "Home Mandir Sanctuary",
    description: "Annual family deepavali ritual. Lighting 51 earthen diyas, chanting Sri Suktam, followed by family dinner.",
    reminderSet: true,
    tasks: [
      { id: "t-5", title: "Procure organic ghee & earthen clay diyas", assignedToMemberId: "m-3", isDone: true },
      { id: "t-6", title: "Decorate temple threshold with rice rangoli", assignedToMemberId: "m-4", isDone: false },
      { id: "t-7", title: "Set up brass puja vessels with Dadu", assignedToMemberId: "m-5", isDone: false },
    ],
  },
  {
    id: "fn-3",
    title: "Aarav's Inter-School Science Fair",
    category: "school",
    date: "2026-11-18",
    time: "09:00 AM",
    location: "Greenwood High Auditorium",
    description: "Model demonstration on solar irrigation pumps. Both parents and grandparents attending.",
    reminderSet: true,
    tasks: [
      { id: "t-8", title: "Dry run solar motor demo board", assignedToMemberId: "m-3", isDone: false },
      { id: "t-9", title: "Press school ceremonial uniform", assignedToMemberId: "m-4", isDone: false },
    ],
  },
  {
    id: "fn-4",
    title: "Quarterly Comprehensive Health Panel",
    category: "health",
    date: "2026-11-25",
    time: "07:30 AM",
    location: "Apollo Diagnostics Clinic",
    description: "Fasting blood sugar, lipid profile, and geriatric health checkup for grandparents.",
    reminderSet: true,
    tasks: [
      { id: "t-10", title: "Confirm 12-hour fasting overnight", assignedToMemberId: "m-4", isDone: false },
      { id: "t-11", title: "Schedule home sample phlebotomist backup", assignedToMemberId: "m-3", isDone: true },
    ],
  },
]

export const useScheduleStore = create<ScheduleState>((set) => ({
  functions: INITIAL_FUNCTIONS,
  addFunction: (fn) =>
    set((state) => ({
      functions: [{ ...fn, id: `fn-${Date.now()}` }, ...state.functions],
    })),
  toggleTask: (functionId, taskId) =>
    set((state) => ({
      functions: state.functions.map((fn) =>
        fn.id === functionId
          ? {
              ...fn,
              tasks: fn.tasks.map((t) => (t.id === taskId ? { ...t, isDone: !t.isDone } : t)),
            }
          : fn,
      ),
    })),
  removeFunction: (id) =>
    set((state) => ({
      functions: state.functions.filter((f) => f.id !== id),
    })),
}))
