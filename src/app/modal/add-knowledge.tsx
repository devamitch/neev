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

const CATEGORIES: { key: KnowledgeCategory; label: string }[] = [
  { key: "wisdom", label: "Elder Wisdom" },
  { key: "recipe", label: "Heirloom Recipe" },
  { key: "tradition", label: "Tradition / Ritual" },
  { key: "health", label: "Health / Lifeline" },
]

export default function AddKnowledgeModal() {
  const colors = useColors()
  const addEntry = useKnowledgeStore((s) => s.addEntry)

  const [title, setTitle] = useState("")
  const [authorName, setAuthorName] = useState("Aparna Chakraborty")
  const [authorRole, setAuthorRole] = useState("Grandmother (Dida)")
  const [body, setBody] = useState("")
  const [category, setCategory] = useState<KnowledgeCategory>("recipe")
  const [tagsInput, setTagsInput] = useState("Heritage, Family")

  const handleSave = () => {
    if (!title.trim() || !body.trim()) return
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    addEntry({
      title: title.trim(),
      authorName: authorName.trim() || "Elder",
      authorRole: authorRole.trim() || "Family Member",
      excerpt: body.trim().slice(0, 80) + "...",
      body: body.trim(),
      category,
      tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      isPinned: false,
    })
    router.back()
  }

  return (
    <ScreenContainer scrollable={false} style={{ backgroundColor: colors.background }}>
      <AppHeader
        title="Record Knowledge"
        subtitle="Shared Family Sanctuary Vault"
        showBack
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
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
          title="Preserve in Sanctuary Vault"
          variant="primary"
          onPress={handleSave}
          disabled={!title.trim() || !body.trim()}
          style={{ marginTop: 24, marginBottom: 40 }}
        />
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 14,
  },
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  rowInputs: {
    flexDirection: "row",
  },
})
