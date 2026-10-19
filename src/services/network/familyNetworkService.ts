/**
 * Neev Family Network Supabase Service
 * Specification: Neev_Family_Network_Privacy_and_Implementation_Master.md (Section 55 & 56)
 *
 * Implements server-side synchronization for:
 * - Family Realms
 * - Kinship Graph Edges
 * - Overlapping Family Clusters
 * - Bilateral Family Bridges
 * - Invitations and Account Claims
 * - Edge Functions Invocation
 */

import { supabase } from "@/services/supabase/supabaseClient"
import type {
  FamilyRealm,
  KinshipEdge,
  FamilyCluster,
  FamilyBridge,
  FamilyInvitation,
} from "@/stores/slices/createFamilyNetworkSlice"

export const familyNetworkService = {
  /**
   * Sync a family realm metadata
   */
  async syncRealm(realm: FamilyRealm): Promise<void> {
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
    if (error) {
      console.warn("[NetworkService] syncRealm error:", error.message)
    }
  },

  /**
   * Sync kinship relationship edge between two family people
   */
  async syncKinshipEdge(edge: KinshipEdge): Promise<void> {
    const { error } = await supabase.from("kinship_edges").upsert({
      id: edge.id,
      realm_id: edge.realmId,
      source_member_id: edge.sourceMemberId,
      target_member_id: edge.targetMemberId,
      relation: edge.relation,
      label: edge.label,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.warn("[NetworkService] syncKinshipEdge error:", error.message)
    }
  },

  /**
   * Sync a cluster (subgroup) definition
   */
  async syncCluster(cluster: FamilyCluster): Promise<void> {
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
    if (error) {
      console.warn("[NetworkService] syncCluster error:", error.message)
    }
  },

  /**
   * Sync a bilateral family bridge
   */
  async syncBridge(bridge: FamilyBridge): Promise<void> {
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
    if (error) {
      console.warn("[NetworkService] syncBridge error:", error.message)
    }
  },

  /**
   * Sync a family invitation
   */
  async syncInvitation(invitation: FamilyInvitation): Promise<void> {
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
    if (error) {
      console.warn("[NetworkService] syncInvitation error:", error.message)
    }
  },

  /**
   * Invoke Supabase Edge Function with fallback
   */
  async invokeEdgeFunction<T = unknown>(
    functionName: string,
    body?: unknown,
  ): Promise<{ data: T | null; error: string | null }> {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: body as Record<string, unknown>,
      })
      if (error) {
        return { data: null, error: error.message }
      }
      return { data: data as T, error: null }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Edge function call failed"
      return { data: null, error: msg }
    }
  },

  /**
   * Claim invitation code via server-side Edge Function
   */
  async claimInvitationViaEdge(inviteCode: string) {
    return this.invokeEdgeFunction("claim-invitation", { inviteCode })
  },

  /**
   * Calculate deterministic plan via server-side Edge Function
   */
  async generatePlanViaEdge(tasks: unknown[]) {
    return this.invokeEdgeFunction("generate-plan", { tasks })
  },

  /**
   * Request sanctuary-protected AI guidance via Edge Function
   */
  async requestAiViaEdge(prompt: string, contextType = "family_plan", realmId?: string) {
    return this.invokeEdgeFunction("ai-request", { prompt, contextType, realmId })
  },

  /**
   * Perform privacy-preserving data deletion via Edge Function
   */
  async deleteUserDataViaEdge(scope: "all" | "personal_space_only" = "personal_space_only") {
    return this.invokeEdgeFunction("delete-user-data", {
      confirmation: "PERMANENTLY_DELETE_MY_DATA",
      scope,
    })
  },
}

