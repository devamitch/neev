/**
 * Real Google Sign-In through Google Play services (no WebView, no fake users).
 *
 * Needs two OAuth clients in the Google Cloud project (see
 * docs/BACKEND_AND_AUTH_GUIDE.md): an Android client for com.amit.neev
 * with the signing SHA-1, and a Web client whose ID app.config.ts reads from
 * google-services.json so Google returns an ID token.
 */
import { auth as firebaseAuth } from "@/services/firebase/firebaseClient"
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin"
import Constants from "expo-constants"
import { Platform } from "react-native"

// Set by app.config.ts from google-services.json (or EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).
const WEB_CLIENT_ID =
  (Constants.expoConfig?.extra?.googleWebClientId as string | undefined) ??
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  ""

let configured = false

export const isGoogleConfigured = () => WEB_CLIENT_ID.length > 0

/**
 * All Google API scopes requested at sign-in.
 * NOTE: Requesting sensitive/restricted scopes (calendar, tasks, drive) at initial
 * sign-in causes Google Play Services to hang, block unverified apps, or fail with
 * Code 10 / 12500 when not pre-approved. Standard OpenID ("profile", "email")
 * provides reliable one-tap sign-in. Feature scopes are authorized incrementally
 * on-demand via getGoogleAccessToken().
 */
const GOOGLE_SIGN_IN_SCOPES = [
  "profile",
  "email",
  /* Commented out to prevent sign-in freeze/blocking on Android devices:
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/drive.file",
  */
]

function ensureConfigured() {
  if (configured) return
  if (Platform.OS === "web") {
    configured = true
    return
  }
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    scopes: GOOGLE_SIGN_IN_SCOPES,
    /* Commented out offlineAccess and forceCodeForRefreshToken to prevent hanging
     * and developer configuration mismatches when no backend code exchange exists:
    offlineAccess: true,
    forceCodeForRefreshToken: true,
    */
  })
  configured = true
}

/** Force reconfigure (e.g. after scope changes or sign-out). */
export function reconfigureGoogle() {
  configured = false
  ensureConfigured()
}

export type GoogleSignInResult =
  | {
      status: "success"
      idToken: string
      accessToken: string
      user: { id: string; email: string; name: string | null; photo: string | null }
    }
  | { status: "cancelled"; message?: string }
  | { status: "not_configured"; message?: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }

export async function signInWithGoogleAccount(): Promise<GoogleSignInResult> {
  // Web Platform Support: Use Firebase Web Google Sign-In Popup
  if (Platform.OS === "web") {
    try {
      const { signInWithPopup, GoogleAuthProvider } = await import("firebase/auth")
      const provider = new GoogleAuthProvider()
      const userCred = await signInWithPopup(firebaseAuth, provider)
      const credential = GoogleAuthProvider.credentialFromResult(userCred)
      const idToken = await userCred.user.getIdToken()
      return {
        status: "success",
        idToken,
        accessToken: credential?.accessToken || "",
        user: {
          id: userCred.user.uid,
          email: userCred.user.email || "",
          name: userCred.user.displayName,
          photo: userCred.user.photoURL,
        },
      }
    } catch (webErr: unknown) {
      console.warn("[GoogleSignIn] Web popup notice:", webErr)
      return {
        status: "error",
        message:
          webErr instanceof Error ? webErr.message : "Web Google sign-in could not be completed.",
      }
    }
  }

  if (!isGoogleConfigured()) {
    return {
      status: "not_configured",
      message: "Google Web Client ID is not configured in this build.",
    }
  }
  ensureConfigured()
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })

    /* Previous direct call without timeout:
    const response = await GoogleSignin.signIn()
    */
    // Race GoogleSignin.signIn() with a 45s safety timeout so the UI never stays stuck
    const signInPromise = GoogleSignin.signIn()
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Google sign-in timed out. Please try again.")), 45000),
    )
    const response = await Promise.race([signInPromise, timeoutPromise])

    if (!isSuccessResponse(response)) {
      return { status: "cancelled", message: "Google sign-in was dismissed or closed." }
    }
    const { idToken, user } = response.data
    if (!idToken) {
      return { status: "error", message: "Google didn't return an ID token for this account." }
    }

    // Safely retrieve access token with timeout and error fallback so it never blocks
    let accessToken = ""
    try {
      /* Previous direct getTokens call:
      const tokens = await GoogleSignin.getTokens()
      accessToken = tokens.accessToken
      */
      const tokensPromise = GoogleSignin.getTokens()
      const tokenTimeout = new Promise<{ accessToken?: string }>((resolve) =>
        setTimeout(() => resolve({ accessToken: "" }), 5000),
      )
      const tokens = await Promise.race([tokensPromise, tokenTimeout])
      accessToken = tokens.accessToken || ""
    } catch (tokenErr) {
      console.warn("[GoogleSignIn] getTokens notice (non-fatal):", tokenErr)
    }

    if (!accessToken) {
      console.warn("[GoogleSignIn] signIn succeeded but getTokens() returned no accessToken")
    }

    return {
      status: "success",
      idToken,
      accessToken: accessToken || "",
      user: { id: user.id, email: user.email, name: user.name, photo: user.photo },
    }
  } catch (err: unknown) {
    const errorObj = err as
      { code?: string | number; statusCode?: number; message?: string } | undefined
    const code = errorObj?.code ?? errorObj?.statusCode
    const rawMessage = errorObj?.message ?? (err instanceof Error ? err.message : String(err))

    if (code === statusCodes.SIGN_IN_CANCELLED || String(code) === "12501") {
      return {
        status: "cancelled",
        message:
          "Google sign-in dismissed. If Google closed automatically, ensure your email is added to Test Users in GCP.",
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
        message:
          "Network error connecting to Google Play Services. Please check your internet connection.",
      }
    }
    return {
      status: "error",
      message: rawMessage || "Google sign-in could not be completed.",
    }
  }
}

