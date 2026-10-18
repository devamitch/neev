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

const envVersionCode = Number.parseInt(env.ANDROID_VERSION_CODE?.trim() ?? "", 10)
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
    },
  }

  // Chain local plugins
  const withReleaseSigning = releaseSigningModule.default ?? releaseSigningModule
  const withGradleTimeout = gradleTimeoutModule.default ?? gradleTimeoutModule

  let configured = typeof withReleaseSigning === "function" ? withReleaseSigning(merged) : merged
  configured = typeof withGradleTimeout === "function" ? withGradleTimeout(configured) : configured

  return configured
}
