import { requireNativeModule } from 'expo';
import type { SetuNativeEvents, SetuNativeExtended, SetuNativeModule } from './SetuNative.types';

const core = requireNativeModule<SetuNativeModule>('SetuNative');
const content = requireNativeModule<SetuNativeModule>('SetuNativeContent');
const saf = requireNativeModule<SetuNativeModule>('SetuNativeSaf');
const messaging = requireNativeModule<SetuNativeModule>('SetuNativeMessaging');
const sharedSpaces = requireNativeModule<SetuNativeModule>('SetuNativeSharedSpace');
const swarm = requireNativeModule<SetuNativeModule>('SetuNativeSwarm');
const background = requireNativeModule<SetuNativeModule>('SetuNativeBackground');

const eventOwners: Partial<Record<keyof SetuNativeEvents, SetuNativeModule>> = {
  onContentDiscovered: content,
  onContentRemoved: content,
  onScanProgress: content,
  onScanComplete: content,
  onScanFailed: content,
  onVaultContentChanged: content,
  onMessageReceived: messaging,
  onMessageDelivered: messaging,
  onMessageRead: messaging,
  onMessageFailed: messaging,
  onConversationCreated: messaging,
  onGroupUpdated: messaging,
  onEmergencyReceived: messaging,
  onSpaceCreated: sharedSpaces,
  onSpaceInvitationReceived: sharedSpaces,
  onSpaceInvitationAccepted: sharedSpaces,
  onContentAddedToSpace: sharedSpaces,
  onContentRemovedFromSpace: sharedSpaces,
  onSpaceUpdated: sharedSpaces,
  onSpaceSyncProgress: sharedSpaces,
  onSpaceSyncComplete: sharedSpaces,
  onSpaceOperationFailed: sharedSpaces,
  onPieceAvailable: swarm,
  onPieceRequested: swarm,
  onPieceServed: swarm,
  onPieceTransferred: swarm,
  onSwarmHealthChanged: swarm,
  onDepartureDetected: swarm,
  onSwarmTransferProgress: swarm,
  onSwarmTransferCompleted: swarm,
  onSwarmTransferFailed: swarm,
};

const methodOwners: Record<string, SetuNativeModule> = {
  selectSafTree: saf,
  scanContent: content,
  getContent: content,
  getContentByOwner: content,
  getContentPage: content,
  searchContent: content,
  deleteContent: content,
  addSetuManagedContent: content,
  getThumbnail: content,
  getMediaPage: content,
  getMediaAlbums: content,
  getMediaCounts: content,
  openExternally: content,
  canOpenExternally: content,
  deleteMediaItems: content,
  setMediaFavorite: content,
  openPdf: content,
  renderPdfPage: content,
  closePdf: content,
  listVaultContent: content,
  importContentToVault: content,
  copyContentToVault: content,
  moveContentToVault: content,
  exportVaultContent: content,
  deleteVaultContent: content,
  openVaultContentForRead: content,
  closeVaultContentRead: content,
  sendMessage: messaging,
  sendMessageWithAttachments: messaging,
  getConversations: messaging,
  getConversationMessages: messaging,
  markMessageRead: messaging,
  getMessageStats: messaging,
  pruneMessageRetention: messaging,
  getMessageRetentionPolicy: messaging,
  setMessageRetentionPolicy: messaging,
  getNotificationPreviewsEnabled: messaging,
  setNotificationPreviewsEnabled: messaging,
  createGroup: messaging,
  updateGroupMembers: messaging,
  getGroupEpoch: messaging,
  sendEmergencyBroadcast: messaging,
  createSpace: sharedSpaces,
  getSpacesByOwner: sharedSpaces,
  getSpacesByMember: sharedSpaces,
  getSpace: sharedSpaces,
  deleteSpace: sharedSpaces,
  inviteToSpace: sharedSpaces,
  acceptSpaceInvitation: sharedSpaces,
  declineSpaceInvitation: sharedSpaces,
  leaveSpace: sharedSpaces,
  addContentToSpace: sharedSpaces,
  removeContentFromSpace: sharedSpaces,
  getSpaceContent: sharedSpaces,
  syncSpace: sharedSpaces,
  getSpaceStats: sharedSpaces,
  startSwarmTransfer: swarm,
  addLocalPiece: swarm,
  getSwarmHealth: swarm,
  getSwarmPieceMap: swarm,
  setServingEnabled: swarm,
  getServingEnabled: swarm,
  setPlaybackPriority: swarm,
  clearPlaybackPriority: swarm,
  startSetuService: background,
  stopSetuService: background,
  isSetuServiceRunning: background,
  getStartOnBoot: background,
  setStartOnBoot: background,
  isIgnoringBatteryOptimizations: background,
  openBatteryOptimizationSettings: background,
};

const combined = new Proxy(core as SetuNativeExtended, {
  get(target, property) {
    if (property === 'addListener') {
      return <EventName extends keyof SetuNativeEvents>(
        eventName: EventName,
        listener: SetuNativeEvents[EventName]
      ) => (eventOwners[eventName] ?? core).addListener(eventName, listener);
    }

    const owner = typeof property === 'string' ? methodOwners[property] : undefined;
    const source = owner ?? target;
    const value = Reflect.get(source, property, source);
    return typeof value === 'function' ? value.bind(source) : value;
  },
});

export default combined;
