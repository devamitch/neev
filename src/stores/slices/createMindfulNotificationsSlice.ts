/**
 * Neev Mindful Notifications Store Slice
 * Manages thoughtful, tiered, non-intrusive notifications across Sacred Spaces.
 *
 * Core principles:
 * - Mindful & Necessary: Never sends notification spam or artificial urgency.
 * - Dismissable & Actionable: Every notification can be easily dismissed, snoozed, or acted upon.
 * - Privacy-Gated: Respects Personal, Nuclear, and Family Sanctuary boundaries.
 */

import type { ImmerStateCreator } from "../types"

export type MindfulNotificationCategory =
  | "sanctuary_nudge"
  | "space_task"
  | "care_circle"
  | "family_event"
  | "system"

export interface MindfulNotification {
  id: string
  title: string
  body: string
  category: MindfulNotificationCategory
  space?: "personal" | "nuclear" | "family"
  actionLabel?: string
  actionRoute?: string
  createdAt: string
  isDismissed: boolean
  isRead: boolean
}

export interface MindfulNotificationsSlice {
  mindfulNotifications: MindfulNotification[]
  activeBannerNotificationId: string | null

  dismissMindfulNotification: (id: string) => void
  markMindfulNotificationAsRead: (id: string) => void
  addMindfulNotification: (
    item: Omit<MindfulNotification, "id" | "createdAt" | "isDismissed" | "isRead">,
  ) => void
  dismissActiveBanner: () => void
  clearAllMindfulNotifications: () => void
  resetMindfulNotificationsToClean: () => void
}

// Sample reference notifications for development / testing (uncomment if testing offline mock nudges)
// export const SAMPLE_MINDFUL_NOTIFICATIONS: MindfulNotification[] = [
//   {
//     id: "notif-1",
//     title: "Dadu's Evening Warmth",
//     body: "Shyamal (Dadu) completed his gentle evening stroll. Ginger chai & Marie biscuits are ready.",
//     category: "care_circle",
//     space: "family",
//     actionLabel: "View Care Circle",
//     actionRoute: "/(app)/(tabs)/family",
//     createdAt: new Date().toISOString(),
//     isDismissed: false,
//     isRead: false,
//   },
//   {
//     id: "notif-2",
//     title: "Family Celebration Coordination",
//     body: "Ritual checklist and sweet offerings preparation ready for tomorrow.",
//     category: "family_event",
//     space: "family",
//     actionLabel: "View Schedule",
//     actionRoute: "/(app)/(tabs)/schedule",
//     createdAt: new Date(Date.now() - 3600000).toISOString(),
//     isDismissed: false,
//     isRead: false,
//   },
//   {
//     id: "notif-3",
//     title: "Sanctuary Offline Shield Active",
//     body: "Your family kinship tree and sacred memories are encrypted and synced locally with MMKV.",
//     category: "system",
//     space: "personal",
//     createdAt: new Date(Date.now() - 7200000).toISOString(),
//     isDismissed: false,
//     isRead: true,
//   },
// ]
export const INITIAL_MINDFUL_NOTIFICATIONS: MindfulNotification[] = []

export const createMindfulNotificationsSlice: ImmerStateCreator<MindfulNotificationsSlice> = (
  set,
) => ({
  mindfulNotifications: INITIAL_MINDFUL_NOTIFICATIONS,
  activeBannerNotificationId: null,

  dismissMindfulNotification: (id: string) =>
    set((state) => {
      const item = state.mindfulNotifications.find((n) => n.id === id)
      if (item) {
        item.isDismissed = true
        item.isRead = true
      }
      if (state.activeBannerNotificationId === id) {
        // Find next non-dismissed notification
        const next = state.mindfulNotifications.find((n) => !n.isDismissed && n.id !== id)
        state.activeBannerNotificationId = next ? next.id : null
      }
    }),

  markMindfulNotificationAsRead: (id: string) =>
    set((state) => {
      const item = state.mindfulNotifications.find((n) => n.id === id)
      if (item) {
        item.isRead = true
      }
    }),

  addMindfulNotification: (item) =>
    set((state: any) => {
      const newNotif: MindfulNotification = {
        ...item,
        id: `notif_${Date.now()}`,
        createdAt: new Date().toISOString(),
        isDismissed: false,
        isRead: false,
      }
      state.mindfulNotifications.unshift(newNotif)
      state.activeBannerNotificationId = newNotif.id
      if (typeof state.showToast === "function") {
        state.showToast({
          title: item.title,
          message: item.body,
          type: "info",
        })
      }
    }),

  dismissActiveBanner: () =>
    set((state) => {
      if (state.activeBannerNotificationId) {
        const item = state.mindfulNotifications.find(
          (n) => n.id === state.activeBannerNotificationId,
        )
        if (item) {
          item.isDismissed = true
          item.isRead = true
        }
      }
      state.activeBannerNotificationId = null
    }),

  clearAllMindfulNotifications: () =>
    set((state) => {
      state.mindfulNotifications.forEach((n) => {
        n.isDismissed = true
        n.isRead = true
      })
      state.activeBannerNotificationId = null
    }),

  resetMindfulNotificationsToClean: () =>
    set((state) => {
      state.mindfulNotifications = []
      state.activeBannerNotificationId = null
    }),
})
