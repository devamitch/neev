/**
 * Family Knowledge Sanctuary Hook
 * Powered by unified RootStore slice
 */

import { useRootStore } from "./useRootStore"
export type { KnowledgeCategory, KnowledgeEntry, KnowledgeSlice } from "./slices/createKnowledgeSlice"

export const useKnowledgeStore = useRootStore
