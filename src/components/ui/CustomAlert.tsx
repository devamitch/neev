import { useRootStore, useShallow } from "@/stores/useRootStore"
import { useTheme } from "@/theme/useTheme"
import { BlurView } from "expo-blur"
import React from "react"
import { Modal, StyleSheet, View } from "react-native"
import { AppButton } from "./AppButton"
import { AppText } from "./AppText"
import { PressableScale } from "./PressableScale"
import { SquircleSurface } from "./SquircleSurface"

export function CustomAlert() {
  const { colors, isDark } = useTheme()
  const { alert, hideAlert } = useRootStore(
    useShallow((s) => ({
      alert: s.alert,
      hideAlert: s.hideAlert,
    })),
  )

  if (!alert) return null

  const handleConfirm = () => {
    alert.onConfirm?.()
    hideAlert()
  }

  const handleCancel = () => {
    alert.onCancel?.()
    hideAlert()
  }

  return (
    <Modal transparent animationType="fade" visible={Boolean(alert)} onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <BlurView
          intensity={30}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
          blurMethod={"dimezisBlurView"}
          blurReductionFactor={30}
        />
        <PressableScale style={StyleSheet.absoluteFill} scaleTo={1} onPress={handleCancel} />

        <SquircleSurface
          radius={24}
          smoothing={1}
          fill={colors.surface}
          stroke={colors.border}
          strokeWidth={1}
          style={styles.dialog}
        >
          <View style={styles.content}>
            <AppText variant="h3" style={styles.title}>
              {alert.title}
            </AppText>
            {alert.message ? (
              <AppText variant="body" style={[styles.message, { color: colors.text.secondary }]}>
                {alert.message}
              </AppText>
            ) : null}

            <View style={styles.actions}>
              {alert.cancelText !== null ? (
                <AppButton
                  title={alert.cancelText || "Cancel"}
                  variant="secondary"
                  size="sm"
                  style={styles.button}
                  onPress={handleCancel}
                />
              ) : null}
              <AppButton
                title={alert.confirmText || "Confirm"}
                variant={alert.destructive ? "danger" : "primary"}
                size="sm"
                style={styles.button}
                onPress={handleConfirm}
              />
            </View>
          </View>
        </SquircleSurface>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 340,
    zIndex: 10,
  },
  content: {
    padding: 20,
  },
  title: {
    marginBottom: 8,
  },
  message: {
    marginBottom: 20,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  button: {
    minWidth: 90,
  },
})
