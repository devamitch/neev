import { useFamilyNetworkStore } from "@/stores/useFamilyNetworkStore"

describe("Neev Family Network & Kinship Graph System", () => {
  beforeEach(() => {
    // Reset to initial state
    useFamilyNetworkStore.setState({
      activeRealmId: "realm_primary_chakraborty",
      activeClusterType: "all",
      kinshipEdges: [],
      bridges: [],
      invitations: [],
    })
  })

  it("creates and switches between isolated family realms (Section 45 & 46)", () => {
    const store = useFamilyNetworkStore.getState()
    const newRealm = store.createRealm({
      name: "Banerjee Sanctuary",
      motto: "Knowledge and peace",
      establishedYear: 1970,
      city: "Kolkata",
      ownerId: "usr_amit",
      isPrimary: false,
    })

    expect(newRealm.id).toBeDefined()
    expect(newRealm.name).toBe("Banerjee Sanctuary")
    expect(useFamilyNetworkStore.getState().activeRealmId).toBe(newRealm.id)

    // Switch back to primary
    useFamilyNetworkStore.getState().setActiveRealm("realm_primary_chakraborty")
    expect(useFamilyNetworkStore.getState().activeRealmId).toBe("realm_primary_chakraborty")
  })

  it("records and removes typed kinship edges without leaking permissions (Section 45 & 52)", () => {
    const store = useFamilyNetworkStore.getState()
    store.addKinshipEdge({
      sourceMemberId: "m-1",
      targetMemberId: "m-3",
      relation: "parent",
      label: "Father of Anirban",
    })

    const edges = useFamilyNetworkStore.getState().kinshipEdges
    expect(edges).toHaveLength(1)
    expect(edges[0].label).toBe("Father of Anirban")
    expect(edges[0].relation).toBe("parent")

    store.removeKinshipEdge(edges[0].id)
    expect(useFamilyNetworkStore.getState().kinshipEdges).toHaveLength(0)
  })

  it("manages overlapping clusters and cluster memberships (Section 47)", () => {
    const store = useFamilyNetworkStore.getState()
    store.addCluster({
      name: "Simba Care Patrol",
      type: "custom" as any,
      description: "Daily dog walking and vet visits",
      icon: "paw",
      memberIds: ["m-3"],
      color: "#10B981",
    })

    const clusters = useFamilyNetworkStore.getState().clusters
    const customCluster = clusters.find((c) => c.name === "Simba Care Patrol")
    expect(customCluster).toBeDefined()
    expect(customCluster?.memberIds).toContain("m-3")

    store.assignMemberToCluster(customCluster!.id, "m-4")
    const updated = useFamilyNetworkStore.getState().clusters.find((c) => c.name === "Simba Care Patrol")
    expect(updated?.memberIds).toContain("m-4")
    expect(updated?.memberIds).toContain("m-3")
  })

  it("generates cryptographic single-use invitation codes and claims sanctuary profiles (Section 49 & 50)", () => {
    const store = useFamilyNetworkStore.getState()
    const inv = store.createInvitation("Shyamal Chakraborty (Dadu)", "Care Circle")

    expect(inv.inviteCode).toMatch(/^NEEV-SHY-\d{4}$/)
    expect(inv.status).toBe("pending")

    // Claim invitation
    const claimRes = store.claimInvitation(inv.inviteCode)
    expect(claimRes.success).toBe(true)
    expect(claimRes.targetMemberName).toBe("Shyamal Chakraborty (Dadu)")

    // Subsequent claim with same code should fail
    const reClaimRes = store.claimInvitation(inv.inviteCode)
    expect(reClaimRes.success).toBe(false)
  })

  it("governs bilateral family bridges with scoped grants and lifecycle toggles (Section 51)", () => {
    const store = useFamilyNetworkStore.getState()
    store.addBridge("Sen-Roy Clan (In-Laws)", "Wedding & Puja Logistics", ["functions", "rituals"])

    const bridges = useFamilyNetworkStore.getState().bridges
    expect(bridges).toHaveLength(1)
    expect(bridges[0].status).toBe("active")
    expect(bridges[0].sharedCategories).toEqual(["functions", "rituals"])

    // Toggle status (pause/resume)
    store.toggleBridgeStatus(bridges[0].id)
    expect(useFamilyNetworkStore.getState().bridges[0].status).toBe("paused")

    store.toggleBridgeStatus(bridges[0].id)
    expect(useFamilyNetworkStore.getState().bridges[0].status).toBe("active")

    // Revoke bridge
    store.revokeBridge(bridges[0].id)
    expect(useFamilyNetworkStore.getState().bridges).toHaveLength(0)
  })
})
