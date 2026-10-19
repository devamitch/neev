# BlinkQuest — Production Publishing Credentials & Setup Guide

This document lists all external credentials, configuration keys, and accounts needed to complete automated cloud builds, live Firebase crash tracking, and store submissions for **BlinkQuest** (`com.amit.neev`).

---

## Quick Reference Summary

| #     | Service                | Required File / Secret       | Purpose                                             | Target Location                                        |
| ----- | ---------------------- | ---------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| **1** | **Firebase**           | `google-services.json`       | Real-time native Crashlytics & exception reporting  | `Apps/blinkquest/google-services.json`                 |
| **2** | **Expo / EAS**         | `projectId` & `EXPO_TOKEN`   | Cloud building & automated updates                  | `app.config.ts` & CI Secrets                           |
| **3** | **Google Play**        | Service Account JSON         | Fastlane & EAS automated submission to Play Console | `Apps/blinkquest/blinkquest-play-service-account.json` |
| **4** | **Keystore**           | `blinkquest-upload.keystore` | Android release app signing                         | `.setu/keystores/` & `credentials.json`                |
| **5** | **Apple** _(Optional)_ | Team ID & App Store API Key  | iOS TestFlight & App Store release                  | EAS Dashboard / CLI                                    |

---

## 1. Firebase Crashlytics Setup (Android)

BlinkQuest is equipped with a lazy-loaded crash reporting service (`src/services/security/CrashReportingService.ts`). When `google-services.json` is added, Firebase Crashlytics activates automatically in production builds.

### Steps to generate:

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create or select a project (e.g. `BlinkQuest-Production`).
3. Click **Add App** -> **Android** (icon).
4. Register the app:
   - **Android package name**: `com.amit.neev`
   - **App nickname**: `BlinkQuest`
5. Download **`google-services.json`**.
6. Place the file at:
   ```
   /Volumes/Amit/Projects/Apps/blinkquest/google-services.json
   ```

_(Note: `google-services.json` is automatically gitignored so your API keys remain private)._

---

## 2. Expo & EAS Project Configuration

### A. EAS Project ID:

- Current configured ID in `app.config.ts`: `de08ee8b-b83a-4a66-ab5c-eaccc044632d`
- If you wish to use a fresh EAS project under your account:
  ```bash
  cd /Volumes/Amit/Projects/Apps/blinkquest
  pnpm dlx eas-cli project:init
  ```
  Then update `extra.eas.projectId` in `app.config.ts`.

### B. CI/CD Cloud Token (`EXPO_TOKEN`):

1. Go to [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens).
2. Create a token named `BlinkQuest-CI`.
3. Add it as an environment variable or repository secret named `EXPO_TOKEN` in:
   - GitHub: **Repo Settings -> Secrets and variables -> Actions**
   - CircleCI: **Project Settings -> Environment Variables**

---

## 3. Google Play Console Service Account (Fastlane / EAS Submit)

To allow `pnpm run fastlane:internal` or `pnpm run submit:play` to automatically upload release bundles to Google Play:

1. Open the [Google Cloud Console](https://console.cloud.google.com/) for your Google Play Developer Account.
2. Go to **IAM & Admin -> Service Accounts** -> **Create Service Account**.
   - Name: `play-console-deployer`
   - Role: `Service Account User`
3. Click into the new service account -> **Keys** -> **Add Key** -> **Create new key (JSON)**.
4. Download the JSON key file and save it to:
   ```
   /Volumes/Amit/Projects/Apps/blinkquest/blinkquest-play-service-account.json
   ```
5. Go to the [Google Play Console](https://play.google.com/console) -> **API access**.
6. Find the service account and grant it **Release manager** permissions (Release to production, exclude devices, manage testing tracks).

---

## 4. Android Signing Keystore

BlinkQuest currently uses the upload keystore referenced in `credentials.json`:

- **Current Path**: `.setu/keystores/setu-upload.keystore`
- **Alias**: `setu-upload`

### If you want a dedicated BlinkQuest upload keystore:

Run the following in your terminal:

```bash
keytool -genkeypair -v -keystore /Volumes/Amit/Projects/Apps/blinkquest/.setu/keystores/blinkquest-upload.keystore \
  -alias blinkquest-upload -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_SECURE_PASSWORD -keypass YOUR_SECURE_PASSWORD \
  -dname "CN=BlinkQuest, OU=Mobile, O=Amit, L=Bangalore, ST=Karnataka, C=IN"
```

Then update `credentials.json`:

```json
{
  "android": {
    "keystore": {
      "keystorePath": ".setu/keystores/blinkquest-upload.keystore",
      "keystorePassword": "YOUR_SECURE_PASSWORD",
      "keyAlias": "blinkquest-upload",
      "keyPassword": "YOUR_SECURE_PASSWORD"
    }
  }
}
```

---

## 5. Apple App Store / TestFlight (iOS, Optional)

If you plan to release on iOS:

- **Bundle Identifier**: `com.amit.neev`
- Provide your Apple Developer Team ID and App Store Connect API Key by running:
  ```bash
  cd /Volumes/Amit/Projects/Apps/blinkquest
  pnpm dlx eas-cli credentials
  ```

---

## Verification & Execution Commands

Once you have provided any of the above credentials, run:

```bash
# 1. Run doctor to verify presence of required files
pnpm run doctor

# 2. Run automated validation checks
pnpm run ci:check

# 3. Build Android release bundle locally
pnpm run build:bundle

# 4. Trigger cloud EAS build
pnpm run build:cloud

# 5. Submit directly to Google Play Internal Testing
pnpm run fastlane:internal
```
