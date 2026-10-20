import React, { useState } from "react"
import { Alert, StyleSheet, TextInput, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

import { AppBottomSheetModal } from "@/components/ui/AppBottomSheetModal"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Badge"
import { PressableScale } from "@/components/ui/PressableScale"
import { useByokStore } from "@/stores/useByokStore"
import { useRootStore } from "@/stores/useRootStore"
import { useColors } from "@/theme/useTheme"
import type { AiProvider } from "@/services/ai/byokManager"

export interface ByokModalProps {
  visible: boolean
  onClose: () => void
}

const PROVIDERS: { id: AiProvider; name: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "google", name: "Google Gemini", subtitle: "Gemini 1.5 Flash • Free tier available", icon: "logo-google" },
  { id: "openai", name: "OpenAI", subtitle: "GPT-4o • Personal API key", icon: "sparkles-outline" },
  { id: "groq", name: "Groq", subtitle: "Llama-3 70B • High-speed inference", icon: "flash-outline" },
  { id: "anthropic", name: "Anthropic", subtitle: "Claude 3.5 Sonnet", icon: "hardware-chip-outline" },
]

export function ByokModal({ visible, onClose }: ByokModalProps) {
  const colors = useColors()
  const showToast = useRootStore((s) => s.showToast)
  const {
    credentials,
    deterministicOnlyMode,
    setDeterministicOnlyMode,
    saveCredential,
    removeCredential,
    testConnection,
  } = useByokStore()

  const [selectedProvider, setSelectedProvider] = useState<AiProvider>("google")
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [isSecure, setIsSecure] = useState(true)
  const [isTesting, setIsTesting] = useState(false)

  const activeCred = credentials.find((c) => c.provider === selectedProvider)

  const handleSave = () => {
    if (!apiKeyInput.trim()) {
      showToast({ message: "Please enter an API key", type: "warning" })
      return
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    saveCredential(selectedProvider, apiKeyInput.trim())
    setApiKeyInput("")
    showToast({ message: `${selectedProvider.toUpperCase()} key securely saved!`, type: "success" })
  }

  const handleTest = async (provider: AiProvider) => {
    setIsTesting(true)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      const res = await testConnection(provider)
      if (res.success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        showToast({ message: "Connection verified successfully!", type: "success" })
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        showToast({ message: res.message || "Connection failed. Please check key.", type: "error" })
      }
    } catch {
      showToast({ message: "Failed to test connection.", type: "error" })
    } finally {
      setIsTesting(false)
    }
  }

  const handleDelete = (provider: AiProvider) => {
    Alert.alert(
      "Remove API Key",
      `Are you sure you want to remove your ${provider.toUpperCase()} API key?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            removeCredential(provider)
            showToast({ message: "Key removed.", type: "info" })
          },
        },
      ],
    )
  }

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Bring Your Own Key (BYOK)"
      subtitle="Encrypted on-device keys or 100% offline deterministic math"
      eyebrow="AI ENGINE & CREDENTIALS"
      maxHeight="90%"
    >
      <View style={styles.container}>
        {/* Offline Deterministic Guarantee Banner */}
        <View style={[styles.offlineBanner, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Ionicons name="shield-checkmark" size={18} color="#2E7D32" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <AppText variant="caption" style={{ fontWeight: "700", color: colors.text.primary }}>
              100% Free & Offline Deterministic By Default
            </AppText>
            <AppText variant="caption" style={{ color: colors.text.secondary, marginTop: 2, fontSize: 11 }}>
              Neev operates completely free without requiring any API keys. All chore balance, schedules, and routines run locally on device. Adding your own key is completely optional.
            </AppText>
          </View>
        </View>

        {/* Provider Selector Tabs */}
        <AppText variant="caption" style={styles.sectionHeader}>
          SELECT AI PROVIDER
        </AppText>
        <View style={styles.providerGrid}>
          {PROVIDERS.map((p) => {
            const isSelected = selectedProvider === p.id
            const hasKey = credentials.some((c) => c.provider === p.id)
            return (
              <PressableScale
                key={p.id}
                style={[
                  styles.providerCard,
                  {
                    backgroundColor: isSelected ? colors.surface : colors.surface2,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
                onPress={() => {
                  void Haptics.selectionAsync()
                  setSelectedProvider(p.id)
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Ionicons
                    name={p.icon}
                    size={18}
                    color={isSelected ? colors.primary : colors.text.secondary}
                  />
                  {hasKey && (
                    <Badge label="Saved" tone="success" size="small" />
                  )}
                </View>
                <AppText
                  variant="caption"
                  style={{
                    fontWeight: "700",
                    marginTop: 6,
                    color: isSelected ? colors.primary : colors.text.primary,
                  }}
                >
                  {p.name}
                </AppText>
                <AppText
                  style={{
                    fontSize: 10,
                    color: colors.text.muted,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {p.subtitle}
                </AppText>
              </PressableScale>
            )
          })}
        </View>

        {/* Current Key Status / Input Form */}
        <View style={[styles.cardSurface, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {activeCred ? (
            <View style={styles.savedCredBox}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <AppText variant="subheading" style={{ fontWeight: "700" }}>
                    {activeCred.label}
                  </AppText>
                  <AppText variant="caption" style={{ color: colors.text.muted, marginTop: 2 }}>
                    Key: {activeCred.maskedKey}
                  </AppText>
                </View>
                <Badge
                  label={activeCred.status.toUpperCase()}
                  tone={activeCred.status === "active" ? "success" : activeCred.status === "invalid" ? "error" : "neutral"}
                  size="small"
                />
              </View>

              <View style={styles.actionRow}>
                <PressableScale
                  style={[styles.btnOutline, { borderColor: colors.border }]}
                  onPress={() => handleTest(activeCred.provider)}
                  disabled={isTesting}
                >
                  <Ionicons name="refresh-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                  <AppText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>
                    {isTesting ? "Testing..." : "Test Connection"}
                  </AppText>
                </PressableScale>

                <PressableScale
                  style={[styles.btnOutline, { borderColor: "#FCA5A5" }]}
                  onPress={() => handleDelete(activeCred.provider)}
                >
                  <Ionicons name="trash-outline" size={14} color="#DC2626" style={{ marginRight: 6 }} />
                  <AppText variant="caption" style={{ fontWeight: "700", color: "#DC2626" }}>
                    Remove Key
                  </AppText>
                </PressableScale>
              </View>
            </View>
          ) : (
            <View>
              <AppText variant="caption" style={{ fontWeight: "700", color: colors.text.primary, marginBottom: 6 }}>
                Enter {selectedProvider.toUpperCase()} API Key:
              </AppText>
              <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
                <TextInput
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  placeholder={`Paste ${selectedProvider} API key...`}
                  placeholderTextColor={colors.text.muted}
                  secureTextEntry={isSecure}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, { color: colors.text.primary }]}
                />
                <PressableScale onPress={() => setIsSecure(!isSecure)} style={{ padding: 6 }}>
                  <Ionicons
                    name={isSecure ? "eye-outline" : "eye-off-outline"}
                    size={16}
                    color={colors.text.muted}
                  />
                </PressableScale>
              </View>

              <PressableScale
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
              >
                <Ionicons name="lock-closed" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <AppText style={styles.saveBtnText}>Save Securely to Device</AppText>
              </PressableScale>
            </View>
          )}
        </View>
      </View>
    </AppBottomSheetModal>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeader: {
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
    color: "#6B7280",
    fontSize: 11,
  },
  providerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  providerCard: {
    flexBasis: "48%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 14,
  },
  cardSurface: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  savedCredBox: {
    gap: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  btnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 13,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
})
