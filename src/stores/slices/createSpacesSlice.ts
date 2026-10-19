import type { ImmerStateCreator } from "../types"

export type SpaceType = "personal" | "nuclear" | "family"

export interface SpaceTask {
  id: string
  title: string
  space: SpaceType
  category: "school" | "doctor" | "career" | "home" | "ritual"
  assignedTo: string
  dueDate: string
  time: string
  priority: "urgent" | "normal" | "low"
  isCompleted: boolean
  googleTaskId?: string
  reminderNudgeCount: number
  clusterType?: string
  estimatedMinutes?: number
  dependsOn?: string[]
  priorityScore?: number
}

export interface SpaceMeeting {
  id: string
  title: string
  space: SpaceType
  date: string
  time: string
  location: string
  meetLink?: string
  calendarSynced: boolean
  preparationNotes: string
}

export interface AiBriefing {
  id: string
  space: SpaceType
  title: string
  summary: string
  actionItems: string[]
  contextTag: "school_prep" | "doctor_visit" | "career_interview" | "family_event"
  timestamp: string
}

export interface SpacesSlice {
  currentSpace: SpaceType
  tasks: SpaceTask[]
  meetings: SpaceMeeting[]
  aiBriefings: AiBriefing[]
  setSpace: (space: SpaceType) => void
  addTask: (task: Omit<SpaceTask, "id" | "isCompleted" | "reminderNudgeCount">) => void
  toggleSpaceTask: (id: string) => void
  toggleTask: (arg1: string, arg2?: string) => void
  addMeeting: (meeting: Omit<SpaceMeeting, "id" | "calendarSynced">) => void
  dismissBriefing: (id: string) => void
  generateAiBriefing: (context: "school_prep" | "doctor_visit" | "career_interview" | "family_event") => void
}

export const INITIAL_TASKS: SpaceTask[] = [
  // Personal Space Tasks (Confidential)
  {
    id: "tsk-p1",
    title: "System Design Mock Interview Prep (Google & Stripe)",
    space: "personal",
    category: "career",
    assignedTo: "Amit",
    dueDate: "2026-10-21",
    time: "07:30 PM",
    priority: "urgent",
    isCompleted: false,
    reminderNudgeCount: 2,
  },
  {
    id: "tsk-p2",
    title: "Review Senior Staff Architect Portfolio & Case Studies",
    space: "personal",
    category: "career",
    assignedTo: "Amit",
    dueDate: "2026-10-23",
    time: "09:00 PM",
    priority: "normal",
    isCompleted: false,
    reminderNudgeCount: 1,
  },

  // Nuclear Space Tasks (Immediate Home & Kids)
  {
    id: "tsk-n1",
    title: "Aarav's Pediatrician Checkup & Flu Vaccine Documentation",
    space: "nuclear",
    category: "doctor",
    assignedTo: "Pooja & Amit",
    dueDate: "2026-10-22",
    time: "10:30 AM",
    priority: "urgent",
    isCompleted: false,
    reminderNudgeCount: 3,
  },
  {
    id: "tsk-n2",
    title: "Review Aarav's Science Project Demo & Uniform Pressing",
    space: "nuclear",
    category: "school",
    assignedTo: "Pooja",
    dueDate: "2026-10-24",
    time: "06:00 PM",
    priority: "urgent",
    isCompleted: false,
    reminderNudgeCount: 1,
  },

  // Family Sanctuary Tasks (Multigenerational)
  {
    id: "tsk-f1",
    title: "Arrange 51 Brass Diyas & Organic Ghee for Mandir",
    space: "family",
    category: "ritual",
    assignedTo: "Dadu & Amit",
    dueDate: "2026-11-09",
    time: "04:00 PM",
    priority: "normal",
    isCompleted: true,
    reminderNudgeCount: 0,
  },
  {
    id: "tsk-f2",
    title: "Simba's Afternoon Park Frisbee Session & Grooming",
    space: "family",
    category: "home",
    assignedTo: "Chotu",
    dueDate: "2026-10-20",
    time: "05:00 PM",
    priority: "normal",
    isCompleted: false,
    reminderNudgeCount: 1,
  },
]

export const INITIAL_MEETINGS: SpaceMeeting[] = [
  {
    id: "mtg-1",
    title: "Staff Engineering Architecture Interview (Round 3)",
    space: "personal",
    date: "2026-10-22",
    time: "05:30 PM",
    location: "Google Meet Remote",
    meetLink: "https://meet.google.com/nee-arch-call",
    calendarSynced: true,
    preparationNotes: "Focus on distributed consensus, SQLite local-first sync, and high QPS scaling.",
  },
  {
    id: "mtg-2",
    title: "Greenwood High Parent-Teacher Consultation",
    space: "nuclear",
    date: "2026-10-25",
    time: "11:00 AM",
    location: "Classroom 2B & Google Meet",
    meetLink: "https://meet.google.com/grn-wood-ptm",
    calendarSynced: true,
    preparationNotes: "Discuss Aarav's reading progress and solar science fair showcase.",
  },
  {
    id: "mtg-3",
    title: "Dida's 75th Birthday Extended Family Planning Call",
    space: "family",
    date: "2026-10-26",
    time: "08:00 PM",
    location: "Family Google Meet",
    meetLink: "https://meet.google.com/fam-dida-75th",
    calendarSynced: true,
    preparationNotes: "Coordinate Kolkata travel dates, guest lists, and sweet catering.",
  },
]

