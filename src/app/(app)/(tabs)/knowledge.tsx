import React, { useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppHeader, HeaderIconButton } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { PressableScale } from "@/components/ui/PressableScale"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { useColors } from "@/theme/useTheme"
import { useTabBarInset } from "@/components/navigation/CustomTabBar"
import { useKnowledgeStore, type KnowledgeCategory } from "@/stores/useKnowledgeStore"
import { useShallow } from "@/stores/useRootStore"

const CATEGORIES: { key: KnowledgeCategory | "all"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "all", label: "All Vault", icon: "albums-outline" },
  { key: "story", label: "Family Stories", icon: "book-outline" },
  { key: "recipe", label: "Heirloom Recipes", icon: "restaurant-outline" },
  { key: "wisdom", label: "Elder Wisdom", icon: "bulb-outline" },
  { key: "tradition", label: "Rituals & Mandir", icon: "flame-outline" },
  { key: "project", label: "Pet Projects", icon: "hammer-outline" },
]

export default function KnowledgeScreen() {
  const colors = useColors()
  const bottomInset = useTabBarInset()
  const { entries, selectedCategory, setCategory, togglePin } = useKnowledgeStore(
    useShallow((s) => ({
      entries: s.entries,
      selectedCategory: s.selectedCategory,
      setCategory: s.setCategory,
      togglePin: s.togglePin,
    })),
  )
  const [expandedId, setExpandedId] = useState<string | null>("k-1")

  const filteredEntries = React.useMemo(
    () => (selectedCategory === "all" ? entries : entries.filter((e) => e.category === selectedCategory)),
    [selectedCategory, entries],
  )

  return (
    <ScreenContainer
      safeArea
      scrollable
      header={
        <AppHeader
          sticky
          title="Knowledge Sanctuary"
          subtitle="Family Stories, Heirloom Recipes & Traditions Vault"
          showBack={false}
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
        {/* Category Pills (Zero Borders) */}
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

        {/* Entries List */}
        <View style={styles.entriesList}>
          {filteredEntries.map((entry) => {
            const isExpanded = expandedId === entry.id

            return (
              <Card key={entry.id} style={[styles.entryCard, { backgroundColor: colors.surface }]}>
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
                      togglePin(entry.id)
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
                  <AppText variant="subheading" style={styles.entryTitle}>
                    {entry.title}
                  </AppText>

                  <AppText variant="caption" style={styles.authorLine}>
                    Recorded by <AppText style={{ fontWeight: "700" }}>{entry.authorName}</AppText> ({entry.authorRole}) · {entry.createdAt}
                  </AppText>

                  <AppText variant="body" style={styles.excerpt}>
                    {isExpanded ? entry.body : entry.excerpt}
                  </AppText>
                </PressableScale>

                {/* Tags */}
                <View style={styles.tagsRow}>
                  {entry.tags.map((tag) => (
                    <View key={tag} style={[styles.tagChip, { backgroundColor: colors.surface2 }]}>
                      <AppText variant="caption" style={{ color: colors.text.secondary, fontSize: 10.5 }}>
                        #{tag}
                      </AppText>
                    </View>
                  ))}
                </View>
              </Card>
            )
          })}
        </View>

        {/* Add Entry Button */}
        <AppButton
          title="+ Add Knowledge or Recipe to Sanctuary"
          variant="outline"
          onPress={() => router.push("/modal/add-knowledge")}
          style={{ marginTop: 16 }}
        />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
  entriesList: {
    gap: 14,
  },
  entryCard: {
    padding: 16,
    borderRadius: 18,
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
