/**
 * Neev Firebase client: Auth (persisted across app restarts) and Firestore.
 * Household data lives under households/{householdId}; see services/sync/cloudSyncEngine.ts
 * and firestore.rules for the data model.
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
import { initializeApp, getApps, getApp } from "firebase/app"
import * as FirebaseAuth from "firebase/auth"
import { getAuth, initializeAuth, type Auth } from "firebase/auth"
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore"
import { getStorage, type FirebaseStorage } from "firebase/storage"
import { Platform } from "react-native"

import firebaseConfig from "../../../firebase-applet-config.json"

const isFirstInit = getApps().length === 0
const app = isFirstInit ? initializeApp(firebaseConfig) : getApp()

/**
 * getAuth() on React Native keeps the session in memory only, so every cold start
 * would sign the user out of Firebase and Firestore rules would reject their reads.
 * The RN build of firebase/auth exports getReactNativePersistence (absent from the
 * default typings, hence the lookup).
 */
function createAuth(): Auth {
  const getRnPersistence = (FirebaseAuth as unknown as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => FirebaseAuth.Persistence
  }).getReactNativePersistence
  if (Platform.OS === "web" || !getRnPersistence || !isFirstInit) return getAuth(app)
  try {
    return initializeAuth(app, { persistence: getRnPersistence(AsyncStorage) })
  } catch {
    return getAuth(app)
  }
}

function createFirestore(): Firestore {
  const configuredDbId =
    process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID ||
    (firebaseConfig as Record<string, string | undefined>).firestoreDatabaseId
  const databaseId =
    configuredDbId && configuredDbId !== "(default)"
      ? configuredDbId
      : undefined
  if (!isFirstInit) return databaseId ? getFirestore(app, databaseId) : getFirestore(app)
  // App records carry optional fields; Firestore rejects `undefined` unless told to skip it.
  // Long polling avoids the WebChannel stalls seen on React Native networking.
  const settings = { ignoreUndefinedProperties: true, experimentalAutoDetectLongPolling: true }
  return databaseId ? initializeFirestore(app, settings, databaseId) : initializeFirestore(app, settings)
}

export const auth: Auth = createAuth()
export const db: Firestore = createFirestore()
export const storage: FirebaseStorage = getStorage(app)

export interface HealthTelemetry {
  memberId: string
  memberName: string
  date: string // YYYY-MM-DD
  dailySteps: number
  activeMinutes: number
  sleepHours: number
  restingHeartRate: number
  source: "google_fit" | "apple_health" | "manual"
  lastUpdated: string
}
