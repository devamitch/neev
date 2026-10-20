/**
 * Authentication Slice
 * Backs Google Sign-In, Setu SSO, and Guest mode
 */

import { signInWithGoogleAccount, signOutOfGoogle } from "@/services/auth/googleSignIn"
import { setuSsoService, type SsoCallbackData } from "@/services/auth/setuSsoService"
import { supabase } from "@/services/supabase/supabaseClient"
import type { ImmerStateCreator } from "../types"

export type AuthProvider = "google" | "setu" | "apple" | "guest"

export interface AuthUser {
  uid: string
  displayName?: string
  email?: string
  photoUrl?: string
  provider: AuthProvider
  token?: string
  avatar?: string
  signedInAt: number
}

export type GoogleSignInStatus = "success" | "cancelled" | "not_configured" | "unavailable" | "error"

export type SetuSignInResult = {
  ok: boolean
  status: "launched" | "not_installed" | "failed"
  message?: string
}

export interface AuthSlice {
  user: AuthUser | null
  isAuthenticated: boolean
  isAuthLoading: boolean
  authError: string | null
  pendingSsoState: string | null

  signInWithGoogle: () => Promise<GoogleSignInStatus>
  signInWithSetu: () => Promise<SetuSignInResult>
  signInAsGuest: () => Promise<void>
  signInAsDemoUser: () => Promise<void>
  handleSetuSsoCallback: (data: SsoCallbackData) => boolean
  checkSetuInstalled: () => Promise<boolean>
  openSetuDownload: () => Promise<void>
  signOut: () => Promise<void>
  clearAuthError: () => void
}

