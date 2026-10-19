import type {
  BiometricCapability,
  NearbySnapshot,
  RadioSnapshot,
  SetuNativeEvents,
  SetuNativeModule,
  SetuUserProfile,
} from './SetuNative.types';

/**
 * Web stub. Setu is Android-only; this exists so bundling for web does not fail. Everything that
 * needs a radio, the Keystore or the local transport reports unavailable rather than pretending.
 */
const unsupported = async (): Promise<never> => {
  throw new Error('UNAVAILABLE_ON_WEB');
};

const nearby: NearbySnapshot = {
  state: 'STOPPED',
  scanning: false,
  peerCount: 0,
  reason: 'UNAVAILABLE_ON_WEB',
};

const radio: RadioSnapshot = {
  nfc: 'UNSUPPORTED',
  wifi: 'UNSUPPORTED',
  wifiDirect: 'UNSUPPORTED',
  location: 'UNSUPPORTED',
  nearbyPermission: 'UNSUPPORTED',
  notifications: 'UNSUPPORTED',
  battery: 'UNSUPPORTED',
};

const profile: SetuUserProfile = {
  deviceId: 'web-device',
  displayName: '',
  phone: null,
  email: null,
  visibility: 'PRIVATE',
  version: 0,
};

const SetuNative: SetuNativeModule = {
  ping: () => 'Setu web bridge is alive',

  startRuntime: async () => ({ started: false, deviceId: 'web-device', nearby, radio }),
  stopRuntime: async () => false,
  isRuntimeStarted: () => false,
  getInitialShareIntent: async () => null,

  getCryptoIdentity: async () => ({ deviceId: 'web-device', publicKey: '' }),
  getProfile: async () => profile,
  updateProfile: async () => profile,
  getProfileVisibility: async () => 'PRIVATE',
  setProfileVisibility: async () => 'PRIVATE',
  setPeerProfileVisibility: async () => false,
  isCryptoIdentityInitialized: () => false,
  signPayload: unsupported,
  verifyPeerSignature: async () => false,
  destroyCryptoIdentity: async () => false,

  initVault: async () => false,
  readVault: async () => null,
  updateVault: async () => false,
  isVaultInitialized: () => false,
  destroyVault: async () => false,

  setNearbyScanning: async () => nearby,
  getNearbyState: async () => nearby,
  getDiscoveredPeers: async () => [],
  refreshNearby: async () => nearby,

  getRadioState: async () => radio,
  refreshRadioState: async () => radio,
  openRadioSettings: async () => false,

  connectToPeer: unsupported,
  connectToAddress: unsupported,
  getLocalEndpoint: async () => null,
  authorizePeerSession: async () => false,
  closePeerSession: async () => false,
  getKnownPeers: async () => [],
  forgetPeer: async () => false,

  createPairCode: unsupported,
  stopPairCode: async () => false,
  redeemPairCode: async () => ({ error: 'UNAVAILABLE_ON_WEB' }),

  startFileTransfer: unsupported,
  acceptIncomingTransfer: async () => false,
  declineIncomingTransfer: async () => false,
  cancelTransfer: async () => false,

  connectOverWifiDirect: async () => {
    throw new Error('WIFI_DIRECT_UNAVAILABLE');
  },
  leaveWifiDirectGroup: async () => false,
  getWifiDirectState: async () => 'UNSUPPORTED' as const,
  startNfcIntroduction: async () => 'NFC_UNAVAILABLE',
  stopNfcIntroduction: async () => false,

  setSecureScreen: async () => false,

  getBiometricCapability: (): BiometricCapability => 'NONE',

  startSwarmTransfer: unsupported,
  addLocalPiece: async () => false,
  getSwarmHealth: async () => ({
    availablePieces: 0,
    totalPieces: 0,
    rarePieces: [],
    atRiskPieces: [],
    replicationFactor: 0,
    isComplete: false,
    availablePieceCount: 0,
    totalPieceCount: 0,
    minimumProviderCount: 0,
    averageProviderCount: 0,
    criticalPieceCount: 0,
    rarePieceCount: 0,
    atRiskPieceCount: 0,
  }),
  getSwarmPieceMap: unsupported,
  setServingEnabled: async () => false,
  getServingEnabled: async () => false,
  setPlaybackPriority: async () => {},
  clearPlaybackPriority: async () => {},

  startSetuService: unsupported,
  stopSetuService: unsupported,
  isSetuServiceRunning: () => false,
  getStartOnBoot: () => false,
  setStartOnBoot: unsupported,
  isIgnoringBatteryOptimizations: () => false,
  openBatteryOptimizationSettings: unsupported,

  addListener: <EventName extends keyof SetuNativeEvents>(
    _eventName: EventName,
    _listener: SetuNativeEvents[EventName]
  ) => ({ remove: () => undefined }),
};

export default SetuNative;
