import type { ImmerStateCreator } from "../types"

export type FamilyRole = "elder" | "parent" | "youth" | "child" | "tutor" | "caregiver" | "pet"

export interface FamilyMember {
  id: string
  name: string
  nickname?: string
  relationship: string
  role: FamilyRole
  avatarText: string
  avatarColor: string
  phone?: string
  dateOfBirth?: string
  favoriteTreat?: string
  superpower?: string
  notes?: string

  // Supervised Child fields (managed by parents/elders)
  guardianIds?: string[]
  schoolGrade?: string
  learningGoals?: string[]

  // Home Tutor fields (classes & homework)
  subjectsTaught?: string[]
  tutoringSchedule?: string
  assignedChildIds?: string[]

  // Nanny / Caregiver fields (daily care & routines)
  caregiverType?: "nanny" | "elder_care" | "home_nurse"
  careSchedule?: string
  caredMemberIds?: string[]
}

export interface HouseholdInfo {
  id?: string
  name: string
  motto: string
  city: string
  establishedYear: number
}

/**
 * Underaged kids (under 18) hold Read-Only permissions across sanctuary settings,
 * member invites, administrative deletions and financial spaces until they come of age.
 */
export function isMemberUnderage(member?: FamilyMember | null): boolean {
  if (!member) return false
  if (member.role === "youth" || member.role === "child") return true
  if (member.dateOfBirth) {
    const birthYear = new Date(member.dateOfBirth).getFullYear()
    const currentYear = new Date().getFullYear()
    if (currentYear - birthYear < 18) return true
  }
  const rel = (member.relationship || "").toLowerCase()
  if (rel.includes("child") || rel.includes("son") || rel.includes("daughter")) {
    return true
  }
  return false
}

export function getMemberPermissions(member?: FamilyMember | null) {
  if (!member) {
    return { canEdit: false, canDelete: false, canInvite: false, canManageSettings: false, isReadOnly: true }
  }
  const underage = isMemberUnderage(member)
  const isTutorOrCaregiver = member.role === "tutor" || member.role === "caregiver"
  return {
    canEdit: !underage && !isTutorOrCaregiver,
    canDelete: !underage && (member.role === "parent" || member.role === "elder"),
    canInvite: !underage && (member.role === "parent" || member.role === "elder"),
    canManageSettings: !underage && member.role === "parent",
    isReadOnly: underage || isTutorOrCaregiver,
    isSupervisedChild: member.role === "child" || member.role === "youth",
    isTutorOrCaregiver,
  }
}

export interface FamilySlice {
  household: HouseholdInfo
  members: FamilyMember[]
  activeMemberId: string | null
  addMember: (member: Omit<FamilyMember, "id"> & { id?: string }) => string
  removeMember: (id: string) => void
  updateMember: (id: string, updates: Partial<FamilyMember>) => void
  setActiveMember: (id: string) => void
  setHousehold: (household: Partial<HouseholdInfo>) => void
  resetFamilyToClean: () => void
  loadDemoFamily: () => void
}