export const INITIAL_BRIEFINGS: AiBriefing[] = [
  {
    id: "ab-1",
    space: "personal",
    title: "Career Switch & Interview Strategy",
    summary:
      "Your Google & Stripe staff interviews are coming up in 3 days. Focus on system architecture patterns and trade-offs.",
    actionItems: [
      "Review high-availability distributed locks and write-ahead logs.",
      "Complete mock architectural drawing for offline-first messaging.",
      "Ensure quiet room and headset checked 15 mins prior.",
    ],
    contextTag: "career_interview",
    timestamp: "Today, 08:30 AM",
  },
  {
    id: "ab-2",
    space: "nuclear",
    title: "Pediatrician Visit & School Checklist",
    summary:
      "Dr. Sen's clinic appointment is scheduled for Thursday. Aarav's immunization booklet is filed in the Vault.",
    actionItems: [
      "Bring immunization records booklet from Vault.",
      "Prepare list of seasonal allergy questions for Dr. Sen.",
      "Double-check science fair materials checklist with Pooja.",
    ],
    contextTag: "doctor_visit",
    timestamp: "Today, 09:00 AM",
  },
  {
    id: "ab-3",
    space: "family",
    title: "Ancestral Heritage & Festive Countdown",
    summary:
      "Deepavali is 21 days away. All brass puja vessels and sweet pre-orders are on track.",
    actionItems: [
      "Confirm flower garland delivery time with local florist.",
      "Practice evening flute piece with Aarav.",
      "Sync Dida's payesh ingredients checklist with the local market.",
    ],
    contextTag: "family_event",
    timestamp: "Yesterday, 07:45 PM",
  },
]

export const createSpacesSlice: ImmerStateCreator<SpacesSlice> = (set) => ({
  currentSpace: "nuclear",
  tasks: INITIAL_TASKS,
  meetings: INITIAL_MEETINGS,
  aiBriefings: INITIAL_BRIEFINGS,

  setSpace: (space) =>
    set((state) => {
      state.currentSpace = space
    }),

  addTask: (task) =>
    set((state) => {
      state.tasks.unshift({
        ...task,
        id: `tsk-${Date.now()}`,
        isCompleted: false,
        reminderNudgeCount: 0,
      })
    }),

  toggleSpaceTask: (id) =>
    set((state) => {
      const task = state.tasks.find((t) => t.id === id)
      if (task) {
        task.isCompleted = !task.isCompleted
      }
    }),

  toggleTask: (arg1: string, arg2?: string) =>
    set((state) => {
      if (arg2) {
        // Toggle function task in schedule slice
        const fn = state.functions.find((f) => f.id === arg1)
        if (fn) {
          const task = fn.tasks.find((t) => t.id === arg2)
          if (task) {
            task.isDone = !task.isDone
          }
        }
      } else {
        // Toggle space task in spaces slice
        const task = state.tasks.find((t) => t.id === arg1)
        if (task) {
          task.isCompleted = !task.isCompleted
        }
      }
    }),

  addMeeting: (meeting) =>
    set((state) => {
      state.meetings.unshift({
        ...meeting,
        id: `mtg-${Date.now()}`,
        calendarSynced: true,
      })
    }),

  dismissBriefing: (id) =>
    set((state) => {
      state.aiBriefings = state.aiBriefings.filter((b) => b.id !== id)
    }),

  generateAiBriefing: (context) =>
    set((state) => {
      const space = state.currentSpace
      let title = "AI Preparation Plan"
      let summary = "Tailored daily briefing for your upcoming milestone."
      let actionItems: string[] = []

      if (context === "career_interview") {
        title = "Career Switch & Technical Interview Briefing"
        summary = "Comprehensive preparation roadmap for senior engineering and leadership loops."
        actionItems = [
          "Rehearse STAR format leadership stories and conflict resolution cases.",
          "Review distributed caching, database indexing, and partition schemes.",
          "Draft 3 thoughtful questions regarding team roadmaps and engineering culture.",
        ]
      } else if (context === "doctor_visit") {
        title = "Doctor Consultation & Wellness Briefing"
        summary = "Checklist for upcoming clinic appointment, health vitals history, and physician queries."
        actionItems = [
          "Check recent symptom timeline and sleep logs.",
          "Prepare medication list and previous prescription records.",
          "Confirm appointment timing and traffic transit buffer.",
        ]
      } else if (context === "school_prep") {
        title = "Child School & Academics Preparation Plan"
        summary = "Actionable checklist for school curriculum, project submissions, and parent-teacher collaboration."
        actionItems = [
          "Check homework diary and science fair presentation notes.",
          "Ensure healthy lunchbox and morning transit readiness.",
          "Confirm parent-teacher conference schedule on Google Calendar.",
        ]
      } else {
        title = "Family Celebration & Festive Blueprint"
        summary = "Detailed coordination plan for festive rituals, extended guests, and dinner preparations."
        actionItems = [
          "Confirm guest invitations RSVP list and dietary preferences.",
          "Delegate sweets and dessert orders among family members.",
          "Set up music playlist and festive photography retrospective.",
        ]
      }

      state.aiBriefings.unshift({
        id: `ab-${Date.now()}`,
        space,
        title,
        summary,
        actionItems,
        contextTag: context,
        timestamp: "Just now",
      })
    }),
})
