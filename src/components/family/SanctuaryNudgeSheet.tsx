import React, { useState } from "react"
import { StyleSheet, View, TextInput, ScrollView } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppBottomSheetModal } from "@/components/ui/AppBottomSheetModal"
import { AppText } from "@/components/ui/AppText"
import { PressableScale } from "@/components/ui/PressableScale"
import { Badge } from "@/components/ui/Badge"
import { useColors } from "@/theme/useTheme"
import { notificationsService } from "@/services/notifications/notificationsService"
import { useRootStore } from "@/stores/useRootStore"
import type { FamilyMember } from "@/stores/slices/createFamilySlice"
import type { FamilyLocationData } from "@/services/location/familyLocationService"

export interface NudgeTemplate {
  id: string
  title: string
  body: string
  icon: keyof typeof Ionicons.glyphMap
  category: "care" | "wellness" | "home" | "presence"
}

export const NUDGE_TEMPLATES: NudgeTemplate[] = [
  {
    id: "thinking_of_you",
    title: "Thinking of You",
    body: "Just sending warmth and love. Hope your day is serene and peaceful.",
    icon: "heart-outline",
    category: "presence",
  },
  {
    id: "drink_water_meds",
    title: "Hydration & Wellness",
    body: "Gentle reminder to pause, drink a glass of water, or take afternoon medicine.",
    icon: "water-outline",
    category: "wellness",
  },
  {
    id: "sanctuary_safe",
    title: "All Safe at Sanctuary",
    body: "Roots are steady. Everyone at home is safe, relaxed, and smiling.",
    icon: "home-outline",
    category: "home",
  },
  {
    id: "heading_home",
    title: "Heading Home Now",
    body: "Wrapping up and making my way back to the sanctuary. See you soon!",
    icon: "navigate-outline",
    category: "presence",
  },
  {
    id: "family_chai",
    title: "Chai & Family Time",
    body: "Tea is brewing! Gathering together in the living room for a quick break.",
    icon: "cafe-outline",
    category: "care",
  },
]

export interface SanctuaryNudgeSheetProps {
  visible: boolean
  onClose: () => void
  member?: FamilyMember | null
  locationData?: FamilyLocationData | null
}

