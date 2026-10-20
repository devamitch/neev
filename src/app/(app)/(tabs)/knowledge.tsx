import React, { useCallback, useMemo, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppHeader, HeaderIconButton } from "@/components/ui/AppHeader"
import { SanctuaryHeader, SanctuaryLargeTitle } from "@/components/ui/SanctuaryHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { PressableScale } from "@/components/ui/PressableScale"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { ScreenFlatList } from "@/components/ui/ScreenFlatList"
import { useColors } from "@/theme/useTheme"
import { useTabBarInset } from "@/components/navigation/CustomTabBar"
import { useKnowledgeStore, type KnowledgeCategory, type KnowledgeEntry } from "@/stores/useKnowledgeStore"
import { useShallow } from "@/stores/useRootStore"
import { useKnowledgeQuery, useToggleKnowledgePinMutation } from "@/hooks/useKnowledgeQuery"
import { FamilyPhotoBoothModal } from "@/components/family/FamilyPhotoBoothModal"

const CATEGORIES: { key: KnowledgeCategory | "all"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "all", label: "All Vault", icon: "albums-outline" },
  { key: "story", label: "Family Stories", icon: "book-outline" },
  { key: "recipe", label: "Heirloom Recipes", icon: "restaurant-outline" },
  { key: "wisdom", label: "Elder Wisdom", icon: "bulb-outline" },
  { key: "tradition", label: "Traditions", icon: "flame-outline" },
  { key: "project", label: "Pet Projects", icon: "hammer-outline" },
]

