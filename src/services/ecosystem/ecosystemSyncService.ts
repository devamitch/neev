/**
 * Neev Unified Vault SOS — Cross-App Unified User Profile & Ecosystem Data Engine
 *
 * Peer-to-peer ecosystem connection: Any app in the ecosystem (Setu, Thrivefold,
 * HarmonyBloom, Neev, BlinkQuest) can connect with any other app directly
 * with complete data access.
 *
 * RULE: Non-destructive nullish merging.
 * Never overwrite valid existing non-nullish data with null/undefined/empty values.
 * Unify, finish, fix, and fill gaps across identity, addresses, places,
 * preferences, biological rhythms, and progression.
 */

import { Linking, Platform } from 'react-native';
import { useRootStore } from '../../stores/useRootStore';

export interface EcosystemAddress {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface SanctuaryPlace {
  id: string;
  name: string;
  category: 'home' | 'office' | 'studio' | 'nature' | 'retreat' | 'clinic' | 'gym' | 'temple' | 'other';
  address?: string;
  latitude?: number;
  longitude?: number;
  favorite?: boolean;
}

export interface DetailedUserProfile {
  userId: string;
  displayName: string;
  email?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  gender?: 'female' | 'male' | 'other' | string | null;
  age?: number | null;
  ageBand?: string | null;
  isAgeVerified?: boolean;
  avatar?: string | null;
  avatarSeed?: string | null;
  avatarIndex?: number | null;
  photoUrl?: string | null;
  bio?: string | null;
  occupation?: string | null;
  emergencyContact?: {
    name: string;
    relationship: string;
    phoneNumber: string;
  } | null;
}

export interface EcosystemLocations {
  homeAddress?: EcosystemAddress | null;
  officeAddress?: EcosystemAddress | null;
  sanctuaryPlaces?: SanctuaryPlace[];
  recentLocations?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    visitedAt: string;
  }>;
}

export interface EcosystemPreferences {
  theme?: 'dark' | 'light' | 'system' | null;
  accentColor?: string | null;
  hapticsEnabled?: boolean | null;
  soundsEnabled?: boolean | null;
  notificationsEnabled?: boolean | null;
  preferredRoutineDurationSec?: number | null;
  wakeTime?: string | null;
  sleepTime?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
  eatingPreferences?: string[];
  dietaryRestrictions?: string[];
  waterIntakeGoalMl?: number | null;
  language?: string | null;
  units?: 'metric' | 'imperial' | null;
}

export interface EcosystemExperience {
  activeArchetype?: string | null;
  selectedDomains?: string[];
  womenHealth?: {
    enabled?: boolean;
    cycleTrackingConsent?: boolean;
    contraceptionMode?: string | null;
    pregnancyIntent?: string | null;
  };
  menHealth?: {
    enabled?: boolean;
    fitnessFocus?: string[];
    vitalityGoals?: string[];
  };
  family?: {
    enabled?: boolean;
    familyRole?: string | null;
    dependentsCount?: number | null;
    familyName?: string | null;
  };
  holistic?: {
    tradition?: string | null;
    meditationMinutesTotal?: number | null;
    mindfulnessStreakDays?: number | null;
  };
}

export interface PeriodRecordItem {
  id: string;
  startDate: string;
  endDate?: string;
  length?: number;
  flow?: string;
  symptoms?: string[];
  painLevel?: number;
  mood?: number;
  notes?: string;
}

export interface EcosystemHealth {
  lastPeriodDate?: string | null;
  cycleLengthDays?: number | null;
  periodLengthDays?: number | null;
  flowIntensity?: string | null;
  currentPhase?: string | null;
  estimatedNextPeriodDate?: string | null;
  reproductiveContext?: string | null;
  symptoms?: string[];
  symptomsByDate?: Record<string, string[]>;
  periodHistory?: PeriodRecordItem[];
  dailyWaterGoalMl?: number | null;
  recentDailyCheckIns?: Array<{
    date: string;
    energy?: number;
    mood?: number;
    stress?: number;
    sleepHours?: number;
    symptoms?: string[];
    notes?: string;
  }>;
  eyeHealth?: {
    lastBlinkRate?: number;
    screenTimeMinutesToday?: number;
    eyeBatteryPercentage?: number;
  };
}

