package expo.modules.setunative.swarm

import android.content.Context
import android.util.Log
import expo.modules.setunative.governor.ResourceGovernor
import expo.modules.setunative.models.*
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.persistence.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.Condition
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Core swarm engine for Setu. Manages swarm transfers and coordinates components.
 */
class SetuSwarmEngine private constructor(
    private val context: Context,
    val pieceRepository: PieceRepository,
    val transferRepository: TransferRepository,
    val peerRepository: PeerRepository,
    val providerMapRepository: ProviderMapRepository,
    val swarmStateRepository: SwarmStateRepository,
    val manifestRepository: ManifestRepository
) {

    companion object {
        private const val TAG = "SETU_SWARM_ENGINE"

        @Volatile
        private var instance: SetuSwarmEngine? = null

        fun getInstance(context: Context): SetuSwarmEngine {
            return instance ?: synchronized(this) {
                instance ?: createInstance(context).also { instance = it }
            }
        }

        fun createInstance(context: Context): SetuSwarmEngine {
            val db = SetuDatabase.getInstance(context)
            return SetuSwarmEngine(
                context = context.applicationContext,
                pieceRepository = PieceRepository.create(context),
                transferRepository = TransferRepository.create(context),
                peerRepository = PeerRepository.create(context),
                providerMapRepository = ProviderMapRepository.create(context),
                swarmStateRepository = SwarmStateRepository.create(context),
                manifestRepository = ManifestRepository.create(context)
            )
        }
    }

    internal val executor = Executors.newCachedThreadPool()
    private val isRunning = AtomicBoolean(false)
    private val servingEnabled = AtomicBoolean(true)
    internal val activeTransfers = ConcurrentHashMap<String, SwarmTransfer>()
    internal val resourceGovernor = ResourceGovernor(context, peerRepository, transferRepository)

    internal var swarmListener: SwarmListener? = null

    /** Signalled by [onPieceVerified]; readers waiting for a piece wake on it instead of polling. */
    private val pieceProgressLock = ReentrantLock()
    private val pieceProgress: Condition = pieceProgressLock.newCondition()
    internal lateinit var swarmCoordinator: SwarmCoordinator
    private lateinit var pieceManager: PieceManager
    internal lateinit var transferManager: TransferManager
    internal lateinit var replicationManager: ReplicationManager
    val pieceStore = PieceStore(context)

    interface SwarmListener {
        fun onPieceAvailable(manifestId: String, pieceIndex: Int, peerId: String)
        fun onPieceRequested(manifestId: String, pieceIndex: Int, peerId: String)
        fun onPieceServed(manifestId: String, pieceIndex: Int, peerId: String, bytes: Long)
        fun onPieceTransferred(manifestId: String, pieceIndex: Int, peerId: String, bytes: Long)
        fun onTransferProgress(transferId: String, verifiedBytes: Long, totalBytes: Long)
        fun onTransferCompleted(transferId: String, manifestId: String)
        fun onTransferFailed(transferId: String, reason: String)
        fun onRarePieceDetected(manifestId: String, pieceIndex: Int)
        fun onSwarmHealthChanged(manifestId: String, health: SwarmHealth)
        fun onDepartureDetected(peerId: String, sessionId: String, rarePieces: Set<Int>)
    }

    data class SwarmHealth(
        val availablePieces: Int,
        val totalPieces: Int,
        val rarePieces: Set<Int>,
        val atRiskPieces: Set<Int>,
        val replicationFactor: Int,
        val isComplete: Boolean
    )

    data class SwarmTransfer(
        val transferId: String,
        val manifestId: String,
        val direction: TransferDirection,
        var peerId: String,
        var sessionId: String,
        var state: TransferState,
        val totalBytes: Long,
        var verifiedBytes: Long,
        val requestedPieces: MutableSet<Int> = ConcurrentHashMap.newKeySet()
    )

    fun initialize(listener: SwarmListener? = null) {
        if (listener != null) swarmListener = listener
        if (isRunning.compareAndSet(false, true)) {
            this.swarmCoordinator = SwarmCoordinator(this)
            this.pieceManager = PieceManager(this)
            this.transferManager = TransferManager(this)
            this.replicationManager = ReplicationManager(this)
            executor.execute { resourceGovernor.startMonitoring() }

            Log.i(TAG, "Swarm engine initialized")
        }
    }

    fun shutdown() {
        if (isRunning.compareAndSet(true, false)) {
            activeTransfers.clear()
            swarmListener = null
            resourceGovernor.stopMonitoring()
            Log.i(TAG, "Swarm engine shutdown")
        }
    }

    fun setServingEnabled(enabled: Boolean): Boolean {
        servingEnabled.set(enabled)
        return enabled
    }

    fun isServingEnabled(): Boolean = servingEnabled.get()

    fun onPieceServed(manifestId: String, pieceIndex: Int, peerId: String, bytes: Long) {
        swarmListener?.onPieceServed(manifestId, pieceIndex, peerId, bytes)
    }

    fun startSwarmTransfer(manifest: SetuManifest, peerId: String, sessionId: String): String {
        if (!isRunning.get()) throw IllegalStateException("Swarm engine not initialized")
        require(SetuPeerTransport.isSessionAuthorized(sessionId)) { "SESSION_NOT_AUTHORIZED" }
        require(SetuPeerTransport.peerIdForSession(sessionId) == peerId) { "SESSION_PEER_MISMATCH" }
        return transferManager.startSwarmTransfer(manifest, peerId, sessionId)
    }

    fun requestPieceFromPeer(manifestId: String, pieceIndex: Int, peerId: String, sessionId: String): String =
        pieceManager.requestPieceFromPeer(manifestId, pieceIndex, peerId, sessionId)

    fun onPieceVerified(manifestId: String, pieceIndex: Int) {
        if (::transferManager.isInitialized) transferManager.onPieceVerified(manifestId, pieceIndex)
        pieceProgressLock.withLock { pieceProgress.signalAll() }
    }

    /**
     * Blocks the caller until some piece anywhere is verified, or [timeoutMs] elapses. Readers that
     * need a specific piece re-check their own condition after every wake; nothing here polls.
     */
    fun awaitPieceProgress(timeoutMs: Long) {
        if (timeoutMs <= 0L) return
        pieceProgressLock.withLock { pieceProgress.await(timeoutMs, TimeUnit.MILLISECONDS) }
    }

    fun onProviderAvailabilityChanged(manifestId: String) {
        if (::transferManager.isInitialized) transferManager.onProviderAvailabilityChanged(manifestId)
    }

    fun requestPiece(manifestId: String, pieceIndex: Int): Boolean {
        if (!isRunning.get()) initialize()
        val manifest = manifestRepository.get(manifestId) ?: return false
        if (pieceIndex !in 0 until manifest.pieceCount) return false
        val localPiece = pieceRepository.get("${manifestId}_$pieceIndex")
        if (localPiece?.state == PieceState.AVAILABLE &&
            pieceStore.verifyFile(manifest, pieceIndex, localPiece.hash, localPiece.storagePath)) return true
        if (!swarmCoordinator.canRequestPlaybackPiece()) return false

        val knownProviders = providerMapRepository.getProviders(manifestId, pieceIndex)
            .map { it.providerPeerId }
            .toMutableSet()
        knownProviders.add(manifest.ownerId)
        val peer = peerRepository.getConnected().firstOrNull { candidate ->
            candidate.peerId in knownProviders && candidate.sessionId?.let {
                SetuPeerTransport.isSessionAuthorized(it)
            } == true
        } ?: return false

        providerMapRepository.upsert(
            ProviderMapEntry(manifestId, pieceIndex, peer.peerId, isVerified = false)
        )
        setPlaybackWindow(manifestId, pieceIndex, pieceIndex)
        val alreadyActive = activeTransfers.values.any { it.manifestId == manifestId }
        if (alreadyActive) {
            transferManager.onProviderAvailabilityChanged(manifestId)
        } else {
            transferManager.startSwarmTransfer(manifest, peer.peerId, peer.sessionId!!)
        }
        return activeTransfers.values.any { it.manifestId == manifestId }
    }

    fun removeRequestsForPeer(peerId: String, sessionId: String) {
        if (::pieceManager.isInitialized) pieceManager.removeRequestsForPeer(peerId, sessionId)
    }

    fun getPieceManagerActiveRequestCount(): Int =
        if (::pieceManager.isInitialized) pieceManager.activeRequestCount() else 0

    fun handleHaveMessage(sessionId: String, peerId: String, payload: ByteArray) {
        swarmCoordinator.handleHaveMessage(sessionId, peerId, payload)
    }

    fun handleWantMessage(sessionId: String, peerId: String, payload: ByteArray) {
        swarmCoordinator.handleWantMessage(sessionId, peerId, payload)
    }

    fun handlePieceData(sessionId: String, peerId: String, payload: ByteArray) {
        pieceManager.handlePieceData(sessionId, peerId, payload)
    }

    fun handleDepartureAnnouncement(sessionId: String, peerId: String, payload: ByteArray) {
        swarmCoordinator.handleDepartureAnnouncement(sessionId, peerId, payload)
    }

    /** Sends this device's full piece inventory to a peer the user has just authorized. */
    fun advertiseInventoryTo(sessionId: String) {
        if (::pieceManager.isInitialized) pieceManager.advertiseInventoryTo(sessionId)
    }

    fun handlePeerDisconnected(peerId: String, sessionId: String) {
        if (::transferManager.isInitialized) transferManager.handlePeerDisconnected(peerId, sessionId)
    }

    fun addLocalPiece(manifestId: String, pieceIndex: Int, pieceHash: ByteArray, storagePath: String): Boolean {
        return pieceManager.addLocalPiece(manifestId, pieceIndex, pieceHash, storagePath)
    }

    /**
     * Records a manifest this device knows about. Knowing the manifest is what lets the device
     * accept HAVE advertisements for it and track who else holds its pieces; it claims nothing
     * about what this device can serve. Safe to call again (upserts).
     */
    fun publishManifest(manifest: SetuManifest): Boolean {
        if (!isRunning.get()) initialize()
        val stored = manifestRepository.upsert(manifest)
        if (!stored) Log.w(TAG, "Could not persist manifest ${manifest.manifestId}")
        return stored
    }

    /**
     * Publishes a manifest this device now holds in full and registers every verified piece against
     * [storagePath]. Returns the number of pieces that verified; the device only becomes a provider
     * for those.
     */
    fun publishLocalFile(manifest: SetuManifest, storagePath: String): Int {
        if (!publishManifest(manifest)) return 0
        return pieceManager.addLocalFile(manifest.manifestId, storagePath)
    }

    fun getActiveTransfers(): MutableMap<String, SwarmTransfer> = activeTransfers
    fun getSwarmState(): Map<String, SwarmState> =
        if (::swarmCoordinator.isInitialized) swarmCoordinator.getSwarmState() else emptyMap()
    fun getExecutor() = executor
    fun getListener() = swarmListener
    fun getReplicationManager() = replicationManager

    // ─── Playback window management ───────────────────────────────────────────

    private val playbackWindows = ConcurrentHashMap<String, IntRange>()

    fun setPlaybackWindow(manifestId: String, startPiece: Int, endPiece: Int) {
        playbackWindows[manifestId] = startPiece..endPiece
        // Notify scheduler to reprioritize
        if (::swarmCoordinator.isInitialized) {
            swarmCoordinator.onPlaybackWindowChanged(manifestId, startPiece, endPiece)
        }
        Log.d(TAG, "Playback window set for $manifestId: [$startPiece, $endPiece]")
    }

    fun clearPlaybackWindow(manifestId: String) {
        playbackWindows.remove(manifestId)
        if (::swarmCoordinator.isInitialized) {
            swarmCoordinator.onPlaybackWindowCleared(manifestId)
        }
    }

    fun getPlaybackWindow(manifestId: String): IntRange? = playbackWindows[manifestId]
    fun isPlaybackPriority(manifestId: String, pieceIndex: Int): Boolean =
        playbackWindows[manifestId]?.contains(pieceIndex) == true
}
