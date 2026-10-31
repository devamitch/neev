# 🪷 Neev (नींव) · Private Family AI Operating System

> **One app. Every role. Every stage of family life — coordinated with the calm wisdom of a trusted elder.**

Neev is a **production-grade, private family AI operating system** engineered on **expo sdk 58, React Native New Architecture, Zustand, Firebase Firestore, and Google Services**.

It safeguards family data within an encrypted private enclave with zero third-party data selling, coordinating life across **Personal Space**, **Nuclear Space**, and the **Family Sanctuary**.

---

## 🛡️ AnvayKosh (अन्वयकोश) Ecosystem Integration

<div align="center">
  <img src="assets/brand/anvaykosh-icon.svg" width="96" height="96" alt="AnvayKosh Ecosystem Icon" />
  <p><em>Registered flagship application in the AnvayKosh unified private ecosystem.</em></p>
</div>

Neev is a registered cornerstone application in the **AnvayKosh** private multi-app ecosystem:

- **Anvay ID**: Fast, federated single sign-on across member apps (`Neev`, `Thrivefold`, `HarmonyBloom`, `BlinkQuest`, `Setu`).
- **Anvay Vault**: Encrypted personal profile storing user identity basics and shared family traditions while strictly isolating private household radar and locations on-device.
- **Anvay Connect**: Authorized cross-app peer-to-peer protocol via verified deep links and Android 11+ `<queries>`.
- **Anvay Sync**: Offline-first synchronization with non-destructive nullish merge (`coalesce`) and secure cloud reconciliation.

---

## 🌟 Core Architecture & Sacred Spaces

### 1. 🔒 Sacred Spaces Multi-Partitioning

- **Personal Space (Confidential)**: Career switch plans, staff engineering interview preparation, system design drills, and private goals.
- **Nuclear Space (Immediate Home)**: Child school curriculum, science fair deadlines, pediatrician checkups, office deliverables, and chores.
- **Family Sanctuary (Multigenerational)**: Grandparents, oral histories, festival muhurats, heirloom recipes, family pujas, and beloved pets (Simba 🐾).

### 2. ⚡ Token-Saving Deterministic Cognitive Engine (`neevHeuristicEngine`)

- **0 AI Tokens Consumed**: Computes transit departure buffers, preparation countdowns, and checklists deterministically on-device.
- **Time Arithmetic**: Automatically calculates departure times with traffic buffers (e.g. clinic parking: -35m; school bus: -20m).
- **Family Load Balancing**: Evaluates chore distributions across family members to prevent caregiver fatigue.

### 3. 🔔 Proactive Escalating Notifications Engine (`notificationsService`)

- Persistent, tiered reminders that nudge the right family members at the right time:
  - **Tier 1 (Gentle Advance)**: Heads-up reminder scheduled well in advance.
  - **Tier 2 (Preparation Checklist)**: 30 minutes prior with actionable tasks (e.g. immunization card, science project battery test).
  - **Tier 3 (Immediate Action)**: Due right now with 1-tap Google Meet / Calendar links.

### 4. 🌐 Google Services & Cloud Synchronization

- **Google Calendar**: Real-time sync for family functions, puja muhurats, and school events.
- **Google Tasks**: Delegated chore tracking synchronized with Google accounts.
- **Google Meet**: Automatic 1-tap video conference generation for interviews and overseas family calls.
- **Google Fit / Health Connect**: Daily family movement telemetry (steps, sleep, active minutes).
- **Firebase Firestore**: Multi-user real-time synchronization partitioned by Household Enclave (`NEEV-xxxx-SANC`).

### 5. 🏛️ Single Store, Separate Slices (`useRootStore`)

- Unified Zustand state store with MMKV persistent storage.
- Slices for `Spaces`, `Family`, `Schedule`, `Knowledge`, `Routine`, `Intentions`, `Profile`, and `Auth`.

---

## 📱 Tech Stack & Quality Standards

- **Framework**: expo sdk 58 · React Native 0.83 · React 19
- **State**: Zustand with Immer & MMKV persistence
- **Backend & Cloud**: Firebase 13 (Firestore, Cloud Storage) + Google Cloud REST APIs
- **Notifications**: `expo-notifications` with tiered escalating nudges
- **Testing**: Jest unit tests (100% passing across stores, heuristic engine, and sync)
- **Expo Doctor**: 20/20 checks verified passing

---

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Run static type verification
pnpm typecheck

# Run automated test suite
pnpm test

# Verify Expo project health (20/20 checks)
pnpm dlx expo-doctor

# Start development server
pnpm start
```

---

## 🛡️ AnvayKosh (अन्वयकोश) Ecosystem Integration

<p align="center">
  <img src="assets/brand/anvaykosh-icon.svg" width="96" height="96" alt="AnvayKosh Ecosystem Icon" />
</p>

Neev is a registered cornerstone application in the **AnvayKosh** private multi-app ecosystem:

- **Anvay ID**: 1-tap single sign-on powered by federated peer discovery. If Setu is present, it acts as the master vault. If not, Neev or sibling apps (`Thrivefold`, `HarmonyBloom`, `BlinkQuest`) serve as the Anvay Vault Provider.
- **Anvay Vault**: Encrypted personal profile storing family identity, household location (`homeAddress`, `officeAddress`, sanctuary places), routine times, notification preferences, and non-destructive coalesced state.
- **Anvay Connect**: Peer-to-peer deep-link channel (`neev://unified-vault`) with package validation and state-nonce tamper verification.
- **Anvay Sync**: Offline-first synchronization with non-destructive nullish merge (`coalesce`) and secure Supabase cloud reconciliation.
