import type { ImmerStateCreator } from "../types"

export type FamilyRole = "elder" | "parent" | "youth" | "pet"

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
}

export interface HouseholdInfo {
  name: string
  motto: string
  city: string
  establishedYear: number
}

export interface FamilySlice {
  household: HouseholdInfo
  members: FamilyMember[]
  activeMemberId: string | null
  addMember: (member: Omit<FamilyMember, "id"> & { id?: string }) => string
  removeMember: (id: string) => void
  updateMember: (id: string, updates: Partial<FamilyMember>) => void
  setActiveMember: (id: string) => void
}

export const INITIAL_MEMBERS: FamilyMember[] = [
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
  },
  {
    id: "m-6",
    name: "Simba",
    nickname: "Sheru",
    relationship: "Golden Retriever Pup",
    role: "pet",
    avatarText: "🐾",
    avatarColor: "#DA7756",
    favoriteTreat: "Crunchy Peanut Butter Biscuits",
    superpower: "Morning tail wags that wake the whole house with joy",
    notes: "Family pet · Expert frisbee catcher, gentle guard, and puddle leaper.",
  },
]

export const createFamilySlice: ImmerStateCreator<FamilySlice> = (set) => ({
  household: {
    name: "Chakraborty Family Sanctuary",
    motto: "Ground in love, grow with laughter",
    city: "Bengaluru & Kolkata",
    establishedYear: 1978,
  },
  members: INITIAL_MEMBERS,
  activeMemberId: "m-3",

  addMember: (member) => {
    const id = member.id || `m-${Date.now()}`
    set((state) => {
      state.members.push({ ...member, id })
    })
    return id
  },

  removeMember: (id) =>
    set((state) => {
      state.members = state.members.filter((m) => m.id !== id)
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
})
