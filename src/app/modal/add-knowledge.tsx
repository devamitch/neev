import React, { useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import * as Haptics from "expo-haptics"

import { AppHeader } from "@/components/ui/AppHeader"
import { AppText } from "@/components/ui/AppText"
import { AppButton } from "@/components/ui/AppButton"
import { TextField } from "@/components/ui/TextField"
import { ScreenContainer } from "@/components/ui/ScreenContainer"
import { PressableScale } from "@/components/ui/PressableScale"
import { useColors } from "@/theme/useTheme"
import { useKnowledgeStore, type KnowledgeCategory } from "@/stores/useKnowledgeStore"

import { useRootStore } from "@/stores/useRootStore"
import { makeExcerpt } from "@/utils/textUtils"

const CATEGORIES: { key: KnowledgeCategory; label: string }[] = [
  { key: "story", label: "Family Story" },
  { key: "recipe", label: "Heirloom Recipe" },
  { key: "wisdom", label: "Elder Wisdom" },
  { key: "tradition", label: "Tradition / Ritual" },
  { key: "project", label: "Pet / House Project" },
]

export default function AddKnowledgeModal() {
  const colors = useColors()
  const addEntry = useKnowledgeStore((s) => s.addEntry)
  const user = useRootStore((s) => s.user)

  const [title, setTitle] = useState("")
  const [authorName, setAuthorName] = useState(user?.displayName || "")
  const [authorRole, setAuthorRole] = useState("")
  const [body, setBody] = useState("")
  const [category, setCategory] = useState<KnowledgeCategory>("recipe")
  const [tagsInput, setTagsInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = () => {
    if (!title.trim() || !body.trim() || isSaving) return
    setIsSaving(true)
    try {
      addEntry({
        title: title.trim(),
        authorName: authorName.trim() || user?.displayName || "Family Member",
        authorRole: authorRole.trim() || "Contributor",
        excerpt: makeExcerpt(body, 80),
        body: body.trim(),
        category,
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        isPinned: false,
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.back()
    } catch {
      setIsSaving(false)
    }
  }

  return (
    <ScreenContainer
      safeArea
      scrollable
      header={
        <AppHeader
          title="Record Knowledge"
          subtitle="Shared Family Sanctuary Vault"
          showBack
        />
      }
    >
        <TextField
          label="Title"
          placeholder="e.g. Dadi's Spiced Kadha, Ancestral Land Location"
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.sectionMargin}>
          <AppText variant="caption" style={styles.label}>
            CATEGORY
          </AppText>
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.key
              return (
                <PressableScale
                  key={cat.key}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: active ? colors.primary : colors.surface2,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setCategory(cat.key)
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{ color: active ? "#FFFFFF" : colors.text.secondary, fontWeight: "600" }}
                  >
                    {cat.label}
                  </AppText>
                </PressableScale>
              )
            })}
          </View>
        </View>

        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextField label="Author Name" placeholder="e.g. Aparna Chakraborty" value={authorName} onChangeText={setAuthorName} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <TextField label="Role" placeholder="e.g. Dida" value={authorRole} onChangeText={setAuthorRole} />
          </View>
        </View>

        <TextField
          label="Knowledge or Recipe Text"
          placeholder="Detailed ingredients, life lesson, instructions, memories..."
          value={body}
          onChangeText={setBody}
          multiline
        />

        <TextField
          label="Tags (comma separated)"
          placeholder="Ayurveda, Immunity, Winter, Ancestry"
          value={tagsInput}
          onChangeText={setTagsInput}
        />

        <AppButton
          title={isSaving ? "Preserving..." : "Preserve in Sanctuary Vault"}
          variant="primary"
          onPress={handleSave}
          disabled={!title.trim() || !body.trim() || isSaving}
          style={{ marginTop: 24, marginBottom: 40 }}
        />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  sectionMargin: {
    marginVertical: 4,
  },
  label: {
    fontWeight: "700",
    color: "#777",
    marginBottom: 8,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  rowInputs: {
    flexDirection: "row",
  },
})
