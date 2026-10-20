import type { ConfigContext, ExpoConfig } from "expo/config"
import fs from "fs"
import path from "path"

import "tsx/cjs"

import * as releaseSigningModule from "./plugins/withLocalReleaseSigning"
import * as gradleTimeoutModule from "./plugins/withGradleTimeout"

const projectRoot = __dirname
const env = process.env

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(projectRoot, "package.json"), "utf8"),
) as { version?: string; dependencies?: Record<string, string> }
const appVersion = packageJson.version || "1.0.0"

/** Web OAuth client (type 3) for com.amit.neev — Google only returns an ID token when it is set. */
function readGoogleWebClientId(): string {
  if (env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) return env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  try {
    const services = JSON.parse(
      fs.readFileSync(path.resolve(projectRoot, "google-services.json"), "utf8"),
    ) as {
      client?: {
        client_info?: { android_client_info?: { package_name?: string } }
        oauth_client?: { client_id: string; client_type: number }[]
      }[]
    }
    const app = services.client?.find(
      (c) => c.client_info?.android_client_info?.package_name === "com.amit.neev",
    )
    return app?.oauth_client?.find((o) => o.client_type === 3)?.client_id ?? ""
  } catch {
    return ""
  }
}

const envVersionCode =Number.parseInt(env.ANDROID_VERSION_CODE?.trim() ?? "", 10)
const versionCode = Number.isFinite(envVersionCode) && envVersionCode > 0 ? envVersionCode : 1

export default ({ config }: ConfigContext): ExpoConfig => {
  const merged: ExpoConfig = {
    ...config,
    name: "Neev",
    slug: "neev",
    scheme: "neev",
    version: appVersion,
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    android: {
      ...config.android,
      package: "com.amit.neev",
      versionCode,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: "com.amit.neev",
      buildNumber: String(versionCode),
    },
    extra: {
      ...config.extra,
      appName: "Neev",
      appTagline: "Family Functions Schedulers & Shared Knowledge Sanctuary",
      supportEmail: "support@neev.app",
      googleWebClientId: readGoogleWebClientId(),
    },
  }

  // Chain local plugins
  const withReleaseSigning = releaseSigningModule.default ?? releaseSigningModule
  const withGradleTimeout = gradleTimeoutModule.default ?? gradleTimeoutModule

  let configured = typeof withReleaseSigning === "function" ? withReleaseSigning(merged) : merged
  configured = typeof withGradleTimeout === "function" ? withGradleTimeout(configured) : configured

  return configured
}
