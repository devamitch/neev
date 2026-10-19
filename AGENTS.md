# BlinkQuest — Agent Contract (short form)

Single source of truth for every agent and contributor. Tool files (`CLAUDE.md`, `ANTIGRAVITY.md`, `.github/copilot-instructions.md`) only point here.
Last revision: 2026-10-16. Keep this file short: update the **Current state** and **Map** sections instead of adding prose.

## 1. Product in one paragraph

BlinkQuest (`com.amit.neev`) is an Android-first, offline, light-mode-only eye-wellness app: one on-device scanner (VisionCamera + MediaPipe Face Landmarker in Kotlin) measures blinks, closure and iris-based distance; short games and guided breaks build eye habits (blinking, eye movement, focus, relax) with XP/levels/streaks; history and metrics stay in local SQLite. It is **not a medical device** — no diagnosis, no clinical claims.

## 2. Hard rules

1. **pnpm only.** Never npm/npx/yarn/bun. Don't upgrade packages casually; `pnpm install --frozen-lockfile` must keep `react-native-worklets` at the lockfile version (a stray 0.13 copy caused the "installTurboModule … expected 0 arguments" crash).
2. **Truthful status.** Never claim a build, device result, metric or store claim you didn't observe. Label unverified work `IMPLEMENTED_NOT_VERIFIED`.
3. **One canonical scanner** (`ScannerHost` + `scan-session.ts`). Never add a second camera/scanner route.
4. **No fake data**: no `Math.random()` metrics, placeholder results, inert buttons or mock store screenshots presented as the app.
5. **Privacy**: frames/landmarks stay in memory; only minimal summaries in SQLite; no accounts, trackers or startup network calls. Camera only after an explicit user action.
6. **Design**: light mode only; bone/ivory surfaces, charcoal text, terracotta `#DA7756` accent, dock `#262624`, muted `#A8A29E`. No emoji in UI. Reuse shared components (below) — no one-off headers/buttons.
7. **No Google-branded search, no Maps/location.**
8. **Commits**: feature-wise commits are authorized by the owner (`type(scope): summary`, ≤72 chars, types fix|feat|chore|refactor|docs|test|perf|style). **Never push** or open PRs unless asked.
9. **No new test files** during the MVP pass; keep existing tests green.
10. Don't edit `android/` or `ios/` (generated, gitignored) — change `app.json` / `app.config.ts` / `plugins/` instead. Never print secrets (`credentials.json`, keystores).

## 3. Map — where things live

