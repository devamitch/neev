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
  | { status: "cancelled"; message?: string }
  | { status: "not_configured"; message?: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }

export async function signInWithGoogleAccount(): Promise<GoogleSignInResult> {
  if (!isGoogleConfigured()) {
    return {
      status: "not_configured",
      message: "Google Web Client ID is not configured in this build.",
    }
  }
  ensureConfigured()
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const response = await GoogleSignin.signIn()
    if (!isSuccessResponse(response)) {
      return { status: "cancelled", message: "Google sign-in was dismissed or closed." }
    }
    const { idToken, user } = response.data
    if (!idToken) {
      return { status: "error", message: "Google didn't return an ID token for this account." }
    }
    return {
      status: "success",
      idToken,
      user: { id: user.id, email: user.email, name: user.name, photo: user.photo },
    }
  } catch (err: unknown) {
    const errorObj = err as { code?: string | number; statusCode?: number; message?: string } | undefined
    const code = errorObj?.code ?? errorObj?.statusCode
    const rawMessage = errorObj?.message ?? (err instanceof Error ? err.message : String(err))

    if (code === statusCodes.SIGN_IN_CANCELLED || String(code) === "12501") {
      return {
        status: "cancelled",
        message: "Google sign-in dismissed. If Google closed automatically, ensure your email is added to Test Users in GCP.",
      }
    }
    if (code === statusCodes.IN_PROGRESS || code === "ASYNC_OP_IN_PROGRESS") {
      return { status: "cancelled", message: "A Google sign-in prompt is already active." }
    }
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return {
        status: "unavailable",
        message: "Google Play Services is not available or needs to be updated on this device.",
      }
    }
    if (String(code) === "10" || code === 10 || String(rawMessage).includes("DEVELOPER_ERROR")) {
      return {
        status: "error",
        message:
          "Google Sign-In configuration mismatch (Code 10: DEVELOPER_ERROR). Keystore SHA-1 must match Firebase / GCP Console.",
      }
    }
    if (String(code) === "12500") {
      return {
        status: "error",
        message:
          "Google Sign-In internal error (Code 12500). Verify OAuth consent screen and authorized test users in GCP Console.",
      }
    }
    if (String(code) === "7") {
      return {
        status: "error",
        message: "Network error connecting to Google Play Services. Please check your internet connection.",
      }
    }
    return {
      status: "error",
      message: rawMessage || "Google sign-in could not be completed.",
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
      if (!granted || !granted.data || missing.some((scope) => !granted.data.scopes.includes(scope))) {
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

