import type { ProfileVisibility, SetuUserProfile } from './SetuProfile.types';

export type { ProfileVisibility, SetuUserProfile } from './SetuProfile.types';

export type SetuPlatform = 'android';

export type BiometricCapability = 'STRONG_BIOMETRIC' | 'DEVICE_CREDENTIAL' | 'NONE';

/** A device advertising Setu on the local network whose id matches its advertised key. */
/** Where a peer was found. The session, the trust and the transfer are identical either way. */
export type PeerTransportKind = 'LAN' | 'WIFI_DIRECT';

export interface DiscoveredPeer {
  id: string;
  name: string;
  /** Empty for a Wi-Fi Direct peer: there is no address until a group has been formed. */
  host: string;
  port: number;
  serviceName: string;
  publicKey: string;
  transport: PeerTransportKind;
}

/**
 * The result of forming a Wi-Fi Direct group. `waiting` means this phone became the group owner,
 * so there is nothing to dial: the other phone connects, and the session arrives through
 * `onPeerAuthenticated`.
 */
export type WifiDirectConnectResult =
  | { waiting: true; peerId: string }
  | ({ waiting: false } & AuthenticatedPeerSession);

export interface LostPeer {
  id: string;
  serviceName: string;
}

export interface DiscoveryFailure {
  errorCode: number;
}

export interface AuthenticatedPeerSession {
  sessionId: string;
  peerId: string;
  publicKey: string;
  /** Short code shown on both phones; identical codes mean the same authenticated session. */
  verificationCode: string;
}

export interface NfcIntroducedPeer {
  peerId: string;
  publicKey: string;
}

/**
 * The end of a tap-to-connect window. `INTRODUCED` is the success that `onNfcPeerIntroduced`
 * carries the peer for; `FAILED` is recoverable and leaves the window open until it `EXPIRED`.
 */
export interface NfcIntroductionState {
  state: 'INTRODUCED' | 'EXPIRED' | 'FAILED' | 'STOPPED';
  reason: string | null;
}

/** A device this phone has paired with before, whether or not it is nearby now. */
export interface KnownPeer {
  peerId: string;
  displayName: string;
  trustState: string;
  lastSeenAt: number;
  publicKey: string | null;
  host: string | null;
  port: number | null;
  /** Set only while an authorized session is open, so it is reachability, not history. */
  sessionId: string | null;
}

export interface DisconnectedPeerSession {
  sessionId: string;
  peerId: string;
}

/** AVAILABLE, or why the radio or permission cannot be used right now. */
export type RadioState = 'AVAILABLE' | 'DISABLED' | 'UNSUPPORTED' | 'PERMISSION_MISSING';

export interface RadioSnapshot {
  nfc: RadioState;
  wifi: RadioState;
  wifiDirect: RadioState;
  location: RadioState;
  nearbyPermission: RadioState;
  notifications: RadioState;
  battery: RadioState;
}

/** Which system screen `openRadioSettings` should open. */
export type RadioSettingsTarget = 'nfc' | 'wifi' | 'location' | 'app' | 'battery';

export type NearbyState = 'STOPPED' | 'WAITING_FOR_NETWORK' | 'SEARCHING' | 'ERROR';

export interface NearbySnapshot {
  state: NearbyState;
  scanning: boolean;
  peerCount: number;
  /** Machine-readable cause when state is ERROR. */
  reason: string | null;
}

export interface RuntimeStatus {
  started: boolean;
  deviceId: string;
  nearby: NearbySnapshot;
  radio: RadioSnapshot;
}

export interface PairCode {
  code: string;
  expiresAt: number;
  peerId: string;
}

export interface PairCodeRedemption {
  peerId?: string;
  publicKey?: string;
  host?: string;
  port?: number;
  name?: string;
  introductionSignature?: string;
  expiresAt?: number;
  /** RATE_LIMITED, INVALID_CODE, PEER_NOT_FOUND, SELF_PAIR or PEER_INCOMPLETE. */
  error?: string;
}

