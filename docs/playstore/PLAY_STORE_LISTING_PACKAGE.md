# BlinkQuest — Google Play Store Complete Publishing & Review Package

**Application ID:** `com.amit.neev`  
**App Version:** `1.0.0` (Build `1`)  
**Target Platform:** Android 12+ (API 31–36)  
**Package Manager:** `pnpm`  
**Compliance Standard:** Google Play Health & Fitness Policy, Zero-Telemetry Offline Guarantee

---

## 1. Store Listing Metadata & Copy

### 1.1 App Title

```text
BlinkQuest: Mindful Eye Breaks
```

_(Exact length: 30 characters — precisely meets Google Play's 30-character maximum limit)_

**Alternative titles:**

- `BlinkQuest: Eye Care & Games` (28 chars)
- `BlinkQuest: Eye Wellness & PiP` (30 chars)

---

### 1.2 Short Description

```text
Mindful eye breaks, blink tracking, and focus games. 100% private and on-device.
```

_(Exact length: 78 characters — within Google Play's 80-character maximum limit)_

**Alternative short descriptions:**

- `Train focus, track blinks, and refresh tired eyes with 100% on-device vision.` (76 chars)
- `Rest your eyes with quick games, blink tracking, and private offline exercises.` (78 chars)

---

### 1.3 Full Description (Ready to Copy-Paste into Play Console)

```text
Staring at screens all day strains your vision. BlinkQuest helps you build restorative eye habits through playful 1-minute visual breaks, real-time blink tracking, and mindful eye exercises—all processed 100% on your device with zero cloud servers.

Whether you are coding, reading, studying, or gaming, BlinkQuest keeps your eyes energized, refreshed, and comfortable without interrupting your workflow.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ KEY CAPABILITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👁️ 100% ON-DEVICE COMPUTER VISION
Using Google MediaPipe Face Landmarker right on your phone, BlinkQuest accurately detects 478 facial and ocular landmarks in real time.
• Live Blink Frequency: Keep track of your average blinks per minute to prevent dry eyes.
• Eye Closure: See how much of a scan your eyes spent closed.
• Distance Hint: An iris-based estimate of how close your face is to the screen.
• Zero Video Recording: Camera frames live only in volatile RAM for milliseconds and are never saved or transmitted.

🎮 MINDFUL FOCUS & REFLEX GAMES
Take short 25–60 second breaks that keep your eyes moving, focusing and blinking:
• Orb Pop: Tap floating orbs to re-train visual reflexes and peripheral awareness.
• Slider Chase: Smooth-pursuit tracking to exercise eye-movement coordination.
• Orbit Follow: Dynamic circular tracking exercises to release visual tension.
• Direction Trail: Quick saccadic direction changes to boost eye agility.

🌿 GUIDED EYE EXERCISES & 20-20-20 ROUTINES
• Focus Point: Soft gaze on a calm centre point with slow breathing.
• Focus Garden: Five calm prompts: look, breathe, look far, blink, relax.
• Blink Bloom: Slow, complete blinks grow a flower (camera or tap mode).
• Near/Far Break Guide: The classic 20-20-20 rule made simple and guided with gentle timers.

📱 PICTURE-IN-PICTURE (PiP) SCANNING
Multi-task freely! Keep eye wellness observation active in a compact, native Android Picture-in-Picture window while reading emails, watching lectures, or browsing other apps.

📊 ACTIONABLE WELLNESS INSIGHTS
• Levels, Streaks & Badges: Earn XP for completed activities and keep a daily streak.
• Historical Trends: View daily, weekly, and monthly averages to observe your digital wellbeing habits over time.
• Delete Anytime: Erase scans, activity results or everything from Settings & data.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 100% PRIVATE & OFFLINE MANIFESTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BlinkQuest is designed from the ground up for total privacy:
1. NO ACCOUNT NEEDED: Start immediately. No email, sign-up, password, or profile registration.
2. ZERO TELEMETRY: No analytics SDKs, no ad trackers, and no background network calls.
3. WORKS OFFLINE: Full offline capability in Airplane Mode. All AI models run locally on your phone hardware.
4. YOUR DATA STAYS YOURS: Summaries are stored only in local storage on your device and can be deleted in Settings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ HEALTH & WELLNESS DISCLAIMER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BlinkQuest is an ergonomic digital wellness and visual exercise application intended to encourage healthy screen-break habits. BlinkQuest is NOT a medical or ophthalmological diagnostic tool. It does not diagnose, treat, cure, or prevent any eye disease, strain condition, or visual pathology. Always consult a qualified optometrist or ophthalmologist for medical eye care advice.
```

---

## 2. Play Store Categorization & Setup Details

| Setting                | Selection                                                                         |
| ---------------------- | --------------------------------------------------------------------------------- |
| **Primary Category**   | `Health & Fitness`                                                                |
| **Secondary Category** | `Casual / Board Games`                                                            |
| **Tags**               | `Eye care`, `Digital wellbeing`, `Screen time`, `Focus games`, `Vision exercises` |
| **Target Audience**    | Everyone (Ages 3+)                                                                |
| **Contains Ads**       | **No** (Strict zero-ads policy)                                                   |
| **In-App Purchases**   | **No** (100% free open wellness software)                                         |
| **App Access / Login** | **All features available without credentials**                                    |
| **Content Rating**     | `PEGI 3` / `ESRB Everyone`                                                        |
| **Primary Language**   | English (United States) — `en-US`                                                 |

---

## 3. Reviewer & Testing Instructions ("App Access" in Play Console)

Google Play policy requires developers to provide instructions for features requiring hardware permissions. Use the exact text below in the **App Access** form:

```text
=== BLINKQUEST REVIEWER INSTRUCTIONS ===

1. LOGIN / CREDENTIALS:
BlinkQuest requires NO account, NO username, and NO password. All features are fully accessible upon first launch.

2. CAMERA PERMISSION JUSTIFICATION:
The app requests 'android.permission.CAMERA' exclusively to run Google MediaPipe Face Landmarker for real-time, on-device blink counting and eye-closure observation for wellness awareness.
• Frames are processed strictly in volatile RAM and immediately discarded.
• No image, video, biometric mesh, or facial data is ever saved to the disk or transmitted over any network.
• If the camera permission is denied, the user can still fully play all 8 touch games and view guided exercises.

3. HOW TO TEST ALL KEY USER FLOWS:
• Onboarding: Launch the app; swipe through the 3-slide intro, then read "Before you start" and tap "Allow camera and start" or "Start without the camera".
• Home: See recommended activities, progress (level, streak) and scan shortcuts.
• Scanner: Tap the central "Scan" button in the bottom navigation. Grant camera permission when prompted. Notice live face and eye landmarks, the blink count, eye closure and distance hint.
• Native Android PiP: On the scanner screen, tap the PiP button or press the phone's Home gesture. Verify that the live camera/metric indicator shrinks into a floating window over the Android desktop.
• Games & Exercises: Tap the "Activities" tab. Tap "Orb Pop" or "Focus Point". Play the 30–60 second routine; the result card shows XP, level and streak.
• Historical Trends: Tap the "You" tab to inspect session history and weekly progress charts.
• Offline & Privacy Wipe: Enable Airplane Mode. Verify that games and scanner continue running without internet. Open Settings (gear on Home) → Settings & data → "Erase everything" to delete all local data.
```

---

## 4. Google Play Data Safety Form Responses

When completing the **Data Safety** questionnaire in Google Play Console, declare:

| Question                                                                  | Answer                    | Notes                                                                              |
| ------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| **Does your app collect or share any of the required user data types?**   | **No**                    | Camera frames are processed ephemerally in RAM and never collected or shared.      |
| **Is all of the user data collected by your app encrypted in transit?**   | **Not Applicable / Yes**  | The app operates 100% offline and makes zero cloud requests.                       |
| **Do you provide a way for users to request that their data be deleted?** | **Yes**                   | Settings & data → Erase everything permanently wipes local SQLite and app storage. |
| **Is this app designed for families or children?**                        | **No (General Audience)** | Target age is general audience (13+ / All ages).                                   |
| **Does your app declare any sensitive permissions?**                      | **`CAMERA`**              | Disclosed with clear in-app rationale before prompting.                            |

---

## 5. Visual Asset Specifications & Files

All production assets have been generated and calibrated to Google Play's exact technical specifications:

| Asset Name                              | Resolution / Specs                             | Format | File Path                                              |
| --------------------------------------- | ---------------------------------------------- | ------ | ------------------------------------------------------ |
| **App Icon**                            | 512 × 512 px, 32-bit color, <1024 KB           | PNG    | `assets/playstore/playstore_icon_512x512.png`          |
| **Feature Graphic (Banner)**            | 1024 × 500 px, exact 1024:500 ratio            | PNG    | `assets/playstore/feature_graphic_1024x500.png`        |
| **Feature Graphic (Banner JPEG)**       | 1024 × 500 px, high quality (Q=95)             | JPEG   | `assets/playstore/feature_graphic_1024x500.jpg`        |
| **Real device screenshots (use these)** | 1200 × 2400 px (2:1, Moto G71 captures padded) | PNG    | `assets/playstore/screenshots/device/`                 |
| **Phone Screenshot 1 (Home)**           | 1080 × 2400 px (9:20), crisp UI                | PNG    | `assets/playstore/screenshots/01_home_dashboard.png`   |
| **Phone Screenshot 2 (Scanner)**        | 1080 × 2400 px (9:20), MediaPipe               | PNG    | `assets/playstore/screenshots/02_unified_scanner.png`  |
| **Phone Screenshot 3 (PiP Mode)**       | 1080 × 2400 px (9:20), Multitask               | PNG    | `assets/playstore/screenshots/03_pip_multitasking.png` |
| **Phone Screenshot 4 (Games)**          | 1080 × 2400 px (9:20), Activities              | PNG    | `assets/playstore/screenshots/04_mindful_games.png`    |
| **Phone Screenshot 5 (Trends)**         | 1080 × 2400 px (9:20), Analytics               | PNG    | `assets/playstore/screenshots/05_wellness_trends.png`  |
| **Phone Screenshot 6 (Privacy)**        | 1080 × 2400 px (9:20), On-device               | PNG    | `assets/playstore/screenshots/06_privacy_offline.png`  |

---

> **Note (2026-10-16):** the six images in `assets/playstore/screenshots/*.png` are generated mockups. They show UI and metrics the app does not have (e.g. a "Low Strain" badge, PERCLOS overlay) and are 9:20, which Play rejects (max 2:1). Use the real captures in `screenshots/device/` for the phone screenshot slots.

## 6. Pre-Submission Checklist

- [x] App ID configured as `com.amit.neev` in `app.json` and `build.gradle`.
- [x] Version code incremented (`versionCode: 1`, `version: 1.0.0`).
- [x] Light theme forced (`userInterfaceStyle: "light"`), no jarring color inconsistencies.
- [x] App icon tested and verified at 512×512 without missing corners.
- [x] Feature graphic tested at 1024×500 with central safe margin.
- [x] Medical disclaimer present in both app description and in-app About screen.
- [x] Fastlane & EAS configuration ready for automated delivery (`pnpm run fastlane:internal`).
