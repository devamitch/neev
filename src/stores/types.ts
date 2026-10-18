/**
 * Unified Zustand Store Types & Slices Contract
 */

import type { StateCreator } from "zustand"
import "zustand/middleware"
import "zustand/middleware/immer"

import type { AppSlice } from "./slices/createAppSlice"
import type { AuthSlice } from "./slices/createAuthSlice"
import type { EyeHealthSlice } from "./slices/createEyeHealthSlice"
import type { ProfileSlice } from "./slices/createProfileSlice"
import type { UiSlice } from "./slices/createUiSlice"

export type RootStoreState = AppSlice & EyeHealthSlice & UiSlice & ProfileSlice & AuthSlice

export type ImmerStateCreator<Slice> = StateCreator<
  RootStoreState,
  [["zustand/persist", unknown], ["zustand/immer", never]],
  [],
  Slice
>
