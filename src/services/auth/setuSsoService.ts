import { Linking } from "react-native"

const SETU_PACKAGE = "com.amit.setu"
const SETU_PLAY_STORE_MARKET = `market://details?id=${SETU_PACKAGE}`
const SETU_PLAY_STORE_WEB = `https://play.google.com/store/apps/details?id=${SETU_PACKAGE}`
const SETU_SCHEME = "setu://"

export interface SsoCallbackData {
  status: "authorized" | "cancelled" | "error"
  userId?: string
  displayName?: string
  avatar?: string
  token?: string
  state?: string
  errorMessage?: string
}

export const setuSsoService = {
  /**
   * Checks whether the Setu app is installed on this device.
   * Relies on the <queries> declaration in AndroidManifest.xml for Android 11+.
   */
  async isSetuInstalled(): Promise<boolean> {
    try {
      return await Linking.canOpenURL(SETU_SCHEME)
    } catch {
      return false
    }
  },

  /**
   * Opens the Google Play Store to install Setu.
   */
  async openSetuDownload(): Promise<void> {
    try {
      const canMarket = await Linking.canOpenURL(SETU_PLAY_STORE_MARKET).catch(() => false)
      if (canMarket) {
        await Linking.openURL(SETU_PLAY_STORE_MARKET)
      } else {
        await Linking.openURL(SETU_PLAY_STORE_WEB)
      }
    } catch {
      await Linking.openURL(SETU_PLAY_STORE_WEB).catch(() => undefined)
    }
  },

  /**
   * Initiates Setu Single Sign-On flow.
   * If Setu is installed, switches to Setu with deep link.
   * If not installed, reports 'not_installed'.
   */
  async launchSetuSso(): Promise<{
    ok: boolean
    status: "launched" | "not_installed" | "failed"
    state?: string
  }> {
    const installed = await this.isSetuInstalled()
    if (!installed) {
      return { ok: false, status: "not_installed" }
    }

    const state = `neev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const callbackUrl = "neev://auth/callback"

    const params = new URLSearchParams({
      app_id: "com.amit.neev",
      app_name: "Neev",
      callback_url: callbackUrl,
      state,
      scopes: "identity,p2p",
    })

    const ssoUrl = `setu://sso?${params.toString()}`

    try {
      await Linking.openURL(ssoUrl)
      return { ok: true, status: "launched", state }
    } catch {
      return { ok: false, status: "failed" }
    }
  },

  /**
   * Parses the redirect URL received from Setu SSO.
   */
  parseCallbackUrl(url: string): SsoCallbackData {
    try {
      // Normalise scheme for URL parsing
      const normalized = url.replace(/^(neev|blinkquest):\/\//, "http://neev.local/")
      const parsed = new URL(normalized)
      const params = parsed.searchParams

      const status = (params.get("status") as SsoCallbackData["status"]) || "error"
      return {
        status,
        userId: params.get("user_id") || undefined,
        displayName: params.get("display_name") || undefined,
        avatar: params.get("avatar") || undefined,
        token: params.get("token") || undefined,
        state: params.get("state") || undefined,
        errorMessage: params.get("error_message") || undefined,
      }
    } catch {
      return { status: "error", errorMessage: "Malformed callback URL" }
    }
  },
}
