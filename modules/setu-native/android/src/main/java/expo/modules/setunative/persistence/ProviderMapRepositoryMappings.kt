package expo.modules.setunative.persistence

import android.database.Cursor
import expo.modules.setunative.models.*

internal object ProviderMapRepositoryMappings {

    fun mapEntry(cursor: Cursor, dbHelper: SetuDatabase): ProviderMapEntry {
        val manifestId = cursor.getString(cursor.getColumnIndexOrThrow("manifest_id"))
        val pieceIndex = cursor.getInt(cursor.getColumnIndexOrThrow("piece_index"))
        val providerPeerId = cursor.getString(cursor.getColumnIndexOrThrow("provider_peer_id"))
        val isVerified = cursor.getInt(cursor.getColumnIndexOrThrow("is_verified")) == 1
        val lastAdvertisedAt = cursor.getLong(cursor.getColumnIndexOrThrow("last_advertised_at"))

        return ProviderMapEntry(
            manifestId = manifestId,
            pieceIndex = pieceIndex,
            providerPeerId = providerPeerId,
            isVerified = isVerified,
            lastAdvertisedAt = lastAdvertisedAt
        )
    }

    fun Cursor.getLongOrNull(columnIndex: Int): Long? {
        return if (columnIndex >= 0 && !isNull(columnIndex)) getLong(columnIndex) else null
    }
}
