import { create } from "zustand"
import { byokManager, type AiProvider, type ByokCredential } from "@/services/ai/byokManager"

interface ByokState {
  credentials: ByokCredential[]
  selectedProvider: AiProvider
  deterministicOnlyMode: boolean
  loadCredentials: () => void
  saveCredential: (provider: AiProvider, rawKey: string, label?: string) => void
  removeCredential: (provider: AiProvider) => void
  setDeterministicOnlyMode: (enabled: boolean) => void
  testConnection: (provider: AiProvider) => Promise<{ success: boolean; message: string }>
}

export const useByokStore = create<ByokState>((set, get) => ({
  credentials: byokManager.listCredentials(),
  selectedProvider: "google",
  deterministicOnlyMode: false,

  loadCredentials: () => {
    set({ credentials: byokManager.listCredentials() })
  },

  saveCredential: (provider, rawKey, label) => {
    byokManager.saveKey(provider, rawKey, label)
    set({ credentials: byokManager.listCredentials() })
  },

  removeCredential: (provider) => {
    byokManager.removeKey(provider)
    set({ credentials: byokManager.listCredentials() })
  },

  setDeterministicOnlyMode: (enabled) => {
    set({ deterministicOnlyMode: enabled })
  },

  testConnection: async (provider) => {
    const res = await byokManager.testConnection(provider)
    set({ credentials: byokManager.listCredentials() })
    return res
  },
}))
