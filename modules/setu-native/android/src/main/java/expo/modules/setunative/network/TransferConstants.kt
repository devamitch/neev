package expo.modules.setunative.network

internal object TransferConstants {
    const val MANIFEST_VERSION = 1
    const val PIECE_SIZE = 4 * 1024 * 1024
    const val MAX_PIECES = 16_384
    const val MAX_FILE_SIZE = PIECE_SIZE.toLong() * MAX_PIECES
    const val MAX_MANIFEST_BYTES = 1024 * 1024
    const val MAX_PENDING_INCOMING = 4
    const val MAX_QUEUED_OUTGOING = 4
    const val OPERATION_TIMEOUT_MS = 60_000L
    const val STORAGE_MARGIN_BYTES = 32L * 1024 * 1024
    const val TRANSFER_TMP_DIR = "transfer_tmp"
    const val LIBRARY_DIR = "library"
}
