/**
 * UI Store Slice
 * Manages toast notifications and global confirmation/alert dialogs
 */


export type ToastType = "success" | "error" | "info" | "warning"

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  title?: string
  actionLabel?: string
  actionRoute?: string
}

export interface ToastInput {
  message: string
  type?: ToastType
  title?: string
  actionLabel?: string
  actionRoute?: string
}

export interface AlertOptions {
  title: string
  message?: string
  confirmText?: string
  /** null hides the cancel button. */
  cancelText?: string | null
  onConfirm?: () => void
  onCancel?: () => void
  destructive?: boolean
  variant?: "default" | "danger"
}

export interface UiSlice {
  toasts: ToastItem[]
  alert: AlertOptions | null
  isDrawerOpen: boolean
  easyMode: boolean
  showToast: (input: string | ToastInput, type?: ToastType) => void
  hideToast: (id: string) => void
  showAlert: (options: AlertOptions) => void
  hideAlert: () => void
  setDrawerOpen: (open: boolean) => void
  openDrawer: () => void
  closeDrawer: () => void
  setEasyMode: (enabled: boolean) => void
  toggleEasyMode: () => void
}

import type { ImmerStateCreator } from "../types"

export const createUiSlice: ImmerStateCreator<UiSlice> = (set) => ({
  toasts: [],
  alert: null,
  isDrawerOpen: false,
  easyMode: false,

  showToast: (input, maybeType = "info") => {
    const id = Math.random().toString(36).slice(2, 9)
    const message = typeof input === "string" ? input : input.message
    const type = typeof input === "string" ? maybeType : (input.type ?? "info")
    const title = typeof input === "string" ? undefined : input.title
    const actionLabel = typeof input === "string" ? undefined : input.actionLabel
    const actionRoute = typeof input === "string" ? undefined : input.actionRoute

    set((state) => {
      state.toasts.push({ id, message, type, title, actionLabel, actionRoute })
      if (state.toasts.length > 3) {
        state.toasts.shift()
      }
    })

    setTimeout(() => {
      set((state) => {
        state.toasts = state.toasts.filter((t) => t.id !== id)
      })
    }, 3500)
  },

  hideToast: (id) =>
    set((state) => {
      state.toasts = state.toasts.filter((t) => t.id !== id)
    }),

  showAlert: (options) =>
    set((state) => {
      state.alert = options
    }),

  hideAlert: () =>
    set((state) => {
      state.alert = null
    }),

  setDrawerOpen: (isDrawerOpen) =>
    set((state) => {
      state.isDrawerOpen = isDrawerOpen
    }),

  openDrawer: () =>
    set((state) => {
      state.isDrawerOpen = true
    }),

  closeDrawer: () =>
    set((state) => {
      state.isDrawerOpen = false
    }),

  setEasyMode: (enabled) =>
    set((state) => {
      state.easyMode = enabled
    }),

  toggleEasyMode: () =>
    set((state) => {
      state.easyMode = !state.easyMode
    }),
})