export const createAuthSlice: ImmerStateCreator<AuthSlice> = (set, get) => ({
  user: null,
  isAuthenticated: false,
  isAuthLoading: false,
  authError: null,
  pendingSsoState: null,

  clearAuthError: () =>
    set((state) => {
      state.authError = null
    }),

  signInWithGoogle: async () => {
    set((state) => {
      state.isAuthLoading = true
      state.authError = null
    })
    const result = await signInWithGoogleAccount()
    if (result.status !== "success") {
      set((state) => {
        state.isAuthLoading = false
        state.authError =
          result.status === "error" || result.status === "unavailable" ? result.message : null
      })
      return result.status
    }
    const { user } = result
    const name = user.name || user.email.split("@")[0]
    set((state) => {
      state.user = {
        uid: `google_${user.id}`,
        displayName: name,
        email: user.email,
        photoUrl: user.photo ?? undefined,
        avatar: user.photo ?? undefined,
        provider: "google",
        token: result.idToken,
        signedInAt: Date.now(),
      }
      state.displayName = name
      state.isAuthenticated = true
      state.isAuthLoading = false
    })
    return "success"
  },

  checkSetuInstalled: async () => {
    return await setuSsoService.isSetuInstalled()
  },

  openSetuDownload: async () => {
    await setuSsoService.openSetuDownload()
  },

  signInWithSetu: async () => {
    set((state) => {
      state.isAuthLoading = true
      state.authError = null
    })

    try {
      const result = await setuSsoService.launchSetuSso()
      if (result.status === "not_installed") {
        set((state) => {
          state.isAuthLoading = false
          state.authError = "Setu app is not installed on this device"
        })
        return { ok: false, status: "not_installed" }
      }

      if (result.status === "launched") {
        set((state) => {
          state.pendingSsoState = result.state || null
        })
        return { ok: true, status: "launched" }
      }

      set((state) => {
        state.isAuthLoading = false
        state.authError = "Failed to launch Setu for authentication"
      })
      return { ok: false, status: "failed" }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect Setu account"
      set((state) => {
        state.authError = msg
        state.isAuthLoading = false
      })
      return { ok: false, status: "failed", message: msg }
    }
  },

  handleSetuSsoCallback: (data: SsoCallbackData): boolean => {
    // Only accept a reply to a request this app actually sent. Without this any
    // app or web page could open the callback link and sign the user in as an
    // identity of its choosing.
    const expected = get().pendingSsoState
    if (data.status === "authorized" && (!expected || data.state !== expected || !data.userId)) {
      set((state) => {
        state.isAuthLoading = false
        state.authError = "That sign-in reply didn't match a request from this app"
        state.pendingSsoState = null
      })
      return false
    }

    if (data.status === "authorized") {
      const user: AuthUser = {
        uid: data.userId || `setu_${Date.now()}`,
        displayName: data.displayName || "Setu Explorer",
        provider: "setu",
        token: data.token,
        avatar: data.avatar,
        photoUrl: data.avatar,
        signedInAt: Date.now(),
      }

      set((state) => {
        state.user = user
        if (data.displayName) {
          state.displayName = data.displayName
        }
        state.isAuthenticated = true
        state.isAuthLoading = false
        state.authError = null
        state.pendingSsoState = null
      })
      return true
    }

    if (data.status === "cancelled") {
      set((state) => {
        state.isAuthLoading = false
        state.authError = "Setu authorization was cancelled"
        state.pendingSsoState = null
      })
      return false
    }

    set((state) => {
      state.isAuthLoading = false
      state.authError = data.errorMessage || "Setu authentication failed"
      state.pendingSsoState = null
    })
    return false
  },

  signInAsGuest: async () => {
    const guestUid = `guest_${Date.now()}`
    const displayName = "Guest Explorer"

    try {
      await supabase.from("profiles").upsert({
        id: guestUid,
        display_name: displayName,
        role: "guest",
        updated_at: new Date().toISOString(),
      })
    } catch (e) {
      console.warn("[AuthSlice] Supabase guest sync note:", e)
    }

    set((state) => {
      state.user = {
        uid: guestUid,
        displayName,
        provider: "guest",
        signedInAt: Date.now(),
      }
      state.displayName = displayName
      state.isAuthenticated = true
      state.isAuthLoading = false
      state.authError = null

      // Clean guest isolation: start with clean personal sanctuary, zero fake relatives
      state.household = {
        name: "My Family Sanctuary",
        motto: "Roots in reverence, wings in harmony",
        city: "",
        establishedYear: new Date().getFullYear(),
      }
      state.members = []
      state.activeMemberId = null
      state.realms = []
      state.activeRealmId = ""
      state.clusters = []
      state.kinshipEdges = []
      state.bridges = []
      state.invitations = []
    })
  },

  signInAsDemoUser: async () => {
    const demoUid = "demo_amit_guardian"
    const displayName = "Amit Sharma (Demo Guardian)"
    const email = "amit.sharma.demo@neev.sanctuary"

    try {
      await supabase.from("profiles").upsert({
        id: demoUid,
        display_name: displayName,
        email,
        role: "guardian",
        updated_at: new Date().toISOString(),
      })
    } catch (e) {
      console.warn("[AuthSlice] Supabase demo user sync note:", e)
    }

    set((state) => {
      state.user = {
        uid: demoUid,
        displayName,
        email,
        provider: "guest",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
        signedInAt: Date.now(),
      }
      state.displayName = displayName
      state.isAuthenticated = true
      state.isAuthLoading = false
      state.authError = null

      // Ensure demo family realm is established if not present
      const existingRealms = state.realms || []
      const demoRealmId = "realm_sharma_heritage"
      if (!existingRealms.some((r) => r.id === demoRealmId)) {
        state.realms.push({
          id: demoRealmId,
          name: "Sharma Sanctuary Realm",
          motto: "Tradition, Wisdom & Clarity Across Generations",
          establishedYear: 1994,
          city: "Bengaluru",
          ownerId: demoUid,
          isPrimary: true,
        })
        state.activeRealmId = demoRealmId
      }

      // Ensure demo clusters exist
      const existingClusters = state.clusters || []
      if (existingClusters.length === 0) {
        state.clusters = [
          {
            id: "cluster_core",
            realmId: demoRealmId,
            name: "Household Core",
            type: "nuclear",
            description: "Daily meals, tasks, and home logistics",
            icon: "home",
            memberIds: [demoUid, "demo_priya", "demo_aarav"],
            color: "#6B8E23",
          },
          {
            id: "cluster_grandparents",
            realmId: demoRealmId,
            name: "Grandparents Sanctuary Circle",
            type: "extended",
            description: "Medication schedules, evening walks, doctor consultations",
            icon: "heart",
            memberIds: [demoUid, "demo_dadaji", "demo_dadiji"],
            color: "#D97706",
          },
          {
            id: "cluster_kids",
            realmId: demoRealmId,
            name: "Children's Growth & Learning",
            type: "care_circle",
            description: "School projects, exams, tennis practices",
            icon: "school",
            memberIds: [demoUid, "demo_priya", "demo_aarav"],
            color: "#2563EB",
          },
        ]
      }

      // Ensure kinship edges exist
      const existingEdges = state.kinshipEdges || []
      if (existingEdges.length === 0) {
        state.kinshipEdges = [
          {
            id: "edge_amit_priya",
            realmId: demoRealmId,
            sourceMemberId: demoUid,
            targetMemberId: "demo_priya",
            relation: "spouse",
            label: "Partner in Sanctuary Care",
          },
          {
            id: "edge_amit_aarav",
            realmId: demoRealmId,
            sourceMemberId: demoUid,
            targetMemberId: "demo_aarav",
            relation: "child",
            label: "Son (10th Grade)",
          },
          {
            id: "edge_amit_dadaji",
            realmId: demoRealmId,
            sourceMemberId: demoUid,
            targetMemberId: "demo_dadaji",
            relation: "parent",
            label: "Father (Retired Civil Engineer)",
          },
        ]
      }

      // Ensure bilateral bridge exists
      const existingBridges = state.bridges || []
      if (existingBridges.length === 0) {
        state.bridges = [
          {
            id: "bridge_jaipur_heritage",
            fromRealmId: demoRealmId,
            targetRealmName: "Sharma Family (Jaipur Branch)",
            purpose: "Joint Diwali Puja & Annual Family Gathering",
            sharedCategories: ["functions", "rituals"],
            status: "active",
            connectedAt: new Date().toISOString(),
          },
        ]
      }
    })
  },

  signOut: async () => {
    if (get().user?.provider === "google") await signOutOfGoogle()
    set((state) => {
      state.user = null
      state.displayName = ""
      state.isAuthenticated = false
      state.isAuthLoading = false
      state.authError = null
      state.pendingSsoState = null

      // Account & Family isolation: reset family state to clean on sign-out
      state.household = {
        name: "",
        motto: "",
        city: "",
        establishedYear: new Date().getFullYear(),
      }
      state.members = []
      state.activeMemberId = null
      state.realms = []
      state.activeRealmId = ""
      state.clusters = []
      state.kinshipEdges = []
      state.bridges = []
      state.invitations = []
      state.tasks = []
      state.functions = []
      state.entries = []
    })
  },
})

