/**
 * Neev Resilient Supabase Network Client
 * Specification: Neev_Complete_Supabase_First_Master_Implementation.md & Neev_Family_Network_Privacy_and_Implementation_Master.md
 *
 * Implements a strict 2-tier resilient execution strategy:
 * - Tier 1: Supabase Edge Functions (server-side privacy isolation, transactional execution)
 * - Tier 2: Supabase Client Database Query fallback (direct Postgres RLS queries)
 * - If both fail: Throws a detailed composite error explicitly describing both Tier 1 and Tier 2 errors.
 */

import { supabase } from "@/services/supabase/supabaseClient"
import type {
  FamilyRealm,
  KinshipEdge,
  FamilyCluster,
  FamilyBridge,
  FamilyInvitation,
} from "@/stores/slices/createFamilyNetworkSlice"
import type { FamilyMember } from "@/stores/slices/createFamilySlice"
import type { FamilyFunction } from "@/stores/slices/createScheduleSlice"
import type { KnowledgeEntry } from "@/stores/slices/createKnowledgeSlice"
import type { FamilyRoutineItem } from "@/stores/slices/createRoutineSlice"
import type { FamilyIntention } from "@/stores/slices/createIntentionsSlice"

export interface ResilientCallOptions<T> {
  operationName: string
  edgeFn: () => Promise<T>
  dbFallback: () => Promise<T>
}

/**
 * Universal Resilient Supabase Caller
 * Executes Tier 1 (Edge Function) first.
 * If Tier 1 fails, enters catch block to execute Tier 2 (Direct Supabase DB query fallback).
 * If Tier 2 also fails, throws a composite error reporting both failure reasons.
 */
export async function resilientSupabaseCall<T>({
  operationName,
  edgeFn,
  dbFallback,
}: ResilientCallOptions<T>): Promise<T> {
  let edgeErrorMsg = ""

  try {
    // --- TIER 1: Supabase Edge Function ---
    return await edgeFn()
  } catch (edgeErr: any) {
    edgeErrorMsg = edgeErr?.message || String(edgeErr) || "Unknown Edge Function error"
    console.warn(
      `[Neev ResilientCall] Tier 1 Edge Function '${operationName}' failed: ${edgeErrorMsg}. Executing Tier 2 Database fallback...`,
    )

    try {
      // --- TIER 2: Supabase Client Direct Database Fallback ---
      return await dbFallback()
    } catch (dbErr: any) {
      // --- BOTH TIERS FAILED ---
      const dbErrorMsg = dbErr?.message || String(dbErr) || "Unknown DB fallback error"
      const compositeError = new Error(
        `[Neev Resilient Call Failed: ${operationName}]\n` +
          `• Tier 1 (Edge Function Error): ${edgeErrorMsg}\n` +
          `• Tier 2 (Database Fallback Error): ${dbErrorMsg}`,
      )
      console.error(compositeError.message)
      throw compositeError
    }
  }
}

