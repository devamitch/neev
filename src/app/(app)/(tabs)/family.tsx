import React, { useState } from "react"
import { Linking, Modal, ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppHeader, HeaderIconButton } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { TextField } from "@/components/ui/TextField"
import { PressableScale } from "@/components/ui/PressableScale"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { useColors } from "@/theme/useTheme"
import { useTabBarInset } from "@/components/navigation/CustomTabBar"
import { useFamilyStore, type FamilyMember } from "@/stores/useFamilyStore"
import {
  useFamilyNetworkStore,
  type ClusterType,
  type KinshipType,
} from "@/stores/useFamilyNetworkStore"
import { familyNetworkService } from "@/services/network/familyNetworkService"
import { useRootStore, useShallow } from "@/stores/useRootStore"

const KINSHIP_OPTIONS: { relation: KinshipType; label: string }[] = [
  { relation: "parent", label: "Parent of" },
  { relation: "child", label: "Child of" },
  { relation: "spouse", label: "Spouse / Partner of" },
  { relation: "sibling", label: "Sibling of" },
  { relation: "grandparent", label: "Grandparent of" },
  { relation: "grandchild", label: "Grandchild of" },
  { relation: "in_law", label: "In-law of" },
  { relation: "guardian", label: "Guardian of" },
]

