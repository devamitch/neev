/**
 * Authentication Slice
 * Backs Google Sign-In, Setu SSO, and Guest mode
 */

import {
  GoogleAuthProvider,
  signInWithCredential,
  signInAnonymously,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth as firebaseAuth, db as firestoreDb } from "@/services/firebase/firebaseClient"
import { connectGoogleServices, signInWithGoogleAccount, signOutOfGoogle } from "@/services/auth/googleSignIn"
import { setuSsoService, type SsoCallbackData } from "@/services/auth/setuSsoService"
import {
  unifiedVaultSosService,
  type UnifiedVaultResult,
} from "@/services/auth/unifiedVaultSosService"
import {
  ecosystemSyncService,
  encodeEcosystemPayload,
  decodeEcosystemPayload,
} from "@/services/ecosystem/ecosystemSyncService"
import { supabase } from "@/services/supabase/supabaseClient"
import { Platform } from "react-native"
import type { ImmerStateCreator } from "../types"

export type AuthProvider = "google" | "setu" | "apple" | "guest"

export interface AuthUser {
  uid: string
  displayName?: string
  email?: string
  photoUrl?: string
  provider: AuthProvider
  token?: string
  /** Google API access token — carries Calendar, Tasks, Drive scopes. */
  googleAccessToken?: string
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
  signInWithUnifiedVaultSos: (preferredTargetId?: string) => Promise<UnifiedVaultResult>
  signInAsGuest: () => Promise<void>
  handleSetuSsoCallback: (data: SsoCallbackData) => boolean
  checkSetuInstalled: () => Promise<boolean>
  openSetuDownload: () => Promise<void>
  signOut: () => Promise<void>
  clearAuthError: () => void
  /** Returns the stored Google API access token, or null if unavailable/expired. */
  getGoogleAccessToken: () => string | null
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

  getGoogleAccessToken: () => {
    return get().user?.googleAccessToken ?? null
  },

  signInWithGoogle: async () => {
    set((state) => {
      state.isAuthLoading = true
      state.authError = null
    })

    try {
      const result = await signInWithGoogleAccount()
      if (result.status !== "success") {
        const errorMsg =
          ("message" in result && result.message) ||
          (result.status === "cancelled"
            ? "Google sign-in was dismissed or closed."
            : result.status === "not_configured"
              ? "Google Web Client ID is not configured."
              : "Google sign-in could not be completed.")
        set((state) => {
          state.isAuthLoading = false
          state.authError = errorMsg
        })
        return result.status
      }
      const { user } = result
      const name = user.name || user.email.split("@")[0]
      let resolvedUid = `google_${user.id}`

      // 1. Firebase Auth + Firestore User Profile (safeguarded with timeout)
      if (result.idToken) {
        try {
          const syncFirebase = async () => {
            const credential = GoogleAuthProvider.credential(result.idToken)
            const fbCred = await signInWithCredential(firebaseAuth, credential)
            if (fbCred?.user) {
              resolvedUid = fbCred.user.uid
              console.log("[Auth] Firebase authenticated user:", fbCred.user.uid, fbCred.user.email)
              const userDoc = doc(firestoreDb, "users", fbCred.user.uid)
              await setDoc(
                userDoc,
                {
                  uid: fbCred.user.uid,
                  displayName: fbCred.user.displayName || name,
                  email: fbCred.user.email,
                  photoURL: fbCred.user.photoURL || user.photo || null,
                  provider: "google",
                  lastLoginAt: serverTimestamp(),
                  createdAt: serverTimestamp(),
                },
                { merge: true },
              )
            }
          }
          /* Previous direct call without timeout could hang on slow network:
          const credential = GoogleAuthProvider.credential(result.idToken)
          const fbCred = await signInWithCredential(firebaseAuth, credential)
          ...
          */
          await Promise.race([
            syncFirebase(),
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ])
        } catch (fbErr: unknown) {
          console.warn("[Auth] Firebase Google auth notice:", fbErr)
        }
      }

      // 2. Supabase Auth + Postgres Profiles Table (safeguarded with timeout)
      if (result.idToken) {
        try {
          const syncSupabase = async () => {
            const { data: supaData, error: supaErr } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: result.idToken,
            })
            if (supaErr) {
              console.warn("[Auth] Supabase signInWithIdToken notice:", supaErr.message)
            } else if (supaData?.user) {
              console.log("[Auth] Supabase session established:", supaData.user.id)
              const { error: upsertErr } = await supabase.from("profiles").upsert({
                id: supaData.user.id,
                display_name: name,
                locale: "en",
                time_zone: "Asia/Kolkata",
                onboarding_state: "complete",
                updated_at: new Date().toISOString(),
              })
              if (upsertErr) {
                console.warn("[Auth] Supabase profile upsert notice:", upsertErr.message)
              }
            }
          }
          /* Previous direct call without timeout could hang on slow network:
          const { data: supaData, error: supaErr } = await supabase.auth.signInWithIdToken(...)
          */
          await Promise.race([
            syncSupabase(),
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ])
        } catch (sbErr: unknown) {
          console.warn("[Auth] Supabase auth notice:", sbErr)
        }
      }