export default function KnowledgeScreen() {
  const colors = useColors()
  const bottomInset = useTabBarInset()
  const { data: queryEntries } = useKnowledgeQuery()
  const togglePinMutation = useToggleKnowledgePinMutation()

  const { storeEntries, selectedCategory, setCategory, togglePin } = useKnowledgeStore(
    useShallow((s) => ({
      storeEntries: s.entries,
      selectedCategory: s.selectedCategory,
      setCategory: s.setCategory,
      togglePin: s.togglePin,
    })),
  )
  const entries = queryEntries || storeEntries
  const [expandedId, setExpandedId] = useState<string | null>("k-1")
  const [photoBoothVisible, setPhotoBoothVisible] = useState(false)

  const filteredEntries = useMemo(
    () => (selectedCategory === "all" ? entries : entries.filter((e) => e.category === selectedCategory)),
    [selectedCategory, entries],
  )

  const renderItem = useCallback(
    ({ item: entry }: { item: KnowledgeEntry }) => {
      const isExpanded = expandedId === entry.id

      return (
        <Card style={[styles.entryCard, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Badge
              label={entry.category.toUpperCase()}
              tone={
                entry.category === "wisdom"
                  ? "warning"
                  : entry.category === "story"
                  ? "info"
                  : entry.category === "recipe"
                  ? "success"
                  : "neutral"
              }
              size="small"
            />
            <PressableScale
              onPress={() => {
                void Haptics.selectionAsync()
                togglePinMutation.mutate(entry.id)
              }}
              style={styles.pinButton}
            >
              <Ionicons
                name={entry.isPinned ? "pin" : "pin-outline"}
                size={18}
                color={entry.isPinned ? colors.primary : colors.text.muted}
              />
            </PressableScale>
          </View>

          <PressableScale
            onPress={() => {
              void Haptics.selectionAsync()
              setExpandedId(isExpanded ? null : entry.id)
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <AppText variant="subheading" style={styles.entryTitle}>
                {entry.title}
              </AppText>
              {entry.photoFrame && (
                <View style={[styles.photoFrameBadge, { borderColor: "#DA7756" }]}>
                  <Ionicons name="camera-outline" size={11} color="#DA7756" style={{ marginRight: 3 }} />
                  <AppText style={{ fontSize: 10, fontWeight: "800", color: "#DA7756" }}>
                    POLAROID
                  </AppText>
                </View>
              )}
            </View>

            <AppText variant="caption" style={styles.authorLine}>
              Recorded by <AppText style={{ fontWeight: "700" }}>{entry.authorName}</AppText> ({entry.authorRole}) · {entry.createdAt}
            </AppText>

            <AppText variant="body" style={styles.excerpt}>
              {isExpanded ? entry.body : entry.excerpt}
            </AppText>
          </PressableScale>

          {/* Tags */}
          {entry.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {entry.tags.map((tag) => (
                <View key={tag} style={[styles.tagChip, { backgroundColor: colors.surface2 }]}>
                  <AppText variant="caption" style={{ color: colors.text.secondary, fontSize: 10.5 }}>
                    #{tag}
                  </AppText>
                </View>
              ))}
            </View>
          )}
        </Card>
      )
    },
    [colors, expandedId, togglePin],
  )

  const listHeader = useMemo(
    () => (
      <View style={{ marginBottom: 12 }}>
        <SanctuaryLargeTitle
          title="Knowledge Sanctuary"
          subtitle="Family Stories, Heirloom Recipes & Traditions Vault"
        />

        {/* Photo Booth Quick Launch Banner */}
        <PressableScale
          style={[styles.photoBoothBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setPhotoBoothVisible(true)
          }}
        >
          <View style={[styles.photoBoothIconCircle, { backgroundColor: colors.primaryAlpha }]}>
            <Ionicons name="camera" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <AppText variant="subheading" style={{ fontWeight: "700" }}>
                Family Photo Booth
              </AppText>
              <Badge label="100% Free" tone="success" size="small" />
            </View>
            <AppText variant="caption" style={{ color: colors.text.secondary, marginTop: 2 }}>
              Framed heirlooms & polaroids captured locally into your Sanctuary
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
        </PressableScale>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.key
            return (
              <PressableScale
                key={cat.key}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? colors.primary : colors.surface2,
                  },
                ]}
                onPress={() => {
                  void Haptics.selectionAsync()
                  setCategory(cat.key)
                }}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={active ? "#FFFFFF" : colors.text.secondary}
                  style={{ marginRight: 6 }}
                />
                <AppText
                  variant="caption"
                  style={[styles.filterPillText, { color: active ? "#FFFFFF" : colors.text.secondary }]}
                >
                  {cat.label}
                </AppText>
              </PressableScale>
            )
          })}
        </ScrollView>
      </View>
    ),
    [colors, selectedCategory, setCategory],
  )

  const listFooter = useMemo(
    () => (
      <View style={{ paddingTop: 16 }}>
        <AppButton
          title="+ Add Knowledge or Recipe to Sanctuary"
          variant="outline"
          onPress={() => router.push("/modal/add-knowledge")}
        />
      </View>
    ),
    [],
  )

  const emptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="book-outline" size={40} color={colors.text.muted} />
        <AppText variant="subheading" style={{ marginTop: 8, color: colors.text.secondary }}>
          No entries found in this category
        </AppText>
      </View>
    ),
    [colors],
  )

  return (
    <ScreenContainer
      safeArea
      scrollMode="external"
      dockBehavior="auto-hide"
      header={
        <SanctuaryHeader
          eyebrow="SANCTUARY VAULT"
          title="Knowledge Sanctuary"
          subtitle="Family Stories, Heirloom Recipes & Traditions Vault"
          rightAction={
            <HeaderIconButton
              icon="add"
              label="Preserve Knowledge"
              onPress={() => router.push("/modal/add-knowledge")}
            />
          }
        />
      }
    >
      <ScreenFlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={emptyComponent}
        contentContainerStyle={{ flexGrow: 1 }}
      />

      {/* ── Family Photo Booth Modal ── */}
      <FamilyPhotoBoothModal
        visible={photoBoothVisible}
        onClose={() => setPhotoBoothVisible(false)}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  photoBoothBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  photoBoothIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  photoFrameBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  filterRow: {
    gap: 8,
    marginBottom: 16,
    paddingRight: 16,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterPillText: {
    fontWeight: "600",
  },
  entryCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  pinButton: {
    padding: 4,
  },
  entryTitle: {
    fontWeight: "700",
    fontSize: 16,
  },
  authorLine: {
    color: "#777",
    marginTop: 4,
    marginBottom: 8,
    fontSize: 11,
  },
  excerpt: {
    color: "#444",
    lineHeight: 22,
    fontSize: 13.5,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
})