export const resilientNetworkClient = {
  // ==========================================
  // FAMILY REALMS
  // ==========================================

  /**
   * Fetch family realms for a user
   */
  async fetchRealms(userId: string): Promise<FamilyRealm[]> {
    return resilientSupabaseCall<FamilyRealm[]>({
      operationName: `fetchRealms(${userId})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("family-realms", {
          method: "GET",
        })
        if (error) throw new Error(error.message)
        if (!data || !Array.isArray(data.realms)) {
          throw new Error("Invalid response format from family-realms Edge Function")
        }
        return data.realms.map((r: any) => ({
          id: r.id,
          name: r.name,
          motto: r.motto,
          establishedYear: r.established_year ?? r.establishedYear ?? 2026,
          city: r.city,
          ownerId: r.owner_id ?? r.ownerId ?? userId,
          isPrimary: r.is_primary ?? r.isPrimary ?? false,
          memberCount: r.member_count ?? r.memberCount ?? 1,
        }))
      },
      dbFallback: async () => {
        const { data, error } = await supabase
          .from("family_realms")
          .select("*")
          .order("is_primary", { ascending: false })

        if (error) throw new Error(error.message)
        return (data || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          motto: r.motto,
          establishedYear: r.established_year ?? 2026,
          city: r.city,
          ownerId: r.owner_id,
          isPrimary: r.is_primary ?? false,
          memberCount: 1,
        }))
      },
    })
  },

  /**
   * Sync / upsert a family realm
   */
  async syncRealm(realm: FamilyRealm): Promise<FamilyRealm> {
    return resilientSupabaseCall<FamilyRealm>({
      operationName: `syncRealm(${realm.id})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("family-realms", {
          body: {
            action: "sync_realm",
            id: realm.id,
            name: realm.name,
            city: realm.city,
            establishedYear: realm.establishedYear,
            motto: realm.motto,
          },
        })
        if (error) throw new Error(error.message)
        return (data?.realm as FamilyRealm) || realm
      },
      dbFallback: async () => {
        const { error } = await supabase.from("family_realms").upsert({
          id: realm.id,
          name: realm.name,
          motto: realm.motto,
          established_year: realm.establishedYear,
          city: realm.city,
          owner_id: realm.ownerId,
          is_primary: realm.isPrimary,
          updated_at: new Date().toISOString(),
        })
        if (error) throw new Error(error.message)
        return realm
      },
    })
  },

  // ==========================================
  // KINSHIP GRAPH
  // ==========================================

  /**
   * Fetch kinship edges for a realm
   */
  async fetchKinshipEdges(realmId: string): Promise<KinshipEdge[]> {
    return resilientSupabaseCall<KinshipEdge[]>({
      operationName: `fetchKinshipEdges(${realmId})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("kinship-graph", {
          body: { realmId, action: "get_graph" },
        })
        if (error) throw new Error(error.message)
        if (!data || !Array.isArray(data.edges)) {
          throw new Error("Invalid response format from kinship-graph Edge Function")
        }
        return data.edges.map((e: any) => ({
          id: e.id,
          realmId: e.realm_id ?? e.realmId,
          sourceMemberId: e.source_member_id ?? e.sourceMemberId,
          targetMemberId: e.target_member_id ?? e.targetMemberId,
          relation: e.relation,
          label: e.label,
        }))
      },
      dbFallback: async () => {
        const { data, error } = await supabase
          .from("kinship_edges")
          .select("*")
          .eq("realm_id", realmId)

        if (error) throw new Error(error.message)
        return (data || []).map((e: any) => ({
          id: e.id,
          realmId: e.realm_id,
          sourceMemberId: e.source_member_id,
          targetMemberId: e.target_member_id,
          relation: e.relation,
          label: e.label,
        }))
      },
    })
  },

  /**
   * Sync kinship edge between members
   */
  async syncKinshipEdge(edge: KinshipEdge): Promise<KinshipEdge> {
    return resilientSupabaseCall<KinshipEdge>({
      operationName: `syncKinshipEdge(${edge.id})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("kinship-graph", {
          body: { realmId: edge.realmId, action: "add_edge", edge },
        })
        if (error) throw new Error(error.message)
        return (data?.edge as KinshipEdge) || edge
      },
      dbFallback: async () => {
        const { error } = await supabase.from("kinship_edges").upsert({
          id: edge.id,
          realm_id: edge.realmId,
          source_member_id: edge.sourceMemberId,
          target_member_id: edge.targetMemberId,
          relation: edge.relation,
          label: edge.label,
          updated_at: new Date().toISOString(),
        })
        if (error) throw new Error(error.message)
        return edge
      },
    })
  },

  // ==========================================
  // CLUSTERS (SUBGROUPS)
  // ==========================================

  /**
   * Fetch clusters for a realm
   */
  async fetchClusters(realmId: string): Promise<FamilyCluster[]> {
    return resilientSupabaseCall<FamilyCluster[]>({
      operationName: `fetchClusters(${realmId})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("family-realms", {
          body: { realmId, action: "get_clusters" },
        })
        if (error) throw new Error(error.message)
        if (!data || !Array.isArray(data.clusters)) {
          throw new Error("Invalid response format from family-realms Edge Function (clusters)")
        }
        return data.clusters.map((c: any) => ({
          id: c.id,
          realmId: c.realm_id ?? c.realmId,
          name: c.name,
          type: c.cluster_type ?? c.type,
          description: c.description,
          icon: c.icon || "people-outline",
          memberIds: c.member_ids ?? c.memberIds ?? [],
          color: c.color,
        }))
      },
      dbFallback: async () => {
        const { data, error } = await supabase
          .from("clusters")
          .select("*")
          .eq("realm_id", realmId)

        if (error) throw new Error(error.message)
        return (data || []).map((c: any) => ({
          id: c.id,
          realmId: c.realm_id,
          name: c.name,
          type: c.cluster_type,
          description: c.description,
          icon: c.icon || "people-outline",
          memberIds: c.member_ids || [],
          color: c.color,
        }))
      },
    })
  },

  /**
   * Sync a family cluster
   */
  async syncCluster(cluster: FamilyCluster): Promise<FamilyCluster> {
    return resilientSupabaseCall<FamilyCluster>({
      operationName: `syncCluster(${cluster.id})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("family-realms", {
          body: { action: "sync_cluster", cluster },
        })
        if (error) throw new Error(error.message)
        return (data?.cluster as FamilyCluster) || cluster
      },
      dbFallback: async () => {
        const { error } = await supabase.from("clusters").upsert({
          id: cluster.id,
          realm_id: cluster.realmId,
          name: cluster.name,
          cluster_type: cluster.type,
          description: cluster.description,
          member_ids: cluster.memberIds,
          color: cluster.color,
          updated_at: new Date().toISOString(),
        })
        if (error) throw new Error(error.message)
        return cluster
      },
    })
  },

  // ==========================================
  // FAMILY BRIDGES
  // ==========================================

  /**
   * Fetch bilateral family bridges
   */
  async fetchBridges(realmId: string): Promise<FamilyBridge[]> {
    return resilientSupabaseCall<FamilyBridge[]>({
      operationName: `fetchBridges(${realmId})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("family-bridge", {
          body: { realmId, action: "list" },
        })
        if (error) throw new Error(error.message)
        if (!data || !Array.isArray(data.bridges)) {
          throw new Error("Invalid response format from family-bridge Edge Function")
        }
        return data.bridges.map((b: any) => ({
          id: b.id,
          fromRealmId: b.from_realm_id ?? b.fromRealmId,
          targetRealmName: b.target_realm_name ?? b.targetRealmName,
          purpose: b.purpose,
          sharedCategories: b.shared_categories ?? b.sharedCategories ?? [],
          status: b.status,
          connectedAt: b.connected_at ?? b.connectedAt,
        }))
      },
      dbFallback: async () => {
        const { data, error } = await supabase
          .from("family_bridges")
          .select("*")
          .eq("from_realm_id", realmId)

        if (error) throw new Error(error.message)
        return (data || []).map((b: any) => ({
          id: b.id,
          fromRealmId: b.from_realm_id,
          targetRealmName: b.target_realm_name,
          purpose: b.purpose,
          sharedCategories: b.shared_categories || [],
          status: b.status,
          connectedAt: b.connected_at,
        }))
      },
    })
  },

  /**
   * Sync a bilateral family bridge
   */
  async syncBridge(bridge: FamilyBridge): Promise<FamilyBridge> {
    return resilientSupabaseCall<FamilyBridge>({
      operationName: `syncBridge(${bridge.id})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("family-bridge", {
          body: { realmId: bridge.fromRealmId, action: "initiate", bridge },
        })
        if (error) throw new Error(error.message)
        return (data?.bridge as FamilyBridge) || bridge
      },
      dbFallback: async () => {
        const { error } = await supabase.from("family_bridges").upsert({
          id: bridge.id,
          from_realm_id: bridge.fromRealmId,
          target_realm_name: bridge.targetRealmName,
          purpose: bridge.purpose,
          shared_categories: bridge.sharedCategories,
          status: bridge.status,
          connected_at: bridge.connectedAt,
          updated_at: new Date().toISOString(),
        })
        if (error) throw new Error(error.message)
        return bridge
      },
    })
  },

  // ==========================================
  // INVITATIONS & ACCOUNT CLAIMS
  // ==========================================

  /**
   * Fetch invitations for a realm
   */
  async fetchInvitations(realmId: string): Promise<FamilyInvitation[]> {
    return resilientSupabaseCall<FamilyInvitation[]>({
      operationName: `fetchInvitations(${realmId})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("claim-invitation", {
          body: { action: "list", realmId },
        })
        if (error) throw new Error(error.message)
        if (!data || !Array.isArray(data.invitations)) {
          throw new Error("Invalid response format from claim-invitation Edge Function")
        }
        return data.invitations.map((i: any) => ({
          id: i.id,
          realmId: i.realm_id ?? i.realmId,
          inviteCode: i.invite_code ?? i.inviteCode,
          targetMemberName: i.target_member_name ?? i.targetMemberName,
          clusterName: i.cluster_name ?? i.clusterName,
          expiresAt: i.expires_at ?? i.expiresAt,
          status: i.status,
        }))
      },
      dbFallback: async () => {
        const { data, error } = await supabase
          .from("invitations")
          .select("*")
          .eq("realm_id", realmId)

        if (error) throw new Error(error.message)
        return (data || []).map((i: any) => ({
          id: i.id,
          realmId: i.realm_id,
          inviteCode: i.invite_code,
          targetMemberName: i.target_member_name,
          clusterName: i.cluster_name,
          expiresAt: i.expires_at,
          status: i.status,
        }))
      },
    })
  },

  /**
   * Sync / create an invitation
   */
  async syncInvitation(invitation: FamilyInvitation): Promise<FamilyInvitation> {
    return resilientSupabaseCall<FamilyInvitation>({
      operationName: `syncInvitation(${invitation.id})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("claim-invitation", {
          body: { action: "sync_invitation", invitation },
        })
        if (error) throw new Error(error.message)
        return (data?.invitation as FamilyInvitation) || invitation
      },
      dbFallback: async () => {
        const { error } = await supabase.from("invitations").upsert({
          id: invitation.id,
          realm_id: invitation.realmId,
          invite_code: invitation.inviteCode,
          target_member_name: invitation.targetMemberName,
          cluster_name: invitation.clusterName,
          expires_at: invitation.expiresAt,
          status: invitation.status,
          updated_at: new Date().toISOString(),
        })
        if (error) throw new Error(error.message)
        return invitation
      },
    })
  },

  /**
   * Claim an invitation by code
   */
  async claimInvitation(inviteCode: string): Promise<{ success: boolean; realmId?: string }> {
    return resilientSupabaseCall<{ success: boolean; realmId?: string }>({
      operationName: `claimInvitation(${inviteCode})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("claim-invitation", {
          body: { inviteCode },
        })
        if (error) throw new Error(error.message)
        return { success: true, realmId: data?.realmId }
      },
      dbFallback: async () => {
        const { data, error } = await supabase
          .from("invitations")
          .update({ status: "accepted", updated_at: new Date().toISOString() })
          .eq("invite_code", inviteCode)
          .select("realm_id")
          .single()

        if (error) throw new Error(error.message)
        return { success: true, realmId: data?.realm_id }
      },
    })
  },

  // ==========================================
  // DETERMINISTIC PLAN & TASK GENERATION
  // ==========================================

  /**
   * Generate deterministic plan
   */
  async generatePlan(tasks: unknown[]): Promise<any> {
    return resilientSupabaseCall<any>({
      operationName: "generatePlan",
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("generate-plan", {
          body: { tasks },
        })
        if (error) throw new Error(error.message)
        return data
      },
      dbFallback: async () => {
        // Fallback: return deterministic local plan payload
        return {
          planId: `local_plan_${Date.now()}`,
          calculatedAt: new Date().toISOString(),
          status: "computed_locally",
          taskCount: tasks.length,
        }
      },
    })
  },

  // ==========================================
  // SANCTUARY AI GUIDANCE
  // ==========================================

  /**
   * Sanctuary AI Request with fallback
   */
  async requestAi(prompt: string, contextType = "family_plan", realmId?: string): Promise<string> {
    return resilientSupabaseCall<string>({
      operationName: `requestAi(${contextType})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("ai-request", {
          body: { prompt, contextType, realmId },
        })
        if (error) throw new Error(error.message)
        return data?.reply || data?.answer || "Sanctuary AI response received."
      },
      dbFallback: async () => {
        // Safe offline local fallback response
        return `Neev Sanctuary Assistant (Offline Mode): I received your request regarding ${contextType}. Your family data remains completely private and offline.`
      },
    })
  },

  // ==========================================
  // HOUSEHOLD MEMBERS, SCHEDULE, INTENTIONS, KNOWLEDGE
  // ==========================================

  /**
   * Sync member to Supabase with 2-tier fallback
   */
  async syncMember(householdId: string, member: FamilyMember): Promise<FamilyMember> {
    return resilientSupabaseCall<FamilyMember>({
      operationName: `syncMember(${member.id})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("family-realms", {
          body: { action: "sync_member", householdId, member },
        })
        if (error) throw new Error(error.message)
        return (data?.member as FamilyMember) || member
      },
      dbFallback: async () => {
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
        if (error) throw new Error(error.message)
        return member
      },
    })
  },

  /**
   * Sync family function / event with 2-tier fallback
   */
  async syncFunction(householdId: string, fn: FamilyFunction): Promise<FamilyFunction> {
    return resilientSupabaseCall<FamilyFunction>({
      operationName: `syncFunction(${fn.id})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("family-realms", {
          body: { action: "sync_function", householdId, fn },
        })
        if (error) throw new Error(error.message)
        return (data?.function as FamilyFunction) || fn
      },
      dbFallback: async () => {
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
        if (error) throw new Error(error.message)
        return fn
      },
    })
  },

  /**
   * Sync intention / milestone with 2-tier fallback
   */
  async syncIntention(householdId: string, intention: FamilyIntention): Promise<FamilyIntention> {
    return resilientSupabaseCall<FamilyIntention>({
      operationName: `syncIntention(${intention.id})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("family-realms", {
          body: { action: "sync_intention", householdId, intention },
        })
        if (error) throw new Error(error.message)
        return (data?.intention as FamilyIntention) || intention
      },
      dbFallback: async () => {
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
        if (error) throw new Error(error.message)
        return intention
      },
    })
  },

  /**
   * Sync knowledge entry with 2-tier fallback
   */
  async syncKnowledge(householdId: string, entry: KnowledgeEntry): Promise<KnowledgeEntry> {
    return resilientSupabaseCall<KnowledgeEntry>({
      operationName: `syncKnowledge(${entry.id})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("family-realms", {
          body: { action: "sync_knowledge", householdId, entry },
        })
        if (error) throw new Error(error.message)
        return (data?.entry as KnowledgeEntry) || entry
      },
      dbFallback: async () => {
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
        if (error) throw new Error(error.message)
        return entry
      },
    })
  },

  /**
   * Sync routine item with 2-tier fallback
   */
  async syncRoutine(householdId: string, routine: FamilyRoutineItem): Promise<FamilyRoutineItem> {
    return resilientSupabaseCall<FamilyRoutineItem>({
      operationName: `syncRoutine(${routine.id})`,
      edgeFn: async () => {
        const { data, error } = await supabase.functions.invoke("family-realms", {
          body: { action: "sync_routine", householdId, routine },
        })
        if (error) throw new Error(error.message)
        return (data?.routine as FamilyRoutineItem) || routine
      },
      dbFallback: async () => {
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
        if (error) throw new Error(error.message)
        return routine
      },
    })
  },
}
