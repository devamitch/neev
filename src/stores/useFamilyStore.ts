import { create } from "zustand"

export type FamilyRole = "elder" | "parent" | "youth" | "guardian"

export interface FamilyMember {
  id: string
  name: string
  relationship: string
  role: FamilyRole
  avatarText: string
  avatarColor: string
  phone?: string
  bloodGroup?: string
  dateOfBirth?: string
  notes?: string
}

export interface HouseholdInfo {
  name: string
  motto: string
  city: string
  establishedYear: number
}

interface FamilyState {
  household: HouseholdInfo
  members: FamilyMember[]
  activeMemberId: string | null
  addMember: (member: Omit<FamilyMember, "id">) => void
  removeMember: (id: string) => void
  updateMember: (id: string, updates: Partial<FamilyMember>) => void
  setActiveMember: (id: string) => void
}

const INITIAL_MEMBERS: FamilyMember[] = [
  {
    id: "m-1",
    name: "Shyamal Chakraborty",
    relationship: "Grandfather (Dadu)",
    role: "elder",
    avatarText: "SC",
    avatarColor: "#D97706",
    bloodGroup: "O+",
    phone: "+91 98300 12345",
    notes: "Requires morning blood pressure check at 8:00 AM.",
  },
  {
    id: "m-2",
    name: "Aparna Chakraborty",
    relationship: "Grandmother (Dida)",
    role: "elder",
    avatarText: "AC",
    avatarColor: "#C85A32",
    bloodGroup: "B+",
    phone: "+91 98300 23456",
    notes: "Master keeper of ancestral recipes & ayurvedic remedies.",
  },
  {
    id: "m-3",
    name: "Amit Chakraborty",
    relationship: "Father (Papa)",
    role: "parent",
    avatarText: "AC",
    avatarColor: "#0D9488",
    bloodGroup: "A+",
    phone: "+91 98300 34567",
    notes: "Primary household organizer & school transport coordinator.",
  },
  {
    id: "m-4",
    name: "Pooja Chakraborty",
    relationship: "Mother (Maa)",
    role: "parent",
    avatarText: "PC",
    avatarColor: "#B45309",
    bloodGroup: "O+",
    phone: "+91 98300 45678",
    notes: "Healthcare & education director of the sanctuary.",
  },
  {
    id: "m-5",
    name: "Aarav Chakraborty",
    relationship: "Son (Chotu)",
    role: "youth",
    avatarText: "AC",
    avatarColor: "#2563EB",
    bloodGroup: "O+",
    dateOfBirth: "2018-05-14",
    notes: "Class 2 · Loves cricket and evening storytelling with Dadu.",
  },
]

export const useFamilyStore = create<FamilyState>((set) => ({
  household: {
    name: "Chakraborty Family Sanctuary",
    motto: "Ground in wisdom, grow with dignity",
    city: "Bengaluru & Kolkata",
    establishedYear: 1978,
  },
  members: INITIAL_MEMBERS,
  activeMemberId: "m-3",
  addMember: (member) =>
    set((state) => ({
      members: [...state.members, { ...member, id: `m-${Date.now()}` }],
    })),
  removeMember: (id) =>
    set((state) => ({
      members: state.members.filter((m) => m.id !== id),
    })),
  updateMember: (id, updates) =>
    set((state) => ({
      members: state.members.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  setActiveMember: (id) => set({ activeMemberId: id }),
}))
