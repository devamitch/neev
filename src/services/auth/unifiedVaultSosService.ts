/**
 * Unified Vault SOS Service — Cross-App Peer Mesh Protocol for Neev
 *
 * Enables ANY ecosystem app (Setu, Thrivefold, HarmonyBloom, Neev, BlinkQuest)
 * to connect directly with ANY other installed app with complete data access.
 * If Setu is not installed, any sibling app serves as the Unified Vault Provider.
 * If no local peer is installed, falls back to Supabase cloud sync when online.
 */

import { Linking } from 'react-native';
import {
  ecosystemSyncService,
  encodeEcosystemPayload,
  decodeEcosystemPayload,
  type UnifiedVaultSosData,
} from '../ecosystem/ecosystemSyncService';

export interface PeerEcosystemApp {
  id: string;
  name: string;
  scheme: string;
  packageName: string;
}

export const ECOSYSTEM_PEERS: PeerEcosystemApp[] = [
  { id: 'setu', name: 'Setu Vault', scheme: 'setu://', packageName: 'com.amit.setu' },
  { id: 'thrivefold', name: 'Thrivefold', scheme: 'thrivefold://', packageName: 'com.amit.thrivefold' },
  { id: 'harmonybloom', name: 'HarmonyBloom', scheme: 'harmonybloom://', packageName: 'com.amit.harmonybloom' },
  { id: 'neev', name: 'Neev Sanctuary', scheme: 'neev://', packageName: 'com.amit.neev' },
  { id: 'blinkquest', name: 'BlinkQuest', scheme: 'blinkquest://', packageName: 'com.amit.blinkquest' },
];

const MY_APP_ID = 'com.amit.neev';
const MY_APP_NAME = 'Neev';
const MY_SCHEME = 'neev://';
const SUPABASE_BACKEND_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kwrdugillyakxgvgbrsu.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  '';

export interface UnifiedVaultResult {
  ok: boolean;
  status: 'launched' | 'cloud_synced' | 'not_installed' | 'failed';
  providerName?: string;
  state?: string;
}

