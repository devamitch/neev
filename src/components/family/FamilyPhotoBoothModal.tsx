import React, { useState } from "react"
import { ScrollView, StyleSheet, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppBottomSheetModal } from "@/components/ui/AppBottomSheetModal"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Badge"
import { PressableScale } from "@/components/ui/PressableScale"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useKnowledgeStore } from "@/stores/useKnowledgeStore"
import { useRootStore } from "@/stores/useRootStore"
import { useColors } from "@/theme/useTheme"

export interface FamilyPhotoBoothModalProps {
  visible: boolean
  onClose: () => void
}

export type HeritageFrame = "ivory" | "pista" | "terracotta" | "vintage"

interface FrameOption {
  id: HeritageFrame
  name: string
  borderColor: string
  bgColor: string
  accentColor: string
  icon: keyof typeof Ionicons.glyphMap
}

const FRAMES: FrameOption[] = [
  {
    id: "ivory",
    name: "Heritage Ivory",
    borderColor: "#E5E7EB",
    bgColor: "#FAFBF9",
    accentColor: "#141F1C",
    icon: "sparkles-outline",
  },
  {
    id: "pista",
    name: "Sanctuary Pista",
    borderColor: "#A8C0B8",
    bgColor: "#EAF0EB",
    accentColor: "#2E4233",
    icon: "leaf-outline",
  },
  {
    id: "terracotta",
    name: "Terracotta Hearth",
    borderColor: "#F3A992",
    bgColor: "#FDF2EE",
    accentColor: "#7C2D12",
    icon: "flame-outline",
  },
  {
    id: "vintage",
    name: "Vintage Sepia",
    borderColor: "#D7CCC8",
    bgColor: "#EFEBE9",
    accentColor: "#4E342E",
    icon: "image-outline",
  },
]

const SAMPLE_MEMORIES = [
  {
    title: "Sunday Afternoon Chai on the Verandah",
    note: "All three generations gathered with freshly boiled ginger chai, warm samosas, and Dadu reciting his favorite Tagore poems.",
    tags: ["ChaiTime", "FamilyGathering", "Tradition"],
  },
  {
    title: "Dida Teaching Secret Chenna Sweets",
    note: "Pooja and Dida gently kneading fresh cottage cheese pearls in the morning sun. The fragrant cardamom aroma filled the entire courtyard.",
    tags: ["HeirloomRecipe", "SweetMoments", "Heritage"],
  },
  {
    title: "Simba's Rainy Season Garden Dash",
    note: "Simba chased butterflies through the wet lemongrass patch and returned with muddy paws and the happiest wagging tail.",
    tags: ["SimbaPup", "RainyDay", "Laughter"],
  },
]

