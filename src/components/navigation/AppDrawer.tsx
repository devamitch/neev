/**
 * Neev Family Sanctuary Side Drawer:
 * Direct access to household settings, family directory, quick actions, and offline privacy safeguards.
 */
import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import { AppText } from "@/components/ui/AppText"
import { PressableScale } from "@/components/ui/PressableScale"
import { useFamilyStore } from "@/stores/useFamilyStore"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { useTheme } from "@/theme/useTheme"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { useRouter, type Href } from "expo-router"
import React, { type ReactNode } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { Drawer } from "react-native-drawer-layout"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export const useDrawerStore = Object.assign(
  <T = { open: boolean; setOpen: (open: boolean) => void },>(
    selector?: (state: { open: boolean; setOpen: (open: boolean) => void }) => T,
  ) =>
    useRootStore(
      useShallow((s) => {
        const d = { open: s.isDrawerOpen, setOpen: s.setDrawerOpen }
        return selector ? selector(d) : (d as unknown as T)
      }),
    ),
  {
    getState: () => ({
      open: useRootStore.getState().isDrawerOpen,
      setOpen: useRootStore.getState().setDrawerOpen,
    }),
  },
)

export const openAppDrawer = () => useRootStore.getState().openDrawer()

type Item = {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  href?: Href
  action?: () => void
}

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Sanctuary Spaces",
    items: [
      { icon: "home-outline", label: "Sanctuary Home", href: "/(app)/(tabs)/dashboard" },
      { icon: "calendar-outline", label: "Functions & Rituals", href: "/(app)/(tabs)/schedule" },
      { icon: "book-outline", label: "Shared Knowledge Vault", href: "/(app)/(tabs)/knowledge" },
      { icon: "people-outline", label: "Family Directory & Roles", href: "/(app)/(tabs)/family" },
    ],
  },
  {
    title: "Quick Actions",
    items: [
      { icon: "add-circle-outline", label: "Schedule Family Event", href: "/modal/add-event" },
      { icon: "document-text-outline", label: "Record Heirloom Wisdom", href: "/modal/add-knowledge" },
    ],
  },
  {
    title: "Household & Security",
    items: [
      { icon: "settings-outline", label: "Sanctuary Settings", href: "/(app)/(profile)/settings" },
      { icon: "shield-checkmark-outline", label: "Local-First Privacy Policy", href: "/(app)/(profile)/privacy-policy" },
      { icon: "information-circle-outline", label: "About Neev OS", href: "/(app)/(profile)/about" },
    ],
  },
]

function DrawerContent({ closeDrawer }: { closeDrawer: () => void }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const household = useFamilyStore((s) => s.household)
  const members = useFamilyStore((s) => s.members)

  const handlePress = (item: Item) => {
    void Haptics.selectionAsync()
    closeDrawer()
    if (item.action) {
      item.action()
    } else if (item.href) {
      router.push(item.href)
    }
  }

  return (
    <View style={[styles.drawerRoot, { backgroundColor: colors.surface, paddingTop: insets.top + 16 }]}>
      {/* Brand header */}
      <View style={styles.brandHeader}>
        <NeevLogoIcon size={46} />
        <View style={styles.brandTitleWrap}>
          <AppText variant="subheading" style={styles.brandTitle}>
            Neev · नींव
          </AppText>
          <AppText variant="caption" style={{ color: colors.text.muted }}>
            Family Operating System
          </AppText>
        </View>
      </View>

      {/* Household Status Card (Zero Borders) */}
      <View style={[styles.householdBox, { backgroundColor: colors.surface2 }]}>
        <AppText variant="caption" style={{ fontWeight: "700", color: colors.primary, letterSpacing: 0.5 }}>
          ACTIVE HOUSEHOLD
        </AppText>
        <AppText variant="subheading" style={styles.householdName}>
          {household.name}
        </AppText>
        <AppText variant="caption" style={{ color: colors.text.secondary }}>
          {members.length} Multigenerational Members · {household.city}
        </AppText>
      </View>

      {/* Nav groups */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollBody, { paddingBottom: insets.bottom + 24 }]}>
        {GROUPS.map((group) => (
          <View key={group.title} style={styles.groupWrap}>
            <AppText variant="caption" style={styles.groupTitle}>
              {group.title.toUpperCase()}
            </AppText>
            {group.items.map((item) => (
              <PressableScale
                key={item.label}
                style={styles.menuItem}
                onPress={() => handlePress(item)}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name={item.icon} size={18} color={colors.primary} />
                </View>
                <AppText style={styles.itemLabel}>{item.label}</AppText>
                <Ionicons name="chevron-forward" size={14} color={colors.text.muted} />
              </PressableScale>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

export function AppDrawer({ children }: { children: ReactNode }) {
  const { open, setOpen } = useDrawerStore()

  return (
    <Drawer
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      renderDrawerContent={() => <DrawerContent closeDrawer={() => setOpen(false)} />}
      drawerType="front"
      drawerPosition="left"
      drawerStyle={{ width: 310 }}
    >
      {children}
    </Drawer>
  )
}

const styles = StyleSheet.create({
  drawerRoot: {
    flex: 1,
    paddingHorizontal: 20,
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  brandTitleWrap: {
    marginLeft: 12,
  },
  brandTitle: {
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  householdBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 3,
  },
  householdName: {
    fontWeight: "700",
    fontSize: 15,
  },
  scrollBody: {
    paddingTop: 8,
    gap: 16,
  },
  groupWrap: {
    gap: 4,
  },
  groupTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#888",
    marginBottom: 6,
    paddingLeft: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
})
