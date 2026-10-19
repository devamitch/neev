/**
 * Unified Zustand Store Types & Slices Contract
 */

import type { StateCreator } from "zustand"
import "zustand/middleware"
import "zustand/middleware/immer"

import type { AppSlice } from "./slices/createAppSlice"
import type { AuthSlice } from "./slices/createAuthSlice"
import type { IntentionsSlice } from "./slices/createIntentionsSlice"
import type { ProfileSlice } from "./slices/createProfileSlice"
import type { UiSlice } from "./slices/createUiSlice"
import type { FamilySlice } from "./slices/createFamilySlice"
import type { ScheduleSlice } from "./slices/createScheduleSlice"
import type { KnowledgeSlice } from "./slices/createKnowledgeSlice"
import type { RoutineSlice } from "./slices/createRoutineSlice"
import type { SpacesSlice } from "./slices/createSpacesSlice"
import type { FamilyNetworkSlice } from "./slices/createFamilyNetworkSlice"

export type RootStoreState = AppSlice &
  IntentionsSlice &
  UiSlice &
  ProfileSlice &
  AuthSlice &
  FamilySlice &
  ScheduleSlice &
  KnowledgeSlice &
  RoutineSlice &
  SpacesSlice &
  FamilyNetworkSlice

export type ImmerStateCreator<Slice> = StateCreator<
  RootStoreState,
  [["zustand/persist", unknown], ["zustand/immer", never]],
  [],
  Slice
>
