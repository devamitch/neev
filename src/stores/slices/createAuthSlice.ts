/**
 * Authentication Slice
 * Backs Google Sign-In, Setu SSO, and Guest mode
 */

import { signInWithGoogleAccount, signOutOfGoogle } from "@/services/auth/googleSignIn"
import { setuSsoService, type SsoCallbackData } from "@/services/auth/setuSsoService"
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

  signOut: async () => {
    if (get().user?.provider === "google") await signOutOfGoogle()
    set((state) => {
      state.user = null
      state.displayName = ""
      state.isAuthenticated = false
      state.isAuthLoading = false
      state.authError = null
      state.pendingSsoState = null
    })
  },
})