export interface EcosystemProgression {
  level?: number;
  xp?: number;
  diamonds?: number;
  streakDays?: number;
  lastActiveDate?: string;
  completedQuestsCount?: number;
  badges?: string[];
  unlockedFeatures?: string[];
}

export interface EcosystemDeviceInventory {
  deviceId: string;
  installedApps: {
    setu?: boolean;
    thrivefold?: boolean;
    harmonybloom?: boolean;
    neev?: boolean;
    blinkquest?: boolean;
  };
  lastSeenOnline?: string;
  lastSyncApp?: string;
}

export interface UnifiedVaultSosData {
  version: number;
  lastSyncedAt: number;
  originApp: string;
  identity: DetailedUserProfile;
  locations: EcosystemLocations;
  preferences: EcosystemPreferences;
  experience: EcosystemExperience;
  health: EcosystemHealth;
  progression: EcosystemProgression;
  deviceInventory?: EcosystemDeviceInventory;
}

export type UnifiedEcosystemData = UnifiedVaultSosData;

const SUPABASE_BACKEND_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kwrdugillyakxgvgbrsu.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  '';

export const isNullish = (val: unknown): boolean => {
  return val === undefined || val === null || val === '';
};

export const isPlaceholderName = (name?: string | null): boolean => {
  if (!name || isNullish(name)) return true;
  const lower = name.trim().toLowerCase();
  return (
    lower === 'guest' ||
    lower === 'setu user' ||
    lower === 'user' ||
    lower === 'setu explorer' ||
    lower === 'neev user' ||
    lower === 'thrivefold member' ||
    lower === 'unknown'
  );
};

export const pickNonNullishString = (a?: string | null, b?: string | null): string => {
  if (a && !isNullish(a) && !isPlaceholderName(a)) return a;
  if (b && !isNullish(b) && !isPlaceholderName(b)) return b;
  if (a && !isNullish(a)) return a;
  if (b && !isNullish(b)) return b;
  return '';
};

export const pickNonNullishNumber = (
  a?: number | null,
  b?: number | null,
  strategy: 'preferFirst' | 'max' = 'preferFirst'
): number | null => {
  const hasA = a !== undefined && a !== null && !isNaN(a);
  const hasB = b !== undefined && b !== null && !isNaN(b);
  if (!hasA && !hasB) return null;
  if (hasA && !hasB) return a as number;
  if (!hasA && hasB) return b as number;
  if (strategy === 'max') {
    return Math.max(a as number, b as number);
  }
  return a as number;
};

export const mergeUniqueStringArrays = (
  arrA?: string[] | null,
  arrB?: string[] | null
): string[] => {
  const set = new Set<string>();
  (arrA || []).forEach((item) => {
    if (item && item.trim()) set.add(item.trim());
  });
  (arrB || []).forEach((item) => {
    if (item && item.trim()) set.add(item.trim());
  });
  return Array.from(set);
};

export const unifyAddresses = (
  local?: EcosystemAddress | null,
  incoming?: EcosystemAddress | null
): EcosystemAddress | null => {
  if (!local && !incoming) return null;
  if (local && !incoming) return local;
  if (!local && incoming) return incoming;
  const l = local!;
  const i = incoming!;

  return {
    name: pickNonNullishString(l.name, i.name) || 'Home',
    addressLine1:
      l.addressLine1 && l.addressLine1.length > (i.addressLine1?.length || 0)
        ? l.addressLine1
        : i.addressLine1 || l.addressLine1 || '',
    addressLine2: pickNonNullishString(l.addressLine2, i.addressLine2) || undefined,
    landmark: pickNonNullishString(l.landmark, i.landmark) || undefined,
    city: pickNonNullishString(l.city, i.city),
    state: pickNonNullishString(l.state, i.state),
    postalCode: pickNonNullishString(l.postalCode, i.postalCode),
    country: pickNonNullishString(l.country, i.country) || 'India',
    latitude: l.latitude ?? i.latitude,
    longitude: l.longitude ?? i.longitude,
    notes: pickNonNullishString(l.notes, i.notes) || undefined,
  };
};

