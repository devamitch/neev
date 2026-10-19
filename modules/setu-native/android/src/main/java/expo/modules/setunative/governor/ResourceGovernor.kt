package expo.modules.setunative.governor

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.os.StatFs
import android.util.Log
import expo.modules.setunative.models.TransferState
import expo.modules.setunative.persistence.PeerRepository
import expo.modules.setunative.persistence.TransferRepository
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * Resource Governor for managing system constraints.
 * Monitors battery, thermal, storage, and network conditions to control resource usage.
 */
class ResourceGovernor(
    private val context: Context,
    private val peerRepository: PeerRepository,
    private val transferRepository: TransferRepository
) {

    companion object {
        private const val TAG = "SETU_GOVERNOR"

        // Thresholds
        private const val LOW_BATTERY_THRESHOLD = 20
        private const val CRITICAL_BATTERY_THRESHOLD = 10
        private const val LOW_STORAGE_THRESHOLD = 0.15 // 15% free
        private const val CRITICAL_STORAGE_THRESHOLD = 0.05 // 5% free
        private const val MAX_CONCURRENT_TRANSFERS = 4
        private const val MAX_CONCURRENT_HASHERS = 2
        private const val MAX_BACKGROUND_TRANSFERS = 2
        private const val MAX_CONNECTIONS = 8
        private const val MAX_PEERS = 16
        private const val THERMAL_STATUS_MODERATE = 2
        private const val THERMAL_STATUS_SEVERE = 3
        private const val RESOURCE_POLL_SECONDS = 15L

        /** Convenience factory when repositories are not yet wired. */
        fun create(context: Context): ResourceGovernor {
            val peerRepo = PeerRepository.create(context)
            val transferRepo = TransferRepository.create(context)
            return ResourceGovernor(context, peerRepo, transferRepo)
        }
    }

    constructor(context: Context) : this(
        context,
        PeerRepository.create(context),
        TransferRepository.create(context)
    )

    enum class ResourceCondition {
        NORMAL, CONSTRAINED, CRITICAL, CHARGING
    }

    enum class GovernorAction {
        ALLOW, THROTTLE, PAUSE, DENY
    }

    data class ResourceStatus(
        val batteryLevel: Int,
        val thermalStatus: Int,
        val isCharging: Boolean,
        val isUsbCharging: Boolean,
        val isAcCharging: Boolean,
        val storageAvailable: Long,
        val storageTotal: Long,
        val freeStorageRatio: Double,
        val activeTransfers: Int,
        val activeConnections: Int,
        val activePeers: Int,
        val condition: ResourceCondition
    )

    @Volatile
    private var currentStatus = ResourceStatus(
        batteryLevel = 100,
        thermalStatus = 0,
        isCharging = false,
        isUsbCharging = false,
        isAcCharging = false,
        storageAvailable = 0L,
        storageTotal = 0L,
        freeStorageRatio = 1.0,
        activeTransfers = 0,
        activeConnections = 0,
        activePeers = 0,
        condition = ResourceCondition.NORMAL
    )

    private val isMonitoring = AtomicBoolean(false)
    private val conditionListeners = CopyOnWriteArrayList<(ResourceCondition) -> Unit>()
    private var batteryReceiverRegistered = false
    private var monitorExecutor: ScheduledExecutorService? = null

    fun startMonitoring() {
        if (isMonitoring.compareAndSet(false, true)) {
            Log.i(TAG, "Resource governor monitoring started")
            runCatching { updateResourceStatus() }
            monitorExecutor = Executors.newSingleThreadScheduledExecutor().also { executor ->
                executor.scheduleAtFixedRate(
                    { runCatching { updateResourceStatus() } },
                    RESOURCE_POLL_SECONDS,
                    RESOURCE_POLL_SECONDS,
                    TimeUnit.SECONDS,
                )
            }
            // Registered last: the receiver hands its work to the executor above.
            registerBatteryReceiver()
        }
    }

    fun stopMonitoring() {
        if (isMonitoring.compareAndSet(true, false)) {
            Log.i(TAG, "Resource governor monitoring stopped")
            unregisterBatteryReceiver()
            monitorExecutor?.shutdownNow()
            monitorExecutor = null
        }
    }

    fun addConditionListener(listener: (ResourceCondition) -> Unit) {
        conditionListeners.addIfAbsent(listener)
        listener(currentStatus.condition)
    }

    private fun registerBatteryReceiver() {
        if (batteryReceiverRegistered) return

        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_BATTERY_CHANGED)
        }

        try {
            context.registerReceiver(batteryReceiver, filter)
            batteryReceiverRegistered = true
            Log.d(TAG, "Battery receiver registered")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register battery receiver", e)
        }
    }

    private fun unregisterBatteryReceiver() {
        if (!batteryReceiverRegistered) return

        try {
            context.unregisterReceiver(batteryReceiver)
            batteryReceiverRegistered = false
            Log.d(TAG, "Battery receiver unregistered")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to unregister battery receiver", e)
        }
    }

    private val batteryReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != Intent.ACTION_BATTERY_CHANGED) return
            // The battery extras are free to read here. Everything else touches the encrypted store
            // and the filesystem, which must never run on the main thread of a broadcast that fires
            // this often — and must never turn a store error into a crash.
            updateBatteryStatus(intent)
            val executor = monitorExecutor
            if (executor == null || executor.isShutdown) {
                runCatching { updateResourceStatus() }
                return
            }
            runCatching { executor.execute { runCatching { updateResourceStatus() } } }
        }
    }

    private fun updateBatteryStatus(intent: Intent) {
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1)

        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING
        val isUsbCharging = plugged == BatteryManager.BATTERY_PLUGGED_USB
        val isAcCharging = plugged == BatteryManager.BATTERY_PLUGGED_AC

        currentStatus = currentStatus.copy(
            batteryLevel = level,
            isCharging = isCharging,
            isUsbCharging = isUsbCharging,
            isAcCharging = isAcCharging
        )

        Log.d(TAG, "Battery: level=$level%, charging=$isCharging, plugged=$plugged")
    }

    private fun updateStorageStatus() {
        try {
            val stat = StatFs(context.cacheDir.path)
            val totalBytes = stat.totalBytes
            val availableBytes = stat.availableBytes
            val freeRatio = if (totalBytes > 0) availableBytes.toDouble() / totalBytes else 1.0

            currentStatus = currentStatus.copy(
                storageAvailable = availableBytes,
                storageTotal = totalBytes,
                freeStorageRatio = freeRatio
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check storage", e)
        }
    }

    /**
     * Peer and transfer counts come out of the encrypted store, which is unreadable while the
     * device is locked. That is a normal condition, not a failure: the last known counts are kept
     * and the next poll picks the real ones up.
     */
    private fun updateConnectionStatus() {
        val counts = runCatching {
            val activeTransfers = listOf(
                TransferState.INITIALIZING,
                TransferState.PREPARING,
                TransferState.TRANSFERRING,
                TransferState.VERIFYING
            ).sumOf { state -> transferRepository.getByState(state).size }
            Triple(peerRepository.getConnected().size, activeTransfers, peerRepository.getAll().size)
        }.getOrElse { error ->
            Log.d(TAG, "Connection counts unavailable: ${error.javaClass.simpleName}")
            return
        }

        currentStatus = currentStatus.copy(
            activeConnections = counts.first,
            activeTransfers = counts.second,
            activePeers = counts.third
        )
    }

    fun updateResourceStatus() {
        updateStorageStatus()
        updateConnectionStatus()
        updateThermalStatus()

        val condition = calculateCurrentCondition()
        if (condition != currentStatus.condition) {
            currentStatus = currentStatus.copy(condition = condition)
            Log.i(TAG, "Resource condition changed to: $condition")
            conditionListeners.forEach { listener -> runCatching { listener(condition) } }
        }
    }

    private fun updateThermalStatus() {
        val thermalStatus = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            runCatching {
                (context.getSystemService(Context.POWER_SERVICE) as PowerManager).currentThermalStatus
            }.getOrDefault(0)
        } else {
            0
        }
        currentStatus = currentStatus.copy(thermalStatus = thermalStatus)
    }

    private fun calculateCurrentCondition(): ResourceCondition {
        val status = currentStatus

        // Critical conditions take precedence
        if (status.thermalStatus >= THERMAL_STATUS_SEVERE) {
            return ResourceCondition.CRITICAL
        }

        if (status.batteryLevel <= CRITICAL_BATTERY_THRESHOLD && !status.isCharging) {
            return ResourceCondition.CRITICAL
        }

        if (status.freeStorageRatio <= CRITICAL_STORAGE_THRESHOLD) {
            return ResourceCondition.CRITICAL
        }

        // Charging always allows normal operation
        if (status.isCharging) {
            return ResourceCondition.CHARGING
        }

        // Constrained conditions
        if (status.batteryLevel <= LOW_BATTERY_THRESHOLD) {
            return ResourceCondition.CONSTRAINED
        }

        if (status.freeStorageRatio <= LOW_STORAGE_THRESHOLD) {
            return ResourceCondition.CONSTRAINED
        }

        if (status.thermalStatus >= THERMAL_STATUS_MODERATE) {
            return ResourceCondition.CONSTRAINED
        }

        if (status.activeConnections >= MAX_CONNECTIONS) {
            return ResourceCondition.CONSTRAINED
        }

        if (status.activeTransfers >= MAX_CONCURRENT_TRANSFERS) {
            return ResourceCondition.CONSTRAINED
        }

        return ResourceCondition.NORMAL
    }

    fun getCurrentStatus(): ResourceStatus = currentStatus.copy()
    fun getCurrentCondition(): ResourceCondition = currentStatus.condition

    /**
     * Check if a new transfer can be started
     */
    fun canStartTransfer(isUserInitiated: Boolean = false): GovernorAction {
        val condition = currentStatus.condition

        if (isUserInitiated) {
            // User-initiated operations have higher priority
            return when (condition) {
                ResourceCondition.CRITICAL -> GovernorAction.THROTTLE
                else -> GovernorAction.ALLOW
            }
        }

        return when (condition) {
            ResourceCondition.CRITICAL -> GovernorAction.DENY
            ResourceCondition.CONSTRAINED -> {
                if (currentStatus.activeTransfers >= MAX_BACKGROUND_TRANSFERS) {
                    GovernorAction.DENY
                } else {
                    GovernorAction.THROTTLE
                }
            }
            else -> GovernorAction.ALLOW
        }
    }

    /**
     * Check if hashing operations can run
     */
    fun canHashContent(count: Int): GovernorAction {
        val condition = currentStatus.condition

        return when (condition) {
            ResourceCondition.CRITICAL -> GovernorAction.DENY
            ResourceCondition.CONSTRAINED -> {
                if (count > MAX_CONCURRENT_HASHERS) {
                    GovernorAction.THROTTLE
                } else {
                    GovernorAction.ALLOW
                }
            }
            else -> GovernorAction.ALLOW
        }
    }

    /**
     * Check if replication can occur
     */
    fun canReplicate(isUserInitiated: Boolean = false): GovernorAction {
        val condition = currentStatus.condition

        // Replication is background operation, so be more restrictive
        return when (condition) {
            ResourceCondition.CRITICAL -> GovernorAction.DENY
            ResourceCondition.CONSTRAINED -> {
                if (isUserInitiated) GovernorAction.ALLOW else GovernorAction.THROTTLE
            }
            else -> GovernorAction.ALLOW
        }
    }

    /**
     * Check if a new peer connection can be accepted
     */
    fun canAcceptConnection(): GovernorAction {
        val condition = currentStatus.condition

        return when (condition) {
            ResourceCondition.CRITICAL -> GovernorAction.DENY
            ResourceCondition.CONSTRAINED -> {
                if (currentStatus.activeConnections >= MAX_CONNECTIONS) {
                    GovernorAction.DENY
                } else {
                    GovernorAction.ALLOW
                }
            }
            else -> GovernorAction.ALLOW
        }
    }

    /**
     * Check if background swarm operations should run
     */
    fun canRunBackgroundSwarm(): GovernorAction {
        val condition = currentStatus.condition

        return when (condition) {
            ResourceCondition.CRITICAL -> GovernorAction.DENY
            ResourceCondition.CONSTRAINED -> GovernorAction.THROTTLE
            else -> GovernorAction.ALLOW
        }
    }

    /**
     * Get throttle factor based on current conditions
     */
    fun getThrottleFactor(): Double {
        return when (currentStatus.condition) {
            ResourceCondition.CRITICAL -> 0.25
            ResourceCondition.CONSTRAINED -> 0.5
            ResourceCondition.CHARGING -> 1.5
            else -> 1.0
        }
    }

    /**
     * Check if the system is in a critical state where operations should be paused
     */
    fun isCritical(): Boolean = currentStatus.condition == ResourceCondition.CRITICAL

    /**
     * Check if the system is constrained
     */
    fun isConstrained(): Boolean =
        currentStatus.condition == ResourceCondition.CONSTRAINED ||
        currentStatus.condition == ResourceCondition.CRITICAL

    /**
     * Clean up and release resources
     */
    fun cleanup() {
        stopMonitoring()
    }
}
