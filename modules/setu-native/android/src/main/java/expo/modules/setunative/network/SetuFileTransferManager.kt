package expo.modules.setunative.network

import android.content.Context
import android.net.Uri
import expo.modules.setunative.governor.ResourceGovernor
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

object SetuFileTransferManager {
    @Volatile
    private var initialized = false
    @Volatile
    private var appContext: Context? = null
    @Volatile
    private var transferListener: TransferListener? = null
    @Volatile
    private var persistence: TransferPersistence? = null
    @Volatile
    private var incomingHandler: TransferIncomingHandler? = null
    @Volatile
    private var outgoingHandler: TransferOutgoingHandler? = null
    @Volatile
    private var resourceGovernor: ResourceGovernor? = null

    private val outgoingReplies = ConcurrentHashMap<String, LinkedBlockingQueue<TransferFrame>>()
    private val outgoingSessionIds = ConcurrentHashMap<String, String>()
    private val outgoingTransfers = ConcurrentHashMap.newKeySet<String>()

    private val executor = ThreadPoolExecutor(
        2,
        2,
        30L,
        TimeUnit.SECONDS,
        ArrayBlockingQueue(TransferConstants.MAX_QUEUED_OUTGOING),
    )

    private val governorListener: (ResourceGovernor.ResourceCondition) -> Unit = ::applyGovernorCondition

    /** Idempotent: repeated calls keep the existing handlers and only swap the listener's target. */
    @Synchronized
    fun initialize(appContext: Context, transferListener: TransferListener) {
        if (initialized) {
            this.transferListener = transferListener
            return
        }
        val applicationContext = appContext.applicationContext
        val governor = ResourceGovernor.create(applicationContext)
        resourceGovernor = governor
        governor.addConditionListener(governorListener)
        governor.startMonitoring()
        this.appContext = applicationContext
        this.transferListener = transferListener
        this.persistence = TransferPersistence(applicationContext)
        this.incomingHandler = TransferIncomingHandler(
            applicationContext,
            transferListener,
            persistence!!,
            outgoingSessionIds,
            outgoingReplies
        )
        this.outgoingHandler = TransferOutgoingHandler(
            applicationContext,
            transferListener,
            persistence!!,
            outgoingReplies,
            outgoingSessionIds,
            outgoingTransfers,
            executor
        )
        if (!persistence!!.tempCleanupComplete) {
            persistence!!.restoreTransfers()
        }
        SetuPeerTransport.registerApplicationFrameHandler("file-transfer", ::handleFrame)
        initialized = true
    }

    private fun handleFrame(session: PeerSession, type: Int, payload: ByteArray) {
        try {
            when (type) {
                SetuPeerTransport.FRAME_TRANSFER_OFFER -> incomingHandler?.handleIncomingOffer(session, payload)
                SetuPeerTransport.FRAME_TRANSFER_ACCEPT,
                SetuPeerTransport.FRAME_TRANSFER_REJECT,
                SetuPeerTransport.FRAME_TRANSFER_PIECE_ACK,
                SetuPeerTransport.FRAME_TRANSFER_COMPLETE_ACK -> incomingHandler?.routeReply(session, payload, type)
                SetuPeerTransport.FRAME_TRANSFER_PIECE -> incomingHandler?.handleIncomingPiece(session, payload)
                SetuPeerTransport.FRAME_TRANSFER_COMPLETE -> incomingHandler?.handleIncomingComplete(session, payload)
                SetuPeerTransport.FRAME_TRANSFER_CANCEL -> incomingHandler?.handleIncomingCancel(session, payload)
                else -> Unit
            }
        } catch (error: Exception) {
            if (type != SetuPeerTransport.FRAME_TRANSFER_CANCEL && payload.size >= 16) {
                val transferIdText = runCatching {
                    TransferUtils.parseTransferIdPayload(payload).toString()
                }.getOrNull()
                val transfer = transferIdText?.let { persistence?.getPendingIncoming()?.get(it) }
                if (transfer != null && transfer.offer.sessionId == session.sessionId) {
                    persistence?.getPendingIncoming()?.remove(transferIdText)?.let { persistence?.closeAndDelete(it) }
                    transferListener?.onFailed(
                        transferIdText,
                        session.sessionId,
                        session.peerId,
                        TransferUtils.safeFailure(error),
                        "download",
                    )
                }
            }
            throw error
        }
    }

    fun startOutgoing(sessionId: String, uri: Uri, fileName: String, mimeType: String): String {
        if (!initialized) throw IllegalStateException("TRANSFER_MANAGER_NOT_INITIALIZED")
        resourceGovernor?.let { governor ->
            governor.updateResourceStatus()
            val action = governor.canStartTransfer(isUserInitiated = true)
            if (action == ResourceGovernor.GovernorAction.DENY || action == ResourceGovernor.GovernorAction.PAUSE) {
                throw IllegalStateException("RESOURCE_CONSTRAINED")
            }
            applyGovernorCondition(governor.getCurrentCondition())
        }
        return outgoingHandler?.startOutgoing(sessionId, uri, fileName, mimeType)
            ?: throw IllegalStateException("TRANSFER_MANAGER_NOT_INITIALIZED")
    }

    private fun applyGovernorCondition(condition: ResourceGovernor.ResourceCondition) {
        val concurrency = when (condition) {
            ResourceGovernor.ResourceCondition.NORMAL,
            ResourceGovernor.ResourceCondition.CHARGING -> 2
            ResourceGovernor.ResourceCondition.CONSTRAINED,
            ResourceGovernor.ResourceCondition.CRITICAL -> 1
        }
        synchronized(executor) {
            if (concurrency > executor.maximumPoolSize) executor.maximumPoolSize = concurrency
            if (concurrency < executor.corePoolSize) executor.corePoolSize = concurrency
            if (concurrency < executor.maximumPoolSize) executor.maximumPoolSize = concurrency
            if (concurrency > executor.corePoolSize) executor.corePoolSize = concurrency
        }
    }

    fun resumeOutgoing(sessionId: String, peerId: String) {
        outgoingHandler?.resumeOutgoing(sessionId, peerId)
    }

    fun acceptIncoming(transferId: String): Boolean {
        return incomingHandler?.acceptIncoming(transferId) ?: false
    }

    fun declineIncoming(transferId: String): Boolean {
        return incomingHandler?.declineIncoming(transferId) ?: false
    }

    fun cancelTransfer(transferId: String): Boolean {
        val incomingResult = incomingHandler?.cancelIncoming(transferId) ?: false
        if (incomingResult) return true
        return outgoingHandler?.cancelTransfer(transferId) ?: false
    }

    fun onSessionClosed(session: PeerSession) {
        incomingHandler?.onIncomingSessionClosed(session)
        outgoingHandler?.onSessionClosed(session.sessionId)
    }
}