export interface IncomingTransferOffer {
  transferId: string;
  sessionId: string;
  peerId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface TransferStartedEvent {
  transferId: string;
  sessionId: string;
  peerId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

/** Progress is verified bytes over expected bytes, from durable native state. Never estimated. */
export interface TransferProgressEvent {
  transferId: string;
  sessionId: string;
  peerId: string;
  direction: 'upload' | 'download';
  verifiedBytes: number;
  totalBytes: number;
}

export interface TransferCompletedEvent {
  transferId: string;
  sessionId: string;
  peerId: string;
  fileName: string;
  size: number;
  direction: 'upload' | 'download';
  contentId?: string;
}

export interface TransferFailedEvent {
  transferId: string;
  sessionId: string;
  peerId: string;
  reason: string;
  direction: 'upload' | 'download';
}

export interface PieceAvailableEvent {
  manifestId: string;
  pieceIndex: number;
  peerId: string;
}

export interface PieceRequestedEvent {
  manifestId: string;
  pieceIndex: number;
  peerId: string;
}

export interface PieceServedEvent {
  manifestId: string;
  pieceIndex: number;
  peerId: string;
  bytes: number;
  at: number;
}

export interface PieceTransferredEvent {
  manifestId: string;
  pieceIndex: number;
  peerId: string;
  bytes: number;
}

export interface SwarmPieceMapState {
  manifestId: string;
  totalPieces: number;
  pieces: Array<{ index: number; local: boolean; peerIds: string[] }>;
  truncated: boolean;
}

export interface SwarmHealthEvent {
  manifestId: string;
  availablePieces: number;
  totalPieces: number;
  rarePieces: number[];
  atRiskPieces: number[];
  replicationFactor: number;
  isComplete: boolean;
}

export interface DepartureDetectedEvent {
  peerId: string;
  sessionId: string;
  rarePieces: number[];
}

export interface EmergencyReceivedEvent {
  broadcastId: string;
  originId: string;
  content: string;
  category: string;
  createdAt: number;
  expiresAt: number;
}

export interface SwarmTransferProgressEvent {
  transferId: string;
  verifiedBytes: number;
  totalBytes: number;
}

export interface SwarmTransferCompletedEvent {
  transferId: string;
  manifestId: string;
}

export interface SwarmTransferFailedEvent {
  transferId: string;
  reason: string;
}

export type SetuNativeEvents = {
  onGroupUpdated: (group: SetuConversation) => void;
  onRadioStateChanged: (snapshot: RadioSnapshot) => void;
  onNearbyStateChanged: (snapshot: NearbySnapshot) => void;
  onPeerDiscovered: (peer: DiscoveredPeer) => void;
  onPeerLost: (peer: LostPeer) => void;
  onDiscoveryFailed: (failure: DiscoveryFailure) => void;
  onPeerAuthenticated: (session: AuthenticatedPeerSession) => void;
  onPeerDisconnected: (session: DisconnectedPeerSession) => void;
  onNfcPeerIntroduced: (peer: NfcIntroducedPeer) => void;
  onNfcIntroductionStateChanged: (event: NfcIntroductionState) => void;
  onIncomingTransferOffer: (offer: IncomingTransferOffer) => void;
  onTransferStarted: (transfer: TransferStartedEvent) => void;
  onTransferProgress: (progress: TransferProgressEvent) => void;
  onTransferCompleted: (completion: TransferCompletedEvent) => void;
  onTransferFailed: (failure: TransferFailedEvent) => void;
  onNotificationReply: (event: { conversationId: string; text: string }) => void;
  onNotificationMarkRead: (event: { conversationId: string }) => void;
  onNotificationAcceptRequest: (event: { transferId: string; accepted: boolean }) => void;
  onNotificationDeclineRequest: (event: { transferId: string; declined: boolean }) => void;
  onPieceAvailable: (event: PieceAvailableEvent) => void;
  onPieceRequested: (event: PieceRequestedEvent) => void;
  onPieceServed: (event: PieceServedEvent) => void;
  onPieceTransferred: (event: PieceTransferredEvent) => void;
  onSwarmHealthChanged: (event: SwarmHealthEvent) => void;
  onDepartureDetected: (event: DepartureDetectedEvent) => void;
  onSwarmTransferProgress: (event: SwarmTransferProgressEvent) => void;
  onSwarmTransferCompleted: (event: SwarmTransferCompletedEvent) => void;
  onSwarmTransferFailed: (event: SwarmTransferFailedEvent) => void;
  onIntentReceived: (event: { action: string; type?: string; uris?: string[]; magnet?: string }) => void;
  onContentDiscovered: (event: SetuContentItem) => void;
  onVaultContentChanged: (event: { operation: string; contentId: string }) => void;
  onContentRemoved: (event: { contentId: string }) => void;
  onScanProgress: (event: { current: number; total: number }) => void;
  onScanComplete: (event: { total: number }) => void;
  onScanFailed: (event: { reason: string }) => void;
  onMessageReceived: (event: SetuMessage) => void;
  onMessageDelivered: (event: { messageId: string; conversationId: string }) => void;
  onMessageRead: (event: { messageId: string; conversationId: string }) => void;
  onMessageFailed: (event: { messageId: string; conversationId: string; reason: string }) => void;
  onConversationCreated: (event: {
    conversationId: string;
    isGroup: boolean;
    name: string;
  }) => void;
  onEmergencyReceived: (event: EmergencyReceivedEvent) => void;
  onSpaceCreated: (event: SetuSharedSpaceItem) => void;
  onSpaceInvitationReceived: (event: { spaceId: string; inviterId: string }) => void;
  onSpaceInvitationAccepted: (event: { spaceId: string; memberId: string }) => void;
  onContentAddedToSpace: (event: { spaceId: string; contentId: string }) => void;
  onContentRemovedFromSpace: (event: { spaceId: string; contentId: string }) => void;
  onSpaceUpdated: (event: SetuSharedSpaceItem) => void;
  onSpaceSyncProgress: (event: { spaceId: string; progress: number; total: number }) => void;
  onSpaceSyncComplete: (event: { spaceId: string }) => void;
  onSpaceOperationFailed: (event: { spaceId: string; operation: string; reason: string }) => void;
};

// ── Vault ─────────────────────────────────────────────────────────────────────

export interface VaultIdentityData {
  displayName: string;
  givenName: string | null;
  familyName: string | null;
  phoneNumber: string | null;
  email: string | null;
  photoUri: string | null;
  deviceName: string | null;
  deviceModel: string | null;
  platform: SetuPlatform;
  deviceId: string; // derived from crypto identity
  publicKey: string; // shareable
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  // Visibility settings
  visibility: {
    displayName: 'nearby' | 'paired' | 'contacts' | 'private';
    phoneNumber: 'nearby' | 'paired' | 'contacts' | 'private';
    email: 'nearby' | 'paired' | 'contacts' | 'private';
    avatar: 'nearby' | 'paired' | 'contacts' | 'private';
  };
}

// ── Native module interface ────────────────────────────────────────────────────

export interface SetuNativeModule {
  addListener<EventName extends keyof SetuNativeEvents>(
    eventName: EventName,
    listener: SetuNativeEvents[EventName]
  ): { remove(): void };

  // Basic
  ping(): string;

  // Runtime lifecycle: started once the app state machine reaches READY. Idempotent.
  startRuntime(deviceName: string | null): Promise<RuntimeStatus>;
  stopRuntime(): Promise<boolean>;
  isRuntimeStarted(): boolean;
  getInitialShareIntent(): Promise<{ action: string; type?: string; uris?: string[]; magnet?: string } | null>;

  // Crypto identity
  getCryptoIdentity(): Promise<{ deviceId: string; publicKey: string }>;
  getProfile(): Promise<SetuUserProfile>;
  updateProfile(
    displayName: string,
    phone: string | null,
    email: string | null,
    visibility: ProfileVisibility
  ): Promise<SetuUserProfile>;
  getProfileVisibility(): Promise<ProfileVisibility>;
  setProfileVisibility(visibility: ProfileVisibility): Promise<ProfileVisibility>;
  setPeerProfileVisibility(peerId: string, visibility: ProfileVisibility): Promise<boolean>;
  isCryptoIdentityInitialized(): boolean;
  signPayload(payloadBase64: string): Promise<string>;
  verifyPeerSignature(
    payloadBase64: string,
    signatureB64: string,
    publicKeyB64: string
  ): Promise<boolean>;
  destroyCryptoIdentity(): Promise<boolean>;

  // Vault
  initVault(json: string): Promise<boolean>;
  readVault(): Promise<string | null>;
  updateVault(json: string): Promise<boolean>;
  isVaultInitialized(): boolean;
  destroyVault(): Promise<boolean>;

  // Nearby discovery (advertising runs while the runtime is started; scanning follows the screen)
  setNearbyScanning(enabled: boolean): Promise<NearbySnapshot>;
  getNearbyState(): Promise<NearbySnapshot>;
  getDiscoveredPeers(): Promise<DiscoveredPeer[]>;
  refreshNearby(): Promise<NearbySnapshot>;

  // Radios and the system screens that fix them
  getRadioState(): Promise<RadioSnapshot>;
  refreshRadioState(): Promise<RadioSnapshot>;
  openRadioSettings(target: RadioSettingsTarget): Promise<boolean>;

  // Sessions
  connectToPeer(
    peerId: string,
    publicKey: string,
    host: string,
    port: number
  ): Promise<AuthenticatedPeerSession>;
  /**
   * Connects to an address the user typed, when discovery cannot see the peer. The identity is
   * still proven by TLS and the signed transcript, and the session stays unauthorised until the
   * verification code is confirmed on both phones.
   */
  connectToAddress(host: string, port: number): Promise<AuthenticatedPeerSession>;
  /** Forms a Wi-Fi Direct group with a peer found that way, then dials the transport over it. */
  connectOverWifiDirect(peerId: string): Promise<WifiDirectConnectResult>;
  leaveWifiDirectGroup(): Promise<boolean>;
  getWifiDirectState(): Promise<RadioState>;
  /** This device's own address, so another phone can reach it when discovery cannot. */
  getLocalEndpoint(): Promise<{ host: string; port: number } | null>;
  authorizePeerSession(sessionId: string): Promise<boolean>;
  closePeerSession(sessionId: string): Promise<boolean>;
  getKnownPeers(): Promise<KnownPeer[]>;
  forgetPeer(peerId: string): Promise<boolean>;

  // Pair by code
  createPairCode(): Promise<PairCode>;
  stopPairCode(code: string): Promise<boolean>;
  redeemPairCode(code: string): Promise<PairCodeRedemption>;

  // Direct transfer
  startFileTransfer(
    sessionId: string,
    sourceUri: string,
    fileName: string,
    mimeType: string
  ): Promise<string>;
  acceptIncomingTransfer(transferId: string): Promise<boolean>;
  declineIncomingTransfer(transferId: string): Promise<boolean>;
  cancelTransfer(transferId: string): Promise<boolean>;

  // NFC introduction only, never bulk transport
  startNfcIntroduction(): Promise<string>;
  stopNfcIntroduction(): Promise<boolean>;

  // Screen security
  setSecureScreen(secure: boolean): Promise<boolean>;

  // Biometric
  getBiometricCapability(): BiometricCapability;

  // Swarm
  startSwarmTransfer(sessionId: string, manifestId: string): Promise<string>;
  addLocalPiece(
    manifestId: string,
    pieceIndex: number,
    pieceHash: string,
    storagePath: string
  ): Promise<boolean>;
  getSwarmHealth(manifestId: string): Promise<SwarmHealthState>;
  getSwarmPieceMap(manifestId: string): Promise<SwarmPieceMapState | null>;
  setServingEnabled(enabled: boolean): Promise<boolean>;
  getServingEnabled(): Promise<boolean>;
  setPlaybackPriority(
    manifestId: string,
    playbackWindow?: { start: number; end: number }
  ): Promise<void>;
  clearPlaybackPriority(manifestId: string): Promise<void>;

  // Android background service
  startSetuService(): Promise<boolean>;
  stopSetuService(): Promise<boolean>;
  isSetuServiceRunning(): boolean;
  getStartOnBoot(): boolean;
  setStartOnBoot(enabled: boolean): Promise<boolean>;
  isIgnoringBatteryOptimizations(): boolean;
  openBatteryOptimizationSettings(): Promise<boolean>;
}

export interface SwarmHealthState {
  availablePieces: number;
  totalPieces: number;
  rarePieces: number[];
  atRiskPieces: number[];
  /**
   * The smallest provider-set size present in the native provider map. It is not a general
   * replication factor and skips pieces with no known provider. Read `minimumProviderCount`.
   */
  replicationFactor: number;
  isComplete: boolean;
  availablePieceCount: number;
  totalPieceCount: number;
  /** Smallest provider count across every piece; a piece with no provider counts as zero. */
  minimumProviderCount: number;
  averageProviderCount: number;
  /** Pieces held by exactly one provider: losing that peer loses the piece. */
  criticalPieceCount: number;
  rarePieceCount: number;
  atRiskPieceCount: number;
}

// ── Messaging types ────────────────────────────────────────────────────────────

export interface SetuMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  type: string;
  state: string;
  timestamp: number;
  isRead: boolean;
  hopCount: number;
  expiresAt: number;
  attachmentIds: string[];
}

export interface SetuConversation {
  conversationId: string;
  participants: string[];
  createdAt: number;
  lastMessageAt: number;
  lastMessageContent: string;
  isGroup: boolean;
  name: string;
}

// ── Device media library ───────────────────────────────────────────────────────

/** Sections the Library offers. FAVORITES needs Android 11+; older versions report none. */
export type MediaCategory =
  'PHOTOS' | 'VIDEOS' | 'AUDIO' | 'DOCUMENTS' | 'DOWNLOADS' | 'FAVORITES' | 'RECENT' | 'ALL';

export type MediaSortOrder =
  'DATE_DESC' | 'DATE_ASC' | 'NAME_ASC' | 'NAME_DESC' | 'SIZE_DESC' | 'SIZE_ASC';

/** One row of a media page: bounded metadata plus a content:// uri the UI renders directly. */
export interface MediaItem {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
  modifiedAt: number;
  durationMs: number;
  width: number;
  height: number;
  albumId: string | null;
  albumName: string | null;
  kind: 'image' | 'video' | 'audio' | 'document';
  /** MediaStore's favourite flag. Always false below Android 11, which has no such column. */
  isFavorite: boolean;
}

export interface MediaAlbum {
  id: string;
  name: string;
  itemCount: number;
  coverUri: string | null;
}

// ── Content types ──────────────────────────────────────────────────────────────

export interface SetuContentItem {
  contentId: string;
  type: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
  modifiedAt: number;
  sourceUri: string;
  storageMode: string;
  encryptionMode: string;
  manifestId: string;
  ownerId: string;
  visibility: string;
  availability: string;
  state: string;
  thumbnailUri: string;
}

// ── Shared Space types ─────────────────────────────────────────────────────────

export interface SetuSharedSpaceItem {
  spaceId: string;
  name: string;
  ownerId: string;
  members: string[];
  invitedMembers: string[];
  isEncrypted: boolean;
  contentCount: number;
  totalSize: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

// ── Extended module interface (messaging + content + spaces) ───────────────────

export interface SetuNativeExtended extends SetuNativeModule {
  // Messaging
  sendMessage(conversationId: string, recipientId: string, text: string): Promise<string>;
  sendMessageWithAttachments(
    conversationId: string,
    recipientId: string,
    text: string,
    contentIds: string[]
  ): Promise<string>;
  getConversations(userId: string): Promise<SetuConversation[]>;
  getConversationMessages(conversationId: string, limit: number): Promise<SetuMessage[]>;
  markMessageRead(messageId: string): Promise<boolean>;
  getMessageStats(): Promise<Record<string, number>>;
  pruneMessageRetention(policy: 'KEEP' | '7D' | '30D'): Promise<number>;
  getMessageRetentionPolicy(): 'KEEP' | '7D' | '30D';
  setMessageRetentionPolicy(policy: 'KEEP' | '7D' | '30D'): Promise<number>;
  getNotificationPreviewsEnabled(): boolean;
  setNotificationPreviewsEnabled(enabled: boolean): Promise<boolean>;
  createGroup(
    groupId: string,
    ownerId: string,
    name: string,
    members: string[]
  ): Promise<SetuConversation>;
  updateGroupMembers(
    groupId: string,
    actorId: string,
    members: string[]
  ): Promise<SetuConversation>;
  getGroupEpoch(groupId: string): Promise<number>;
  sendEmergencyBroadcast(
    content: string,
    category: string,
    ttlMs: number,
    hopLimit: number
  ): Promise<string>;

