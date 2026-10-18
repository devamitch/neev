# 🪷 Neev (नींव) · Mobile App

> **One app. Every role. Every stage of family life — coordinated with the calm wisdom of a trusted elder.**

Neev is a **private, local-first, AI-guided family operating system** built on **Expo SDK 55, React Native, New Architecture, and SQLite**.

---

## 🌟 Architecture & Core Pillars

### 1. 🪷 Family Sanctuary (Dashboard)
- Multigenerational pulse across Elders, Parents, and Youth.
- Daily Elder Wisdom reflections from ancestral archives.
- Countdown, venues, and status for upcoming family gatherings.
- Daily household rhythms checklist (morning prayers, vitals, screen-free dinner).

### 2. 📅 Functions & Rituals Scheduler (`/schedule`)
- Multigenerational event coordination (Weddings, Pujas, Milestones, School Events, Health Checkups).
- Shared task delegation per family member with real-time toggle.
- Preparation checklists and reminders.

### 3. 🏺 Shared Knowledge Sanctuary Vault (`/knowledge`)
- Heirloom family recipes passed down through generations.
- Elder oral histories, life lessons, and ancestral records.
- Emergency family lifeline directory (blood groups, doctors, policy numbers).
- Pinning and category filtering.

### 4. 👥 Family Directory & Multigenerational Tree (`/family`)
- Hierarchical view of Elders, Parents, and Youth.
- Member blood groups, health notes, and direct call integration.
- Household motto and sanctuary settings.

---

## 📱 Mobile Tech Stack

- **Framework**: Expo SDK 55 · React Native 0.83 · React 19
- **Routing**: Expo Router v4 (Tabs, Drawer, Modals)
- **Local Storage**: `expo-sqlite` (WAL mode, offline resilience) + MMKV key-value store
- **State Management**: Zustand stores (`useFamilyStore`, `useScheduleStore`, `useKnowledgeStore`, `useRoutineStore`, `useRootStore`)
- **Animation & Gestures**: React Native Reanimated 4, Gesture Handler, Haptics
- **UI & Design Tokens**: Setu-derived Squircle continuous curvature, porcelain/sage palette (`#FAF9F6`, `#5A7A64`, `#C27835`), Space Grotesk typography
- **Target OS**: Android 14+ (minSdkVersion 24, targetSdkVersion 35) & iOS 17+

---

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development client
pnpm start

# Run on Android device / emulator
pnpm android

# Run on iOS simulator
pnpm ios

# Typecheck and lint
pnpm typecheck
pnpm lint
```

---

## 🛡️ Sanctuary Privacy Covenant

- **100% On-Device Processing**: All family functions, memories, and health details are stored on your device SQLite database.
- **Zero Advertising**: Zero trackers, zero third-party brokers, zero telemetry selling.
- **Ecosystem**: Proud sibling app to **Setu** and **BlinkQuest**.