export function FamilyPhotoBoothModal({ visible, onClose }: FamilyPhotoBoothModalProps) {
  const colors = useColors()
  const members = useFamilyStore((s) => s.members)
  const addEntry = useKnowledgeStore((s) => s.addEntry)
  const showToast = useRootStore((s) => s.showToast)

  const [selectedFrame, setSelectedFrame] = useState<HeritageFrame>("pista")
  const [title, setTitle] = useState("Sunday Afternoon Chai on the Verandah")
  const [note, setNote] = useState(
    "All three generations gathered with freshly boiled ginger chai, warm samosas, and laughter echoing across the sanctuary.",
  )
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || "m-4")
  const [tagInput, setTagInput] = useState("Tradition, Laughter, Sanctuary")

  const activeFrame = FRAMES.find((f) => f.id === selectedFrame) || FRAMES[0]
  const authorMember = members.find((m) => m.id === selectedMemberId) || members[0]

  const handleApplyPreset = (preset: (typeof SAMPLE_MEMORIES)[0]) => {
    void Haptics.selectionAsync()
    setTitle(preset.title)
    setNote(preset.note)
    setTagInput(preset.tags.join(", "))
  }

  const handleSaveMemory = () => {
    if (!title.trim()) {
      showToast({ message: "Please provide a title for your photo memory", type: "warning" })
      return
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)

    addEntry({
      title: title.trim(),
      category: "tradition",
      authorName: authorMember?.name || "Sanctuary Family",
      authorRole: authorMember?.relationship || "Family Member",
      excerpt: note.slice(0, 110) + (note.length > 110 ? "..." : ""),
      body: note.trim(),
      tags: tags.length > 0 ? tags : ["SanctuaryMemory", "Tradition"],
      isPinned: true,
      photoFrame: selectedFrame,
    })

    showToast({
      message: `Framed photo memory saved to Sanctuary Vault!`,
      type: "success",
    })
    onClose()
  }

  const insets = useSafeAreaInsets()

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Family Photo Booth"
      subtitle="100% Free offline framed memories & heirloom polaroids"
      eyebrow="SANCTUARY MEMORY BOOTH"
      maxHeight="92%"
    >
      <ScrollView
        showsVerticalScrollIndicator={true}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 40 },
        ]}
        keyboardDismissMode="on-drag"
      >
        {/* 100% Free Guarantee Banner */}
        <View style={[styles.freeBadgeBanner, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Ionicons name="gift-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <AppText variant="caption" style={{ color: colors.text.primary, fontWeight: "700" }}>
            100% Free & Private — Captured locally into your offline Vault
          </AppText>
        </View>

        {/* Live Framed Memory Preview (Polaroid Style) */}
        <View style={styles.previewContainer}>
          <View
            style={[
              styles.polaroidFrame,
              {
                backgroundColor: activeFrame.bgColor,
                borderColor: activeFrame.borderColor,
              },
            ]}
          >
            {/* Inner Photo Area */}
            <View style={[styles.photoArtSurface, { backgroundColor: colors.surface }]}>
              <View style={styles.photoArtCenter}>
                <Ionicons name="camera" size={32} color={activeFrame.accentColor} />
                <AppText
                  variant="caption"
                  style={{
                    fontWeight: "800",
                    color: activeFrame.accentColor,
                    marginTop: 6,
                    letterSpacing: 0.5,
                  }}
                >
                  SANCTUARY POLAROID
                </AppText>
                <AppText style={{ fontSize: 10, color: colors.text.muted, marginTop: 2 }}>
                  Framed with {activeFrame.name}
                </AppText>
              </View>

              {/* Decorative Wax Seal Stamp */}
              <View style={[styles.waxSeal, { borderColor: activeFrame.accentColor }]}>
                <AppText style={[styles.waxSealText, { color: activeFrame.accentColor }]}>NEEV</AppText>
              </View>
            </View>

            {/* Polaroid Bottom Caption Area */}
            <View style={styles.polaroidFooter}>
              <AppText variant="subheading" style={[styles.captionTitle, { color: activeFrame.accentColor }]}>
                {title || "Untitled Memory"}
              </AppText>
              <AppText variant="caption" style={styles.captionNote} numberOfLines={2}>
                &ldquo;{note || "A cherished family moment preserved forever."}&rdquo;
              </AppText>
              <View style={styles.captionMetaRow}>
                <AppText style={[styles.captionAuthor, { color: activeFrame.accentColor }]}>
                  {authorMember?.name ? `${authorMember.name} (${authorMember.relationship})` : "Family Heritage"}
                </AppText>
                <AppText style={styles.captionDate}>
                  {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </AppText>
              </View>
            </View>
          </View>
        </View>

        {/* Frame Style Selector */}
        <AppText variant="caption" style={styles.sectionHeader}>
          CHOOSE HERITAGE FRAME
        </AppText>
        <View style={styles.framesRow}>
          {FRAMES.map((f) => {
            const isSelected = selectedFrame === f.id
            return (
              <PressableScale
                key={f.id}
                style={[
                  styles.frameChip,
                  {
                    backgroundColor: isSelected ? colors.surface : colors.surface2,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => {
                  void Haptics.selectionAsync()
                  setSelectedFrame(f.id)
                }}
              >
                <View style={[styles.frameColorCircle, { backgroundColor: f.bgColor, borderColor: f.borderColor }]}>
                  <Ionicons name={f.icon} size={14} color={f.accentColor} />
                </View>
                <AppText
                  variant="caption"
                  style={{
                    fontWeight: isSelected ? "800" : "600",
                    fontSize: 11,
                    color: isSelected ? colors.primary : colors.text.primary,
                    marginTop: 4,
                  }}
                  numberOfLines={1}
                >
                  {f.name.split(" ")[1] || f.name}
                </AppText>
              </PressableScale>
            )
          })}
        </View>

        {/* Memory Presets */}
        <View style={styles.presetSection}>
          <AppText variant="caption" style={styles.sectionHeader}>
            INSPIRING FAMILY MOMENTS
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
            {SAMPLE_MEMORIES.map((m, i) => (
              <PressableScale
                key={i}
                style={[styles.presetCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                onPress={() => handleApplyPreset(m)}
              >
                <Ionicons name="sparkles" size={13} color="#D97706" style={{ marginRight: 4 }} />
                <AppText variant="caption" style={{ fontWeight: "700", color: colors.text.primary }}>
                  {m.title.split(" ")[0]} {m.title.split(" ")[1]}
                </AppText>
              </PressableScale>
            ))}
          </ScrollView>
        </View>

        {/* Memory Inputs */}
        <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="caption" style={styles.inputLabel}>
            Memory / Tradition Title
          </AppText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Sunday Afternoon Chai"
            placeholderTextColor={colors.text.muted}
            style={[styles.textInput, { color: colors.text.primary, borderColor: colors.border }]}
          />

          <AppText variant="caption" style={[styles.inputLabel, { marginTop: 10 }]}>
            Recorded By Family Member
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberPillRow}>
            {members.map((m) => {
              const isSelected = selectedMemberId === m.id
              return (
                <PressableScale
                  key={m.id}
                  style={[
                    styles.memberPill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surface2,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setSelectedMemberId(m.id)
                  }}
                >
                  <AppText
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: isSelected ? "#FFFFFF" : colors.text.primary,
                    }}
                  >
                    {m.nickname || m.name.split(" ")[0]} ({m.relationship})
                  </AppText>
                </PressableScale>
              )
            })}
          </ScrollView>

          <AppText variant="caption" style={[styles.inputLabel, { marginTop: 10 }]}>
            Memory Note & Family Details
          </AppText>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            placeholder="Describe who was there, what was made, and the words spoken..."
            placeholderTextColor={colors.text.muted}
            style={[styles.textArea, { color: colors.text.primary, borderColor: colors.border }]}
          />

          <AppText variant="caption" style={[styles.inputLabel, { marginTop: 10 }]}>
            Heritage Tags (comma-separated)
          </AppText>
          <TextInput
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="e.g. Tradition, Gathering, Sweet"
            placeholderTextColor={colors.text.muted}
            style={[styles.textInput, { color: colors.text.primary, borderColor: colors.border }]}
          />
        </View>

        {/* Save Button */}
        <PressableScale
          style={[styles.saveMemoryBtn, { backgroundColor: colors.primary }]}
          onPress={handleSaveMemory}
          accessibilityRole="button"
          accessibilityLabel="Frame and Save to Sanctuary Vault"
        >
          <Ionicons name="archive-outline" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
          <AppText style={styles.saveMemoryBtnText}>Frame & Save to Sanctuary Vault</AppText>
        </PressableScale>
      </ScrollView>
    </AppBottomSheetModal>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  freeBadgeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  previewContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  polaroidFrame: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
  },
  photoArtSurface: {
    height: 160,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    position: "relative",
  },
  photoArtCenter: {
    alignItems: "center",
  },
  waxSeal: {
    position: "absolute",
    bottom: 8,
    right: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  waxSealText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  polaroidFooter: {
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  captionTitle: {
    fontWeight: "800",
    fontSize: 16,
  },
  captionNote: {
    color: "#4B5563",
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 18,
  },
  captionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  captionAuthor: {
    fontWeight: "700",
    fontSize: 11,
  },
  captionDate: {
    fontSize: 11,
    color: "#6B7280",
  },
  sectionHeader: {
    fontWeight: "700",
    letterSpacing: 0.8,
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 8,
  },
  framesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  frameChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  frameColorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  presetSection: {
    marginBottom: 14,
  },
  presetsRow: {
    gap: 8,
  },
  presetCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  formCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  inputLabel: {
    fontWeight: "700",
    color: "#374151",
    fontSize: 12,
    marginBottom: 4,
  },
  textInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  textArea: {
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    textAlignVertical: "top",
  },
  memberPillRow: {
    gap: 6,
    paddingVertical: 4,
  },
  memberPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  saveMemoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 50,
  },
  saveMemoryBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
})
