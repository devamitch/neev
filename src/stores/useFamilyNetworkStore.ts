/**
 * Neev Family Network & Kinship Graph Hook
 * Specification: Neev_Family_Network_Privacy_and_Implementation_Master.md
 * Powered by unified RootStore slice
 */

import { useRootStore } from "./useRootStore"

export type {
  KinshipType,
  ClusterType,
  FamilyRealm,
  KinshipEdge,
  FamilyCluster,
  FamilyBridge,
  FamilyInvitation,
  FamilyNetworkSlice,
} from "./slices/createFamilyNetworkSlice"

export const useFamilyNetworkStore = useRootStore
