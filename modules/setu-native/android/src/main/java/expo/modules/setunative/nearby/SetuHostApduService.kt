package expo.modules.setunative.nearby

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

class SetuHostApduService : HostApduService() {
    companion object {
        private val executor = ThreadPoolExecutor(
            1,
            1,
            0L,
            TimeUnit.MILLISECONDS,
            ArrayBlockingQueue(1),
            { runnable -> Thread(runnable, "Setu-NFC-APDU").apply { isDaemon = true } },
        )
        private val selectHeader = byteArrayOf(0x00, 0xA4.toByte(), 0x04, 0x00)
        private val aid = byteArrayOf(0xF0.toByte(), 0x53, 0x45, 0x54, 0x55, 0x01)
        private val success = byteArrayOf(0x90.toByte(), 0x00)
        private val notFound = byteArrayOf(0x6A.toByte(), 0x82.toByte())
        private val invalid = byteArrayOf(0x6A.toByte(), 0x80.toByte())
    }

    @Volatile
    private var selected = false

    override fun processCommandApdu(commandApdu: ByteArray, extras: Bundle?): ByteArray? {
        if (commandApdu.size >= 5 && commandApdu.copyOfRange(0, 4).contentEquals(selectHeader)) {
            val aidLength = commandApdu[4].toInt() and 0xff
            selected = aidLength == aid.size && commandApdu.size == 6 + aidLength &&
                commandApdu.copyOfRange(5, 5 + aidLength).contentEquals(aid)
            return if (selected) success else notFound
        }

        if (!selected || commandApdu.size < 6 || commandApdu[1] != 0x10.toByte()) return notFound
        val payloadLength = commandApdu[4].toInt() and 0xff
        if (payloadLength == 0 || commandApdu.size != 6 + payloadLength) return invalid
        val readerToken = commandApdu.copyOfRange(5, 5 + payloadLength)

        return try {
            executor.execute {
                val response = try {
                    SetuNfcManager.exchangeFromHost(readerToken) + success
                } catch (_: Exception) {
                    invalid
                }
                sendResponseApdu(response)
            }
            null
        } catch (_: RejectedExecutionException) {
            invalid
        }
    }

    override fun onDeactivated(reason: Int) {
        selected = false
    }
}