  // Content Library
  selectSafTree(ownerId: string): Promise<number>;
  scanContent(ownerId: string): Promise<void>;
  getContent(contentId: string): Promise<SetuContentItem | null>;
  getContentByOwner(ownerId: string): Promise<SetuContentItem[]>;
  getContentPage(ownerId: string, offset: number, limit: number): Promise<SetuContentItem[]>;
  searchContent(query: string, ownerId: string, limit: number): Promise<SetuContentItem[]>;
  deleteContent(contentId: string): Promise<boolean>;
  addSetuManagedContent(
    name: string,
    mimeType: string,
    size: number,
    sourceUri: string,
    ownerId: string,
    manifestId: string
  ): Promise<SetuContentItem>;
  getThumbnail(contentId: string): Promise<string | null>;

  /** One page of the device's media, read straight from MediaStore. `limit` is capped at 120. */
  getMediaPage(
    category: MediaCategory,
    albumId: string | null,
    query: string | null,
    sort: MediaSortOrder,
    offset: number,
    limit: number
  ): Promise<MediaItem[]>;
  getMediaAlbums(): Promise<MediaAlbum[]>;
  getMediaCounts(): Promise<Record<MediaCategory, number>>;
  /** Hands a file to the user's own app for that type (PDF reader, document editor, …). */
  openExternally(uri: string, mimeType: string): Promise<boolean>;
  /** True when at least one installed app can open this type. */
  canOpenExternally(mimeType: string): Promise<boolean>;
  /**
   * Asks Android to delete these MediaStore items. From Android 11 the system shows its own
   * confirmation; resolves with how many items were deleted, or 0 if the user declined.
   */
  deleteMediaItems(uris: string[]): Promise<number>;
  setMediaFavorite(uris: string[], favorite: boolean): Promise<number>;
  /** Opens a PDF for in-app reading. The document stays open natively until closePdf. */
  openPdf(uri: string): Promise<{ handle: string; pageCount: number }>;
  /** Rasterises one page to a PNG in the cache and returns a file uri to render. */
  renderPdfPage(
    handle: string,
    page: number,
    width: number
  ): Promise<{ uri: string; width: number; height: number }>;
  /** Releases the document and deletes the pages rendered for it. */
  closePdf(handle: string): Promise<void>;
  listVaultContent(ownerId: string): Promise<SetuContentItem[]>;
  importContentToVault(contentId: string): Promise<SetuContentItem>;
  copyContentToVault(contentId: string): Promise<SetuContentItem>;
  moveContentToVault(
    contentId: string
  ): Promise<{ operation: 'MOVED' | 'COPIED'; content: SetuContentItem }>;
  exportVaultContent(
    contentId: string,
    destinationUri: string,
    warningConfirmed: boolean
  ): Promise<boolean>;
  deleteVaultContent(contentId: string): Promise<boolean>;
  openVaultContentForRead(contentId: string): Promise<{ nativeId: string; handle: string }>;
  closeVaultContentRead(handle: string): Promise<boolean>;