export const unifySanctuaryPlaces = (
  local?: SanctuaryPlace[],
  incoming?: SanctuaryPlace[]
): SanctuaryPlace[] => {
  const map = new Map<string, SanctuaryPlace>();
  (local || []).forEach((p) => {
    if (p.id || p.name) {
      map.set(p.id || p.name.toLowerCase(), p);
    }
  });
  (incoming || []).forEach((p) => {
    const key = p.id || p.name.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, p);
    } else {
      map.set(key, {
        id: existing.id || p.id,
        name: existing.name || p.name,
        category: existing.category || p.category,
        address: pickNonNullishString(existing.address, p.address) || undefined,
        latitude: existing.latitude ?? p.latitude,
        longitude: existing.longitude ?? p.longitude,
        favorite: existing.favorite || p.favorite,
      });
    }
  });
  return Array.from(map.values());
};

/**
 * Non-destructive reconciliation function.
 * Unifies local and incoming ecosystem states without losing existing populated data.
 */
export function unifyEcosystemData(
  local: UnifiedVaultSosData,
  incoming: UnifiedVaultSosData
): UnifiedVaultSosData {
  const now = Date.now();

  const unifiedIdentity: DetailedUserProfile = {
    userId: pickNonNullishString(local.identity.userId, incoming.identity.userId) || `usr_${now}`,
    displayName:
      pickNonNullishString(local.identity.displayName, incoming.identity.displayName) ||
      'Neev Sanctuary Member',
    email: pickNonNullishString(local.identity.email, incoming.identity.email) || null,
    phoneNumber:
      pickNonNullishString(local.identity.phoneNumber, incoming.identity.phoneNumber) || null,
    dateOfBirth:
      pickNonNullishString(local.identity.dateOfBirth, incoming.identity.dateOfBirth) || null,
    gender:
      (pickNonNullishString(local.identity.gender, incoming.identity.gender) as any) || null,
    age: pickNonNullishNumber(local.identity.age, incoming.identity.age),
    ageBand: pickNonNullishString(local.identity.ageBand, incoming.identity.ageBand) || null,
    isAgeVerified: Boolean(local.identity.isAgeVerified || incoming.identity.isAgeVerified),
    avatar: pickNonNullishString(local.identity.avatar, incoming.identity.avatar) || null,
    avatarSeed:
      pickNonNullishString(local.identity.avatarSeed, incoming.identity.avatarSeed) || null,
    avatarIndex: pickNonNullishNumber(local.identity.avatarIndex, incoming.identity.avatarIndex),
    photoUrl: pickNonNullishString(local.identity.photoUrl, incoming.identity.photoUrl) || null,
    bio:
      (local.identity.bio && local.identity.bio.length > (incoming.identity.bio?.length || 0)
        ? local.identity.bio
        : incoming.identity.bio) ||
      local.identity.bio ||
      null,
    occupation:
      pickNonNullishString(local.identity.occupation, incoming.identity.occupation) || null,
    emergencyContact: local.identity.emergencyContact || incoming.identity.emergencyContact || null,
  };

  const unifiedLocations: EcosystemLocations = {
    homeAddress: unifyAddresses(local.locations.homeAddress, incoming.locations.homeAddress),
    officeAddress: unifyAddresses(local.locations.officeAddress, incoming.locations.officeAddress),
    sanctuaryPlaces: unifySanctuaryPlaces(
      local.locations.sanctuaryPlaces,
      incoming.locations.sanctuaryPlaces
    ),
    recentLocations: [
      ...(local.locations.recentLocations || []),
      ...(incoming.locations.recentLocations || []),
    ].slice(-10),
  };

  const unifiedPreferences: EcosystemPreferences = {
    theme: (local.preferences.theme || incoming.preferences.theme || 'dark') as any,
    accentColor: pickNonNullishString(
      local.preferences.accentColor,
      incoming.preferences.accentColor
    ) || null,
    hapticsEnabled: local.preferences.hapticsEnabled ?? incoming.preferences.hapticsEnabled ?? true,
    soundsEnabled: local.preferences.soundsEnabled ?? incoming.preferences.soundsEnabled ?? true,
    notificationsEnabled:
      local.preferences.notificationsEnabled ?? incoming.preferences.notificationsEnabled ?? true,
    preferredRoutineDurationSec: pickNonNullishNumber(
      local.preferences.preferredRoutineDurationSec,
      incoming.preferences.preferredRoutineDurationSec
    ),
    wakeTime: pickNonNullishString(local.preferences.wakeTime, incoming.preferences.wakeTime) || null,
    sleepTime:
      pickNonNullishString(local.preferences.sleepTime, incoming.preferences.sleepTime) || null,
    workStartTime:
      pickNonNullishString(local.preferences.workStartTime, incoming.preferences.workStartTime) || null,
    workEndTime:
      pickNonNullishString(local.preferences.workEndTime, incoming.preferences.workEndTime) || null,
    eatingPreferences: mergeUniqueStringArrays(
      local.preferences.eatingPreferences,
      incoming.preferences.eatingPreferences
    ),
    dietaryRestrictions: mergeUniqueStringArrays(
      local.preferences.dietaryRestrictions,
      incoming.preferences.dietaryRestrictions
    ),
    waterIntakeGoalMl: pickNonNullishNumber(
      local.preferences.waterIntakeGoalMl,
      incoming.preferences.waterIntakeGoalMl,
      'max'
    ),
    language: pickNonNullishString(local.preferences.language, incoming.preferences.language) || 'en',
    units: (local.preferences.units || incoming.preferences.units || 'metric') as any,
  };

  const unifiedExperience: EcosystemExperience = {
    activeArchetype:
      pickNonNullishString(
        local.experience.activeArchetype,
        incoming.experience.activeArchetype
      ) || null,
    selectedDomains: mergeUniqueStringArrays(
      local.experience.selectedDomains,
      incoming.experience.selectedDomains
    ),
    womenHealth: {
      enabled:
        local.experience.womenHealth?.enabled ?? incoming.experience.womenHealth?.enabled ?? false,
      cycleTrackingConsent:
        local.experience.womenHealth?.cycleTrackingConsent ??
        incoming.experience.womenHealth?.cycleTrackingConsent ??
        true,
      contraceptionMode: pickNonNullishString(
        local.experience.womenHealth?.contraceptionMode,
        incoming.experience.womenHealth?.contraceptionMode
      ) || null,
      pregnancyIntent: pickNonNullishString(
        local.experience.womenHealth?.pregnancyIntent,
        incoming.experience.womenHealth?.pregnancyIntent
      ) || null,
    },
    menHealth: {
      enabled:
        local.experience.menHealth?.enabled ?? incoming.experience.menHealth?.enabled ?? false,
      fitnessFocus: mergeUniqueStringArrays(
        local.experience.menHealth?.fitnessFocus,
        incoming.experience.menHealth?.fitnessFocus
      ),
      vitalityGoals: mergeUniqueStringArrays(
        local.experience.menHealth?.vitalityGoals,
        incoming.experience.menHealth?.vitalityGoals
      ),
    },
    family: {
      enabled:
        local.experience.family?.enabled ?? incoming.experience.family?.enabled ?? true,
      familyRole: pickNonNullishString(
        local.experience.family?.familyRole,
        incoming.experience.family?.familyRole
      ) || null,
      dependentsCount: pickNonNullishNumber(
        local.experience.family?.dependentsCount,
        incoming.experience.family?.dependentsCount
      ),
      familyName: pickNonNullishString(
        local.experience.family?.familyName,
        incoming.experience.family?.familyName
      ) || null,
    },
    holistic: {
      tradition: pickNonNullishString(
        local.experience.holistic?.tradition,
        incoming.experience.holistic?.tradition
      ) || null,
      meditationMinutesTotal: pickNonNullishNumber(
        local.experience.holistic?.meditationMinutesTotal,
        incoming.experience.holistic?.meditationMinutesTotal,
        'max'
      ),
      mindfulnessStreakDays: pickNonNullishNumber(
        local.experience.holistic?.mindfulnessStreakDays,
        incoming.experience.holistic?.mindfulnessStreakDays,
        'max'
      ),
    },
  };

  // Reconcile Period History
  const periodMap = new Map<string, PeriodRecordItem>();
  (local.health.periodHistory || []).forEach((item) => {
    if (item.startDate) periodMap.set(item.startDate, item);
  });
  (incoming.health.periodHistory || []).forEach((item) => {
    if (item.startDate) {
      const existing = periodMap.get(item.startDate);
      if (!existing) {
        periodMap.set(item.startDate, item);
      } else {
        periodMap.set(item.startDate, {
          id: existing.id || item.id,
          startDate: existing.startDate,
          endDate: existing.endDate || item.endDate,
          length: existing.length || item.length,
          flow: existing.flow || item.flow,
          symptoms: mergeUniqueStringArrays(existing.symptoms, item.symptoms),
          painLevel: existing.painLevel ?? item.painLevel,
          mood: existing.mood ?? item.mood,
          notes: pickNonNullishString(existing.notes, item.notes) || undefined,
        });
      }
    }
  });

  const mergedPeriodHistory = Array.from(periodMap.values()).sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  const unifiedHealth: EcosystemHealth = {
    lastPeriodDate: pickNonNullishString(
      local.health.lastPeriodDate,
      incoming.health.lastPeriodDate
    ) || null,
    cycleLengthDays: pickNonNullishNumber(
      local.health.cycleLengthDays,
      incoming.health.cycleLengthDays
    ),
    periodLengthDays: pickNonNullishNumber(
      local.health.periodLengthDays,
      incoming.health.periodLengthDays
    ),
    flowIntensity: pickNonNullishString(
      local.health.flowIntensity,
      incoming.health.flowIntensity
    ) || null,
    currentPhase: pickNonNullishString(
      local.health.currentPhase,
      incoming.health.currentPhase
    ) || null,
    estimatedNextPeriodDate: pickNonNullishString(
      local.health.estimatedNextPeriodDate,
      incoming.health.estimatedNextPeriodDate
    ) || null,
    reproductiveContext: pickNonNullishString(
      local.health.reproductiveContext,
      incoming.health.reproductiveContext
    ) || null,
    symptoms: mergeUniqueStringArrays(local.health.symptoms, incoming.health.symptoms),
    symptomsByDate: {
      ...(incoming.health.symptomsByDate || {}),
      ...(local.health.symptomsByDate || {}),
    },
    periodHistory: mergedPeriodHistory,
    dailyWaterGoalMl: pickNonNullishNumber(
      local.health.dailyWaterGoalMl,
      incoming.health.dailyWaterGoalMl,
      'max'
    ),
    recentDailyCheckIns: [
      ...(local.health.recentDailyCheckIns || []),
      ...(incoming.health.recentDailyCheckIns || []),
    ].slice(-14),
    eyeHealth: {
      lastBlinkRate:
        local.health.eyeHealth?.lastBlinkRate ?? incoming.health.eyeHealth?.lastBlinkRate,
      screenTimeMinutesToday:
        local.health.eyeHealth?.screenTimeMinutesToday ??
        incoming.health.eyeHealth?.screenTimeMinutesToday,
      eyeBatteryPercentage:
        local.health.eyeHealth?.eyeBatteryPercentage ??
        incoming.health.eyeHealth?.eyeBatteryPercentage,
    },
  };

  const unifiedProgression: EcosystemProgression = {
    level: pickNonNullishNumber(local.progression.level, incoming.progression.level, 'max') ?? 1,
    xp: pickNonNullishNumber(local.progression.xp, incoming.progression.xp, 'max') ?? 0,
    diamonds:
      pickNonNullishNumber(local.progression.diamonds, incoming.progression.diamonds, 'max') ?? 0,
    streakDays:
      pickNonNullishNumber(local.progression.streakDays, incoming.progression.streakDays, 'max') ??
      0,
    lastActiveDate:
      local.progression.lastActiveDate || incoming.progression.lastActiveDate || new Date().toISOString(),
    completedQuestsCount:
      pickNonNullishNumber(
        local.progression.completedQuestsCount,
        incoming.progression.completedQuestsCount,
        'max'
      ) ?? 0,
    badges: mergeUniqueStringArrays(local.progression.badges, incoming.progression.badges),
    unlockedFeatures: mergeUniqueStringArrays(
      local.progression.unlockedFeatures,
      incoming.progression.unlockedFeatures
    ),
  };

  const mergedApps = {
    ...(incoming.deviceInventory?.installedApps || {}),
    ...(local.deviceInventory?.installedApps || {}),
    neev: true,
  };

  return {
    version: Math.max(local.version, incoming.version) + 1,
    lastSyncedAt: now,
    originApp: 'com.amit.neev',
    identity: unifiedIdentity,
    locations: unifiedLocations,
    preferences: unifiedPreferences,
    experience: unifiedExperience,
    health: unifiedHealth,
    progression: unifiedProgression,
    deviceInventory: {
      deviceId: local.deviceInventory?.deviceId || incoming.deviceInventory?.deviceId || 'neev_device',
      installedApps: mergedApps,
      lastSeenOnline: new Date().toISOString(),
      lastSyncApp: 'com.amit.neev',
    },
  };
}

