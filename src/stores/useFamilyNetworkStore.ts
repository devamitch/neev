/**
 * Neev Family Network & Kinship Graph Store
 * Specification: Neev_Family_Network_Privacy_and_Implementation_Master.md
 *
 * Implements the core mental model:
 * - Person: Graph node, can exist without phone/email
 * - Family Realm: Hard multi-tenant privacy boundary
 * - Family Tree / Graph: Typed kinship edges
 * - Clusters: Overlapping collaborative subgroups (nuclear, care circle, siblings, puja)
 * - Family Bridge: Bilateral consented cross-realm connection
 */

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { MMKV } from "react-native-mmkv"

const networkStorage = new MMKV({ id: "neev-family-network-vault" })

export type KinshipType =
  | "parent"
  | "child"
  | "spouse"
  | "sibling"
  | "grandparent"
  | "grandchild"
  | "guardian"
  | "in_law"
  | "relative"

export type ClusterType =
  | "all"
  | "nuclear"
  | "care_circle"
  | "puja_tradition"
  | "siblings"
  | "extended"
  | "in_laws_bridge"

export interface FamilyRealm {
  id: string
  name: string
  motto: string
  establishedYear: number
  city: string
  ownerId: string
  isPrimary: boolean
}

export interface KinshipEdge {
  id: string
  realmId: string
  sourceMemberId: string // e.g. "m-1" (Dadu)
  targetMemberId: string // e.g. "m-3" (Baba)
  relation: KinshipType
  label: string // e.g. "Father of"
}

export interface FamilyCluster {
  id: string
  realmId: string
  name: string
  type: ClusterType
  description: string
  icon: string
  memberIds: string[]
  color: string
}

export interface FamilyBridge {
  id: string
  fromRealmId: string
  targetRealmName: string
  purpose: string // e.g. "Wedding & Ceremony Coordination"
  sharedCategories: string[] // e.g. ["functions", "rituals"]
  status: "active" | "pending" | "paused"
  connectedAt: string
}

export interface FamilyInvitation {
  id: string
  realmId: string
  inviteCode: string
  targetMemberName: string
  clusterName?: string
  expiresAt: string
  status: "pending" | "accepted" | "revoked"
}

interface FamilyNetworkState {
  realms: FamilyRealm[]
  activeRealmId: string
  clusters: FamilyCluster[]
  activeClusterType: ClusterType
  kinshipEdges: KinshipEdge[]
  bridges: FamilyBridge[]
  invitations: FamilyInvitation[]

  setActiveRealm: (realmId: string) => void
  createRealm: (realm: Omit<FamilyRealm, "id">) => FamilyRealm
  setActiveCluster: (clusterType: ClusterType) => void
  addKinshipEdge: (edge: Omit<KinshipEdge, "id" | "realmId">) => void
  removeKinshipEdge: (id: string) => void
  addCluster: (cluster: Omit<FamilyCluster, "id" | "realmId">) => void
  assignMemberToCluster: (clusterId: string, memberId: string) => void
  createInvitation: (memberName: string, clusterName?: string) => FamilyInvitation
  claimInvitation: (code: string) => { success: boolean; message: string; targetMemberName?: string }
  addBridge: (targetRealmName: string, purpose: string, sharedCategories: string[]) => void
  toggleBridgeStatus: (bridgeId: string) => void
  revokeBridge: (bridgeId: string) => void
}

