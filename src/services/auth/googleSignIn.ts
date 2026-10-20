/**
 * Real Google Sign-In through Google Play services (no WebView, no fake users).
 *
 * Needs two OAuth clients in the Google Cloud project (see
 * docs/BACKEND_AND_AUTH_GUIDE.md): an Android client for com.amit.neev
 * with the signing SHA-1, and a Web client whose ID app.config.ts reads from
 * google-services.json so Google returns an ID token.
 */
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin"
import Constants from "expo-constants"

// Set by app.config.ts from google-services.json (or EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).
const WEB_CLIENT_ID =
  (Constants.expoConfig?.extra?.googleWebClientId as string | undefined) ??
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  ""

let configured = false

export const isGoogleConfigured = () => WEB_CLIENT_ID.length > 0

function ensureConfigured() {
  if (configured) return
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, scopes: ["profile", "email"] })
  configured = true
}

export type GoogleSignInResult =
  | {
      status: "success"
      idToken: string
      user: { id: string; email: string; name: string | null; photo: string | null }
    }
  | { status: "cancelled" }
  | { status: "not_configured" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }

export async function signInWithGoogleAccount(): Promise<GoogleSignInResult> {
  if (!isGoogleConfigured()) return { status: "not_configured" }
  ensureConfigured()
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const response = await GoogleSignin.signIn()
    if (!isSuccessResponse(response)) return { status: "cancelled" }
    const { idToken, user } = response.data
    if (!idToken) return { status: "error", message: "Google didn't return an ID token" }
    return {
      status: "success",
      idToken,
      user: { id: user.id, email: user.email, name: user.name, photo: user.photo },
    }
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) return { status: "cancelled" }
      if (err.code === statusCodes.IN_PROGRESS) return { status: "cancelled" }
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { status: "unavailable", message: "Google Play services isn't available" }
      }
    }
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Google sign-in failed",
    }
  }
}

export async function signOutOfGoogle(): Promise<void> {
  if (!isGoogleConfigured()) return
  ensureConfigured()
  await GoogleSignin.signOut().catch(() => undefined)
}

/**
 * Extra Google permissions, asked for one feature at a time (incremental
 * authorization) — never bundled into sign-in. Google shows its own consent screen
 * naming exactly what each one allows. Gmail is never requested (product policy).
 */
export const GOOGLE_FEATURE_SCOPES = {
  /** Add family events to the user's Google Calendar (and create Meet links on them). */
  calendarEvents: "https://www.googleapis.com/auth/calendar.events",
  /** Add chores/prep tasks to the user's Google Tasks. */
  tasks: "https://www.googleapis.com/auth/tasks",
} as const

export type GoogleFeatureScope = (typeof GOOGLE_FEATURE_SCOPES)[keyof typeof GOOGLE_FEATURE_SCOPES]

export type GoogleAccessResult =
  | { status: "granted"; accessToken: string }
  | { status: "not_signed_in" | "declined" | "not_configured" }
  | { status: "error"; message: string }

/**
 * An access token that carries `scopes`. Prompts the user only for scopes they
 * haven't granted yet; returns "declined" if they say no.
 */
export async function getGoogleAccessToken(scopes: GoogleFeatureScope[]): Promise<GoogleAccessResult> {
  if (!isGoogleConfigured()) return { status: "not_configured" }
  ensureConfigured()
  try {
    let user = GoogleSignin.getCurrentUser()
    if (!user && GoogleSignin.hasPreviousSignIn()) {
      const silent = await GoogleSignin.signInSilently()
      user = silent.type === "success" ? silent.data : null
    }
    if (!user) return { status: "not_signed_in" }

    const missing = scopes.filter((scope) => !user.scopes.includes(scope))
    if (missing.length > 0) {
      const granted = await GoogleSignin.addScopes({ scopes: missing })
      if (!granted || missing.some((scope) => !granted.data.scopes.includes(scope))) {
        return { status: "declined" }
      }
    }
    const { accessToken } = await GoogleSignin.getTokens()
    return { status: "granted", accessToken }
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) return { status: "declined" }
    return { status: "error", message: err instanceof Error ? err.message : "Google access failed" }
  }
}

