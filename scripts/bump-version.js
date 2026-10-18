#!/usr/bin/env node
const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "..")
const pkgJsonPath = path.join(root, "package.json")
const configTsPath = path.join(root, "src", "constants", "config.ts")

const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"))

const arg = process.argv[2] || "patch"

const currentVersion = pkgJson.version || "1.0.0"

let [major, minor, patch] = currentVersion.split(".").map((n) => parseInt(n, 10) || 0)

let nextVersion
if (arg === "patch") {
  nextVersion = `${major}.${minor}.${patch + 1}`
} else if (arg === "minor") {
  nextVersion = `${major}.${minor + 1}.0`
} else if (arg === "major") {
  nextVersion = `${major + 1}.0.0`
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  nextVersion = arg
} else {
  console.error(`Unknown bump type or version format: "${arg}". Use "patch", "minor", "major", or "X.Y.Z".`)
  process.exit(1)
}

pkgJson.version = nextVersion
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n")

if (fs.existsSync(configTsPath)) {
  let configContent = fs.readFileSync(configTsPath, "utf8")
  configContent = configContent.replace(
    /VERSION:\s*["'][^"']+["']/,
    `VERSION: "${nextVersion}"`,
  )
  fs.writeFileSync(configTsPath, configContent)
}

console.log(`Version bumped: ${currentVersion} -> ${nextVersion}`)
