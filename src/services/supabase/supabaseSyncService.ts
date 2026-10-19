/**
 * Neev Supabase Cloud Backend Service
 * Powers real-time multi-user synchronization, Postgres database persistence,
 * and secure authentication across all family devices on Supabase's generous free tier.
 */

import { supabase } from "./supabaseClient"
import type { FamilyMember } from "@/stores/slices/createFamilySlice"
import type { FamilyFunction } from "@/stores/slices/createScheduleSlice"
import type { KnowledgeEntry } from "@/stores/slices/createKnowledgeSlice"
import type { FamilyRoutineItem } from "@/stores/slices/createRoutineSlice"
import type { FamilyIntention } from "@/stores/slices/createIntentionsSlice"

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
  lastUpdated?: string
}

export type Unsubscribe = () => void

export const supabaseSyncService = {
  /**
   * Save or update household metadata
   */
  async saveHousehold(household: HouseholdCloudData): Promise<void> {
    const { error } = await supabase.from("households").upsert({
      id: household.id,
      name: household.name,
      motto: household.motto,
      city: household.city,
      established_year: household.establishedYear,
      admin_user_id: household.adminUserId,
      invite_code: household.inviteCode,
      members_count: household.membersCount,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.warn("[Supabase] saveHousehold error:", error.message)
    }
  },

  /**
   * Push member to Supabase
   */
  async syncMember(householdId: string, member: FamilyMember): Promise<void> {
    const { error } = await supabase.from("family_members").upsert({
      id: member.id,
      household_id: householdId,
      name: member.name,
      nickname: member.nickname,
      relationship: member.relationship,
      role: member.role,
      avatar_text: member.avatarText,
      avatar_color: member.avatarColor,
      phone: member.phone,
      date_of_birth: member.dateOfBirth,
      favorite_treat: member.favoriteTreat,
      superpower: member.superpower,
      notes: member.notes,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.warn("[Supabase] syncMember error:", error.message)
    }
  },

  /**
   * Push function / invitation to Supabase
   */
  async syncFunction(householdId: string, fn: FamilyFunction): Promise<void> {
    const { error } = await supabase.from("family_functions").upsert({
      id: fn.id,
      household_id: householdId,
      title: fn.title,
      category: fn.category,
      date: fn.date,
      time: fn.time,
      location: fn.location,
      description: fn.description,
      vibe: fn.vibe,
      invitations_count: fn.invitationsCount ?? 0,
      rsvp_confirmed: fn.rsvpConfirmed ?? 0,
      tasks: fn.tasks,
      reminder_set: fn.reminderSet,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.warn("[Supabase] syncFunction error:", error.message)
    }
  },

  /**
   * Push intention / project to Supabase
   */
  async syncIntention(householdId: string, intention: FamilyIntention): Promise<void> {
    const { error } = await supabase.from("family_intentions").upsert({
      id: intention.id,
      household_id: householdId,
      title: intention.title,
      description: intention.description,
      category: intention.category,
      champion_member_id: intention.championMemberId,
      target_date: intention.targetDate,
      progress: intention.progress,
      cheer_count: intention.cheerCount,
      is_completed: intention.isCompleted,
      tags: intention.tags,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.warn("[Supabase] syncIntention error:", error.message)
    }
  },

  /**
   * Push knowledge entry to Supabase
   */
  async syncKnowledge(householdId: string, entry: KnowledgeEntry): Promise<void> {
    const { error } = await supabase.from("knowledge_entries").upsert({
      id: entry.id,
      household_id: householdId,
      title: entry.title,
      category: entry.category,
      author_name: entry.authorName,
      author_role: entry.authorRole,
      excerpt: entry.excerpt,
      body: entry.body,
      tags: entry.tags,
      is_pinned: entry.isPinned,
      created_at: entry.createdAt,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.warn("[Supabase] syncKnowledge error:", error.message)
    }
  },

  /**
   * Push routine item to Supabase
   */
  async syncRoutine(householdId: string, routine: FamilyRoutineItem): Promise<void> {
    const { error } = await supabase.from("family_routines").upsert({
      id: routine.id,
      household_id: householdId,
      title: routine.title,
      time: routine.time,
      category: routine.category,
      assigned_member: routine.assignedMember,
      is_completed: routine.isCompleted,
      is_shared: routine.isShared,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.warn("[Supabase] syncRoutine error:", error.message)
    }
  },

  /**
   * Realtime subscription to household members
   */
  subscribeToMembers(householdId: string, onUpdate: (members: FamilyMember[]) => void): Unsubscribe {
    const channel = supabase
      .channel(`members:${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_members", filter: `household_id=eq.${householdId}` },
        async () => {
          const { data } = await supabase
            .from("family_members")
            .select("*")
            .eq("household_id", householdId)
          if (data) {
            onUpdate(
              data.map((row) => ({
                id: row.id,
                name: row.name,
                nickname: row.nickname ?? undefined,
                relationship: row.relationship,
                role: row.role,
                avatarText: row.avatar_text,
                avatarColor: row.avatar_color,
                phone: row.phone ?? undefined,
                dateOfBirth: row.date_of_birth ?? undefined,
                favoriteTreat: row.favorite_treat ?? undefined,
                superpower: row.superpower ?? undefined,
                notes: row.notes ?? undefined,
              })),
            )
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  /**
   * Realtime subscription to family functions
   */
  subscribeToFunctions(householdId: string, onUpdate: (fns: FamilyFunction[]) => void): Unsubscribe {
    const channel = supabase
      .channel(`functions:${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_functions", filter: `household_id=eq.${householdId}` },
        async () => {
          const { data } = await supabase
            .from("family_functions")
            .select("*")
            .eq("household_id", householdId)
            .order("date", { ascending: true })
          if (data) {
            onUpdate(
              data.map((row) => ({
                id: row.id,
                title: row.title,
                category: row.category,
                date: row.date,
                time: row.time,
                location: row.location,
                description: row.description,
                vibe: row.vibe ?? undefined,
                invitationsCount: row.invitations_count,
                rsvpConfirmed: row.rsvp_confirmed,
                tasks: row.tasks ?? [],
                reminderSet: row.reminder_set,
              })),
            )
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },
}
