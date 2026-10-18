#!/usr/bin/env node
const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "..")
console.log("Running BlinkQuest project doctor checks...")

let errors = 0

// 1. package.json check
const pkgPath = path.join(root, "package.json")
if (!fs.existsSync(pkgPath)) {
  console.error("❌ package.json is missing")
  errors++
} else {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
  console.log(`✔ package.json valid (v${pkg.version})`)
}

// 2. google-services.json check
const gsPath = path.join(root, "google-services.json")
if (!fs.existsSync(gsPath)) {
  console.warn("⚠ google-services.json is not present locally (optional for local dev, required for Firebase Crashlytics in production)")
} else {
  console.log("✔ google-services.json is present")
}

// 3. Keystore check
const keystorePath = path.join(root, ".setu", "keystores", "setu-upload.keystore")
if (!fs.existsSync(keystorePath)) {
  console.warn("⚠ Release upload keystore missing at .setu/keystores/setu-upload.keystore")
} else {
  console.log("✔ Release upload keystore present")
}

// 4. Native module check
const nativeModuleConfig = path.join(root, "modules", "blinkquest-vision", "expo-module.config.json")
if (!fs.existsSync(nativeModuleConfig)) {
  console.error("❌ modules/blinkquest-vision/expo-module.config.json is missing")
  errors++
} else {
  console.log("✔ modules/blinkquest-vision configuration present")
}

// 5. Assets check
const appIcon = path.join(root, "assets", "images", "app-icon-all.png")
if (!fs.existsSync(appIcon)) {
  console.error("❌ assets/images/app-icon-all.png is missing")
  errors++
} else {
  console.log("✔ Core app icon present")
}

if (errors > 0) {
  console.error(`BlinkQuest doctor finished with ${errors} error(s).`)
  process.exit(1)
} else {
  console.log("✔ BlinkQuest project doctor checks passed cleanly.")
  process.exit(0)
}
