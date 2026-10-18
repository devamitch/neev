import { type ConfigPlugin, withDangerousMod } from "expo/config-plugins"
import fs from "fs"
import path from "path"

/**
 * Raises the Gradle wrapper network timeout.
 */
export const withGradleTimeout: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const wrapperPropsPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "gradle/wrapper/gradle-wrapper.properties",
      )
      if (!fs.existsSync(wrapperPropsPath)) return modConfig

      let contents = fs.readFileSync(wrapperPropsPath, "utf8")

      const mirror = process.env.GRADLE_MIRROR
      if (mirror) {
        const prefix = mirror.replace(/\/?$/, "/").replace(/:/g, "\\:")
        contents = contents.replace(
          /distributionUrl=https\\:\/\/services\.gradle\.org\/distributions\//,
          `distributionUrl=${prefix}`,
        )
      }

      if (/^networkTimeout=\d+/m.test(contents)) {
        contents = contents.replace(/^networkTimeout=\d+/m, "networkTimeout=120000")
      } else {
        contents = `${contents.replace(/\s*$/, "")}\nnetworkTimeout=120000\n`
      }

      fs.writeFileSync(wrapperPropsPath, contents)
      return modConfig
    },
  ])

export default withGradleTimeout
