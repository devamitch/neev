/**
 * Neev Family Network Supabase Service
 * Specification: Neev_Family_Network_Privacy_and_Implementation_Master.md (Section 55 & 56)
 *
 * Backed by resilientNetworkClient with strict 2-tier execution:
 * - Tier 1: Supabase Edge Functions
 * - Tier 2: Supabase Client Database Query fallback
 * - Both: Clear composite error reporting
 */

import { resilientNetworkClient } from "./resilientNetworkClient"
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
    try {
      await resilientNetworkClient.syncRealm(realm)
    } catch (e: any) {
      console.warn("[NetworkService] syncRealm error:", e.message)
    }
  },

  /**
   * Sync kinship relationship edge between two family people
   */
  async syncKinshipEdge(edge: KinshipEdge): Promise<void> {
    try {
      await resilientNetworkClient.syncKinshipEdge(edge)
    } catch (e: any) {
      console.warn("[NetworkService] syncKinshipEdge error:", e.message)
    }
  },

  /**
   * Sync a cluster (subgroup) definition
   */
  async syncCluster(cluster: FamilyCluster): Promise<void> {
    try {
      await resilientNetworkClient.syncCluster(cluster)
    } catch (e: any) {
      console.warn("[NetworkService] syncCluster error:", e.message)
    }
  },

  /**
   * Sync a bilateral family bridge
   */
  async syncBridge(bridge: FamilyBridge): Promise<void> {
    try {
      await resilientNetworkClient.syncBridge(bridge)
    } catch (e: any) {
      console.warn("[NetworkService] syncBridge error:", e.message)
    }
  },

  /**
   * Sync a family invitation
   */
  async syncInvitation(invitation: FamilyInvitation): Promise<void> {
    try {
      await resilientNetworkClient.syncInvitation(invitation)
    } catch (e: any) {
      console.warn("[NetworkService] syncInvitation error:", e.message)
    }
  },

  /**
   * Claim invitation code via server-side Edge Function with client fallback
   */
  async claimInvitationViaEdge(inviteCode: string) {
    try {
      const res = await resilientNetworkClient.claimInvitation(inviteCode)
      return { data: res, error: null }
    } catch (e: any) {
      return { data: null, error: e.message }
    }
  },

  /**
   * Calculate deterministic plan via server-side Edge Function with fallback
   */
  async generatePlanViaEdge(tasks: unknown[]) {
    try {
      const res = await resilientNetworkClient.generatePlan(tasks)
      return { data: res, error: null }
    } catch (e: any) {
      return { data: null, error: e.message }
    }
  },

  /**
   * Request sanctuary-protected AI guidance via Edge Function with fallback
   */
  async requestAiViaEdge(prompt: string, contextType = "family_plan", realmId?: string) {
    try {
      const res = await resilientNetworkClient.requestAi(prompt, contextType, realmId)
      return { data: res, error: null }
    } catch (e: any) {
      return { data: null, error: e.message }
    }
  },

  /**
   * Perform privacy-preserving data deletion via Edge Function
   */
  async deleteUserDataViaEdge(scope: "all" | "personal_space_only" = "personal_space_only") {
    try {
      const reply = await resilientNetworkClient.requestAi(
        "PERMANENTLY_DELETE_MY_DATA",
        scope,
      )
      return { data: reply, error: null }
    } catch (e: any) {
      return { data: null, error: e.message }
    }
  },
}
