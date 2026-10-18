# Antigravity Instructions — BlinkQuest

Read `AGENTS.md` first; it is the contract. This file adds how Antigravity must work here. When the two disagree, `AGENTS.md` wins.

## Your job

Make features **actually work on the phone**, end to end, at the quality of the eye scanner. Not scaffolds, not mocks, not "infrastructure complete". If something can't be made real yet, it must say so on screen, not fake it.

Current priority: the **SETU Beta Camera Lab** (`src/features/beta-camera-lab/`, `src/app/(app)/beta-lab/`, `modules/setu-beta-scanner/`). Follow `.agents/skills/blinkquest-beta-lab/SKILL.md` step by step. It lists the exact files, the order of work, and which features to build, mark experimental or cut. Bring every lab feature up to the eye scanner's standard below.

## The reference: the eye scanner

Before building or fixing any camera feature, read these and copy their patterns. Do not invent a different architecture.

| Concern | Reference file |
| --- | --- |
| Session state, start/pause/stop, PiP, summaries | `src/core/session/scan-session.ts` |
| Camera, layout modes (full / floating / background / pip), chrome | `src/components/scanner/ScannerHost.tsx` |
| Landmark overlay (Skia, projection must match the Camera's `resizeMode`) | `src/components/vision/EyeLandmarkOverlay.tsx` |
| Native inference | `modules/blinkquest-vision/android/.../BlinkQuestVisionRuntime.kt` |
| Metrics from landmarks | `src/core/vision/observation-engine.ts` |
| On-camera colours | `src/theme/onGlass.ts`, `src/components/ui/GlassOrbButton.tsx` |

The rules those files encode, which every camera feature must follow:

1. **One camera.** Never open a second `<Camera>` or a second session. Lab features start the shared session or follow its exact pattern; a feature must not break a scan that's already running.
2. **Native inference, done like the eye runtime:**
   - MediaPipe Tasks in `LIVE_STREAM` mode, one frame in flight, ~20 Hz throttle.
   - GPU delegate with a CPU fallback, and the delegate in use reported in the runtime stats.
   - **No per-frame allocations:** YUV goes straight into a small pool of reused bitmaps, rotated and brightened in the same pass. Never call `ImageProxy.toBitmap()` plus a rotate per frame.
   - Landmarks go to JS as primitive arrays.
3. **Overlay:**
   - Skia only.
   - The projection uses the same fit as the camera preview: `contain` full screen, `cover` in small views. If they differ, landmarks drift off the face.
4. **UI is the scanner's UI, not a new design:**
   - Full-screen layout as in `FullChrome`: top status pill, viewfinder corners, guidance pill, a row of live metric chips, glass round controls, and the wellness line at the bottom.
   - On-camera text uses `ON_GLASS` / `ON_GLASS_MUTED`; buttons use `GlassOrbButton`.
   - Off-camera screens use `ScreenContainer` + `AppHeader`, `Card`/`SquircleSurface`, `AppButton`, `PressableScale`, and actions in a sticky footer.
   - No ad-hoc shadows, borders, hex colours or emoji.
5. **Re-render only what changes:**
   - Components subscribe to **rounded primitives** (`Math.round(...)`) from stores, never whole objects that change several times a second.
   - Endless animations stop while the camera runs.
6. **Honest states:**
   - Every feature shows "needs N s", "Looking for your face", "Model not loaded", "Camera permission off" as appropriate.
   - Timers pause when tracking is lost.
   - Results say what was measured and that they're wellness estimates, not diagnoses.
7. **Background and PiP:** follow `scan-session.ts`:
   - Auto-PiP only while running.
   - PiP aspect 2:3.
   - `setPipSourceRect` after layout changes.
   - A live badge and stats in `PipChrome`.

## No fake data (hard rule)

`AGENTS.md` §2.4 forbids it, and the lab currently breaks it: `modules/setu-beta-scanner/src/SetuBetaScanner.ts` starts a "deterministic simulation" when native startup fails (around line 226/609).

- **Remove that fallback.**
- If a model file or native piece is missing, the feature shows "Not available on this build" and records nothing.
- Never use `Math.random()`, scripted values or simulated sessions presented as measurements.
- Each feature's status in `docs/BETA_CAMERA_LAB_TRACEABILITY_MATRIX.md` must match what you saw on the device: `WORKING`, `NOT_AVAILABLE`, `IMPLEMENTED_NOT_VERIFIED`.

## Think like Claude (required, not optional)

These are the habits that made the eye scanner work. Follow them on every task.

### Load the skills before you start

Read the `.agents/skills/*/SKILL.md` that match the task before touching code:

| Task touches | Skill |
| --- | --- |
| Which doc or file owns what | `blinkquest-source-of-truth` |
| Camera, MediaPipe, frames, overlay | `blinkquest-vision-pipeline` |
| Blink rate, closure, Eye Battery | `blinkquest-eye-metrics` |
| Games and guided routines | `blinkquest-game-engine` |
| Build, adb, device checks | `blinkquest-android-verification` |
| Data, camera privacy | `blinkquest-privacy-security` |
| Tracker, handoffs | `blinkquest-agentic-workflow` |
| Any bug, crash, wrong number, lag | `blinkquest-debugging` |
| Any screen, card, copy | `blinkquest-ui-design` |
| Any camera / MediaPipe feature | `blinkquest-camera-feature` |
| Lag, fps, CPU, memory | `blinkquest-performance` |
| Before every commit | `blinkquest-code-review` |
| Finishing and reporting | `blinkquest-task-completion` |
| **Beta Camera Lab (current priority)** | **`blinkquest-beta-lab`**: step-by-step plan and per-feature verdicts |

### Investigate before you change anything

- **Read the real code.** Open the actual files and follow the data from start to finish (native → event → store → component). Don't assume from names or docs; docs drift.
- **Gather evidence**, and state the cause only once the evidence shows it:
  - screenshots;
  - `adb logcat --pid=$(adb shell pidof com.amit.blinkquest)`;
  - `adb shell top -H -p <pid>` for which thread burns CPU;
  - `dumpsys gfxinfo … framestats` for where frame time goes;
  - `uiautomator dump` for what's really on screen.
- **Separate symptom from cause:**
  - "Face mesh not working" turned out to be a broken button style.
  - "Tab tap opens a game" turned out to be a tap landing below the tab bar.
  - "Metrics don't work" turned out to be a 30 s threshold that reset on movement.
  - Check yours the same way before fixing.
- **Test hypotheses cheaply.** Change one thing, rebuild, measure, then keep or revert. When the CPU-vs-GPU test showed no gain, the change was reverted, not kept "just in case".
- **Notice the side effects of a fix.** Throttling landmarks would have slowed the eye games' gaze, so the throttle only applies when no game is listening. Search for every consumer (`grep -rn`) before changing shared code.

### Design like a senior engineer

- **Reuse first.** Search for an existing component, hook, store or helper before writing one. Extend the canonical one; never create `Thing2`, `NewScanner`, `BetterCard`.
- **Pick the root fix over the patch.** If 20 screens break the same way, fix the shared component once.
- **Keep it small.** Write the smallest coherent change that fully solves the problem:
  - no speculative options, flags or abstractions;
  - three similar lines beat a premature helper;
  - no half-finished paths.
- **Make it truthful.** Every number on screen comes from a real measurement, every button does what it says, every status text matches the state. If it can't work yet, disable it with an honest message.
- **Build for this device class.** Mid-range Android (Moto G71: Adreno 619, about 1 GB free RAM), phone-holding distance (20–35 cm), people with glasses, dim rooms.

### Write code like Claude

- TypeScript strict, no `any` unless an external type forces it. Name things for what they are; well-named code needs no narration.
- **Comments:**
  - Only when the *why* is non-obvious: a hidden constraint, a workaround, or a threshold with its reason. One short line.
  - Never "added for task X" or "used by Y".
  - No commented-out code; delete it (git has it).
- Theme tokens only (`useTheme()` colours, `setuSpacing`, typography variants). No hex colours in components except on-camera `onGlass` constants.
- **Performance by default:**
  - stable callbacks;
  - store selectors that return primitives;
  - no work in render that belongs in a memo;
  - no allocation in per-frame native code.
- **Errors:** handle them at real boundaries (camera, native module, network, permissions) and show the user a clear state. Don't wrap internal code in pointless try/catch.
- **Clean up:** remove dead styles, imports, components and files your change made unused.

### Verify like you'll be audited

- **"It compiles" is not "it works".** A feature is done when you've watched it work on the phone (golden path plus edge cases) and checks pass.
- **Measure, don't feel.** Use fps from a screen recording, CPU per thread, and real metric values with a face in view.
- **Check your own screenshots.** Look at what's in them: wrong screen, someone else's overlay, a missed tap. Redo it rather than reporting a wrong result.
- **Report like Claude:**
  - what changed;
  - what you verified on the device, with numbers;
  - what you did **not** verify, and why;
  - what's still open.
  - No "everything is fixed" without evidence.

## How to work (same loop Claude uses)

1. **Re-read** every file right before editing; other agents commit in parallel. Never revert or overwrite their work.
2. **Reproduce on the device first.** Take a screenshot and logs, then find the root cause in code. Don't guess from code alone.
3. **Fix the root cause**, smallest coherent change, reusing shared components.
4. **Verify**, all of it, every time:

   ```sh
   pnpm run compile && pnpm run lint:check && pnpm test
   cd android && ./gradlew :app:assembleRelease -q        # never two Gradle builds at once
   adb devices -l                                         # use -s <serial> if two transports
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```

   Then on the phone:
   - **Golden path:** open the feature with a face in view; landmarks sit on the face; numbers update.
   - **Edge cases:** no face, camera permission off, pause/resume, minimize to floating, Home → PiP and back.
   - **Smoothness:**
     - Record with `adb shell screenrecord --size 720x1600 --time-limit 6`.
     - Count frames with `ffprobe -count_frames`. Aim for ≥ 40 fps while scrolling with the camera on.
     - `dumpsys gfxinfo` "janky" counts are unreliable with a live camera; use the recording.
5. **Commit feature-wise** (authorized; never push):
   - `type(scope): summary`, at most 72 characters, types `fix|feat|chore|refactor|docs|test|perf|style`, no trailing period.
   - Never the word "phase" (the hook rejects it).
   - Stage only your files.
6. **Update `docs/AGENT_TASK_TRACKER.md`** with what was and wasn't verified on the device, using `VERIFIED` / `IMPLEMENTED_NOT_VERIFIED`. Never claim a result you didn't observe.

## Device tips

- **Taps:** use physical pixels (Moto G71 is 1080×2400). Get exact targets from `adb shell uiautomator dump`; screenshot previews are scaled.
- **Locked or always-on screen:**

  ```sh
  adb shell input keyevent KEYCODE_WAKEUP && adb shell wm dismiss-keyguard
  ```

  Use `adb shell svc power stayon usb` while testing, and turn it off after.
- **Deep links:** `blinkquest://<route>` (for example `blinkquest://beta-lab`, `blinkquest://diagnostics`).
- **Stray overlays:** a YouTube PiP or another app on screen isn't a BlinkQuest bug; close it and retake.

## Don'ts

- Don't edit generated `android/` or `ios/`; change `app.json`, `app.config.ts` or `plugins/`. Native module sources in `modules/*/android/src` are fine to edit.
- Don't leave `.kt` backup copies inside a module source folder; Kotlin compiles them and the build breaks. Put backups in `modules/<name>/backups/` with a `.txt` extension.
- Don't upgrade packages casually. Keep `react-native-worklets` at the lockfile version. pnpm only.
- Don't stop after planning or a visual proposal: implement, verify on the device, commit.