| Area                    | Path                                                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes (Expo Router)    | `src/app/` — `(app)/(tabs)` Home/Activities/Discover/You, `(app)/(games)` 8 activities + `activity/[id]`, `(app)/(profile)` settings/metrics/history/patterns/…, `onboarding.tsx`                                                                             |
| Screen wrapper + header | `src/components/ui/ScreenContainer.tsx` (pass `header={<AppHeader …/>}` → collapsing large-title header + dock auto-hide), `AppHeader.tsx`, `CollapsingHeader.tsx`                                                                                            |
| Bottom dock             | `src/components/navigation/CustomTabBar.tsx` (raised-cosine hump traced from `BlinkQuest_BottomTab_Bar.png`), `useScrollAwareDock.ts`                                                                                                                         |
| Brand                   | `src/components/brand/` — `bqGeometry.ts`, static `BlinkQuestLogoIcon`, animated mascot `AnimatedBlinkQuestLogoIcon` (Scan orb)                                                                                                                               |
| Scanner                 | `src/components/scanner/ScannerHost.tsx`, `src/core/session/scan-session.ts`, overlay `src/components/vision/EyeLandmarkOverlay.tsx`, topology `src/core/vision/landmark-topology.ts`, engine `observation-engine.ts` (obs-1.4.0), gaze `core/vision/gaze.ts` |
| Native vision           | `modules/blinkquest-vision/android/.../BlinkQuestVisionRuntime.kt` (MediaPipe Face Landmarker v2, bundled model)                                                                                                                                              |
| Games                   | `src/core/games/` — catalogue `activities.ts` (each has `focus` + `benefit`), `progression.ts` (XP/levels/streak/achievements/recommendations), `useActivityRecorder.ts`, `useRecentScan.ts`; reward card `src/components/games/RunReward.tsx`                |
| Eye Battery & alerts    | `src/core/metrics/eye-battery.ts`, `eye-alerts.ts` (banner + expo-notifications), UI `src/components/vision/EyeBatteryCard.tsx`, `EyeAlertBanner.tsx`                                                                                                         |
| Eye games               | `src/components/games/EyeGame.tsx` (Orb Pop, Direction Trail, Slider Chase, Orbit Follow), `src/core/games/eye-routines.tsx` (Focus Garden, Near/Far) — camera runs in hidden `background` presentation                                                       |
| Data                    | `src/services/db/` (expo-sqlite schema v3: sessions, 1 Hz samples, rollups, game results)                                                                                                                                                                     |
| Theme                   | `src/theme/useTheme.ts`, `setuColors.ts`, `setuTypography.ts`                                                                                                                                                                                                 |
| Config                  | `app.json` (static), `app.config.ts` (env/version/plugins), `plugins/` (PiP, release signing), `eas.json`                                                                                                                                                     |
| Store assets            | `assets/playstore/` (listing in `docs/playstore/PLAY_STORE_LISTING_PACKAGE.md`; real device screenshots in `assets/playstore/screenshots/device/`)                                                                                                            |
| SETU Beta Camera Lab    | `src/features/beta-camera-lab/` (React Native UI), `modules/setu-beta-scanner/` (MediaPipe Expo module), `docs/BETA_CAMERA_LAB_TRACEABILITY_MATRIX.md` (feature inventory)                                                                                    |

## 4. Docs (read only what the task needs)

- `docs/AGENT_TASK_TRACKER.md` — the one tracker; update it when you finish work.
- `blinkquest_productions.md` — full product contract (long; consult sections by heading).
- `docs/BLINKQUEST_MASTER_ENCYCLOPEDIA.md` — architecture/research compendium.
- `docs/PUBLISHING_INPUTS_AND_CREDENTIALS.md`, `docs/playstore/` — release & store.
- `.agents/skills/*/SKILL.md` — vision pipeline, eye metrics, game engine, Android verification, privacy.

## 5. Current state (2026-10-17)

Verified on a Moto G71 (release): onboarding (intro slider → eye demo → privacy → scanner opens), Home with Eye Battery, drawer, scanner opens with Skia landmark overlay (0.4 % janky frames), eye games start the camera in the background and refuse to start without a face.

SETU Beta Camera Lab: Infrastructure complete with MediaPipe Expo module (`setu-beta-scanner`), TypeScript contracts, Kotlin algorithm analyzers, React Native UI screens, and feature registry. 40+ features tracked in traceability matrix with implementation status. MediaPipe model files (.task) must be downloaded separately (see `android/src/main/assets/MODELS_README.md`). Current implementation uses mock results for demonstration; real frame processing pipeline requires model assets and VisionCamera frame wiring.

Open: counted-blink trial for obs-1.4.0 (TASK-DEV-02), gaze-direction tuning with a real player, alert notifications on device, PiP while using another app, remaining store screenshots. Another local session keeps installing DEBUGGABLE BlinkQuest builds; the Setu app has been seen loading BlinkQuest's Metro bundle (source of the TurboModule argument errors).

## 6. Commands

```sh
pnpm run compile          # tsc
pnpm run lint:check       # eslint (no --fix)
pnpm test                 # jest
CI=1 pnpm dlx expo-doctor # config health
cd android && ./gradlew :app:assembleRelease   # local release APK (run alone; parallel Gradle builds corrupt outputs)
adb -s <serial> install -r android/app/build/outputs/apk/release/app-release.apk
```

## 7. Definition of done

Behaviour works on the device, checks pass, tracker updated, honest summary of what was and wasn't verified.