export function SanctuaryNudgeSheet({
  visible,
  onClose,
  member,
  locationData,
}: SanctuaryNudgeSheetProps) {
  const colors = useColors()
  const showToast = useRootStore((s) => s.showToast)
  const addMindfulNotification = useRootStore((s) => s.addMindfulNotification)

  const [selectedTemplate, setSelectedTemplate] = useState<NudgeTemplate>(NUDGE_TEMPLATES[0])
  const [customNote, setCustomNote] = useState("")
  const [priority, setPriority] = useState<"gentle" | "high">("gentle")

  const targetName =
    member?.nickname ||
    member?.name?.split(" ")[0] ||
    locationData?.memberNickname ||
    locationData?.memberName?.split(" ")[0] ||
    "Family Member"

  const handleSendNudge = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const finalBody = customNote.trim()
      ? `${selectedTemplate.body} "${customNote.trim()}"`
      : selectedTemplate.body

    const notifTitle = `Sanctuary Nudge · ${selectedTemplate.title}`

    // 1. Dispatch real device tray notification via notificationsService
    await notificationsService.dispatchImmediateNotification(
      `${notifTitle} to ${targetName}`,
      finalBody,
    )

    // 2. Also register mindful notification in-app
    addMindfulNotification({
      title: notifTitle,
      body: finalBody,
      category: "sanctuary_nudge",
      space: "family",
      actionLabel: "View Sanctuary Map",
      actionRoute: "/(app)/map",
    })

    showToast({
      title: "Loving Nudge Sent",
      message: `Dispatched "${selectedTemplate.title}" to ${targetName}.`,
      type: "success",
    })

    setCustomNote("")
    onClose()
  }

  const insets = useSafeAreaInsets()

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      eyebrow="SANCTUARY CHECK-IN"
      title={`Nudge ${targetName}`}
      subtitle="Send a gentle, heartfelt check-in without noisy disruptions"
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.container, { paddingBottom: 16 }]}>
        {/* Recipient summary bar */}
        <View style={[styles.recipientBar, { backgroundColor: colors.surface2 }]}>
          <View
            style={[
              styles.avatarBadge,
              { backgroundColor: member?.avatarColor || locationData?.avatarColor || colors.primary },
            ]}
          >
            <AppText style={styles.avatarText}>
              {member?.avatarText || targetName[0] || "F"}
            </AppText>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <AppText variant="subheading" style={styles.recipientName}>
              {member?.name || locationData?.memberName || targetName}
            </AppText>
            <AppText variant="caption" style={{ color: colors.text.secondary }}>
              {locationData?.placeName || "Sanctuary Home"} · {locationData?.batteryLevel ?? 100}% Battery
            </AppText>
          </View>
          <Badge label={priority === "high" ? "High Priority" : "Gentle"} tone={priority === "high" ? "warning" : "neutral"} size="small" />
        </View>

        {/* Nudge templates list */}
        <AppText variant="overline" style={[styles.sectionHeading, { color: colors.accentText }]}>
          SELECT THOUGHTFUL MESSAGE
        </AppText>

        <View style={styles.templateList}>
          {NUDGE_TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplate.id === tmpl.id
            return (
              <PressableScale
                key={tmpl.id}
                style={[
                  styles.templateCard,
                  {
                    backgroundColor: isSelected ? colors.surface : colors.surface2,
                    borderColor: isSelected ? "#DA7756" : colors.border,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
                onPress={() => {
                  void Haptics.selectionAsync()
                  setSelectedTemplate(tmpl)
                }}
                accessibilityRole="button"
                accessibilityLabel={`${tmpl.title}: ${tmpl.body}`}
                accessibilityState={{ selected: isSelected }}
              >
                <View
                  style={[
                    styles.templateIconWrap,
                    { backgroundColor: isSelected ? "rgba(218, 119, 86, 0.12)" : colors.surface },
                  ]}
                >
                  <Ionicons
                    name={tmpl.icon}
                    size={20}
                    color={isSelected ? "#DA7756" : colors.text.secondary}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <AppText
                    variant="bodyMedium"
                    style={{
                      fontWeight: "700",
                      color: isSelected ? "#DA7756" : colors.text.primary,
                      fontSize: 14,
                    }}
                  >
                    {tmpl.title}
                  </AppText>
                  <AppText
                    variant="caption"
                    style={{ color: colors.text.secondary, marginTop: 2, lineHeight: 16 }}
                  >
                    {tmpl.body}
                  </AppText>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color="#DA7756" style={{ marginLeft: 6 }} />
                )}
              </PressableScale>
            )
          })}
        </View>

        {/* Custom note optional input */}
        <View style={styles.customNoteWrap}>
          <AppText variant="caption" style={{ color: colors.text.secondary, marginBottom: 6 }}>
            Add a personal touch (optional)
          </AppText>
          <TextInput
            value={customNote}
            onChangeText={setCustomNote}
            placeholder="e.g. Grandma has made hot samosas for you!"
            placeholderTextColor={colors.text.muted}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text.primary,
              },
            ]}
            maxLength={100}
          />
        </View>

        {/* Priority Selector Pills */}
        <View style={styles.priorityRow}>
          <PressableScale
            style={[
              styles.priorityPill,
              {
                backgroundColor: priority === "gentle" ? colors.surface : colors.surface2,
                borderColor: priority === "gentle" ? colors.primary : colors.border,
                borderWidth: priority === "gentle" ? 1.5 : 1,
              },
            ]}
            onPress={() => {
              void Haptics.selectionAsync()
              setPriority("gentle")
            }}
            accessibilityRole="button"
            accessibilityLabel="Gentle Silent Toast Notification"
            accessibilityState={{ selected: priority === "gentle" }}
          >
            <Ionicons name="leaf-outline" size={15} color={priority === "gentle" ? colors.primary : colors.text.secondary} />
            <AppText variant="caption" style={{ fontWeight: "700", color: priority === "gentle" ? colors.primary : colors.text.primary }}>
              Gentle (Silent Toast)
            </AppText>
          </PressableScale>

          <PressableScale
            style={[
              styles.priorityPill,
              {
                backgroundColor: priority === "high" ? colors.surface : colors.surface2,
                borderColor: priority === "high" ? "#DA7756" : colors.border,
                borderWidth: priority === "high" ? 1.5 : 1,
              },
            ]}
            onPress={() => {
              void Haptics.selectionAsync()
              setPriority("high")
            }}
            accessibilityRole="button"
            accessibilityLabel="High Priority Device Sound Alert"
            accessibilityState={{ selected: priority === "high" }}
          >
            <Ionicons name="notifications-outline" size={15} color={priority === "high" ? "#DA7756" : colors.text.secondary} />
            <AppText variant="caption" style={{ fontWeight: "700", color: priority === "high" ? "#DA7756" : colors.text.primary }}>
              Priority (Device Sound)
            </AppText>
          </PressableScale>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Footer */}
      <View
        style={[
          styles.stickyFooter,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 12,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <PressableScale
          style={[styles.sendButton, { backgroundColor: "#DA7756" }]}
          onPress={handleSendNudge}
          accessibilityRole="button"
          accessibilityLabel="Send Loving Nudge"
        >
          <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
          <AppText style={styles.sendButtonText}>Send Loving Nudge</AppText>
        </PressableScale>
      </View>
    </AppBottomSheetModal>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  recipientBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  recipientName: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionHeading: {
    letterSpacing: 1,
    marginBottom: 8,
  },
  templateList: {
    gap: 8,
  },
  templateCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
  },
  templateIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  customNoteWrap: {
    marginTop: 14,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 13.5,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  priorityPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: 12,
  },
  stickyFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 16,
    gap: 8,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
})