  // Shared Spaces
  createSpace(
    name: string,
    ownerId: string,
    encrypted: boolean
  ): Promise<SetuSharedSpaceItem | null>;
  getSpacesByOwner(ownerId: string): Promise<SetuSharedSpaceItem[]>;
  getSpacesByMember(memberId: string): Promise<SetuSharedSpaceItem[]>;
  getSpace(spaceId: string): Promise<SetuSharedSpaceItem | null>;
  deleteSpace(spaceId: string, ownerId: string): Promise<boolean>;
  inviteToSpace(spaceId: string, inviterId: string, inviteeId: string): Promise<boolean>;
  acceptSpaceInvitation(spaceId: string, memberId: string): Promise<boolean>;
  declineSpaceInvitation(spaceId: string, memberId: string): Promise<boolean>;
  leaveSpace(spaceId: string, memberId: string): Promise<boolean>;
  addContentToSpace(spaceId: string, contentId: string, memberId: string): Promise<boolean>;
  removeContentFromSpace(
    spaceId: string,
    contentId: string,
    memberId: string,
    deleteForBoth?: boolean
  ): Promise<boolean>;
  getSpaceContent(spaceId: string): Promise<SetuContentItem[]>;
  syncSpace(spaceId: string, peerId: string): Promise<boolean>;
  getSpaceStats(): Promise<Record<string, number>>;
}
