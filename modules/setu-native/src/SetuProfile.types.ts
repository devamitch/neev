export type ProfileVisibility = 'PUBLIC' | 'CONTACTS_ONLY' | 'TRUSTED_ONLY' | 'PRIVATE';

export interface SetuUserProfile {
  deviceId: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  visibility: ProfileVisibility;
  version: number;
}