export const useFamilyNetworkStore = create<FamilyNetworkState>()(
  persist(
    (set, get) => ({
      realms: [
        {
          id: "realm_primary_chakraborty",
          name: "Chakraborty Family Sanctuary",
          motto: "Roots in reverence, wings in harmony",
          establishedYear: 1958,
          city: "Kolkata & Bengaluru",
          ownerId: "usr_amit_01",
          isPrimary: true,
        },
        {
          id: "realm_inlaw_senroy",
          name: "Sen-Roy Clan (In-Law Branch)",
          motto: "Knowledge, celebration & shared warmth",
          establishedYear: 1964,
          city: "Shantiniketan",
          ownerId: "usr_inlaw_02",
          isPrimary: false,
        },
      ],
      activeRealmId: "realm_primary_chakraborty",

      clusters: [
        {
          id: "c-nuclear",
          realmId: "realm_primary_chakraborty",
          name: "Nuclear Household",
          type: "nuclear",
          description: "Day-to-day residence, school schedules, grocery & quick decisions",
          icon: "home-outline",
          memberIds: ["m-3", "m-4", "m-5"], // Baba, Maa, Aarav
          color: "#3B82F6",
        },
        {
          id: "c-care",
          realmId: "realm_primary_chakraborty",
          name: "Care Circle (Elders)",
          type: "care_circle",
          description: "Daily health telemetry, walking cadence, blood pressure & Doctor Muhurats",
          icon: "heart-outline",
          memberIds: ["m-1", "m-2", "m-3", "m-4"], // Dadu, Dida, Baba, Maa
          color: "#EC4899",
        },
        {
          id: "c-puja",
          realmId: "realm_primary_chakraborty",
          name: "Traditions & Muhurats",
          type: "puja_tradition",
          description: "Mandir deepam, Durga Puja, Lakshmi Vandana & heirloom sweets",
          icon: "flame-outline",
          memberIds: ["m-1", "m-2", "m-4"], // Dadu, Dida, Maa
          color: "#D97706",
        },
        {
          id: "c-siblings",
          realmId: "realm_primary_chakraborty",
          name: "Siblings & Youth",
          type: "siblings",
          description: "Weekend outings, gaming banter, homework support & secret projects",
          icon: "sparkles-outline",
          memberIds: ["m-5"], // Youth
          color: "#10B981",
        },
        {
          id: "c-bridge",
          realmId: "realm_primary_chakraborty",
          name: "In-Laws Bridge",
          type: "in_laws_bridge",
          description: "Ceremony invitations, shared feasts, wedding planning without private diary leaks",
          icon: "git-network-outline",
          memberIds: ["m-3", "m-4"],
          color: "#8B5CF6",
        },
      ],
      activeClusterType: "all",

      kinshipEdges: [
        {
          id: "ke-1",
          realmId: "realm_primary_chakraborty",
          sourceMemberId: "m-1",
          targetMemberId: "m-3",
          relation: "parent",
          label: "Father of Anirban",
        },
        {
          id: "ke-2",
          realmId: "realm_primary_chakraborty",
          sourceMemberId: "m-2",
          targetMemberId: "m-3",
          relation: "parent",
          label: "Mother of Anirban",
        },
        {
          id: "ke-3",
          realmId: "realm_primary_chakraborty",
          sourceMemberId: "m-1",
          targetMemberId: "m-2",
          relation: "spouse",
          label: "Married 52 Years",
        },
        {
          id: "ke-4",
          realmId: "realm_primary_chakraborty",
          sourceMemberId: "m-3",
          targetMemberId: "m-4",
          relation: "spouse",
          label: "Partners in Sanctuary",
        },
        {
          id: "ke-5",
          realmId: "realm_primary_chakraborty",
          sourceMemberId: "m-3",
          targetMemberId: "m-5",
          relation: "parent",
          label: "Father of Aarav",
        },
        {
          id: "ke-6",
          realmId: "realm_primary_chakraborty",
          sourceMemberId: "m-4",
          targetMemberId: "m-5",
          relation: "parent",
          label: "Mother of Aarav",
        },
      ],

      bridges: [
        {
          id: "b-senroy-1",
          fromRealmId: "realm_primary_chakraborty",
          targetRealmName: "Sen-Roy Clan (In-Laws)",
          purpose: "Durga Puja & Winter Gathering Coordination",
          sharedCategories: ["functions", "rituals"],
          status: "active",
          connectedAt: "2026-09-15",
        },
      ],

      invitations: [
        {
          id: "inv-01",
          realmId: "realm_primary_chakraborty",
          inviteCode: "NEEV-DADU-8821",
          targetMemberName: "Shyamal Chakraborty (Dadu)",
          clusterName: "Care Circle",
          expiresAt: "2026-12-31",
          status: "pending",
        },
      ],

      setActiveRealm: (realmId) => {
        set({ activeRealmId: realmId, activeClusterType: "all" })
      },

      createRealm: (realm) => {
        const newRealm: FamilyRealm = {
          ...realm,
          id: `realm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        }
        set((state) => ({
          realms: [...state.realms, newRealm],
          activeRealmId: newRealm.id,
          activeClusterType: "all",
        }))
        return newRealm
      },

      setActiveCluster: (clusterType) => {
        set({ activeClusterType: clusterType })
      },

      addKinshipEdge: (edge) => {
        const realmId = get().activeRealmId
        const newEdge: KinshipEdge = {
          ...edge,
          id: `ke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          realmId,
        }
        set((state) => ({ kinshipEdges: [...state.kinshipEdges, newEdge] }))
      },

      removeKinshipEdge: (id) => {
        set((state) => ({ kinshipEdges: state.kinshipEdges.filter((e) => e.id !== id) }))
      },

      addCluster: (cluster) => {
        const realmId = get().activeRealmId
        const newCluster: FamilyCluster = {
          ...cluster,
          id: `c_${Date.now()}`,
          realmId,
        }
        set((state) => ({ clusters: [...state.clusters, newCluster] }))
      },

      assignMemberToCluster: (clusterId, memberId) => {
        set((state) => ({
          clusters: state.clusters.map((c) =>
            c.id === clusterId && !c.memberIds.includes(memberId)
              ? { ...c, memberIds: [...c.memberIds, memberId] }
              : c,
          ),
        }))
      },

      createInvitation: (memberName, clusterName) => {
        const realmId = get().activeRealmId
        const code = `NEEV-${memberName.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
        const inv: FamilyInvitation = {
          id: `inv_${Date.now()}`,
          realmId,
          inviteCode: code,
          targetMemberName: memberName,
          clusterName,
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          status: "pending",
        }
        set((state) => ({ invitations: [inv, ...state.invitations] }))
        return inv
      },

      claimInvitation: (code) => {
        const trimmed = code.trim().toUpperCase()
        const invIndex = get().invitations.findIndex(
          (i) => i.inviteCode.toUpperCase() === trimmed && i.status === "pending",
        )

        if (invIndex === -1) {
          return {
            success: false,
            message: "Invalid, expired, or already claimed sanctuary invitation code.",
          }
        }

        const inv = get().invitations[invIndex]
        const now = new Date().toISOString().split("T")[0]
        if (inv.expiresAt < now) {
          return {
            success: false,
            message: "This invitation code has expired. Please ask your family organizer to reissue one.",
          }
        }

        // Mark accepted
        const updatedInvitations = [...get().invitations]
        updatedInvitations[invIndex] = { ...inv, status: "accepted" }
        set({ invitations: updatedInvitations })

        return {
          success: true,
          message: `Sanctuary profile claimed successfully for ${inv.targetMemberName}!`,
          targetMemberName: inv.targetMemberName,
        }
      },

      addBridge: (targetRealmName, purpose, sharedCategories) => {
        const realmId = get().activeRealmId
        const bridge: FamilyBridge = {
          id: `bridge_${Date.now()}`,
          fromRealmId: realmId,
          targetRealmName,
          purpose,
          sharedCategories,
          status: "active",
          connectedAt: new Date().toISOString().split("T")[0],
        }
        set((state) => ({ bridges: [...state.bridges, bridge] }))
      },

      toggleBridgeStatus: (bridgeId) => {
        set((state) => ({
          bridges: state.bridges.map((b) =>
            b.id === bridgeId
              ? { ...b, status: b.status === "active" ? "paused" : "active" }
              : b,
          ),
        }))
      },

      revokeBridge: (bridgeId) => {
        set((state) => ({
          bridges: state.bridges.filter((b) => b.id !== bridgeId),
        }))
      },
    }),
    {
      name: "neev-family-network-storage",
      storage: createJSONStorage(() => ({
        getItem: (key) => networkStorage.getString(key) ?? null,
        setItem: (key, value) => networkStorage.set(key, value),
        removeItem: (key) => networkStorage.delete(key),
      })),
    },
  ),
)