      set((state) => {
        state.user = {
          uid: resolvedUid,
          displayName: name,
          email: user.email,
          photoUrl: user.photo ?? undefined,
          avatar: user.photo ?? undefined,
          provider: "google",
          token: result.idToken,
          googleAccessToken: result.accessToken || undefined,
          signedInAt: Date.now(),
        }
        state.displayName = name
        state.isAuthenticated = true
        state.isAuthLoading = false
      })

      // Google Sign-In is complete with necessary identity scopes (profile, email).
      // Any optional external integrations can be connected on-demand later from Settings.
      if (Platform.OS !== "web") {
        try {
          const { useCloudSyncStore } = require("@/services/sync/cloudSyncEngine")
          useCloudSyncStore.setState({ isGoogleConnected: true })
        } catch { /* cloud sync store may not be available yet */ }
      }

      return "success"
    } catch (unhandledErr: unknown) {
      console.error("[Auth] signInWithGoogle unexpected error:", unhandledErr)
      const message = unhandledErr instanceof Error ? unhandledErr.message : "Unexpected error during Google sign-in."
      set((state) => {
        state.isAuthLoading = false
        state.authError = message
      })
      return "error"
    } finally {
      // Guaranteed safety: ensure isAuthLoading is never left stuck in true
      if (get().isAuthLoading) {
        set((state) => {
          state.isAuthLoading = false
        })
      }
    }
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
      const localData = ecosystemSyncService.buildLocalEcosystemPayload()
      const encodedPayload = encodeEcosystemPayload(localData)

      const isSetuInstalled = await setuSsoService.isSetuInstalled()
      if (isSetuInstalled) {
        const result = await setuSsoService.launchSetuSso(encodedPayload)
        if (result.status === "launched") {
          set((state) => {
            state.pendingSsoState = result.state || null
          })
          return { ok: true, status: "launched" }
        }
      }

      // If Setu is not installed, seamlessly route through Unified Vault SOS peer mesh!
      const sosResult = await unifiedVaultSosService.launchUnifiedVaultSos()
      if (sosResult.status === "launched") {
        set((state) => {
          state.pendingSsoState = sosResult.state || null
        })
        return { ok: true, status: "launched" }
      }

      if (sosResult.status === "cloud_synced") {
        set((state) => {
          state.isAuthLoading = false
          state.authError = null
        })
        return { ok: true, status: "launched" }
      }

      set((state) => {
        state.isAuthLoading = false
        state.authError = "No ecosystem app or cloud vault available"
      })
      return { ok: false, status: "not_installed" }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect ecosystem account"
      set((state) => {
        state.authError = msg
        state.isAuthLoading = false
      })
      return { ok: false, status: "failed", message: msg }
    }
  },

  signInWithUnifiedVaultSos: async (preferredTargetId?: string) => {
    set((state) => {
      state.isAuthLoading = true
      state.authError = null
    })

    try {
      const result = await unifiedVaultSosService.launchUnifiedVaultSos(preferredTargetId)
      if (result.status === "launched") {
        set((state) => {
          state.pendingSsoState = result.state || null
        })
      } else if (result.status === "cloud_synced") {
        set((state) => {
          state.isAuthLoading = false
          state.authError = null
        })
      } else {
        set((state) => {
          state.isAuthLoading = false
          state.authError = "No ecosystem peer app found to connect"
        })
      }
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unified Vault SOS connection failed"
      set((state) => {
        state.isAuthLoading = false
        state.authError = msg
      })
      return { ok: false, status: "failed" }
    }
  },

  handleSetuSsoCallback: (data: SsoCallbackData): boolean => {
    // Only accept a reply to a request this app actually sent.
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
      // 1. If full ecosystem data payload received, hydrate local store non-destructively
      const rawPayload = data.payload || data.ecosystemData
      if (rawPayload) {
        const decoded = decodeEcosystemPayload(rawPayload)
        if (decoded) {
          ecosystemSyncService.hydrateStoreFromEcosystem(decoded)
        }
      }

      const user: AuthUser = {
        uid: data.userId || `setu_${Date.now()}`,
        displayName: data.displayName || "Sanctuary Explorer",
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
        state.authError = "Unified Vault authorization was cancelled"
        state.pendingSsoState = null
      })
      return false
    }

    set((state) => {
      state.isAuthLoading = false
      state.authError = data.errorMessage || "Unified Vault authentication failed"
      state.pendingSsoState = null
    })
    return false
  },

  signInAsGuest: async () => {
    let guestUid = `guest_${Date.now()}`
    const displayName = "Guest"

    // 1. Firebase Anonymous Auth + Firestore document
    try {
      const fbCred = await signInAnonymously(firebaseAuth)
      if (fbCred?.user) {
        guestUid = fbCred.user.uid
        await updateProfile(fbCred.user, { displayName }).catch(() => {})
        await setDoc(
          doc(firestoreDb, "users", fbCred.user.uid),
          {
            uid: fbCred.user.uid,
            displayName,
            isAnonymous: true,
            provider: "guest",
            lastLoginAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true },
        )
      }
    } catch (fbErr) {
      console.warn("[AuthSlice] Firebase anonymous sign-in note:", fbErr)
    }

    // 2. Supabase Anonymous Auth + Profiles Table
    try {
      const { data: supaData, error: supaErr } = await supabase.auth.signInAnonymously()
      if (!supaErr && supaData?.user) {
        const { error: guestUpsertErr } = await supabase.from("profiles").upsert({
          id: supaData.user.id,
          display_name: displayName,
          locale: "en",
          time_zone: "Asia/Kolkata",
          onboarding_state: "in_progress",
          updated_at: new Date().toISOString(),
        })
        if (guestUpsertErr) {
          console.warn("[AuthSlice] Supabase guest profile upsert notice:", guestUpsertErr.message)
        }
      }
    } catch (sbErr) {
      console.warn("[AuthSlice] Supabase anonymous auth note:", sbErr)
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
    })
  },

  signOut: async () => {
    // Stop cloud sync first so clearing local state below is never pushed as deletions.
    const { stopCloudSync } = require("@/services/sync/cloudSyncEngine") as typeof import("@/services/sync/cloudSyncEngine")
    stopCloudSync()
    const { resetGoogleSyncState } = require("@/services/google/googleSyncService") as typeof import("@/services/google/googleSyncService")
    resetGoogleSyncState()
    await firebaseSignOut(firebaseAuth).catch(() => {})
    await supabase.auth.signOut().catch(() => {})
    if (get().user?.provider === "google") await signOutOfGoogle().catch(() => {})
    set((state) => {
      state.user = null
      state.displayName = ""
      state.isAuthenticated = false
      state.isAuthLoading = false
      state.authError = null
      state.pendingSsoState = null

      // Account isolation: the next account must never see this one's family data.
      state.activeRealmId = ""
    })
    const root = get()
    root.resetFamilyToClean()
    root.resetNetworkToClean()
    root.resetSpacesToClean()
    root.resetScheduleToClean()
    root.resetKnowledgeToClean()
    root.resetRoutineToClean()
    root.resetIntentionsToClean()
    root.resetMindfulNotificationsToClean()
  },
})