export default function FamilyScreen() {
  const colors = useColors()
  const bottomInset = useTabBarInset()
  const members = useFamilyStore((s) => s.members)
  const updateMember = useFamilyStore((s) => s.updateMember)

  const {
    realms,
    activeRealmId,
    clusters,
    activeClusterType,
    kinshipEdges,
    bridges,
    setActiveRealm,
    createRealm,
    setActiveCluster,
    addKinshipEdge,
    removeKinshipEdge,
    addCluster,
    createInvitation,
    claimInvitation,
    addBridge,
    toggleBridgeStatus,
    revokeBridge,
  } = useFamilyNetworkStore(
    useShallow((s) => ({
      realms: s.realms,
      activeRealmId: s.activeRealmId,
      clusters: s.clusters,
      activeClusterType: s.activeClusterType,
      kinshipEdges: s.kinshipEdges,
      bridges: s.bridges,
      setActiveRealm: s.setActiveRealm,
      createRealm: s.createRealm,
      setActiveCluster: s.setActiveCluster,
      addKinshipEdge: s.addKinshipEdge,
      removeKinshipEdge: s.removeKinshipEdge,
      addCluster: s.addCluster,
      createInvitation: s.createInvitation,
      claimInvitation: s.claimInvitation,
      addBridge: s.addBridge,
      toggleBridgeStatus: s.toggleBridgeStatus,
      revokeBridge: s.revokeBridge,
    })),
  )

  const showToast = useRootStore((s) => s.showToast)
  const showAlert = useRootStore((s) => s.showAlert)

  // ── Modals State ──
  const [realmModalVisible, setRealmModalVisible] = useState(false)
  const [newRealmName, setNewRealmName] = useState("")
  const [newRealmCity, setNewRealmCity] = useState("")
  const [newRealmYear, setNewRealmYear] = useState("1985")
  const [newRealmMotto, setNewRealmMotto] = useState("")

  const [claimModalVisible, setClaimModalVisible] = useState(false)
  const [enteredClaimCode, setEnteredClaimCode] = useState("")

  const [bridgeModalVisible, setBridgeModalVisible] = useState(false)
  const [targetRealmName, setTargetRealmName] = useState("")
  const [bridgePurpose, setBridgePurpose] = useState("Wedding & Festival Coordination")

  const [kinshipModalVisible, setKinshipModalVisible] = useState(false)
  const [sourceMemberId, setSourceMemberId] = useState(members[0]?.id || "")
  const [targetMemberId, setTargetMemberId] = useState(members[1]?.id || "")
  const [selectedRelation, setSelectedRelation] = useState<KinshipType>("parent")

  const [clusterModalVisible, setClusterModalVisible] = useState(false)
  const [newClusterName, setNewClusterName] = useState("")
  const [newClusterDesc, setNewClusterDesc] = useState("")
  const [newClusterColor, setNewClusterColor] = useState("#8B5CF6")

  const activeRealm = realms.find((r) => r.id === activeRealmId) || realms[0]

  // Filter members based on active cluster
  const currentCluster = clusters.find((c) => c.type === activeClusterType)
  const displayedMembers =
    activeClusterType === "all"
      ? members
      : members.filter((m) => currentCluster?.memberIds.includes(m.id))

  const callMember = (phone?: string) => {
    if (!phone) return
    void Linking.openURL(`tel:${phone}`)
  }

  const handleShareInvite = (memberName: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const inv = createInvitation(memberName, currentCluster?.name)
    void familyNetworkService.syncInvitation(inv)
    showAlert({
      title: "Sanctuary Invitation Generated",
      message: `Share this private one-time claim code with ${memberName}:\n\n🔑 ${inv.inviteCode}\n\nValid for 30 days. Allows claiming their sanctuary profile without sharing unsolicited messages.`,
      confirmText: "Copy & Done",
      onConfirm: async () => {
        showToast({ message: "Invite code ready to share!", type: "success" })
      },
    })
  }

  const handleClaimProfile = () => {
    if (!enteredClaimCode.trim()) {
      showToast({ message: "Please enter your invitation code.", type: "error" })
      return
    }

    const res = claimInvitation(enteredClaimCode)
    if (!res.success) {
      showToast({ message: res.message, type: "error" })
      return
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Find and update matching member
    const targetMember = members.find((m) =>
      res.targetMemberName?.toLowerCase().includes(m.name.toLowerCase()),
    )
    if (targetMember) {
      updateMember(targetMember.id, { phone: "+91 Claimed (Verified)" })
    }

    setClaimModalVisible(false)
    setEnteredClaimCode("")
    showAlert({
      title: "Sanctuary Profile Linked! 🕊️",
      message: res.message,
      confirmText: "Enter Sanctuary",
    })
  }

  const handleCreateRealm = () => {
    if (!newRealmName.trim()) {
      showToast({ message: "Please provide a family realm name.", type: "error" })
      return
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    const r = createRealm({
      name: newRealmName.trim(),
      city: newRealmCity.trim() || "Ancestral City",
      establishedYear: parseInt(newRealmYear, 10) || 1980,
      motto: newRealmMotto.trim() || "Love, respect, and mutual shelter",
      ownerId: "usr_self",
      isPrimary: false,
    })
    void familyNetworkService.syncRealm(r)
    setRealmModalVisible(false)
    setNewRealmName("")
    setNewRealmCity("")
    setNewRealmMotto("")
    showToast({ message: `Switched to ${r.name}!`, type: "success" })
  }

  const handleAddKinship = () => {
    if (!sourceMemberId || !targetMemberId) {
      showToast({ message: "Please select two members to connect.", type: "error" })
      return
    }
    if (sourceMemberId === targetMemberId) {
      showToast({ message: "Cannot create kinship edge to the same person.", type: "error" })
      return
    }

    const sourceMem = members.find((m) => m.id === sourceMemberId)
    const targetMem = members.find((m) => m.id === targetMemberId)
    const relOpt = KINSHIP_OPTIONS.find((k) => k.relation === selectedRelation)

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    const edgeData = {
      sourceMemberId,
      targetMemberId,
      relation: selectedRelation,
      label: `${relOpt?.label || "Relative of"} ${targetMem ? targetMem.name.split(" ")[0] : "Family"}`,
    }
    addKinshipEdge(edgeData)
    setKinshipModalVisible(false)
    showToast({
      message: `Kinship edge recorded: ${sourceMem?.name.split(" ")[0]} is ${edgeData.label}!`,
      type: "success",
    })
  }

  const handleAddBridge = () => {
    if (!targetRealmName.trim()) {
      showToast({ message: "Please specify target realm name.", type: "error" })
      return
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    addBridge(targetRealmName.trim(), bridgePurpose.trim(), ["functions", "rituals"])
    setBridgeModalVisible(false)
    setTargetRealmName("")
    showToast({ message: "Bilateral bridge established with scoped grants!", type: "success" })
  }

  const handleAddCluster = () => {
    if (!newClusterName.trim()) {
      showToast({ message: "Please specify cluster name.", type: "error" })
      return
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    addCluster({
      name: newClusterName.trim(),
      type: "custom" as any,
      description: newClusterDesc.trim() || "Collaborative family circle",
      icon: "people-circle-outline",
      memberIds: [members[0]?.id || "m-1"],
      color: newClusterColor,
    })
    setClusterModalVisible(false)
    setNewClusterName("")
    setNewClusterDesc("")
    showToast({ message: `Cluster "${newClusterName}" created!`, type: "success" })
  }

  const renderMemberCard = (m: FamilyMember) => {
    const memberEdges = kinshipEdges.filter(
      (e) => e.sourceMemberId === m.id || e.targetMemberId === m.id,
    )
    const memberClusters = clusters.filter((c) => c.memberIds.includes(m.id))

    return (
      <Card key={m.id} style={[styles.memberCard, { backgroundColor: colors.surface }]}>
        <View style={styles.memberCardTop}>
          <View style={[styles.avatarCircle, { backgroundColor: m.avatarColor }]}>
            <AppText style={styles.avatarText}>{m.avatarText}</AppText>
          </View>

          <View style={styles.memberInfo}>
            <View style={styles.nameRow}>
              <AppText variant="subheading" style={styles.memberName}>
                {m.name}
              </AppText>
              {m.nickname && (
                <View style={[styles.nicknameChip, { backgroundColor: colors.primaryAlpha }]}>
                  <AppText style={[styles.nicknameText, { color: colors.primary }]}>{m.nickname}</AppText>
                </View>
              )}
            </View>

            <View style={styles.relationshipRow}>
              <AppText variant="caption" style={styles.relationshipText}>
                {m.relationship}
              </AppText>
              <View style={styles.dotSeparator} />
              <AppText
                variant="caption"
                style={{ color: m.phone ? "#10B981" : colors.text.muted, fontWeight: "600" }}
              >
                {m.phone ? "📱 Linked Account" : "🕊️ Sanctuary Profile (No phone)"}
              </AppText>
            </View>
          </View>

          <View style={styles.actionBtnsRow}>
            {m.phone && !m.phone.includes("Claimed") ? (
              <PressableScale
                style={[styles.actionBtn, { backgroundColor: colors.primaryAlpha }]}
                onPress={() => callMember(m.phone)}
              >
                <Ionicons name="call" size={15} color={colors.primary} />
              </PressableScale>
            ) : (
              <PressableScale
                style={[styles.actionBtn, { backgroundColor: "#F3F4F6" }]}
                onPress={() => handleShareInvite(m.name)}
              >
                <Ionicons name="share-social-outline" size={15} color={colors.text.secondary} />
              </PressableScale>
            )}
          </View>
        </View>

        {/* Kinship Graph Edges */}
        {memberEdges.length > 0 && (
          <View style={styles.kinshipPillsRow}>
            {memberEdges.map((e) => (
              <View key={e.id} style={[styles.kinshipBadge, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="git-branch-outline" size={11} color={colors.primary} style={{ marginRight: 4 }} />
                <AppText variant="caption" style={{ fontSize: 11, color: colors.text.primary, fontWeight: "500" }}>
                  {e.label}
                </AppText>
              </View>
            ))}
          </View>
        )}

        {/* Clusters Tag Row */}
        {memberClusters.length > 0 && (
          <View style={styles.clustersRow}>
            {memberClusters.map((c) => (
              <View key={c.id} style={[styles.clusterTag, { borderColor: c.color + "40" }]}>
                <View style={[styles.clusterDot, { backgroundColor: c.color }]} />
                <AppText variant="caption" style={{ fontSize: 10, color: colors.text.secondary }}>
                  {c.name}
                </AppText>
              </View>
            ))}
          </View>
        )}

        {/* Superpower & Favorite Treat */}
        {(m.superpower || m.favoriteTreat) && (
          <View style={styles.traitsBox}>
            {m.superpower && (
              <View style={styles.traitRow}>
                <Ionicons name="sparkles" size={13} color="#D97706" style={{ marginRight: 6 }} />
                <AppText variant="caption" style={{ flex: 1, color: colors.text.secondary }}>
                  {m.superpower}
                </AppText>
              </View>
            )}
            {m.favoriteTreat && (
              <View style={[styles.traitRow, { marginTop: 4 }]}>
                <Ionicons name="heart" size={13} color="#C85A32" style={{ marginRight: 6 }} />
                <AppText variant="caption" style={{ flex: 1, color: colors.text.muted }}>
                  Favorite: {m.favoriteTreat}
                </AppText>
              </View>
            )}
          </View>
        )}

        {m.notes && (
          <View style={[styles.notesBox, { backgroundColor: colors.surface2 }]}>
            <Ionicons name="information-circle-outline" size={14} color={colors.text.muted} style={{ marginRight: 6 }} />
            <AppText variant="caption" style={styles.notesText}>
              {m.notes}
            </AppText>
          </View>
        )}
      </Card>
    )
  }

  return (
    <ScreenContainer scrollable={false} style={{ backgroundColor: colors.background }}>
      <AppHeader
        title="Family Sanctuary"
        subtitle={`${activeRealm.name} · ${members.length} Members`}
        showBack={false}
        rightAction={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <HeaderIconButton
              icon="key-outline"
              label="Claim Code"
              onPress={() => setClaimModalVisible(true)}
            />
            <HeaderIconButton
              icon="person-add"
              label="Welcome Member"
              onPress={() => router.push("/modal/add-member")}
            />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Realm Enclave Header (Interactive Switcher) */}
        <PressableScale onPress={() => setRealmModalVisible(true)}>
          <Card style={[styles.householdCard, { backgroundColor: colors.surface }]}>
            <View style={styles.householdIconRow}>
              <View style={[styles.shieldIcon, { backgroundColor: colors.primaryAlpha }]}>
                <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <AppText variant="subheading" style={styles.householdName}>
                    {activeRealm.name}
                  </AppText>
                  <View style={styles.switcherPill}>
                    <AppText variant="caption" style={{ color: colors.primary, fontWeight: "700", marginRight: 4 }}>
                      Switch Enclave
                    </AppText>
                    <Ionicons name="chevron-down" size={12} color={colors.primary} />
                  </View>
                </View>
                <AppText variant="caption" style={{ color: colors.text.muted, marginTop: 2 }}>
                  {activeRealm.city} · Est. {activeRealm.establishedYear} · Multi-Tenant Isolation
                </AppText>
              </View>
            </View>
            <AppText variant="body" style={styles.householdMotto}>
              "{activeRealm.motto}"
            </AppText>
          </Card>
        </PressableScale>

        {/* ── Kinship Clusters Bar (Overlapping Circles) ── */}
        <View style={styles.clusterSelectorContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clusterPillsScroll}>
            <PressableScale
              style={[
                styles.clusterPill,
                activeClusterType === "all"
                  ? [styles.clusterPillActive, { backgroundColor: colors.primary }]
                  : [styles.clusterPillInactive, { backgroundColor: colors.surface }],
              ]}
              onPress={() => {
                void Haptics.selectionAsync()
                setActiveCluster("all")
              }}
            >
              <Ionicons
                name="people"
                size={14}
                color={activeClusterType === "all" ? "#FFFFFF" : colors.text.secondary}
                style={{ marginRight: 6 }}
              />
              <AppText
                variant="caption"
                style={{
                  fontWeight: "600",
                  color: activeClusterType === "all" ? "#FFFFFF" : colors.text.primary,
                }}
              >
                All Kinship ({members.length})
              </AppText>
            </PressableScale>

            {clusters.map((c) => {
              const isActive = activeClusterType === c.type
              return (
                <PressableScale
                  key={c.id}
                  style={[
                    styles.clusterPill,
                    isActive
                      ? [styles.clusterPillActive, { backgroundColor: c.color }]
                      : [styles.clusterPillInactive, { backgroundColor: colors.surface }],
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setActiveCluster(c.type)
                  }}
                >
                  <Ionicons
                    name={c.icon as any}
                    size={14}
                    color={isActive ? "#FFFFFF" : c.color}
                    style={{ marginRight: 6 }}
                  />
                  <AppText
                    variant="caption"
                    style={{
                      fontWeight: "600",
                      color: isActive ? "#FFFFFF" : colors.text.primary,
                    }}
                  >
                    {c.name} ({c.memberIds.length})
                  </AppText>
                </PressableScale>
              )
            })}

            {/* Add Cluster Pill */}
            <PressableScale
              style={[styles.clusterPill, styles.addClusterPill, { backgroundColor: colors.surface2 }]}
              onPress={() => setClusterModalVisible(true)}
            >
              <Ionicons name="add" size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <AppText variant="caption" style={{ color: colors.primary, fontWeight: "700" }}>
                New Circle
              </AppText>
            </PressableScale>
          </ScrollView>
        </View>

        {/* Cluster Context Banner */}
        {activeClusterType !== "all" && currentCluster && (
          <View style={[styles.clusterBanner, { backgroundColor: currentCluster.color + "15", borderColor: currentCluster.color + "30" }]}>
            <Ionicons name={currentCluster.icon as any} size={18} color={currentCluster.color} style={{ marginRight: 8 }} />
            <AppText variant="caption" style={{ flex: 1, color: colors.text.secondary }}>
              {currentCluster.description}
            </AppText>
          </View>
        )}

        {/* ── Toolbar: Quick Kinship Link & Claim ── */}
        <View style={styles.quickToolsRow}>
          <PressableScale
            style={[styles.toolBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setKinshipModalVisible(true)}
          >
            <Ionicons name="git-branch" size={15} color={colors.primary} style={{ marginRight: 6 }} />
            <AppText variant="caption" style={{ fontWeight: "700", color: colors.text.primary }}>
              Connect Kinship Edge
            </AppText>
          </PressableScale>

          <PressableScale
            style={[styles.toolBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setClaimModalVisible(true)}
          >
            <Ionicons name="key" size={15} color="#D97706" style={{ marginRight: 6 }} />
            <AppText variant="caption" style={{ fontWeight: "700", color: colors.text.primary }}>
              Claim Profile with Code
            </AppText>
          </PressableScale>
        </View>

        {/* ── Member List (Scoped to active cluster) ── */}
        <View style={styles.sectionHeader}>
          <AppText variant="subheading" style={styles.sectionTitle}>
            {activeClusterType === "all" ? "Sanctuary Graph" : currentCluster?.name} ({displayedMembers.length})
          </AppText>
          <Badge label="Privacy Graph Protected" tone="success" size="small" />
        </View>

        <View style={styles.membersList}>
          {displayedMembers.length > 0 ? (
            displayedMembers.map(renderMemberCard)
          ) : (
            <Card style={styles.emptyCard}>
              <AppText variant="caption" style={{ color: colors.text.muted, textAlign: "center" }}>
                No members assigned to this cluster yet.
              </AppText>
            </Card>
          )}
        </View>

        {/* ── Bilateral Family Bridges Section (Section 51) ── */}
        <View style={styles.sectionHeader}>
          <AppText variant="subheading" style={styles.sectionTitle}>
            Bilateral Family Bridges ({bridges.length})
          </AppText>
          <PressableScale onPress={() => setBridgeModalVisible(true)}>
            <Badge label="+ Add Bridge" tone="info" size="small" />
          </PressableScale>
        </View>

        {bridges.map((b) => (
          <Card key={b.id} style={[styles.bridgeCard, { backgroundColor: colors.surface }]}>
            <View style={styles.bridgeHeader}>
              <View style={[styles.bridgeIconBox, { backgroundColor: "#8B5CF620" }]}>
                <Ionicons name="git-network-outline" size={20} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <AppText variant="subheading" style={{ fontSize: 15, fontWeight: "700" }}>
                  {b.targetRealmName}
                </AppText>
                <AppText variant="caption" style={{ color: colors.text.muted }}>
                  {b.purpose}
                </AppText>
              </View>
              <PressableScale onPress={() => toggleBridgeStatus(b.id)}>
                <Badge
                  label={b.status === "active" ? "Active Bridge" : "Paused"}
                  tone={b.status === "active" ? "success" : "warning"}
                  size="small"
                />
              </PressableScale>
            </View>

            <View style={styles.bridgeInfoBox}>
              <Ionicons name="shield-outline" size={13} color={colors.primary} style={{ marginRight: 6 }} />
              <AppText variant="caption" style={{ flex: 1, color: colors.text.secondary }}>
                Bilateral coordination enabled for wedding muhurats and shared events. Personal space diaries, finances & health remain 100% private.
              </AppText>
            </View>

            <View style={styles.bridgeActionsRow}>
              <AppText variant="caption" style={{ color: colors.text.muted }}>
                Grants: Functions & Rituals only
              </AppText>
              <PressableScale onPress={() => revokeBridge(b.id)}>
                <AppText variant="caption" style={{ color: "#EF4444", fontWeight: "600" }}>
                  Revoke Bridge
                </AppText>
              </PressableScale>
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* ── Modal: Multi-Realm Switcher ── */}
      <Modal visible={realmModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <AppText variant="subheading" style={{ fontWeight: "800" }}>
                Select Family Realm
              </AppText>
              <PressableScale onPress={() => setRealmModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text.secondary} />
              </PressableScale>
            </View>

            <AppText variant="caption" style={{ color: colors.text.muted, marginBottom: 12 }}>
              Neev isolates independent family trees. Each realm retains its own private graph.
            </AppText>

            {realms.map((r) => {
              const isSelected = r.id === activeRealmId
              return (
                <PressableScale
                  key={r.id}
                  style={[
                    styles.realmSelectCard,
                    {
                      backgroundColor: isSelected ? colors.primaryAlpha : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setActiveRealm(r.id)
                    setRealmModalVisible(false)
                    showToast({ message: `Active Enclave: ${r.name}`, type: "success" })
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyMedium" style={{ fontWeight: "700" }}>
                      {r.name}
                    </AppText>
                    <AppText variant="caption" style={{ color: colors.text.secondary }}>
                      {r.city} · Est. {r.establishedYear}
                    </AppText>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </PressableScale>
              )
            })}

            <View style={{ marginTop: 16 }}>
              <AppText variant="caption" style={styles.inputLabel}>
                OR ESTABLISH NEW FAMILY REALM:
              </AppText>
              <TextField
                label="Family Realm Name"
                placeholder="e.g. Banerjee Sanctuary"
                value={newRealmName}
                onChangeText={setNewRealmName}
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="City / Ancestral Root"
                    placeholder="e.g. Pune"
                    value={newRealmCity}
                    onChangeText={setNewRealmCity}
                  />
                </View>
                <View style={{ width: 100 }}>
                  <TextField
                    label="Est. Year"
                    placeholder="1980"
                    value={newRealmYear}
                    onChangeText={setNewRealmYear}
                  />
                </View>
              </View>
              <View style={{ marginTop: 8 }}>
                <TextField
                  label="Family Motto / Blessing"
                  placeholder="e.g. Together in warmth and honor"
                  value={newRealmMotto}
                  onChangeText={setNewRealmMotto}
                />
              </View>

              <View style={{ marginTop: 14 }}>
                <AppButton title="Establish New Realm" onPress={handleCreateRealm} variant="primary" />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Claim Profile with Code ── */}
      <Modal visible={claimModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <AppText variant="subheading" style={{ fontWeight: "800" }}>
                Claim Sanctuary Profile 🕊️
              </AppText>
              <PressableScale onPress={() => setClaimModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text.secondary} />
              </PressableScale>
            </View>

            <AppText variant="caption" style={{ color: colors.text.muted, marginBottom: 14 }}>
              Enter the single-use invitation code provided by your family organizer to claim your profile.
            </AppText>

            <TextField
              label="One-Time Claim Code"
              placeholder="e.g. NEEV-DADU-8821"
              value={enteredClaimCode}
              onChangeText={setEnteredClaimCode}
            />

            <View style={{ marginTop: 20 }}>
              <AppButton title="Verify & Claim Profile" onPress={handleClaimProfile} variant="primary" />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Connect Kinship Edge ── */}
      <Modal visible={kinshipModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <AppText variant="subheading" style={{ fontWeight: "800" }}>
                Connect Kinship Edge
              </AppText>
              <PressableScale onPress={() => setKinshipModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text.secondary} />
              </PressableScale>
            </View>

            <AppText variant="caption" style={{ color: colors.text.muted, marginBottom: 12 }}>
              Kinship edges represent family ties without leaking personal data across boundaries.
            </AppText>

            <AppText variant="caption" style={styles.inputLabel}>
              FROM MEMBER:
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberChipsScroll}>
              {members.map((m) => (
                <PressableScale
                  key={m.id}
                  style={[
                    styles.chip,
                    sourceMemberId === m.id
                      ? [styles.chipActive, { backgroundColor: colors.primary }]
                      : [styles.chipInactive, { backgroundColor: colors.surface }],
                  ]}
                  onPress={() => setSourceMemberId(m.id)}
                >
                  <AppText variant="caption" style={{ color: sourceMemberId === m.id ? "#FFFFFF" : colors.text.primary }}>
                    {m.name.split(" ")[0]}
                  </AppText>
                </PressableScale>
              ))}
            </ScrollView>

            <AppText variant="caption" style={[styles.inputLabel, { marginTop: 12 }]}>
              RELATIONSHIP:
            </AppText>
            <View style={styles.relationGrid}>
              {KINSHIP_OPTIONS.map((k) => (
                <PressableScale
                  key={k.relation}
                  style={[
                    styles.relChip,
                    selectedRelation === k.relation
                      ? [styles.relChipActive, { backgroundColor: colors.primaryAlpha, borderColor: colors.primary }]
                      : [styles.relChipInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
                  ]}
                  onPress={() => setSelectedRelation(k.relation)}
                >
                  <AppText
                    variant="caption"
                    style={{
                      fontSize: 11,
                      fontWeight: selectedRelation === k.relation ? "700" : "500",
                      color: selectedRelation === k.relation ? colors.primary : colors.text.secondary,
                    }}
                  >
                    {k.label}
                  </AppText>
                </PressableScale>
              ))}
            </View>

            <AppText variant="caption" style={[styles.inputLabel, { marginTop: 12 }]}>
              TO MEMBER:
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberChipsScroll}>
              {members.map((m) => (
                <PressableScale
                  key={m.id}
                  style={[
                    styles.chip,
                    targetMemberId === m.id
                      ? [styles.chipActive, { backgroundColor: colors.primary }]
                      : [styles.chipInactive, { backgroundColor: colors.surface }],
                  ]}
                  onPress={() => setTargetMemberId(m.id)}
                >
                  <AppText variant="caption" style={{ color: targetMemberId === m.id ? "#FFFFFF" : colors.text.primary }}>
                    {m.name.split(" ")[0]}
                  </AppText>
                </PressableScale>
              ))}
            </ScrollView>

            <View style={{ marginTop: 20 }}>
              <AppButton title="Record Kinship Edge" onPress={handleAddKinship} variant="primary" />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Add Bilateral Bridge ── */}
      <Modal visible={bridgeModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <AppText variant="subheading" style={{ fontWeight: "800" }}>
                Add Bilateral Bridge (Section 51)
              </AppText>
              <PressableScale onPress={() => setBridgeModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text.secondary} />
              </PressableScale>
            </View>

            <AppText variant="caption" style={{ color: colors.text.muted, marginBottom: 12 }}>
              A bilateral bridge allows safe, cross-family collaboration for weddings or ceremonies without merging trees or leaking private journals.
            </AppText>

            <TextField
              label="Target Family Realm Name"
              placeholder="e.g. Sen-Roy Clan or Banerjee Branch"
              value={targetRealmName}
              onChangeText={setTargetRealmName}
            />

            <View style={{ marginTop: 10 }}>
              <TextField
                label="Bridge Purpose"
                placeholder="e.g. Wedding logistics & winter gathering"
                value={bridgePurpose}
                onChangeText={setBridgePurpose}
              />
            </View>

            <View style={[styles.bridgeNoticeBox, { backgroundColor: colors.surface2 }]}>
              <Ionicons name="lock-closed" size={14} color={colors.primary} style={{ marginRight: 6 }} />
              <AppText variant="caption" style={{ flex: 1, color: colors.text.secondary }}>
                Privacy Rule: Only functions and ritual invitations are shared. Personal Space stays 100% hidden.
              </AppText>
            </View>

            <View style={{ marginTop: 18 }}>
              <AppButton title="Establish Bridge" onPress={handleAddBridge} variant="primary" />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Add Custom Cluster ── */}
      <Modal visible={clusterModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <AppText variant="subheading" style={{ fontWeight: "800" }}>
                Create Custom Family Circle
              </AppText>
              <PressableScale onPress={() => setClusterModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text.secondary} />
              </PressableScale>
            </View>

            <TextField
              label="Circle Name"
              placeholder="e.g. Kolkata Trip, Chess Circle, Diya Team"
              value={newClusterName}
              onChangeText={setNewClusterName}
            />

            <View style={{ marginTop: 10 }}>
              <TextField
                label="Purpose & Access Description"
                placeholder="e.g. Coordination for family vacation and tickets"
                value={newClusterDesc}
                onChangeText={setNewClusterDesc}
              />
            </View>

            <View style={{ marginTop: 18 }}>
              <AppButton title="Create Circle" onPress={handleAddCluster} variant="primary" />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  householdCard: {
    padding: 16,
    borderRadius: 16,
  },
  householdIconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  shieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  householdName: {
    fontSize: 16,
    fontWeight: "800",
  },
  switcherPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#3B82F615",
  },
  householdMotto: {
    fontSize: 13,
    fontStyle: "italic",
    opacity: 0.85,
    marginTop: 4,
  },
  clusterSelectorContainer: {
    marginHorizontal: -16,
  },
  clusterPillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  clusterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  clusterPillActive: {},
  clusterPillInactive: {},
  addClusterPill: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(112, 151, 88, 0.4)",
  },
  clusterBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
  },
  quickToolsRow: {
    flexDirection: "row",
    gap: 10,
  },
  toolBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  membersList: {
    gap: 12,
  },
  memberCard: {
    padding: 14,
    borderRadius: 16,
  },
  memberCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "700",
  },
  nicknameChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nicknameText: {
    fontSize: 11,
    fontWeight: "600",
  },
  relationshipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  relationshipText: {
    fontSize: 12,
    color: "#8A8A8A",
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#8A8A8A",
    marginHorizontal: 6,
  },
  actionBtnsRow: {
    flexDirection: "row",
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  kinshipPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  kinshipBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  clustersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  clusterTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  clusterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  traitsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  traitRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  notesBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 11,
    color: "#6B7280",
    fontStyle: "italic",
  },
  bridgeCard: {
    padding: 14,
    borderRadius: 16,
  },
  bridgeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  bridgeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bridgeInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
  },
  bridgeActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  realmSelectCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  inputLabel: {
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
    color: "#8A8A8A",
  },
  memberChipsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  chipActive: {},
  chipInactive: {},
  relationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginVertical: 4,
  },
  relChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  relChipActive: {},
  relChipInactive: {},
  bridgeNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
})
