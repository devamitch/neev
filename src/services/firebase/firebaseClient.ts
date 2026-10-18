/**
 * Neev Firebase Cloud Backend Client
 * Powers real-time multi-user synchronization, Firestore database persistence,
 * cloud storage, and secure authentication across all family devices.
 */

import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL, type FirebaseStorage } from "firebase/storage"

import firebaseConfig from "../../../firebase-applet-config.json"
import type { FamilyMember } from "@/stores/useFamilyStore"
import type { FamilyFunction } from "@/stores/useScheduleStore"
import type { KnowledgeEntry } from "@/stores/useKnowledgeStore"
import type { FamilyRoutineItem } from "@/stores/useRoutineStore"
import type { FamilyIntention } from "@/stores/slices/createIntentionsSlice"

// Initialize singleton Firebase app
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const auth: Auth = getAuth(app)
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId)
export const storage: FirebaseStorage = getStorage(app)

export interface HouseholdCloudData {
  id: string
  name: string
  motto: string
  city: string
  establishedYear: number
  adminUserId: string
  inviteCode: string
  membersCount: number
  updatedAt?: unknown
}

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

/**
 * Cloud Sync Service API
 */
export const firebaseService = {
  /**
   * Save or update household metadata
   */
  async saveHousehold(household: HouseholdCloudData): Promise<void> {
    const householdRef = doc(db, "households", household.id)
    await setDoc(householdRef, { ...household, updatedAt: serverTimestamp() }, { merge: true })
  },

  /**
   * Real-time subscription to household family members
   */
  subscribeToMembers(householdId: string, onUpdate: (members: FamilyMember[]) => void): Unsubscribe {
    const membersRef = collection(db, "households", householdId, "members")
    return onSnapshot(membersRef, (snapshot) => {
      const items: FamilyMember[] = []
      snapshot.forEach((docSnap) => items.push(docSnap.data() as FamilyMember))
      onUpdate(items)
    })
  },

  /**
   * Push member to cloud
   */
  async syncMember(householdId: string, member: FamilyMember): Promise<void> {
    const memberRef = doc(db, "households", householdId, "members", member.id)
    await setDoc(memberRef, { ...member, updatedAt: serverTimestamp() }, { merge: true })
  },

  /**
   * Real-time subscription to family functions and invitations
   */
  subscribeToFunctions(householdId: string, onUpdate: (fns: FamilyFunction[]) => void): Unsubscribe {
    const fnRef = collection(db, "households", householdId, "functions")
    const q = query(fnRef, orderBy("date", "asc"))
    return onSnapshot(q, (snapshot) => {
      const items: FamilyFunction[] = []
      snapshot.forEach((docSnap) => items.push(docSnap.data() as FamilyFunction))
      onUpdate(items)
    })
  },

  /**
   * Push function / invitation to cloud
   */
  async syncFunction(householdId: string, fn: FamilyFunction): Promise<void> {
    const fnRef = doc(db, "households", householdId, "functions", fn.id)
    await setDoc(fnRef, { ...fn, updatedAt: serverTimestamp() }, { merge: true })
  },

  /**
   * Real-time subscription to family intentions & pet projects
   */
  subscribeToIntentions(householdId: string, onUpdate: (intentions: FamilyIntention[]) => void): Unsubscribe {
    const intRef = collection(db, "households", householdId, "intentions")
    return onSnapshot(intRef, (snapshot) => {
      const items: FamilyIntention[] = []
      snapshot.forEach((docSnap) => items.push(docSnap.data() as FamilyIntention))
      onUpdate(items)
    })
  },

  /**
   * Push intention / project to cloud
   */
  async syncIntention(householdId: string, intention: FamilyIntention): Promise<void> {
    const intRef = doc(db, "households", householdId, "intentions", intention.id)
    await setDoc(intRef, { ...intention, updatedAt: serverTimestamp() }, { merge: true })
  },

  /**
   * Real-time subscription to shared knowledge vault & heirloom recipes
   */
  subscribeToKnowledge(householdId: string, onUpdate: (entries: KnowledgeEntry[]) => void): Unsubscribe {
    const kRef = collection(db, "households", householdId, "knowledge")
    const q = query(kRef, orderBy("createdAt", "desc"))
    return onSnapshot(q, (snapshot) => {
      const items: KnowledgeEntry[] = []
      snapshot.forEach((docSnap) => items.push(docSnap.data() as KnowledgeEntry))
      onUpdate(items)
    })
  },

  /**
   * Push knowledge entry to cloud
   */
  async syncKnowledge(householdId: string, entry: KnowledgeEntry): Promise<void> {
    const kRef = doc(db, "households", householdId, "knowledge", entry.id)
    await setDoc(kRef, { ...entry, updatedAt: serverTimestamp() }, { merge: true })
  },

  /**
   * Real-time subscription to daily household rhythms
   */
  subscribeToRoutines(householdId: string, onUpdate: (routines: FamilyRoutineItem[]) => void): Unsubscribe {
    const rRef = collection(db, "households", householdId, "routines")
    return onSnapshot(rRef, (snapshot) => {
      const items: FamilyRoutineItem[] = []
      snapshot.forEach((docSnap) => items.push(docSnap.data() as FamilyRoutineItem))
      onUpdate(items)
    })
  },

  /**
   * Push routine item to cloud
   */
  async syncRoutine(householdId: string, routine: FamilyRoutineItem): Promise<void> {
    const rRef = doc(db, "households", householdId, "routines", routine.id)
    await setDoc(rRef, { ...routine, updatedAt: serverTimestamp() }, { merge: true })
  },

  /**
   * Real-time subscription to family health & wellness telemetry (Google Fit / Apple Health)
   */
  subscribeToHealthTelemetry(householdId: string, onUpdate: (metrics: HealthTelemetry[]) => void): Unsubscribe {
    const hRef = collection(db, "households", householdId, "health_telemetry")
    return onSnapshot(hRef, (snapshot) => {
      const items: HealthTelemetry[] = []
      snapshot.forEach((docSnap) => items.push(docSnap.data() as HealthTelemetry))
      onUpdate(items)
    })
  },

  /**
   * Push health telemetry to cloud
   */
  async syncHealthTelemetry(householdId: string, metric: HealthTelemetry): Promise<void> {
    const hRef = doc(db, "households", householdId, "health_telemetry", `${metric.memberId}_${metric.date}`)
    await setDoc(hRef, { ...metric, updatedAt: serverTimestamp() }, { merge: true })
  },
}