export function encodeEcosystemPayload(data: UnifiedVaultSosData): string {
  try {
    const json = JSON.stringify(data);
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    return encodeURIComponent(json);
  } catch (err) {
    console.warn('[EcosystemSync] encode error:', err);
    return '';
  }
}

export function decodeEcosystemPayload(encoded: string): UnifiedVaultSosData | null {
  try {
    let json = '';
    if (typeof atob === 'function' && /^[A-Za-z0-9_-]+$/.test(encoded)) {
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
      json = decodeURIComponent(escape(atob(base64 + pad)));
    } else {
      json = decodeURIComponent(encoded);
    }
    return JSON.parse(json) as UnifiedVaultSosData;
  } catch (err) {
    console.warn('[EcosystemSync] decode error:', err);
    return null;
  }
}

export const ecosystemSyncService = {
  /**
   * Builds the current Neev local snapshot into a UnifiedVaultSosData record.
   */
  buildLocalEcosystemPayload(): UnifiedVaultSosData {
    const state = useRootStore.getState();

    const identity: DetailedUserProfile = {
      userId: state.user?.uid || state.profileId || `neev_${Date.now()}`,
      displayName: state.user?.displayName || state.displayName || 'Neev Sanctuary Member',
      email: state.user?.email || null,
      phoneNumber: null,
      dateOfBirth: null,
      gender: null,
      age: null,
      avatar: state.user?.avatar || null,
      photoUrl: state.user?.photoUrl || null,
      bio: 'Mindful living & family sanctuary member',
    };

    const homeTask = state.tasks?.find((t) => t.category === 'home' || t.title.toLowerCase().includes('home'));
    const homeAddress: EcosystemAddress = {
      name: 'Home Sanctuary',
      addressLine1: homeTask?.notes || 'Family Home',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
    };

    const officeMeeting = state.meetings?.find((m) => m.location && m.location.trim().length > 0);
    const officeAddress: EcosystemAddress | null = officeMeeting
      ? {
          name: officeMeeting.title || 'Workplace',
          addressLine1: officeMeeting.location,
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'India',
        }
      : null;

    const sanctuaryPlaces: SanctuaryPlace[] = (state.meetings || [])
      .filter((m) => m.location)
      .map((m, idx) => ({
        id: m.id || `place_${idx}`,
        name: m.title,
        category: 'retreat',
        address: m.location,
      }));

    const preferences: EcosystemPreferences = {
      theme: (state.themePreference || 'dark') as any,
      hapticsEnabled: true,
      soundsEnabled: state.pujaTimersEnabled ?? true,
      notificationsEnabled: state.notificationsEnabled ?? true,
      wakeTime: state.routine?.wakeTime || null,
      sleepTime: state.routine?.sleepTime || null,
      workStartTime: state.routine?.workStart || null,
      workEndTime: state.routine?.workEnd || null,
      preferredRoutineDurationSec: (state.routine?.preferredActivitySec) || null,
      language: 'en',
      units: 'metric',
    };

    const experience: EcosystemExperience = {
      family: {
        enabled: true,
        familyName: state.household?.name || (state.members?.[0]?.name ? `${state.members[0].name}'s Family` : 'Sanctuary Family'),
        dependentsCount: state.members?.length || 1,
      },
      holistic: {
        tradition: 'Mindful Sanctuary',
      },
    };

    const progression: EcosystemProgression = {
      level: 1,
      xp: state.tasks?.filter((t) => t.isCompleted).length * 25 || 0,
      completedQuestsCount: state.tasks?.filter((t) => t.isCompleted).length || 0,
      streakDays: 1,
    };

    return {
      version: 1,
      lastSyncedAt: Date.now(),
      originApp: 'com.amit.neev',
      identity,
      locations: {
        homeAddress,
        officeAddress,
        sanctuaryPlaces,
      },
      preferences,
      experience,
      health: {},
      progression,
      deviceInventory: {
        deviceId: 'neev_device',
        installedApps: { neev: true },
        lastSeenOnline: new Date().toISOString(),
        lastSyncApp: 'com.amit.neev',
      },
    };
  },

  /**
   * Hydrates Neev's local Zustand store non-destructively from unified ecosystem data.
   */
  hydrateStoreFromEcosystem(incoming: UnifiedVaultSosData): UnifiedVaultSosData {
    const local = this.buildLocalEcosystemPayload();
    const unified = unifyEcosystemData(local, incoming);

    useRootStore.setState((state) => {
      // 1. Identity & Profile
      if (unified.identity.displayName && !isPlaceholderName(unified.identity.displayName)) {
        state.displayName = unified.identity.displayName;
      }

      // 2. Auth State
      const currentUid = state.user?.uid || unified.identity.userId;
      const currentDisplayName =
        pickNonNullishString(unified.identity.displayName, state.user?.displayName) || 'Sanctuary Explorer';

      state.user = {
        uid: currentUid,
        displayName: currentDisplayName,
        email: unified.identity.email || state.user?.email,
        photoUrl: unified.identity.photoUrl || unified.identity.avatar || state.user?.photoUrl,
        avatar: unified.identity.avatar || state.user?.avatar,
        provider: state.user?.provider || 'setu',
        signedInAt: state.user?.signedInAt || Date.now(),
      };
      state.isAuthenticated = true;

      // 3. Routine timings
      if (unified.preferences.wakeTime || unified.preferences.sleepTime || unified.preferences.workStartTime) {
        state.routine = {
          ...state.routine,
          wakeTime: unified.preferences.wakeTime || state.routine?.wakeTime || null,
          sleepTime: unified.preferences.sleepTime || state.routine?.sleepTime || null,
          workStart: unified.preferences.workStartTime || state.routine?.workStart || null,
          workEnd: unified.preferences.workEndTime || state.routine?.workEnd || null,
          preferredActivitySec:
            unified.preferences.preferredRoutineDurationSec ?? state.routine?.preferredActivitySec ?? null,
        };
      }

      // 4. Preferences
      if (unified.preferences.theme) {
        state.themePreference = unified.preferences.theme as any;
      }
      if (unified.preferences.notificationsEnabled !== undefined) {
        state.notificationsEnabled = Boolean(unified.preferences.notificationsEnabled);
      }
    });

    // Asynchronously push to Supabase cloud if online
    void this.syncToSupabase(unified).catch(() => undefined);

    return unified;
  },

  /**
   * Syncs the unified data to the shared Supabase backend.
   */
  async syncToSupabase(unifiedData: UnifiedVaultSosData): Promise<boolean> {
    try {
      if (!SUPABASE_ANON_KEY) return false;
      const response = await fetch(`${SUPABASE_BACKEND_URL}/rest/v1/user_ecosystem_vaults`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: unifiedData.identity.userId,
          origin_app: unifiedData.originApp,
          last_synced_at: new Date().toISOString(),
          identity_payload: unifiedData.identity,
          locations_payload: unifiedData.locations,
          preferences_payload: unifiedData.preferences,
          experience_payload: unifiedData.experience,
          health_payload: unifiedData.health,
          progression_payload: unifiedData.progression,
          installed_apps: unifiedData.deviceInventory?.installedApps || { neev: true },
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};
