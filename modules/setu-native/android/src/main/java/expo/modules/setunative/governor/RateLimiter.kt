package expo.modules.setunative.governor

import android.util.Log
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/**
 * Rate Limiter for controlling operation frequency.
 * Implements token bucket algorithm for various rate-limited operations.
 */
class RateLimiter(
    private val name: String,
    private val maxRequests: Int,
    private val timeWindowMs: Long,
    private val governor: ResourceGovernor? = null
) {

    companion object {
        private const val TAG = "SETU_RATE_LIMIT"

        // Default rate limits
        private const val DEFAULT_MAX_REQUESTS = 5
        private const val DEFAULT_TIME_WINDOW_MS = 1000L

        // Specific rate limits for different operations
        private val OPERATION_LIMITS = mapOf(
            "PAIR_ATTEMPTS" to Pair(3, 60000L),      // 3 per minute
            "HANDSHAKE" to Pair(10, 60000L),          // 10 per minute
            "AUTHENTICATION" to Pair(5, 60000L),     // 5 per minute
            "CONNECTION_ATTEMPTS" to Pair(8, 10000L), // 8 per 10 seconds
            "MESSAGE_REQUESTS" to Pair(20, 60000L),   // 20 per minute
            "RELAY_FORWARDING" to Pair(50, 60000L),   // 50 per minute
            "EMERGENCY_PROPAGATION" to Pair(10, 10000L), // 10 per 10 seconds
            "MALFORMED_FRAMES" to Pair(20, 60000L),   // 20 per minute
            "HAVE_MESSAGES" to Pair(100, 10000L),     // 100 per 10 seconds
            "WANT_MESSAGES" to Pair(100, 10000L),     // 100 per 10 seconds
            "PIECE_REQUESTS" to Pair(200, 10000L)     // 200 per 10 seconds
        )

        fun create(name: String, governor: ResourceGovernor? = null): RateLimiter {
            val config = OPERATION_LIMITS[name] ?: OPERATION_LIMITS["DEFAULT"]
                ?: Pair(DEFAULT_MAX_REQUESTS, DEFAULT_TIME_WINDOW_MS)
            return RateLimiter(name, config.first, config.second, governor)
        }

        fun createCustom(
            name: String,
            maxRequests: Int,
            timeWindowMs: Long,
            governor: ResourceGovernor? = null
        ): RateLimiter = RateLimiter(name, maxRequests, timeWindowMs, governor)

        private var pairAttemptsLimiter: RateLimiter? = null
        private var handshakeLimiter: RateLimiter? = null
        private var authLimiter: RateLimiter? = null
        private var connectionLimiter: RateLimiter? = null

        fun forPairAttempts(governor: ResourceGovernor?): RateLimiter =
            pairAttemptsLimiter ?: create("PAIR_ATTEMPTS", governor).also { pairAttemptsLimiter = it }

        fun forHandshake(governor: ResourceGovernor?): RateLimiter =
            handshakeLimiter ?: create("HANDSHAKE", governor).also { handshakeLimiter = it }

        fun forAuthentication(governor: ResourceGovernor?): RateLimiter =
            authLimiter ?: create("AUTHENTICATION", governor).also { authLimiter = it }

        fun forConnections(governor: ResourceGovernor?): RateLimiter =
            connectionLimiter ?: create("CONNECTION_ATTEMPTS", governor).also { connectionLimiter = it }
    }

    data class RateLimitConfig(
        val maxRequests: Int,
        val timeWindowMs: Long
    )

    private val timestamps = ConcurrentHashMap<Long, Long>()
    private val requestCounter = AtomicLong(0)
    private var lastCleanup = System.currentTimeMillis()
    private val cleanupIntervalMs = timeWindowMs.coerceAtLeast(5000)

    /**
     * Check if a request is allowed under the rate limit
     */
    fun allow(): Boolean {
        cleanupOldEntries()

        // Check governor state
        governor?.let { gov ->
            if (gov.isCritical()) {
                Log.d(TAG, "$name: Rate limit denied due to critical resource state")
                return false
            }
        }

        val now = System.currentTimeMillis()
        val windowStart = now - timeWindowMs

        val recentRequests = timestamps.values.count { it >= windowStart }

        return if (recentRequests >= maxRequests) {
            Log.w(TAG, "$name: Rate limit exceeded ($recentRequests >= $maxRequests)")
            false
        } else {
            val requestId = requestCounter.incrementAndGet()
            timestamps[requestId] = now
            true
        }
    }

    /**
     * Check if a request is allowed and increment the counter
     */
    fun tryAcquire(): Boolean = allow()

    /**
     * Get remaining requests in current window
     */
    fun getRemainingRequests(): Int {
        cleanupOldEntries()
        val now = System.currentTimeMillis()
        val windowStart = now - timeWindowMs
        val recentRequests = timestamps.values.count { it >= windowStart }
        return (maxRequests - recentRequests).coerceAtLeast(0)
    }

    /**
     * Get time until next request is allowed
     */
    fun getRetryAfterMs(): Long {
        cleanupOldEntries()

        val now = System.currentTimeMillis()
        val windowStart = now - timeWindowMs

        val recentRequests = timestamps.values
            .filter { it >= windowStart }
            .sortedDescending()

        if (recentRequests.size < maxRequests) {
            return 0L
        }

        val oldestRecent = recentRequests.last()
        val timeSinceOldest = now - oldestRecent
        val timeUntilReset = timeWindowMs - timeSinceOldest

        return timeUntilReset.coerceAtLeast(0)
    }

    /**
     * Record a request attempt
     */
    fun recordRequest() {
        cleanupOldEntries()
        val requestId = requestCounter.incrementAndGet()
        timestamps[requestId] = System.currentTimeMillis()
    }

    /**
     * Reset the rate limiter
     */
    fun reset() {
        timestamps.clear()
        requestCounter.set(0)
        Log.d(TAG, "$name: Rate limiter reset")
    }

    /**
     * Clean up old entries from the timestamps map
     */
    private fun cleanupOldEntries() {
        val now = System.currentTimeMillis()

        // Only cleanup periodically
        if (now - lastCleanup < cleanupIntervalMs) {
            return
        }

        lastCleanup = now
        val windowStart = now - timeWindowMs

        val toRemove = timestamps.entries
            .filter { it.value < windowStart }
            .map { it.key }

        for (key in toRemove) {
            timestamps.remove(key)
        }

        if (toRemove.isNotEmpty()) {
            Log.d(TAG, "$name: Cleaned up ${toRemove.size} old rate limit entries")
        }
    }

}
