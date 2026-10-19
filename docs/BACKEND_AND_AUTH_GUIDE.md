# Centralized Backend & Auth — Guidance

**Status:** Recommendation, not yet wired to a live project. Written for BlinkQuest but the comparison and setup steps are the same for your other Expo/React Native apps (Setu, aura-mobile-template, thrivefold, …) if you want one backend shared across all of them.
**Scope right now:** authentication is the immediate need. Crash analytics is covered because the same provider (Firebase) answers both.

---

## 1. The decision: Firebase vs Supabase

|                                 | **Firebase**                                                                                                                                                 | **Supabase**                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Auth                            | Google/Apple/email/phone sign-in, native SDKs, works offline-first                                                                                           | Google/Apple/email/magic-link, REST-based, needs network for most calls |
| Database                        | Firestore (NoSQL, realtime)                                                                                                                                  | Postgres (SQL, realtime via replication)                                |
| Crash analytics                 | **Crashlytics** — already partially wired into this repo (`app.config.ts` loads it conditionally when `google-services.json` exists)                         | None built-in; you'd add Sentry separately                              |
| Android native setup            | `google-services.json` + SHA-1 fingerprint                                                                                                                   | Just an API URL + anon key (no native file)                             |
| Self-hostable                   | No (Google-owned)                                                                                                                                            | Yes (Supabase is open-source; can self-host later)                      |
| Cost at your scale              | Free tier covers auth + Crashlytics + small Firestore usage indefinitely                                                                                     | Free tier covers auth + 500MB Postgres; generous too                    |
| One backend for _all_ your apps | Yes — one Firebase project, multiple "apps" (Android/iOS/web) registered under it, shared Auth user pool optional per-project or shared via a single project | Yes — one Supabase project, same idea                                   |

**Recommendation: Firebase.** Two concrete reasons specific to this codebase, not a generic preference:

1. `app.config.ts` already has a conditional Crashlytics plugin block (`useFirebase` check) — it's inert today because no `google-services.json` exists, but the plumbing is there. Supabase would mean adding a second analytics vendor (Sentry) on top of whatever auth you pick anyway.
2. Firebase Auth's native SDKs (`@react-native-firebase/auth` + `@react-native-google-signin/google-signin`) work without a round-trip to your own server for the sign-in handshake, and integrate directly with Android's Credential Manager — better offline/early-boot behavior for an app that's otherwise fully offline-first, which matters for BlinkQuest specifically (AGENTS.md: no startup network request unless explicit).

If later you want Postgres, row-level security, or to self-host — Supabase is the better long-term call and this doc's structure (one project, `.env` keys, a thin `src/services/auth/` wrapper) ports over with the implementation swapped.

---

## 2. What "one centralized backend for all projects" looks like with Firebase

- **One Firebase project** (e.g. `amit-apps-prod`), with each app (BlinkQuest, Setu, …) registered as a separate **Android app** inside it (separate `applicationId`, separate `google-services.json` per app, same project).
- **Shared or separate Auth user pools:** Firebase Auth users belong to the _project_, not the individual app registration. If you want "sign in once, recognized everywhere," use the same project for every app. If you want each app's users to be fully separate, make a Firebase project per app instead. For BlinkQuest (wellness data, no social features) separate is arguably more private-by-default; your call.
- **Crashlytics** is per-app automatically (each app's crashes are tagged by its own `google-services.json`), no extra config needed once the project exists.

---

## 3. Turning on Google sign-in (the one thing I need from you)

The code is done: `src/services/auth/googleSignIn.ts` uses `@react-native-google-signin/google-signin` 16.1.5 (Google Play services, no Firebase required for sign-in). Until the Web client ID below is set, the Google button shows "Google sign-in isn't set up" instead of pretending.

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), in the project you want BlinkQuest's users in:

1. **OAuth consent screen**: app name BlinkQuest, your support email, scopes `email` and `profile`. Publish it (External, In production) before release.
2. **Create credentials → OAuth client ID → Android**, package `com.amit.neev`, SHA-1 of the **upload key** used by local release builds:
   `A8:5D:4D:F3:E6:56:7C:24:C4:6D:44:A3:F6:1B:77:D4:A5:A2:BA:37`
3. **A second Android client** with the **Play App Signing** SHA-1 (Play Console → BlinkQuest → Test and release → App integrity → App signing key certificate). Builds installed from Play are re-signed with that key, so without this client Google sign-in fails only in Play builds.
4. **Create credentials → OAuth client ID → Web application** (no redirect URIs needed). Copy its **Client ID**.
5. Give that Web client ID to the build as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`:
   - local builds: a `.env` file at the repo root (gitignored) with `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=…apps.googleusercontent.com`
   - EAS: `eas env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value … --environment production`

The Web client ID is public by design (it ships inside the app); the Android clients are what tie sign-in to your signing keys.

## 4. Setu sign-in

No credentials needed. BlinkQuest opens `setu://sso?app_id=com.amit.neev&callback_url=blinkquest://auth/callback&state=…`, Setu shows a consent screen and calls back. BlinkQuest only accepts a reply whose `state` matches the request it sent. Needs a Setu build that includes `src/app/(main)/sso.tsx` (Setu commit fe4d2f5 or later).

## 5. What's in this repo

- `src/services/auth/googleSignIn.ts`: Google SDK wrapper (configure, sign in, sign out).
- `src/services/auth/setuSsoService.ts`: Setu deep-link request/parse.
- `src/stores/slices/createAuthSlice.ts`: account state, persisted. No guest sign-in; an existing guest session from an older build keeps working until it signs out.
- `src/app/(auth)/sign-in.tsx`, `src/app/auth/callback.tsx`, guards in `src/app/_layout.tsx`: sign in → one-time intro → app.

Crash reporting (Crashlytics) is still the Firebase plan in §1–2; it needs `google-services.json`, which sign-in no longer does.

---

## 6. Open questions for you (not blockers, just decisions)

- **Shared user pool or per-app?** (§2) — affects whether BlinkQuest and Setu accounts are the same account.
- **Is sign-in mandatory to use BlinkQuest at all, or only for specific features** (e.g. syncing Eye Battery/history to the cloud later)? Right now everything is local-only and this doc assumes you want a login gate in front of the whole app, per your instruction — confirm that's still what you want, since it's a real product-contract change (AGENTS.md currently says "no login/account requirement").
- **Supabase instead, if you change your mind** — same six steps in §3 become: create a Supabase project, get the project URL + anon key, enable Google/Email providers in Supabase Auth settings, no SHA-1 needed for email but still needed for native Google sign-in. Tell me and I'll redo §5 against `@supabase/supabase-js` instead.
