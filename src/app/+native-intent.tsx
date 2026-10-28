/**
 * Rewrites incoming system links before Expo Router resolves them.
 *
 * The earlier AnvayKosh handoff links (`unified-vault`, `sso`) carried profile data in the URL and
 * are no longer accepted: any app or web page could send one. They open the start screen, and
 * their query string is dropped unread. `auth/callback` also goes to the start screen; the root
 * layout still checks it against a request this app sent (none are sent while Setu is disabled).
 */
const RETIRED_ECOSYSTEM_PATHS = /^\/?(unified-vault|auth\/callback|sso)(\/|\?|$)/i

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    // app://unified-vault puts the first segment where a host would be; https links do not.
    const afterScheme = path.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    const afterHost = afterScheme.replace(/^[^/?]*/, "")
    if ([path, afterScheme, afterHost].some((p) => RETIRED_ECOSYSTEM_PATHS.test(p))) return "/"
    return path
  } catch {
    return "/"
  }
}
