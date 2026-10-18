import { withAppBuildGradle, type ConfigPlugin } from "expo/config-plugins"

const MARKER = "// @blinkquest-local-release-signing"

const RELEASE_SIGNING = `
        ${MARKER}
        release {
            // Local builds sign with the upload keystore described in the
            // gitignored credentials.json (same file EAS uses for
            // credentialsSource: "local"). Without it, release falls back to the
            // debug keystore. EAS remote-credential builds inject their own signing.
            def credentialsFile = rootProject.file("../credentials.json")
            if (credentialsFile.exists()) {
                def creds = new groovy.json.JsonSlurper().parseText(credentialsFile.text).android.keystore
                storeFile rootProject.file("../\${creds.keystorePath}")
                storePassword creds.keystorePassword
                keyAlias creds.keyAlias
                keyPassword creds.keyPassword
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`

/**
 * Makes local release signing survive `expo prebuild --clean`. Previously this
 * was a hand edit to android/app/build.gradle, which a clean prebuild (and every
 * EAS build) regenerates. No secrets are written: values are read from
 * credentials.json at Gradle configuration time.
 */
const withLocalReleaseSigning: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") return config
    let contents = config.modResults.contents
    if (contents.includes(MARKER)) return config

    // Add a release signing config right after the template's debug one.
    const debugSigning = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/
    if (!debugSigning.test(contents)) {
      throw new Error(
        "withLocalReleaseSigning: signingConfigs.debug block not found in app/build.gradle",
      )
    }
    contents = contents.replace(debugSigning, `$1${RELEASE_SIGNING}`)

    // Point the release build type at it (the template uses the debug config).
    contents = contents.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig signingConfigs.release",
    )

    config.modResults.contents = contents
    return config
  })

export default withLocalReleaseSigning
