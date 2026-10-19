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