export async function signOutOfGoogle(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      const { signOut } = await import("firebase/auth")
      await signOut(firebaseAuth)
    } catch {
      /* ignore web signout errors */
    }
    return
  }
  if (!isGoogleConfigured()) return
  ensureConfigured()
  await GoogleSignin.signOut().catch(() => undefined)
}

/** Drops a rejected (expired/revoked) token so the next getTokens() call fetches a fresh one. */
export async function invalidateGoogleAccessToken(accessToken: string): Promise<void> {
  if (Platform.OS === "web" || !isGoogleConfigured()) return
  ensureConfigured()
  await GoogleSignin.clearCachedAccessToken(accessToken).catch(() => undefined)
}

/**
 * Google API scopes used by Neev features.
 * Incremental authorization is used on-demand when features are accessed.
 */
export const GOOGLE_FEATURE_SCOPES = {
  /** Full Google Calendar access (aliased for compatibility). */
  calendar: "https://www.googleapis.com/auth/calendar.events",
  /** Add family events to the user's Google Calendar. */
  calendarEvents: "https://www.googleapis.com/auth/calendar.events",
  /** Add chores/prep tasks to the user's Google Tasks. */
  tasks: "https://www.googleapis.com/auth/tasks",
  /** Export encrypted family vault backups to user's Google Drive (on-demand only). */
  driveFile: "https://www.googleapis.com/auth/drive.file",
  /** Read user contacts to invite and add family members. */
  contactsReadOnly: "https://www.googleapis.com/auth/contacts.readonly",
} as const

export type GoogleFeatureScope = (typeof GOOGLE_FEATURE_SCOPES)[keyof typeof GOOGLE_FEATURE_SCOPES]

export type GoogleAccessResult =
  | { status: "granted"; accessToken: string }
  | { status: "not_signed_in" | "declined" | "not_configured" | "needs_consent" }
  | { status: "error"; message: string }

/** Essential scopes for Neev optional integrations: Calendar + Meet and Tasks. Restricted contacts/drive excluded. */
export const ALL_GOOGLE_FEATURE_SCOPES: GoogleFeatureScope[] = [
  GOOGLE_FEATURE_SCOPES.calendarEvents,
  GOOGLE_FEATURE_SCOPES.tasks,
]

/**
 * An access token that carries `scopes`. Interactive calls prompt once for scopes not
 * yet granted ("declined" if the user says no); background calls never show UI and
 * return "needs_consent" instead.
 */
export async function getGoogleAccessToken(
  scopes: GoogleFeatureScope[],
  options: { interactive?: boolean } = {},
): Promise<GoogleAccessResult> {
  const interactive = options.interactive ?? true
  if (Platform.OS === "web" || !isGoogleConfigured()) return { status: "not_configured" }
  ensureConfigured()
  try {
    let user = GoogleSignin.getCurrentUser()
    if (!user && GoogleSignin.hasPreviousSignIn()) {
      const silent = await GoogleSignin.signInSilently()
      user = silent.type === "success" ? silent.data : null
    }
    if (!user) return { status: "not_signed_in" }

    const userScopes = user.scopes ?? []
    const missing = scopes.filter((scope) => !userScopes.includes(scope))
    if (missing.length > 0) {
      if (!interactive) return { status: "needs_consent" }
      const granted = await GoogleSignin.addScopes({ scopes: missing })
      const grantedUser =
        granted && "data" in granted && granted.data
          ? granted.data
          : (granted as unknown as typeof user | null)
      const grantedScopes = grantedUser?.scopes ?? []
      if (!grantedUser || missing.some((scope) => !grantedScopes.includes(scope))) {
        return { status: "declined" }
      }
    }
    const { accessToken } = await GoogleSignin.getTokens()
    return { status: "granted", accessToken }
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED)
      return { status: "declined" }
    return { status: "error", message: err instanceof Error ? err.message : "Google access failed" }
  }
}

/** Scopes from ALL_GOOGLE_FEATURE_SCOPES this account has already granted (no UI). */
export function getGrantedFeatureScopes(): GoogleFeatureScope[] {
  if (Platform.OS === "web" || !isGoogleConfigured()) return []
  ensureConfigured()
  const user = GoogleSignin.getCurrentUser()
  const userScopes = user?.scopes ?? []
  return user ? ALL_GOOGLE_FEATURE_SCOPES.filter((s) => userScopes.includes(s)) : []
}

/**
 * One consent screen for Calendar, Tasks and Drive, shown right after sign-in (and from
 * Settings). Kept separate from sign-in itself so declining never blocks signing in.
 */
export async function connectGoogleServices(): Promise<GoogleAccessResult> {
  return getGoogleAccessToken(ALL_GOOGLE_FEATURE_SCOPES, { interactive: true })
}
