import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "https://kwrdugillyakxgvgbrsu.supabase.co"

const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_orKU--DQThDikBhAZUx4cg_8g_I5zBe"

const memoryMap = new Map<string, string>()

const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === "function") {
        return await AsyncStorage.getItem(key)
      }
    } catch {
      // Fallback for node/jest environment
    }
    return memoryMap.get(key) ?? null
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === "function") {
        await AsyncStorage.setItem(key, value)
        return
      }
    } catch {
      // Fallback for node/jest environment
    }
    memoryMap.set(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (AsyncStorage && typeof AsyncStorage.removeItem === "function") {
        await AsyncStorage.removeItem(key)
        return
      }
    } catch {
      // Fallback for node/jest environment
    }
    memoryMap.delete(key)
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