export const unifiedVaultSosService = {
  /**
   * Discovers all installed ecosystem peer apps on this device.
   */
  async getInstalledPeers(): Promise<Array<PeerEcosystemApp & { installed: boolean }>> {
    const peers = ECOSYSTEM_PEERS.filter((p) => p.id !== 'neev');
    const checked = await Promise.all(
      peers.map(async (peer) => {
        let installed = false;
        try {
          installed = await Linking.canOpenURL(peer.scheme).catch(() => false);
        } catch {
          installed = false;
        }
        return { ...peer, installed };
      })
    );
    return checked;
  },

  /**
   * Finds the best available installed peer app to act as the Unified Vault SOS Provider.
   */
  async findBestAvailableProvider(): Promise<PeerEcosystemApp | null> {
    const peers = await this.getInstalledPeers();
    // Prefer Setu if installed; otherwise first available sibling (Thrivefold, HarmonyBloom, BlinkQuest)
    const setu = peers.find((p) => p.id === 'setu' && p.installed);
    if (setu) return setu;
    const sibling = peers.find((p) => p.installed);
    return sibling || null;
  },

  /**
   * Initiates Unified Vault SOS login / connection with complete data access.
   * If a local peer is found, deep links into it.
   * If no local peer is found, attempts direct Supabase cloud vault pull.
   */
  async launchUnifiedVaultSos(preferredTargetId?: string): Promise<UnifiedVaultResult> {
    const state = `sos_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const callbackUrl = `${MY_SCHEME}unified-vault/callback`;

    // 1. Pack current local Neev state
    const localData = ecosystemSyncService.buildLocalEcosystemPayload();
    const encodedPayload = encodeEcosystemPayload(localData);

    // 2. Discover target peer app
    let targetProvider: PeerEcosystemApp | null = null;
    if (preferredTargetId) {
      targetProvider = ECOSYSTEM_PEERS.find((p) => p.id === preferredTargetId) || null;
    } else {
      targetProvider = await this.findBestAvailableProvider();
    }

    // 3. If local peer app exists, launch peer handoff
    if (targetProvider) {
      const url =
        targetProvider.id === 'setu'
          ? `${targetProvider.scheme}sso?app_id=${MY_APP_ID}&app_name=${encodeURIComponent(
              MY_APP_NAME
            )}&callback_url=${encodeURIComponent(callbackUrl)}&state=${state}&ecosystem_data=${encodedPayload}`
          : `${targetProvider.scheme}unified-vault?client_app=${MY_APP_ID}&client_name=${encodeURIComponent(
              MY_APP_NAME
            )}&callback_url=${encodeURIComponent(callbackUrl)}&state=${state}&payload=${encodedPayload}`;

      try {
        await Linking.openURL(url);
        return {
          ok: true,
          status: 'launched',
          providerName: targetProvider.name,
          state,
        };
      } catch {
        // Fall back to cloud attempt
      }
    }

    // 4. If no peer app is installed, attempt online cloud sync from Supabase backend
    const cloudSuccess = await this.pullFromCloudBackend(localData.identity.userId);
    if (cloudSuccess) {
      return {
        ok: true,
        status: 'cloud_synced',
        providerName: 'Unified Cloud Vault',
      };
    }

    return {
      ok: false,
      status: 'not_installed',
    };
  },

  /**
   * Responds to an incoming Unified Vault request from a sibling app (acting as Vault Provider).
   * Unifies incoming client data with Neev's local store non-destructively,
   * then redirects back to the calling client with full unified data.
   */
  async handleIncomingVaultRequest(url: string): Promise<boolean> {
    try {
      const normalized = url.replace(/^[a-z]+:\/\//, 'http://unified-vault.local/');
      const parsed = new URL(normalized);
      const params = parsed.searchParams;

      const callbackUrl = params.get('callback_url');
      const state = params.get('state') || '';
      const rawPayload = params.get('payload') || params.get('ecosystem_data');

      if (!callbackUrl) return false;

      let unified = ecosystemSyncService.buildLocalEcosystemPayload();
      if (rawPayload) {
        const incoming = decodeEcosystemPayload(rawPayload);
        if (incoming) {
          unified = ecosystemSyncService.hydrateStoreFromEcosystem(incoming);
        }
      }

      const delimiter = callbackUrl.includes('?') ? '&' : '?';
      const redirectParams = new URLSearchParams({
        status: 'authorized',
        state,
        payload: encodeEcosystemPayload(unified),
        ecosystem_data: encodeEcosystemPayload(unified),
        user_id: unified.identity.userId,
        display_name: unified.identity.displayName,
        avatar: unified.identity.avatar || '',
      });

      const finalRedirect = `${callbackUrl}${delimiter}${redirectParams.toString()}`;
      await Linking.openURL(finalRedirect).catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Parses the redirect response received from Unified Vault SOS and hydrates the local store.
   */
  handleIncomingVaultCallback(url: string): boolean {
    try {
      const normalized = url.replace(/^[a-z]+:\/\//, 'http://unified-vault.local/');
      const parsed = new URL(normalized);
      const params = parsed.searchParams;

      const status = params.get('status');
      if (status !== 'authorized') return false;

      const rawPayload = params.get('payload') || params.get('ecosystem_data');
      if (!rawPayload) {
        // Fallback to basic SSO params if payload missing
        const userId = params.get('user_id');
        const displayName = params.get('display_name');
        if (userId) {
          const minimalData: Partial<UnifiedVaultSosData> = {
            identity: {
              userId,
              displayName: displayName || 'Sanctuary Member',
            },
          };
          ecosystemSyncService.hydrateStoreFromEcosystem(minimalData as any);
          return true;
        }
        return false;
      }

      const decoded = decodeEcosystemPayload(rawPayload);
      if (decoded) {
        ecosystemSyncService.hydrateStoreFromEcosystem(decoded);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Direct cloud pull from Supabase backend when no local peer is installed.
   */
  async pullFromCloudBackend(userId: string): Promise<boolean> {
    try {
      if (!SUPABASE_ANON_KEY) return false;
      const res = await fetch(
        `${SUPABASE_BACKEND_URL}/rest/v1/user_ecosystem_vaults?user_id=eq.${encodeURIComponent(
          userId
        )}&select=*&order=last_synced_at.desc&limit=1`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (!res.ok) return false;
      const rows = await res.json();
      if (!rows || rows.length === 0) return false;

      const row = rows[0];
      const cloudData: UnifiedVaultSosData = {
        version: 1,
        lastSyncedAt: new Date(row.last_synced_at || Date.now()).getTime(),
        originApp: row.origin_app || 'cloud',
        identity: row.identity_payload || { userId, displayName: 'Sanctuary Explorer' },
        locations: row.locations_payload || {},
        preferences: row.preferences_payload || {},
        experience: row.experience_payload || {},
        health: row.health_payload || {},
        progression: row.progression_payload || {},
        deviceInventory: {
          deviceId: 'neev_cloud_device',
          installedApps: row.installed_apps || { neev: true },
          lastSeenOnline: new Date().toISOString(),
          lastSyncApp: 'supabase_cloud',
        },
      };

      ecosystemSyncService.hydrateStoreFromEcosystem(cloudData);
      return true;
    } catch {
      return false;
    }
  },
};
