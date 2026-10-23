import type { ImmerStateCreator } from "../types"

export type FunctionCategory = "celebration" | "gathering" | "outing" | "ritual" | "project"

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
  vibe?: string
  invitationsCount?: number
  rsvpConfirmed?: number
  tasks: FunctionTask[]
  reminderSet: boolean
  /** "google": mirrored from this user's Google Calendar; stays on this device. */
  source?: "google"
  calendarName?: string
  htmlLink?: string
}

export interface ScheduleSlice {
  functions: FamilyFunction[]
  addFunction: (fn: Omit<FamilyFunction, "id">) => void
  toggleFunctionTask: (functionId: string, taskId: string) => void
  removeFunction: (id: string) => void
  /** Inserts or replaces functions by id (e.g. events imported from Google Calendar). */
  upsertFunctions: (fns: FamilyFunction[]) => number
  resetScheduleToClean: () => void
}

/** Sample record kept for tests and for purging installs seeded by older builds. Never loaded in the app. */
export const DEMO_FUNCTIONS: FamilyFunction[] = [
  {
    id: "fn-1",
    title: "Dida's 75th Amrit Mahotsav Celebration",
    category: "celebration",
    date: "2026-11-05",
    time: "11:30 AM",
    location: "Ancestral Home Courtyard, Kolkata",
    description:
      "Milestone 75th birthday celebration with extended relatives, special Bengali bhog lunch, and photo retrospective.",
    vibe: "Traditional festive & silk kurtas",
    invitationsCount: 28,
    rsvpConfirmed: 24,
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
    title: "Deepavali Family Diya & Mandir Ritual",
    category: "ritual",
    date: "2026-11-09",
    time: "06:30 PM",
    location: "Home Mandir Sanctuary",
    description:
      "Annual family deepavali ritual. Lighting 51 earthen diyas, chanting Sri Suktam, followed by feast with sweets.",
    vibe: "Bright festive gold & orange",
    invitationsCount: 12,
    rsvpConfirmed: 12,
    reminderSet: true,
    tasks: [
      { id: "t-5", title: "Procure organic ghee & earthen clay diyas", assignedToMemberId: "m-3", isDone: true },
      { id: "t-6", title: "Decorate temple threshold with rice rangoli", assignedToMemberId: "m-4", isDone: false },
      { id: "t-7", title: "Set up brass puja vessels with Dadu", assignedToMemberId: "m-5", isDone: false },
    ],
  },
  {
    id: "fn-3",
    title: "Aarav & Simba's Cubbon Park Sunday Picnic",
    category: "outing",
    date: "2026-11-15",
    time: "09:30 AM",
    location: "Cubbon Park Dog Park & Lawn",
    description:
      "Family weekend picnic with Simba! Frisbee sessions, badminton, homemade sandwiches, and ginger tea in thermos.",
    vibe: "Casual pastels, walking shoes & frisbees",
    invitationsCount: 6,
    rsvpConfirmed: 6,
    reminderSet: true,
    tasks: [
      { id: "t-8", title: "Pack Simba's water bowl & peanut butter treats", assignedToMemberId: "m-5", isDone: true },
      { id: "t-9", title: "Prepare cucumber mint sandwiches & samosas", assignedToMemberId: "m-4", isDone: false },
      { id: "t-10", title: "Load picnic mat, badminton rackets & board games", assignedToMemberId: "m-3", isDone: false },
    ],
  },
  {
    id: "fn-4",
    title: "Aarav's School Science & Invention Fair",
    category: "gathering",
    date: "2026-11-18",
    time: "09:00 AM",
    location: "Greenwood High School Auditorium",
    description:
      "Model demonstration on solar irrigation pumps. Both parents and grandparents attending to cheer Chotu.",
    vibe: "Proud family cheer squad",
    invitationsCount: 4,
    rsvpConfirmed: 4,
    reminderSet: true,
    tasks: [
      { id: "t-11", title: "Dry run solar motor demo board", assignedToMemberId: "m-3", isDone: false },
      { id: "t-12", title: "Press school ceremonial uniform", assignedToMemberId: "m-4", isDone: false },
    ],
  },
]


export const createScheduleSlice: ImmerStateCreator<ScheduleSlice> = (set) => ({
  functions: [],

  addFunction: (fn) =>
    set((state) => {
      state.functions.unshift({ ...fn, id: `fn-${Date.now()}` })
    }),

  toggleFunctionTask: (functionId, taskId) =>
    set((state) => {
      const fn = state.functions.find((f) => f.id === functionId)
      if (fn) {
        const task = fn.tasks.find((t) => t.id === taskId)
        if (task) {
          task.isDone = !task.isDone
        }
      }
    }),

  removeFunction: (id) =>
    set((state) => {
      state.functions = state.functions.filter((f) => f.id !== id)
    }),

  upsertFunctions: (fns) => {
    let added = 0
    set((state) => {
      for (const fn of fns) {
        const idx = state.functions.findIndex((f) => f.id === fn.id)
        if (idx === -1) {
          state.functions.push(fn)
          added++
        } else {
          // Keep the family's own checklist on re-import.
          state.functions[idx] = { ...fn, tasks: state.functions[idx].tasks, reminderSet: state.functions[idx].reminderSet }
        }
      }
      state.functions.sort((a, b) => a.date.localeCompare(b.date))
    })
    return added
  },

  resetScheduleToClean: () =>
    set((state) => {
      state.functions = []
    }),
})