export const DEMO_MEMBERS: FamilyMember[] = [
  {
    id: "m-1",
    name: "Shyamal Chakraborty",
    nickname: "Dadu",
    relationship: "Grandfather",
    role: "elder",
    avatarText: "SC",
    avatarColor: "#D97706",
    phone: "+91 98300 12345",
    favoriteTreat: "Warm Ginger Chai & Marie Biscuits",
    superpower: "Epic bedtime storyteller & evening chess champion",
    notes: "Tells the best folktales of old Kolkata and Shantiniketan.",
  },
  {
    id: "m-2",
    name: "Aparna Chakraborty",
    nickname: "Dida",
    relationship: "Grandmother",
    role: "elder",
    avatarText: "AC",
    avatarColor: "#C85A32",
    phone: "+91 98300 23456",
    favoriteTreat: "Warm Mishti Doi & Roasted Makhana",
    superpower: "Keeper of heirloom family recipes & master gardener",
    notes: "Can identify any garden bird call and makes heavenly kachoris.",
  },
  {
    id: "m-3",
    name: "Amit Chakraborty",
    nickname: "Papa",
    relationship: "Father",
    role: "parent",
    avatarText: "AC",
    avatarColor: "#0D9488",
    phone: "+91 98300 34567",
    favoriteTreat: "Sunday Morning Masala Dosa",
    superpower: "Weekend outing organizer & car pool pilot",
    notes: "Chief coordinator of family weekend projects and picnics.",
  },
  {
    id: "m-4",
    name: "Pooja Chakraborty",
    nickname: "Maa",
    relationship: "Mother",
    role: "parent",
    avatarText: "PC",
    avatarColor: "#B45309",
    phone: "+91 98300 45678",
    favoriteTreat: "Filter Coffee & Dark Chocolate",
    superpower: "Balcony garden designer & festive decor curator",
    notes: "Directs family celebrations, art projects, and holiday plans.",
  },
  {
    id: "m-5",
    name: "Aarav Chakraborty",
    nickname: "Chotu",
    relationship: "Son",
    role: "youth",
    avatarText: "AC",
    avatarColor: "#2563EB",
    dateOfBirth: "2018-05-14",
    favoriteTreat: "Mango Kulfi & Homemade French Toast",
    superpower: "Lego architecture mastermind & Simba's best friend",
    notes: "Class 4 · Passionate about astronomy, cricket, and science projects.",
    schoolGrade: "Class 4",
    guardianIds: ["m-3", "m-4"],
    learningGoals: ["Astronomy Explorer", "Cricket Practice", "Mathematics Mastery"],
  },
  {
    id: "m-6",
    name: "Simba",
    nickname: "Sheru",
    relationship: "Golden Retriever Pup",
    role: "pet",
    avatarText: "S",
    avatarColor: "#DA7756",
    favoriteTreat: "Crunchy Peanut Butter Biscuits",
    superpower: "Morning tail wags that wake the whole house with joy",
    notes: "Family pet · Expert frisbee catcher, gentle guard, and puddle leaper.",
  },
]

export const INITIAL_MEMBERS = DEMO_MEMBERS

export const DEMO_HOUSEHOLD: HouseholdInfo = {
  name: "Chakraborty Family Sanctuary",
  motto: "Ground in love, grow with laughter",
  city: "Bengaluru & Kolkata",
  establishedYear: 1978,
}

export const createFamilySlice: ImmerStateCreator<FamilySlice> = (set) => ({
  // Production accounts and fresh installs start with clean, empty family state
  household: {
    name: "",
    motto: "",
    city: "",
    establishedYear: new Date().getFullYear(),
  },
  members: [],
  activeMemberId: null,

  addMember: (member) => {
    const id = member.id || `m-${Date.now()}`
    set((state) => {
      state.members.push({ ...member, id })
      if (!state.activeMemberId) {
        state.activeMemberId = id
      }
    })
    return id
  },

  removeMember: (id) =>
    set((state) => {
      state.members = state.members.filter((m) => m.id !== id)
      if (state.activeMemberId === id) {
        state.activeMemberId = state.members[0]?.id || null
      }
    }),

  updateMember: (id, updates) =>
    set((state) => {
      const idx = state.members.findIndex((m) => m.id === id)
      if (idx !== -1) {
        state.members[idx] = { ...state.members[idx], ...updates }
      }
    }),

  setActiveMember: (id) =>
    set((state) => {
      state.activeMemberId = id
    }),

  setHousehold: (household) =>
    set((state) => {
      state.household = { ...state.household, ...household }
    }),

  resetFamilyToClean: () =>
    set((state) => {
      state.household = {
        name: "",
        motto: "",
        city: "",
        establishedYear: new Date().getFullYear(),
      }
      state.members = []
      state.activeMemberId = null
    }),

  loadDemoFamily: () =>
    set((state) => {
      state.household = DEMO_HOUSEHOLD
      state.members = DEMO_MEMBERS
      state.activeMemberId = "m-3"
    }),
})
