import { Tabs } from "expo-router"

import { AppDrawer } from "@/components/navigation/AppDrawer"
import { CustomTabBar } from "@/components/navigation/CustomTabBar"
import { useColors } from "@/theme/useTheme"

export { ErrorBoundary } from "@/components/ErrorBoundary"

export const unstable_settings = { anchor: "dashboard" }

/**
 * Main bottom tabs layout matching Neev's family operating system architecture:
 * 1. Sanctuary (dashboard)
 * 2. Functions Schedulers (schedule)
 * 3. Central Schedule Orb
 * 4. Knowledge Vault (knowledge)
 * 5. Family Directory & Roles (family)
 */
export default function TabsLayout() {
  const colors = useColors()

  return (
    <AppDrawer>
      <Tabs
        initialRouteName="dashboard"
        backBehavior="initialRoute"
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: "Sanctuary" }} />
        <Tabs.Screen name="schedule" options={{ title: "Functions" }} />
        <Tabs.Screen name="knowledge" options={{ title: "Vault" }} />
        <Tabs.Screen name="family" options={{ title: "Family" }} />
      </Tabs>
    </AppDrawer>
  )
}
