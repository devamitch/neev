import type { ImmerStateCreator } from "../types"

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
  | "custom"

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
  sourceMemberId: string
  targetMemberId: string
  relation: KinshipType
  label: string
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
  purpose: string
  sharedCategories: string[]
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

export interface FamilyNetworkSlice {
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

  setRealms: (realms: FamilyRealm[]) => void
  addRealm: (realm: FamilyRealm) => void
  setKinshipEdges: (edges: KinshipEdge[]) => void
  setClusters: (clusters: FamilyCluster[]) => void
  setBridges: (bridges: FamilyBridge[]) => void
  addBridgeRecord: (bridge: FamilyBridge) => void
  setInvitations: (invitations: FamilyInvitation[]) => void
  addInvitationRecord: (invitation: FamilyInvitation) => void
  resetNetworkToClean: () => void
}

/** Sample record kept for tests and for purging installs seeded by older builds. Never loaded in the app. */
export const DEMO_REALMS: FamilyRealm[] = [
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
]

/** Sample record kept for tests and for purging installs seeded by older builds. Never loaded in the app. */
export const DEMO_CLUSTERS: FamilyCluster[] = [
  {
    id: "c-nuclear",
    realmId: "realm_primary_chakraborty",
    name: "Nuclear Household",
    type: "nuclear",
    description: "Day-to-day residence, school schedules, grocery & quick decisions",
    icon: "home-outline",
    memberIds: ["m-3", "m-4", "m-5"],
    color: "#3B82F6",
  },
  {
    id: "c-care",
    realmId: "realm_primary_chakraborty",
    name: "Care Circle (Elders)",
    type: "care_circle",
    description: "Daily health telemetry, walking cadence, blood pressure & Doctor Muhurats",
    icon: "heart-outline",
    memberIds: ["m-1", "m-2", "m-3", "m-4"],
    color: "#EC4899",
  },
  {
    id: "c-puja",
    realmId: "realm_primary_chakraborty",
    name: "Traditions & Celebrations",
    type: "puja_tradition",
    description: "Seasonal festivals, family milestones, traditions & heirloom recipes",
    icon: "flame-outline",
    memberIds: ["m-1", "m-2", "m-4"],
    color: "#D97706",
  },
  {
    id: "c-siblings",
    realmId: "realm_primary_chakraborty",
    name: "Siblings & Youth",
    type: "siblings",
    description: "Weekend outings, gaming banter, homework support & secret projects",
    icon: "people-outline",
    memberIds: ["m-5"],
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
]

/** Sample record kept for tests and for purging installs seeded by older builds. Never loaded in the app. */
export const DEMO_KINSHIP_EDGES: KinshipEdge[] = [
  {
    id: "ke-1",
    realmId: "realm_primary_chakraborty",
    sourceMemberId: "m-1",
    targetMemberId: "m-3",
    relation: "parent",
    label: "Father of Amit",
  },
  {
    id: "ke-2",
    realmId: "realm_primary_chakraborty",
    sourceMemberId: "m-2",
    targetMemberId: "m-3",
    relation: "parent",
    label: "Mother of Amit",
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
]

/** Sample record kept for tests and for purging installs seeded by older builds. Never loaded in the app. */
export const DEMO_BRIDGES: FamilyBridge[] = [
  {
    id: "b-senroy-1",
    fromRealmId: "realm_primary_chakraborty",
    targetRealmName: "Sen-Roy Clan (In-Laws)",
    purpose: "Seasonal Celebrations & Winter Gathering Coordination",
    sharedCategories: ["functions", "rituals"],
    status: "active",
    connectedAt: "2026-09-15",
  },
]

/** Sample record kept for tests and for purging installs seeded by older builds. Never loaded in the app. */
export const DEMO_INVITATIONS: FamilyInvitation[] = [
  {
    id: "inv-01",
    realmId: "realm_primary_chakraborty",
    inviteCode: "NEEV-DADU-8821",
    targetMemberName: "Shyamal Chakraborty (Dadu)",
    clusterName: "Care Circle",
    expiresAt: "2026-12-31",
    status: "pending",
  },
]


export const createFamilyNetworkSlice: ImmerStateCreator<FamilyNetworkSlice> = (set, get) => ({
  realms: [],
  activeRealmId: "",
  clusters: [],
  activeClusterType: "all",
  kinshipEdges: [],
  bridges: [],
  invitations: [],

  setActiveRealm: (realmId) =>
    set((state) => {
      state.activeRealmId = realmId
      state.activeClusterType = "all"
    }),

  createRealm: (realm) => {
    const newRealm: FamilyRealm = {
      ...realm,
      id: `realm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    }
    set((state) => {
      state.realms.push(newRealm)
      state.activeRealmId = newRealm.id
      state.activeClusterType = "all"
    })
    return newRealm
  },

  setActiveCluster: (clusterType) =>
    set((state) => {
      state.activeClusterType = clusterType
    }),

  addKinshipEdge: (edge) =>
    set((state) => {
      state.kinshipEdges.push({
        ...edge,
        id: `ke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        realmId: state.activeRealmId,
      })
    }),

  removeKinshipEdge: (id) =>
    set((state) => {
      state.kinshipEdges = state.kinshipEdges.filter((e) => e.id !== id)
    }),

  addCluster: (cluster) =>
    set((state) => {
      state.clusters.push({
        ...cluster,
        id: `c_${Date.now()}`,
        realmId: state.activeRealmId,
      })
    }),

  assignMemberToCluster: (clusterId, memberId) =>
    set((state) => {
      const target = state.clusters.find((c) => c.id === clusterId)
      if (target && !target.memberIds.includes(memberId)) {
        target.memberIds.push(memberId)
      }
    }),

  createInvitation: (memberName, clusterName) => {
    const code = `NEEV-${memberName.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
    const inv: FamilyInvitation = {
      id: `inv_${Date.now()}`,
      realmId: get().activeRealmId,
      inviteCode: code,
      targetMemberName: memberName,
      clusterName,
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      status: "pending",
    }
    set((state) => {
      state.invitations.unshift(inv)
    })
    return inv
  },

  claimInvitation: (code) => {
    const trimmed = code.trim().toUpperCase()
    const currentInvitations = get().invitations
    const invIndex = currentInvitations.findIndex(
      (i) => i.inviteCode.toUpperCase() === trimmed && i.status === "pending",
    )

    if (invIndex === -1) {
      return {
        success: false,
        message: "Invalid, expired, or already claimed sanctuary invitation code.",
      }
    }

    const inv = currentInvitations[invIndex]
    const now = new Date().toISOString().split("T")[0]
    if (inv.expiresAt < now) {
      return {
        success: false,
        message: "This invitation code has expired. Please ask your family organizer to reissue one.",
      }
    }

    set((state) => {
      state.invitations[invIndex].status = "accepted"
    })

    return {
      success: true,
      message: `Sanctuary profile claimed successfully for ${inv.targetMemberName}!`,
      targetMemberName: inv.targetMemberName,
    }
  },

  addBridge: (targetRealmName, purpose, sharedCategories) =>
    set((state) => {
      state.bridges.push({
        id: `bridge_${Date.now()}`,
        fromRealmId: state.activeRealmId,
        targetRealmName,
        purpose,
        sharedCategories,
        status: "active",
        connectedAt: new Date().toISOString().split("T")[0],
      })
    }),

  toggleBridgeStatus: (bridgeId) =>
    set((state) => {
      const bridge = state.bridges.find((b) => b.id === bridgeId)
      if (bridge) {
        bridge.status = bridge.status === "active" ? "paused" : "active"
      }
    }),

  revokeBridge: (bridgeId) =>
    set((state) => {
      state.bridges = state.bridges.filter((b) => b.id !== bridgeId)
    }),

  setRealms: (realms) =>
    set((state) => {
      state.realms = realms
    }),

  addRealm: (realm) =>
    set((state) => {
      const idx = state.realms.findIndex((r) => r.id === realm.id)
      if (idx >= 0) {
        state.realms[idx] = realm
      } else {
        state.realms.push(realm)
      }
    }),

  setKinshipEdges: (edges) =>
    set((state) => {
      state.kinshipEdges = edges
    }),

  setClusters: (clusters) =>
    set((state) => {
      state.clusters = clusters
    }),

  setBridges: (bridges) =>
    set((state) => {
      state.bridges = bridges
    }),

  addBridgeRecord: (bridge) =>
    set((state) => {
      const idx = state.bridges.findIndex((b) => b.id === bridge.id)
      if (idx >= 0) {
        state.bridges[idx] = bridge
      } else {
        state.bridges.push(bridge)
      }
    }),

  setInvitations: (invitations) =>
    set((state) => {
      state.invitations = invitations
    }),

  addInvitationRecord: (invitation) =>
    set((state) => {
      const idx = state.invitations.findIndex((i) => i.id === invitation.id)
      if (idx >= 0) {
        state.invitations[idx] = invitation
      } else {
        state.invitations.push(invitation)
      }
    }),

  resetNetworkToClean: () =>
    set((state) => {
      state.realms = []
      state.activeRealmId = ""
      state.clusters = []
      state.activeClusterType = "all"
      state.kinshipEdges = []
      state.bridges = []
      state.invitations = []
    }),
})
