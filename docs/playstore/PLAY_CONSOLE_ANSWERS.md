# Neev — Play Console answers (from the code, 2026-10-28)

Package `com.amit.neev`. Based on what the release build actually does. If a feature changes,
update this file before the next submission.

## Fix the listing before submitting

The current full description (`fastlane/metadata/android/en-US/full_description.txt`) promises
things the app does not do. Google treats these as misleading claims. Remove or rewrite:

| Current claim | What the code does |
| --- | --- |
| "Sacred Safe Zones: automatic alerts when family members arrive" | A home ring is drawn on the map. There is no geofencing and no background location, so no arrival alerts. |
| "Emergency Broadcast: one-tap family beacon … with limited connectivity" | Not implemented. |
| "Document Enclave: store certificates, medical records, legal papers" | No document picker or document storage exists. |
| "Hardware Keystore Encryption … only authorized members can decrypt" | Local storage (MMKV) is not encrypted. Data in transit uses HTTPS. |
| "Live Family Radar: real-time, peer-to-peer" | Opt-in location sharing goes through Firestore (Google cloud) to the household's members. Not peer-to-peer. |
| "Anvay ID 1-tap SSO" / "Decentralized Mesh" | Switched off (it leaked data through deep links). |

**Suggested full description**

```
Neev is a private space for your family to stay organised and connected: shared plans and routines, family functions and rituals, a family tree, and optional location sharing with the people in your household. No ads, no feeds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ WHAT YOU CAN DO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏡 YOUR FAMILY SPACE
• A private household space for the people you invite
• A dashboard with today's plans, routines and reminders
• Roles for guardians, elders and children

📅 FUNCTIONS, RITUALS AND SCHEDULES
• Plan family gatherings, celebrations, rituals and appointments together
• Shared routines and intentions for the household
• A family knowledge book for recipes, life lessons and important contacts

🌳 FAMILY TREE
• Add family members (type them in or pick from your contacts) and how you are related

📍 OPTIONAL LOCATION SHARING
• Off by default. When you turn it on, members of your household can see your location on the family map while the app is open
• Turn it off any time

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 YOUR PRIVACY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Only people you invite can see your household
• No ads and no ad tracking; Neev never sells family data
• Crash reports help fix bugs
• Delete your account and family data from Settings

Neev is not an emergency service. In an emergency, call your local emergency number.
```

**Short description (≤ 80 chars)**

```
A private family space: shared plans, rituals, family tree and opt-in location.
```

## App content

| Question | Answer |
| --- | --- |
| Privacy policy URL | `https://neev.app/privacy` is referenced in the app. **Confirm you own neev.app and the page is live**; otherwise publish it on a domain you own. |
| Ads | No ads. |
| App access | Reviewers need a household: provide a test Google account or use "Continue without an account". |
| Target audience | Adults managing a family (18+). If children use it, Play's Families policy applies; keep it 18+ unless you intend that. |
| Location permission declaration | Foreground location only (`ACCESS_FINE/COARSE_LOCATION`), for opt-in family location sharing. No background location. |
| Contacts permission | Used only to fill in one family member from the contact the person picks. Consider dropping `READ_CONTACTS`: the system contact picker works without it, and Google reviews this permission closely. |

## Data safety

| Data type | Collected? | Shared? | Optional? | Purpose | Notes |
| --- | --- | --- | --- | --- | --- |
| Name, email address | Yes (Google / Firebase sign-in) | No | Required for a cloud household; optional without | Account management | Firebase Auth, Supabase (processors). |
| Precise location | Yes, only when the person turns on location sharing | No* | Yes (off by default) | App functionality | Stored in Firestore `households/{id}/locations/{uid}`, visible to household members. *Transfer to other users at the person's request is not "sharing" under Play's definition. |
| Contacts (name, phone, email, birthday of one picked contact) | Yes, when the person adds a member from contacts and saves | No | Yes | App functionality | Saved as that family member in the household. |
| Other user content (events, routines, intentions, knowledge entries, family tree) | Yes | No | Required for the household feature | App functionality | Supabase and Firestore, household-scoped. |
| Crash logs, diagnostics | Yes | No | **No** (always on today; add an off switch to declare it optional) | App stability | Firebase Crashlytics, enabled unconditionally in `CrashReportingService.ts`. |
| Health, financial, messages, photos, audio, files, web history | No | No | — | — | |
| Device or other IDs | No | No | — | — | Advertising ID blocked in `app.json`. |

Encrypted in transit: **Yes** (HTTPS). Deletion: in-app account deletion
(`deleteAccountAndData`); also provide a web deletion URL, as Play asks for one.

## Permissions to justify

| Permission | Why |
| --- | --- |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Opt-in family location sharing, foreground only. |
| `READ_CONTACTS` | Fill a family member from a contact the person picks (see note above). |
| `POST_NOTIFICATIONS` | Family reminders and invitations. |
| `FOREGROUND_SERVICE` | Added by a library; if Play asks for a foreground-service type, check which service declares it, or block it in `app.json` if no feature uses it. |

## Release

- Built release: `versionName 1.0.3`, `versionCode 3`. Upload must have a higher `versionCode` than
  the last one in Play Console.
- The Neev on the test phone is a development build; a release cannot install over it without
  uninstalling (different signature).
